/*!
 * Module dependencies.
 */
var https    = require('https')
  , stream   = require('stream')
  , util     = require('util')
  , zlib     = require('zlib')
  , crypto   = require('crypto')
  , url      = require('url')
  , qs       = require('querystring')
  , events   = require('events') 
  , uuid     = require('node-uuid')

  , Transform = stream.Transform

/**
 * Internal OAuth helper lib
 */
  , oauth    = require('../auth/oauth1a')

/**
 * Package info
 */
  , pkg = require('../../package')


/**
 * Maximum number of terms each connection can handle
 */
  , T_MAX_tags_PER_CONN   = 400


/**
 * Maximum number of users each connection can handle
 */
  , T_MAX_FOLLOWS_PER_CONN = 5000



/**
 * URL for handling Twitter streams. This is the primary
 * source of data. All connections start by requesting
 * this endpoint then fallback to others based on different
 * application or response criteria.
 *
 */
  , T_FILTER_URL       = 'https://userstream.twitter.com/1.1/statuses/filter.json'

/**
 * URL for handling Twitter search requests
 */
  , T_SEARCH_URL       = 'https://api.twitter.com/1.1/search/tweets.json'

/**
 * URL for handling Twitter User streams
 */
  , T_USER_STREAM_URL  = 'https://userstream.twitter.com/1.1/user.json'

  , T_STALL_TIMEOUT = 90000

  , T_STREAM_CHUNK_DELIMITER = '\r\n'

  , T_MIN_RECONNECT_CYCLE_COUNT = 3

  , T_CONNERR_TCP = 1

  , T_CONNERR_RATELIMIT = 2

  , T_CONNERR_UNAVAIL = 3

  , T_ERRTCP_RECONNECT_INCEREMENT = 250

  , T_ERRTCP_RECONNECT_MAX_TIME = 16000

  , T_RECONNECT_MIN_TIME = 20000

  , T_CONNERR_UNAVAIL = new Error('Twitter server seems to be unavailable. ')
;

/**
 * Create md5 hashes of the provided string.
 *
 * @param {String} str
 * @return {String} MD5 hash of input value
 */
function md5(str){
  var md5 = crypto.createHash('md5');
  md5.update(str);
  return md5.digest('hex');
}

/**
 * Parse Host name portion of URI
 *
 * @param {String} uri
 * @return {String} Hostname of URI
 */
function hostname(uri){
  return url.parse(uri).hostname;
}

/**
 * Parse Path only portion of URI
 *
 * @param {String} uri
 * @return {String} Pathname of URI
 */
function path(uri){
  return url.parse(uri).pathname;
}



/**
 * TwitterStream constructor
 *
 * @param {Object} appAuth Application credentials from Twitter
 * @param {Object} userAuth User credentials from Twitter
 * @api public
 */
function TwitterStream(appAuth, userAuth){

  if( !appAuth ||
      !appAuth.hasOwnProperty('key') ||
      !appAuth.hasOwnProperty('secret')
  ){
    throw new Error('Invalid App/Client Authentication info. `key` and `secret` properties are required.');
  }

  if( !userAuth ||
      !userAuth.hasOwnProperty('user') ||
      !userAuth.hasOwnProperty('token') ||
      !userAuth.hasOwnProperty('secret')
  ){
    throw new Error('Invalid User Authentication info. `user`, `token` and `secret` properties are required.');
  }

  Transform.call(this, {
  });

  this._writableState.objectMode = false;
  this._readableState.objectMode = true;

  this._appAuth   = appAuth;
  this._userAuth  = userAuth;

  this._pressure       = 0;
  
  this._body               = '';
  this._stid               = -1;
  this._fails              = 0;
  this._lastConnected      = 0;
  this._lastConnAttempted  = 0;
  this._dataReceived       = 0;

  this._tags      = [];
  this._users      = [];
  this._locations  = [];
};
util.inherits(TwitterStream, Transform);


/**
  *
  *
  * @param
  * @api public
  * @method open
  * @memberOf TwitterStream
  */
TwitterStream.prototype.open = function(){
  // if( this._dataSignature == this._calculateDataSignature()){
  //   console.log("duplicate data request for stream");
  //   return;
  // }

  if( (this._connecting&&!this._reconnectDelay) || (this._lastConnected && (Date.now()-this._lastConnected) < T_RECONNECT_MIN_TIME)){
    this._reconnect();
  }else if( !this._connecting && !this._reconnectDelay && (this._tags.length || this._users.length || this._locations.length)){

    // console.log("opening new request");
    this.close();
    this._connecting = true;
    this._cancelDelayedReconnection();

    var method = 'GET';

    this._createClientRequest(method);
    this._dataSignature = this._calculateDataSignature();

    // console.log(this._dataSignature);

    if( method=='POST'){
      this._req.end(
        this._createRequestData(true),
        'utf8'
      );
    }else {
      this._req.end();
    }
    return true;
  }else {
    return false;
  }
};


