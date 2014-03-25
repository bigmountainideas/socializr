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
  , T_MAX_TERMS_PER_CONN   = 400


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
 * TwitterConnection constructor
 *
 * @param {Object} appAuth Application credentials from Twitter
 * @param {Object} userAuth User credentials from Twitter
 * @api public
 */
function TwitterConnection(appAuth, userAuth){

  if( !userAuth ||
      !userAuth.hasOwnProperty('user') ||
      !userAuth.hasOwnProperty('token') ||
      !userAuth.hasOwnProperty('secret')
  ){
    throw new Error('Invalid User Authentication info. `user`, `token` and `secret` properties are required.');
  }

  Transform.call(this, {
    objectMode: true
  });

  this._appAuth   = appAuth;
  this._userAuth  = userAuth;

  this._body           = '';
  this._chunkDelimiter = '\r\n';
  this._pressure       = 0;
  this._wasOpened      = false;
  this._ququed         = {};
  this._user           = userAuth.user;

  this._terms      = [];
  this._users      = [];
  this._locations  = [];
};
util.inherits(TwitterConnection, Transform);


/**
  *
  *
  * @param
  * @api public
  * @method open
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype.open = function(){
  if( this._terms.length || this._users.length || this._locations.length){

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

    return this._wasOpened = true;
  }else {
    return false;
  }
};

/**
  *
  *
  * @param
  * @api private
  * @method _createClientRequest
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype._createClientRequest = function(method){
  var conn = this;
  this._req = https.request(
                this._createRequestOptions( T_FILTER_URL, method),
                function(res){
                  conn._connectionResponse(res);
                }
              );
  return this._req;
};


/**
  *
  *
  * @param
  * @api private
  * @method _createRequestOptions
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype._createRequestOptions = function(endpointUrl, endpointMethod){
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
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype._createRequestData = function(encode){
  var data = {};

  if( this._terms.length){
    data.track = this._terms.join(',');
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
  return encode ? qs.stringify(data) : data;
};


/**
  *
  *
  * @param
  * @api private
  * @method _transformLocation
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype._transformLocation = function(loc){
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
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype._connectionResponse = function(res){

  switch( res.statusCode){

    case 200:
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
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype._connectionError = function(res){

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
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype._connected = function(res){
  switch( res.headers['content-encoding']){
    case 'gzip':
      var gunzip = zlib.createGunzip();
      res.pipe(gunzip);
      gunzip.pipe(this);
      break;

    default:
      res.pipe(this);
      break;
  }
};


/**
  *
  *
  * @param
  * @api private
  * @method _transform
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype._transform = function(chunk, encoding, done){
  chunk = chunk.toString();
  if( !chunk.trim().length) return;
  this._body += chunk;
  var nextPart, tweet;
  while( true){
    nextPart = this._body.indexOf(this._chunkDelimiter,0);
    if (nextPart !== -1){
      tweet = this._body.substring(0,nextPart);
      this._body = this._body.substring(nextPart+2);
      try{
        this.push( JSON.parse(tweet.trim()) );
      }catch(err){
        this.emit('error', new Error('Malformed [Tweet Object].'));
        done(err);
        return;
      }
    }else {
      break;
    }
  };
  done();
};


/**
  *
  *
  * @param
  * @api public
  * @method addTerm
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype.addTerm = function(val){
  if( this._terms.indexOf(val)==-1){
    this._terms.push( val);
    this._pressure++;
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method removeTerm
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype.removeTerm = function(val){
  var i = this._terms.indexOf(val);
  if( i!=-1){
    delete this._terms[ i];
    this._pressure--;
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method addUser
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype.addUser = function(val){
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
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype.removeUser = function(val){
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
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype.addLocation = function(val){
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
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype.removeLocation = function(val){
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
  * @memberOf TwitterConnection
  */
TwitterConnection.prototype.close = function(){
  if( this._req){
    this._req.abort();
    this._wasOpened = false;
  }
};






/**
 * Twitter constructor
 *
 * @param {Object} appAuth Application credentials from Twitter
 * @api public
 */
function Twitter(auth){

  Transform.call(this, {
    objectMode: true
  });

  this._auth = auth;
  this._connMap = {};
  this._connByUser = {};
  this.connections = [];
};
util.inherits(Twitter, Transform);


