var stream   = require('stream')
  , util     = require('util')
  , request  = require('superagent')
  , _        = require('underscore') 
  , uuid     = require('node-uuid')
  , oauth1a  = require('../auth/oauth1a')
  , PubSubConnection  = require('../auth/pubsub')

  , Transform = stream.Transform

  , IG_API_URL = 'https://api.instagram.com/v1/'

  , IG_OBJECT_USER = 'user'

  , IG_OBJECT_TAG = 'tag'

  , IG_OBJECT_LOCATION = 'location'

  , IG_OBJECT_GEOGRAPHY = 'geography'

  , IG_DEFAULT_SUBSRIPTION_TYPE = IG_OBJECT_USER

;


function Instagram(opts){

  Transform.call(this, {
    objectMode: true
  });

  this.clientId     = opts.appId;
  this.clientSecret = opts.appSecret;
  this.subscriptionCallbackURL = opts.subscriptionCallbackURL;

  this.pubsub         = opts.pubsub || new PubSubConnection( this.appSecret, this);
  this.uuid           = uuid.v1();

  this._tags = []
};
util.inherits(Instagram, Transform);


Instagram.prototype.stream = function(request, auth, socializr){
  if( !this._piped){
    this._piped = true;
    this.pubsub
    .pipe( this)
    .pipe( socializr);
    this.on('warning', socializr._onError.bind(socializr));
  }
  var data;
  this._tags = this._tags.concat( request.tags);
  for( var i in request.tags){
    data = {
      type: IG_OBJECT_TAG,
      tag: request.tags[i]
    };
    this.subscribe( data, function(req){
      console.log('++++++++ instagram',arguments);
    });
  }
  return this;
};

Instagram.prototype.auth = function(auth){
  auth._provider = this;
  return auth;
};


Instagram.prototype.subscribe = function(sub, cb){

  // var conn = new PubSubConnection( this.appSecret)
    // , verify_token = conn.verifyToken()
  // ;
  var verify_token = this.pubsub.verifyToken();
  // this.pubsubConnections[ verify_token] = conn;

  var data = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        object: sub.type || IG_DEFAULT_SUBSRIPTION_TYPE,
        aspect: 'media',
        verify_token: verify_token,
        callback_url: this.subscriptionCallbackURL
      }
  ;

  switch( sub.type){
    case IG_OBJECT_TAG:
      data = _.extend(data,{
        object_id: sub.tag
      });
      break;

    case IG_OBJECT_LOCATION:
      data = _.extend(data,{
        object_id: sub.location
      });
      break;

    case IG_OBJECT_GEOGRAPHY:
      data = _.extend(data,{
        lat: sub.lat,
        lng: sub.lng,
        radius: sub.radius
      });
      break;
  };

  this._apiRequest( 'subscriptions', 'POST', data, function(res){
    cb&&cb(res);
  });
};

Instagram.prototype.unsubscribe = function(type){
  this._apiRequest( 'subscriptions', 'DELETE', {
    client_id:     this.clientId,
    client_secret: this.clientSecret,
    object: type
  }, function(){

  });
};

Instagram.prototype._transform = function(chunk, encoding, done){

  console.log("Instagram transform", chunk)

  var expected = 0
    , ig = this
  ;
  for( var i in chunk){

    // this.getMediaByTag({
    //   tag: chunk.object_id
    // }, function(res){

    // });
    // console.log( chunk[i]);

  }

  done();
  
};


Instagram.prototype.getMediaByTag = function(tag, cb){
  this._apiRequest( 'tags/' + tag.tag + '/media/recent', 'GET', {
    access_token: tag.accessToken
  }, function(res){
    cb&&cb(res.error || res.body);
  });
};

Instagram.prototype.getFeed = function(token, cb){
  this._apiRequest( 'users/self/feed', 'GET', {
    access_token: token
  }, function(res){
    cb&&cb(res.error || res.body);
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