TwitterStream.prototype._resetFails = function(){
  this._fails = 0;
};


/**
  *
  *
  * @param
  * @api private
  * @method close
  * @memberOf TwitterStream
  */
TwitterStream.prototype._reconnect = function(reason){

  // console.log("reconnecting",reason);
  if( (!arguments.length && this._reconnectDelay) || (reason!=T_CONNERR_RATELIMIT && this._isRateLimited) || this._connecting){
    // console.log("deny reconnection attempt");
    return;
  }
  // 

  var delay;
  switch(reason){
    case T_CONNERR_UNAVAIL:
      delay = (Math.pow(this._fails,2))*5000;
      if( delay>320000){
        throw T_ERR_CONN_UNAVAIL;
        return;
      }
      break;

    case T_CONNERR_RATELIMIT:
      delay = (Math.pow(this._fails,2))*60000;
      // console.log("rate limit delay", delay);
      break;

    default:
      delay = T_RECONNECT_MIN_TIME;
      break;
  }
  
  this._cancelDelayedReconnection();
  this._reconnectDelay = setTimeout(function(){
    this._reconnectDelay = null;
    this.close();
    process.nextTick(function(){
      // console.log("executing reconnect after timeout", reason);
      this.open();
    }.bind(this));
  }.bind(this), delay);
};

TwitterStream.prototype._cancelDelayedReconnection = function(){
  clearTimeout( this._reconnectDelay);
};

/**
  *
  *
  * @param
  * @api private
  * @method _createClientRequest
  * @memberOf TwitterStream
  */
TwitterStream.prototype._createClientRequest = function(method){
  this._body = '';
  this._req = https.request(
                this._createRequestOptions( T_FILTER_URL, method),
                function(res){
                  this._connectionResponse(res);
                }.bind(this)
              );
  this._req.on('error', function(e){
    this._lastConnected = Date.now();
    this._connecting = false;
    this._fails++;
    this._tcpError(e);
  }.bind(this));
  return this._req;
};



TwitterStream.prototype._tcpError = function(e){

  // console.log("tcp error",e);

  var wait = this._fails*T_ERRTCP_RECONNECT_INCEREMENT;
  if( wait<T_ERRTCP_RECONNECT_MAX_TIME){
    setTimeout(function(){
      this._reconnect(T_CONNERR_TCP);
    }.bind(this), wait);
  }else {
    // fallback to manual requests
  }
};




/**
  *
  *
  * @param
  * @api private
  * @method _createRequestOptions
  * @memberOf TwitterStream
  */
TwitterStream.prototype._createRequestOptions = function(endpointUrl, endpointMethod){
  var method = endpointMethod || 'GET'
    , auth = oauth.createAuthHeaders({
        method:  method,
        url:     endpointUrl,
        data:    this._createRequestData(),

        appKey:     this._appAuth.key,
        appSecret:  this._appAuth.secret,

        token:       this._userAuth.token,
        tokenSecret: this._userAuth.secret
      })
  ;


  var qs = '';
  if( method == 'GET'){
    qs = '?' + this._createRequestData(true);
  }

  return {
    hostname: hostname( T_FILTER_URL),
    path:     path( T_FILTER_URL) + qs,
    method:   method,
    headers: {
      'Authorization':    auth,
      'User-Agent':       pkg.name + ' v' + pkg.version,
      'Content-Type':     'application/x-www-form-urlencoded;charset=UTF-8',
      'Accept-Encoding':  'gzip',
      'Connection':       'keep-alive'
    },

    /* Disable agent pooling */
    agent: false
  };
};


/**
  *
  *
  * @param
  * @api private
  * @method _createRequestData
  * @memberOf TwitterStream
  */
TwitterStream.prototype._createRequestData = function(encode){
  var data = {
    stall_warnings: true
  };

  if( this._tags.length){
    data.track = this._tags.join(',');
  }

  if( this._users.length){
    data.follow = this._users.join(',');
  }

  if( this._locations.length){
    var loc = this._locations, locs = [];
    for( var i in loc){
      locs.push( this._transformLocation( loc[ i]));
    }
    data.locations = locs.join(',');
  }

  if(this.language){
    data.language = this.language;
  }
  return encode ? qs.stringify(data) : data;
};


/**
  *
  *
  * @param
  * @api private
  * @method _transformLocation
  * @memberOf TwitterStream
  */
TwitterStream.prototype._transformLocation = function(loc){
  return [
    loc.sw.lng,
    loc.sw.lat,
    loc.ne.lng,
    loc.ne.lat
  ].join(',');
};


