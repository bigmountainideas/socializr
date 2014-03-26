var stream   = require('stream')
  , util     = require('util')
  , crypto   = require('crypto')
  , request  = require('superagent')
  , oauth1a  = require('../auth/oauth1a')

  , Transform = stream.Transform

  , FB_GRAPH_URL = 'https://graph.facebook.com/'

  , FB_DEFAULT_PAGE_SUBSCRIBED_FIELDS = [

    'feed'

  ]
;


function Page(id, accessToken){
  this.id = id;
  this.accessToken = accessToken;
};




function PubSubConnection(secret){
  this.appSecret = secret;
};

PubSubConnection.prototype.verifyToken = function(){
  return this.verifyToken = oauth1a.makeNonce();
};

PubSubConnection.prototype.validateSignature = function(data){
  var decipher = crypto.createDecipher('AES-128-CBC-HMAC-SHA1', this.appSecret);
  decipher.update('sha1='+data, 'hex');
  return decipher.final('utf8');
};




function Facebook(opts){

  Transform.call(this, {
    objectMode: true
  });

  this.appId          = opts.appId;
  this.appSecret      = opts.appSecret;
  this.appAccessToken = this.getApplicationToken();

  this.subscriptionCallbackURL = opts.subscriptionCallbackURL;
  this.subscribedFields = FB_DEFAULT_PAGE_SUBSCRIBED_FIELDS;

  this._pubsubConnections = {};
};
util.inherits(Facebook, Transform);


Facebook.prototype.getApplicationToken = function(cb){
  if( cb){
    this._graphRequest( 'oauth/access_token', 'GET', {
      client_id:      this.appId, 
      client_secret:  this.appSecret,
      grant_type:     'client_credentials'
    }, function(res){
      cb&&cb(res);
    });
  }
  return [
    this.appId, 
    this.appSecret
  ].join('|');
};


Facebook.prototype.getTokenInfo = function(token, cb){
  this._graphRequest( 'debug_token', 'GET', {
    input_token:  token,
    access_token: this.appAccessToken
  }, function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.exchangeToken = function(token, cb){
  this._graphRequest( 'oauth/access_token', 'GET', {
    grant_type:         'fb_exchange_token',
    client_id:          this.appId,
    client_secret:      this.appSecret,
    fb_exchange_token:  token
  }, function(res){
    cb&&cb(res);
  });
};



Facebook.prototype.subscribe = function(token,cb){

  var conn = new PubSubConnection( this.appSecret)
    , verify_token = conn.verifyToken()
  ;
  this._pubsubConnections[ verify_token] = conn;

  this._graphRequest( this.appId + '/subscriptions', 'POST', {
    object:       'page',
    callback_url: this.subscriptionCallbackURL,
    fields:       this.subscribedFields.join(','),
    verify_token: verify_token,
    access_token: this.appAccessToken
  },function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.getPages = function(user, token, cb){
  this._graphRequest( user + '/accounts', 'GET', {
    access_token: token
  }, function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.install = function(pageId, token, cb){
  this._graphRequest( pageId + '/tabs', 'POST', {
    app_id: this.appId,
    access_token: token
  }, function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.uninstall = function(pageId, token){
  this._graphRequest( pageId + '/tabs/app_' + this.appId, 'DELETE', {
    access_token: token
  }, function(){

  });
};


Facebook.prototype.pipeSubscription = function(){
  var _this = this;
  return function(req, res, next){
    console.log(req.get('X-Hub-Signature'));
    req.pipe( this);
    next();
  };
};

Facebook.prototype.isVerifyToken = function(token){
  return this._pubsubConnections.hasOwnProperty( token);
};

Facebook.prototype.verify = function(){
  var _this = this;
  return function(req, res){
    if( _this.isVerifyToken( req.query['hub.verify_token'])){
      res.send( req.query['hub.challenge']);
    }else {
      res.send(401);
    }
  };
};

Facebook.prototype._transform = function(chunk, encoding, done){

  this.push(chunk);

  done();
};


Facebook.prototype._graphRequest = function(endpoint, method, data, cb){

  var url = FB_GRAPH_URL + endpoint
    , req
  ;

  switch( method.toUpperCase()){

    case 'GET':

      req = request.get(url)
              .query(data)
              .end( function(res){
                cb&&cb( res);
              })
      break;

    case 'POST':

      req = request.post(url)
              .query(data)
              .send(data)
              .end( function(res){
                cb&&cb( res);
              })
      break;

  }


};


module.exports = Facebook;
