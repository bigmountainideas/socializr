var stream   = require('stream')
  , util     = require('util')
  , request  = require('superagent')
  , _        = require('underscore') 
  , oauth1a  = require('../auth/oauth1a')
  , PubSubConnection  = require('../auth/pubsub')

  , Transform = stream.Transform

  , IG_API_URL = 'https://api.instagram.com/v1/'

  , IG_DEFAULT_SUBSRIPTION_TYPE = 'user'

;



function Instagram(opts){

  Transform.call(this, {
    objectMode: true
  });

  this.clientId     = opts.appId;
  this.clientSecret = opts.appSecret;
  this.subscriptionCallbackURL = opts.subscriptionCallbackURL;

  this.pubsubConnections = {};
};
util.inherits(Instagram, Transform);


Instagram.prototype.subscribe = function(sub, cb){

  var conn = new PubSubConnection( this.appSecret)
    , verify_token = conn.verifyToken()
  ;
  this.pubsubConnections[ verify_token] = conn;

  var data = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        object: sub.type || IG_DEFAULT_SUBSRIPTION_TYPE,
        aspect: 'media',
        verify_token: verify_token,
        callback_url: this.subscriptionCallbackURL
      }
  ;

  //object: 'user | tag | location | geography'
  switch( sub.type){
    case 'tag':
      data = _.extend(data,{
        object_id: sub.tag
      });
      break;

    case 'location':
      data = _.extend(data,{
        object_id: sub.location
      });
      break;

    case 'geography':
      data = _.extend(data,{
        lat: sub.lat,
        lng: sub.lng,
        radius: sub.radius
      });
      break;
  };

  console.log(data);

  this._apiRequest( 'subscriptions', 'POST', data, function(res){
    cb&&cb(res);
  });
};

Instagram.prototype.unsubscribe = function(){
  this._apiRequest( 'subscriptions', 'DELETE', {
    client_id: this.clientId,
    client_secret: this.clientSecret,
    object: 'user | tag | location'
  }, function(){

  });
};

Instagram.prototype.verify = function(){
  var _this = this;
  return function(req, res){

    console.log('subscription verify:', req.query);

    if( _this.isVerifyToken( req.query['hub.verify_token'])){
      res.send( req.query['hub.challenge']);
    }else {
      res.send(401);
    }
  };
};

Instagram.prototype.isVerifyToken = function(token){
  return this.pubsubConnections.hasOwnProperty( token);
};

Instagram.prototype.getMediaByTag = function(tag){
  this._apiRequest( 'tags/' + tag + '/media/recent', 'GET', {
  }, function(){

  });
};

Instagram.prototype.getFeed = function(token){
  this._apiRequest( 'users/self/feed', 'GET', {
  }, function(){

  });
};

Instagram.prototype.findMediaAtLocation = function(id){
  this._apiRequest( 'locations/' + id + '/media/recent', 'GET', {
  }, function(){

  });
};

Instagram.prototype.getLocations = function(lat, lng){
  this._apiRequest( 'locations/search', 'GET', {
    lat: '',
    lng: ''
  }, function(){

  });
};

Instagram.prototype.getMediaByLocation = function(id){
  this._apiRequest( 'locations/' + id + '/media/recent', 'GET', {
  }, function(){

  });
};

Instagram.prototype.getMediaByGeo = function(id){
  this._apiRequest( 'geographies/' + id + '/media/recent', 'GET', {
    client_id: this.clientId
  }, function(){

  });
};

Instagram.prototype.pipeSubscription = function(){
  var _this = this;
  return function(req, res, next){

    next();
  };
};


Instagram.prototype._apiRequest = function(endpoint, method, data, cb){

  var url = IG_API_URL + endpoint
  ;

  switch( method.toUpperCase()){

    case 'GET':

      request.get(url)
        .query(data)
        .end( function(res){
          cb&&cb( res);
        });
      break;

    case 'POST':

      request.post(url)
        .type('form')
        .send(data)
        .end( function(res){
          cb&&cb( res);
        });

      break;

    case 'DELETE':

      request.del(url)
        .send(data)
        .end( function(res){
          cb&&cb( res);
        });
      break;
  }

};


module.exports = Instagram;