/**
  *
  *
  * @param
  * @api private
  * @method _connectionResponse
  * @memberOf TwitterStream
  */
TwitterStream.prototype._connectionResponse = function(res){

  // console.log(res.statusCode);
  this._lastConnected = Date.now();
  this._connecting = false;
  
      
  switch( res.statusCode){

    case 200:
      this._isRateLimited = false;
      this._resetFails();
      this._connected( res);
      break;

    default:
      this._connectionError( res);
      break;
  }

};


/**
  *
  *
  * @param
  * @api private
  * @method _connectionError
  * @memberOf TwitterStream
  */
TwitterStream.prototype._connectionError = function(res){

  var err;
  switch( res.statusCode){

    case 401:
      err = {
        code: 401,
        message: 'Unauthorized'
      };
      break;

    case 420:
      err = {
        code: 420,
        message: 'Rate limited'
      };
      this._isRateLimited = true;
      this._reconnect( T_CONNERR_RATELIMIT);
      break;

    case 503:
      err = {
        code: 503,
        message: 'Service Unavailable'
      };
      this._reconnect( T_CONNERR_UNAVAIL);
      break;

    default:
      err = {
        code: res.statusCode,
        message: 'Error connecting.'
      };
      break;
  }
  this._fails++;
  this.close();
  this.emit('warning', err);
};


/**
  *
  *
  * @param
  * @api private
  * @method _connected
  * @memberOf TwitterStream
  */
TwitterStream.prototype._connected = function(res){

  // console.log( res.headers, res.statusCode);
  this._res = res;

  switch( res.headers['content-encoding']){
    case 'gzip':
      this._gunzip = zlib.createGunzip();
      this._res
        .pipe(this._gunzip)
        .pipe(this);
      break;

    default:
      this._res.pipe(this);
      break;
  }
};


TwitterStream.prototype._resetStallTimer = function(){
  var strm = this;
  clearTimeout(this._stid);
  this._stid = setTimeout(function(){
    strm._handleStall();
  }, T_STALL_TIMEOUT);
};


TwitterStream.prototype._unpipeResponseStreams = function(){
  if( this._res&&this._gunzip){
    // console.log("cleaning up internal piped streams");
    this._res.unpipe( this._gunzip);
    this._gunzip.unpipe(this);
    this._res = this._gunzip = null;
  }
};


TwitterStream.prototype._handleStall = function(){
  this.emit('stall', this);
  var cc = 0, self = this;
  (function tick(){
    if(++cc>T_MIN_RECONNECT_CYCLE_COUNT){
      self._reconnect();
    }else{
      process.nextTick(tick.bind(self));
    }
  })();
};



/**
  *
  *
  * @param
  * @api private
  * @method _transform
  * @memberOf TwitterStream
  */
TwitterStream.prototype._transform = function(chunk, encoding, done){

  // console.log("data chunk");

  this._resetStallTimer();
  this._dataReceived = Date.now();
  chunk = chunk.toString();

  if( chunk.trim().length){
    this._body += chunk;
    var nextPart, tweet;
    while( true){
      nextPart = this._body.indexOf(T_STREAM_CHUNK_DELIMITER,0);
      if (nextPart !== -1){
        tweet = this._body.substring(0,nextPart+2);
        this._body = this._body.substring(nextPart+2);
        try{
          tweet = JSON.parse( tweet.trim());
          this.push(tweet);
          // console.log('pushed new data to stream successfully');
        }catch(err){
          this._body = '';
          // console.log('data error', tweet, err);
          this.emit('warning', err, this);
          done();
          return;
        }
      }
      else {
        break;
      }
    };
  }
  // console.log("_transform done");
  done();
};

/**
  *
  *
  */
TwitterStream.prototype.addData = function(data){
  if( data.hasOwnProperty('tags')){
    if( data.tags instanceof Array ){
      for( var tag in data.tags){
        this.addTag( data.tags[tag]);
      }
    }else {
      this.addTag( data.tags);
    }
  }
  if( data.hasOwnProperty('users')){
    if( data.users instanceof Array ){
      for( var user in data.users){
        this.addUser( data.users[user]);
      }
    }else {
      this.addUser( data.users);
    }
  }
  if( data.hasOwnProperty('locations')){
    if( data.locations instanceof Array ){
      for( var locations in data.locations){
        this.addLocation( data.locations[location]);
      }
    }else {
      this.addLocation( data.locations);
    }
  }
  if( data.hasOwnProperty('language')){
    this.language = data.language;
  }
};


TwitterStream.prototype._calculateDataSignature = function(){
  return new Buffer([
    this._tags.sort().join(),
    this._users.sort().join(),
    this._locations.sort().join(),
    this.language||''
  ].join('.'))
  .toString('base64');
};

/**
  *
  *
  * @param
  * @api public
  * @method addTerm
  * @memberOf TwitterStream
  */
