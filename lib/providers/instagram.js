var stream   = require('stream')
  , util     = require('util')
  , request  = require('superagent')
  , oauth1a  = require('../auth/oauth1a')

  , Transform = stream.Transform

  , IG_API_URL = 'https://api.instagram.com/v1/'

;



function Instagram(auth){
  this.clientId     = auth.appId;
  this.clientSecret = auth.secret;
};
util.inherits(Facebook, Transform);


Instagram.prototype.subscribe = function(){
  this._apiRequest( 'subscriptions', 'POST', {
    client_id: this.clientId,
    client_secret: this.clientSecret,
    object: 'user | tag | location',
    aspect: 'media',
    verify_token: oauth1a.makeNonce(),
    callback_url: this.subscriptionCallbackURL,
    object_id: 'tag | user id | location id',

    lat: '35.657872',
    lng: '139.70232',
    radius: '1000'
  }, function(){

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
        .query(data)
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
