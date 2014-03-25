var stream   = require('stream')
  , util     = require('util')
  , request  = require('superagent')
  , oauth1a  = require('../auth/oauth1a')

  , Transform = stream.Transform

  , FB_GRAPH_URL = 'https://graph.facebook.com/'

  , FB_DEFAULT_PAGE_SUBSCRIBED_FIELDS = [

    'feed'

  ]
;



function PubSubConnection(){

};

PubSubConnection.prototype.verify = function(){

};


PubSubConnection.prototype.verify = function(){

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
  this._graphRequest( this.appId + '/subscriptions', 'POST', {
    object:       'page',
    callback_url: this.subscriptionCallbackURL,
    fields:       this.subscribedFields.join(','),
    verify_token: oauth1a.makeNonce(),
    access_token: this.appAccessToken
  },function(res){
    cb&&cb(res);
  });
};


Facebook.prototype.pipeSubscription = function(){
  var _this = this;
  return function(req, res, next){
    res.pipe( this);
    next();
  };
};

Facebook.prototype.verify = function(){
  var _this = this;
  return function(req, res, next){

    console.log(req.query);

    res.send();
    next();
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
