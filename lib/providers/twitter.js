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
  if( this._tags.length || this._users.length || this._locations.length){

    var method = 'GET';

    this._createClientRequest(method);

    if( method=='POST'){
      this._req.end(
        this._createRequestData(true),
        'utf8'
      );
    }else {
      this._req.end();
    }

    this._lastAttempted = Date.now();
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

  console.log("reconnecting",reason);

  this.close();
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
      break;

    default:
      delay = 1000;
      break;
  }
  setTimeout(function(){
    this.open();
  }.bind(this), delay);
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
  this._req = https.request(
                this._createRequestOptions( T_FILTER_URL, method),
                function(res){
                  this._connectionResponse(res);
                }.bind(this)
              );
  this._req.on('error', function(e){
    this._fails++;
    this._tcpError(e);
  }.bind(this));
  return this._req;
};



TwitterStream.prototype._tcpError = function(e){

  console.log("tcp error");

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

  console.log(res.statusCode);

  switch( res.statusCode){

    case 200:
      this._lastConnected = Date.now();
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

  this.emit('error', err);
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

  console.log( res.headers, res.statusCode);
  this._res = res;

  switch( res.headers['content-encoding']){
    case 'gzip':
      console.log("creating unzip pipe");

      this._body = '';

      this._gunzip = zlib.createGunzip();
      this._res
        .pipe(this._gunzip)
        .pipe(this);

      // var self = this;
      // this._gunzip.on('data', function(chunk){
      //   if( chunk.toString().trim().length){
      //     self.write( chunk.toString(), 'utf8');
      //   }else {
      //     console.log( "keep-alive", chunk);
      //   }
      // });

      console.log("unzip piped");
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
    this._res.unpipe( this._gunzip);
    this._gunzip.unpipe(this);
    this._res = this._gunzip = null;
  }
};


TwitterStream.prototype._handleStall = function(){

  console.log( this._writableState, this._readableState);
  console.log( this._res._readableState);

  console.log("twitter connection stalling");

  this.emit('stall');
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

  console.log("data chunk");

  this._resetStallTimer();
  this._dataReceived = Date.now();
  chunk = chunk.toString();

  if( chunk.trim().length){
    this._body += chunk;
    var nextPart, tweet;
    while( true){
      nextPart = this._body.indexOf(T_STREAM_CHUNK_DELIMITER,0);
      if (nextPart !== -1){
        tweet = this._body.substring(0,nextPart);
        this._body = this._body.substring(nextPart+2);
        try{
          this.push(JSON.parse(tweet.trim()));
          console.log('pushed new data to stream successfully');
        }catch(err){
          console.log('data error');
          this.emit('error', new Error('Malformed [Tweet Object].'));
          done(err);
          return;
        }
      }else {
        break;
      }
    };
  }
  done();
};

/**
  *
  *
  */
TwitterStream.prototype.addData = function(data){
  if( data.hasOwnProperty('tag')){
    this.addTag( data.tag);
  }
  if( data.hasOwnProperty('user')){
    this.addUser( data.user);
  }
  if( data.hasOwnProperty('location')){
    this.addLocation( data.location);
  }
  if( data.hasOwnProperty('language')){
    this.language = data.language;
  }
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
  if( this._req){
    this._req.abort();
    this._req = null;
    this._unpipeResponseStreams();
  }
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
  // this._connMap = {};
  // this._connByUser = {};
  // this.connections = [];

  this._filters = options.filters || [];
};
util.inherits(Twitter, Transform);


/**
  *
  *
  * @param
  * @api public
  * @method connection
  * @memberOf Twitter
  */
// Twitter.prototype.connection = function(auth, create){
//   var authStr = typeof auth == 'string' ? auth : JSON.stringify(auth)
//     , conn = this._connByUser[ authStr]
//   ;
//   if( !conn&&!create){
//     return null;
//   }else if(!conn&&create) {
//     conn = new TwitterStream(this._auth, auth[ i]);
//     conn.network = this;
//     this._connByUser[ auth[ i].user] = conn;
//     this.connections.push( conn);
//     this._connMap[ md5( authStr)] = conn;
//   }
//   return conn;
// };


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
Twitter.prototype.stream = function(request, auth){
  auth = auth instanceof Array ? auth : [auth];
  var i, strm, self = this;
  for( i in auth){
    strm = new TwitterStream(this._auth, auth[ i]);
    strm.addData( request);
    strm.on('error', function(err){
      self._onError(err, this);
    });
    strm.pipe( this);
    strm.open();

    // strm.on('data', function(data){
    //   console.log("transformed:",data);
    // });
    // strm.on('readable', function(){
    //   var msg;
    //   while( null !== (msg = strm.read()) ){
    //     console.log("transformed:",msg);
    //   }
    // });
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
  this.emit('error', err, conn);
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
    if( !cb()){
      pass = false;
      return false;
    }
  });
  pass&&this.push(data);
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