/**
  *
  *
  * @param
  * @api public
  * @method connect
  * @memberOf Twitter
  */
Twitter.prototype.connect = function(auth){
  auth = auth instanceof Array ? auth : [auth];
  var i, conn, self = this;
  for( i in auth){
    conn = new TwitterConnection(this._auth, auth[ i]);
    conn.on('error', function(err){
      self._onError(err, this);
    });
    conn.pipe( this);
    this.connections.push( conn);
    this._connByUser[ auth[ i].user] = conn;
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
Twitter.prototype._transform = function(chunk, encoding, done){

  // TODO: Apply filtering rules here.

  this.push( chunk);
  done();
};

/**
  *
  *
  * @param
  * @api privagte
  * @method _bestAvailableConnection
  * @memberOf Twitter
  */
Twitter.prototype._bestAvailableConnection = function(){
  var p = Number.MAX_VALUE, conn;
  for( var i in this.connections){
    if( Math.min( p, this.connections[i]._pressure)<p){
      conn = this.connections[ i];
    }
  }
  return conn;
};

/**
  *
  *
  * @param
  * @api public
  * @method filter
  * @memberOf Twitter
  */
Twitter.prototype.filter = function(opts){

  return this;
};

/**
  *
  *
  * @param
  * @api privagte
  * @method _add
  * @memberOf Twitter
  */
Twitter.prototype._add = function(val, userConn, fn){
  val = val instanceof Array ? val : [val];
  var i, v, conn;
  for( i in val){
    v = typeof val[ i] == 'string' ? val[ i] : JSON.stringify(val[ i]);
    conn = this._connByUser[ userConn] ||
                this._bestAvailableConnection();
    fn( conn, val[ i]);
    this._connMap[ md5( v)] = conn;
  }
};

/**
  *
  *
  * @param
  * @api privagte
  * @method _remove
  * @memberOf Twitter
  */
Twitter.prototype._remove = function(val, userConn, fn){
  val = val instanceof Array ? val : [val];
  var i, v;
  for( i in val){
    v = typeof v == 'string' ? val[ i] : JSON.stringify(val[ i]);
    this._connMap[ md5( v)] = conn;
    fn( conn, val[ i]);
  }
};

/**
  *
  *
  * @param
  * @api public
  * @method addTerm
  * @memberOf Twitter
  */
Twitter.prototype.addTerm = function(val, userConn){
  this._add( val, userConn, function(conn, val){
    conn.addTerm( val);
  });
  return this;
};

/**
  *
  *
  * @param
  * @api public
  * @method removeTerm
  * @memberOf Twitter
  */
Twitter.prototype.removeTerm = function(val){
  this._remove( val, userConn, function(conn, val){
    conn.removeTerm( val);
  });
  return this;
};

/**
  *
  *
  * @param
  * @api public
  * @method addUser
  * @memberOf Twitter
  */
Twitter.prototype.addUser = function(val, userConn){
  this._add( val, userConn, function(conn, val){
    conn.addUser( val);
  });
  return this;
};

/**
  *
  *
  * @param
  * @api public
  * @method removeUser
  * @memberOf Twitter
  */
Twitter.prototype.removeUser = function(val){
  this._remove( val, userConn, function(conn, val){
    conn.removeUser( val);
  });
  return this;
};

/**
  *
  *
  * @param
  * @api public
  * @method addLocation
  * @memberOf Twitter
  */
Twitter.prototype.addLocation = function(val, userConn){
  this._add( val, userConn, function(conn, val){
    conn.addLocation( val);
  });
  return this;
};

/**
  *
  *
  * @param
  * @api public
  * @method removeLocation
  * @memberOf Twitter
  */
Twitter.prototype.removeLocation = function(val, userConn){
  this._remove( val, userConn, function(conn, val){
    conn.removeLocation( val);
  });
  return this;
};

/**
  * Start streaming data from all the connections.
  *
  * @param
  * @api public
  * @method stream
  * @memberOf Twitter
  */
Twitter.prototype.stream = function(){
  this.connections.forEach(function(conn){
    conn.open()
  });
  return this;
};

/**
  * Close all connections to twitter.com.
  *
  * @api public
  * @method close
  * @memberOf Twitter
  */
Twitter.prototype.close = function(){
  this.connections.forEach(function(conn){
    conn.close();
  });
  return this;
};


/**
  *
  * Export lib
  */
module.exports = Twitter;
