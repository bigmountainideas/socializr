var stream   = require('stream')
  , util     = require('util')
  , zlib     = require('zlib')
  , https    = require('https')
  , url      = require('url')
  , qs       = require('querystring')
  , events   = require('events')
  , _        = require('underscore') 
  , Scheduler = require('pragma-scheduler')
  , uuid     = require('node-uuid')
  , Message = require('../message')
  , Transform = stream.Transform



  /**
   * Package info
   */
  , pkg = require('../../package')

;


function GooglePlus(options){
  options = _.extend({
    filters: []
  },options);

  Transform.call(this, {
    objectMode: true
  });
  this._apiKey = options.key;

  this._pageLimit = options.pages || 5;
  this._pageToken = null;
  this._pageCount = 0;
  this._refreshRate = options.refresh || 15000;
  this._filters = options.filters;

  this.uuid = uuid.v1();

  this._timer = new Scheduler(0, this._refreshRate, function(){
    this._page();
  }.bind(this));
  this._timer.start();

};
util.inherits(GooglePlus, Transform);


GooglePlus.prototype.request = function(endpointUrl, method, data){
  this._req = https.request(
    this._createRequestOptions( endpointUrl, method, data),
    this._connectionResponse.bind(this)
  );
  this._req.end();
};

GooglePlus.prototype._createRequestOptions = function(endpointUrl, endpointMethod, data){

  this._prevRequest = arguments;

  var method = endpointMethod || 'GET'
    , _uri = url.parse(endpointUrl)
    , _qs = ''
  ;

  if( method == 'GET'){
    _qs = '?' + qs.stringify({
      key: this._apiKey,
      orderBy: 'recent',
      maxResults: 20,
      pageToken: this._pageToken || '',
      query: data.tags&&data.tags.join('|')
    });

    console.log( _qs)
  }

  return {
    hostname: _uri.hostname,
    path:     _uri.pathname + _qs,
    method:   method,
    headers: {
      'User-Agent':       pkg.name + ' v' + pkg.version,
      'Content-Type':     'application/x-www-form-urlencoded;charset=UTF-8',
      'Accept-Encoding':  'gzip',
      'Connection':       'keep-alive'
    },

    /* Disable agent pooling */
    agent: false
  };
};

GooglePlus.prototype._connectionResponse = function(res){
      
  // console.log( res.headers, res.statusCode);

  switch( res.statusCode){

    case 200:
      this._connected( res);
      break;

    default:
      this._connectionError( res);
      break;
  }

};

GooglePlus.prototype._connected = function(res){

  this._res = res;
  var body = '';
  switch( res.headers['content-encoding']){
    case 'gzip':
      this._gunzip = zlib.createGunzip();
      
      this._gunzip.on('data', function(data){
        body += data.toString();
      });

      this._gunzip.on('end', function(){
        this._pipeResponse(body);
      }.bind(this));

      this._res.pipe(this._gunzip);
      break;

    default:

      res.on('data', function(chunk) {
        body += chunk
      });

      res.on('end', function(){
        this._pipeResponse(body);
      }.bind(this));

      break;
  }
};

GooglePlus.prototype._page = function(){
  if (this._prevResponse) {
    if( this._prevResponse.nextPageToken!=this._pageToken){
      this._pageToken = this._prevResponse.nextPageToken;
      this.request.apply(this, this._prevRequest);
    }else{
      this._pageToken = null;
    }
  }
};


GooglePlus.prototype._pipeResponse = function(data){
  this._prevResponse = data = JSON.parse(data);
  if( data && data.items){
    for (var i = data.items.length - 1; i >= 0; i--) {
      this.write(JSON.stringify(data.items[i]), 'utf8');
    };
  }
};


GooglePlus.prototype._connectionError = function(res){
  console.log(res.body);
  this.emit('warning', new Error(res.statusCode));
};


GooglePlus.prototype.auth = function(auth){
  auth._provider = this;
  return auth;
};

GooglePlus.prototype._transform = function(data,encoding,done){
  try {
    data = JSON.parse(data);
    if( this.include(data)){
      this.push(
        new Message( this, data )
      );
    }
  }catch(err){
    console.log(err);
    this.emit('warning', new Error(err));
  }
  done();
};


GooglePlus.prototype.include = function(data){
  var pass = true;
  this._filters.forEach( function(cb){
    if( !cb(data)){
      pass = false;
      return false;
    }
  });
  return pass;
};


GooglePlus.prototype.stream = function(request, auth, socializr){
  if( !this._piped){
    this._piped = true;
    this.pipe( socializr);
    this.on('warning', socializr._onError.bind(socializr));
  }
  this._pageToken = null;
  this.request('https://www.googleapis.com/plus/v1/activities','GET',request);
  return this;
};

module.exports = GooglePlus;