TwitterStream.prototype.addTag = function(val){
  if( this._tags.indexOf(val)==-1){
    this._tags.push( val);
    this._pressure++;
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method removeTerm
  * @memberOf TwitterStream
  */
TwitterStream.prototype.removeTag = function(val){
  var i = this._tags.indexOf(val);
  if( i!=-1){
    delete this._tags[ i];
    this._pressure--;
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method addUser
  * @memberOf TwitterStream
  */
TwitterStream.prototype.addUser = function(val){
  if( this._users.indexOf(val)==-1){
    this._users.push( val);
    this._pressure++;
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method removeUser
  * @memberOf TwitterStream
  */
TwitterStream.prototype.removeUser = function(val){
  var i = this._users.indexOf(val);
  if( i!=-1){
    delete this._users[ i];
    this._pressure--;
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method addLocation
  * @memberOf TwitterStream
  */
TwitterStream.prototype.addLocation = function(val){
  if( this._locations.indexOf(val)==-1){
    this._locations.push( val);
    this._pressure++;
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method removeLocation
  * @memberOf TwitterStream
  */
TwitterStream.prototype.removeLocation = function(val){
  var i = this._locations.indexOf(val);
  if( i!=-1){
    delete this._locations[ i];
    this._pressure--;
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method close
  * @memberOf TwitterStream
  */
TwitterStream.prototype.close = function(){
  this._body = '';
  if( this._req){
    try{
      this._req.abort();
      // console.log("request aborted");
    }catch(err){
      // console.log("error closing request",err)
    }
    this._req = null;
  }
  this._unpipeResponseStreams();
};







/**
 * Twitter constructor
 *
 * @param {Object} appAuth Application credentials from Twitter
 * @api public
 */
function Twitter(auth,options){

  Transform.call(this, {
    objectMode: true
  });
  
  this._auth = auth;
  this._streamByAuth = {};
  this._filters = options.filters || [];

  this.uuid = uuid.v1();

  console.log(this.uuid);
};
util.inherits(Twitter, Transform);


/**
  *
  *
  * @param
  * @api public
  * @method getStreamForAuth
  * @memberOf Twitter
  */
Twitter.prototype.getStreamForAuth = function(auth){
  return this._streamByAuth[ this._serializeAuth(auth)];
};


Twitter.prototype._saveStreamForAuth = function(auth,strm){
  this._streamByAuth[ this._serializeAuth(auth)] = strm;
};

Twitter.prototype._serializeAuth = function(auth){
  return [auth.user,auth.token,auth.secret].join(':');
};

/**
  *
  *
  * @param
  * @api public
  * @method connection
  * @memberOf Twitter
  */
Twitter.prototype.auth = function(auth){
  auth._provider = this;
  return auth;
};


/**
  *
  *
  * @param
  * @api public
  * @method connect
  * @memberOf Twitter
  */
Twitter.prototype.stream = function(request, auth, socializr){
  auth = auth instanceof Array ? auth : [auth];
  var i, strm, self = this;
  for( i in auth){
    strm = this.getStreamForAuth(auth[ i]);
    if( !strm){
      strm = new TwitterStream(this._auth, auth[ i]);
      strm.uuid = this.uuid;
      this._saveStreamForAuth( auth[ i], strm);
      strm.on('warning', this._onError.bind(this));
      strm.pipe( this);

      if( socializr){
        this.pipe( socializr);
        this.on('warning', socializr._onError.bind(socializr));
      }
    }
    strm.addData( request);
    strm.open();
  }
  return this;
};

/**
  *
  *
  * @param
  * @api privagte
  * @method _onError
  * @memberOf Twitter
  */
Twitter.prototype._onError = function(err, conn){
  this.emit('warning', err, conn);
};

/**
  *
  *
  * @param
  * @api privagte
  * @method _transform
  * @memberOf Twitter
  */
Twitter.prototype._transform = function(data, encoding, done){
  var pass = true;
  this._filters.forEach( function(cb){
    if( !cb(data)){
      pass = false;
      return false;
    }
  });
  pass&&this.push(data);

  // console.log("data passed",pass);

  done();
};

/**
  * Start streaming data from all the connections.
  *
  * @param
  * @api public
  * @method stream
  * @memberOf Twitter
  */
// Twitter.prototype.stream = function(){
//   this.connections.forEach(function(conn){
//     conn.open()
//   });
//   return this;
// };

/**
  * Close all connections to twitter.com.
  *
  * @api public
  * @method close
  * @memberOf Twitter
  */
// Twitter.prototype.closeAll = function(){
//   this.connections.forEach(function(conn){
//     conn.close();
//   });
//   return this;
// };


/**
  *
  * Export lib
  */
module.exports = Twitter;
