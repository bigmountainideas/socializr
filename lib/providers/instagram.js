var stream   = require('stream')
  , util     = require('util')
  , request  = require('superagent')
  , _        = require('underscore') 
  , uuid     = require('node-uuid')
  , oauth1a  = require('../auth/oauth1a')
  , PubSubConnection  = require('../auth/pubsub')
  , Message = require('../message')

  , Transform = stream.Transform

  , IG_API_URL = 'https://api.instagram.com/v1/'

  , IG_OBJECT_USER = 'user'

  , IG_OBJECT_TAG = 'tag'

  , IG_OBJECT_LOCATION = 'location'

  , IG_OBJECT_GEOGRAPHY = 'geography'

  , IG_DEFAULT_SUBSRIPTION_TYPE = IG_OBJECT_USER

;


function Instagram(options){
  
  options = _.extend({
    filters: []
  },options);

  Transform.call(this, {
    objectMode: true
  });

  this.clientId     = options.appId;
  this.clientSecret = options.appSecret;
  this.subscriptionCallbackURL = options.subscriptionCallbackURL;

  this.pubsub         = options.pubsub || new PubSubConnection( this.clientSecret, this);
  this.uuid           = uuid.v1();

  this._filters = options.filters;
  this._tags = [];
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
      tag: request.tags[i].toString().replace('#','')
    };
    this.subscribe( data, function(err,res){
      console.log('++++++++ instagram',res.body);
    });
  }
  return this;
};

Instagram.prototype.unstream = function(request, auth, socializr){
  
  var data;
  this._tags = this._tags.concat( request.tags);
  for( var i in request.tags){
    this.unsubscribe( request.tags[i].toString().replace('#',''), function(err,res){
      console.log('++++++++ instagram',res.headers);
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

  this._apiRequest( 'subscriptions', 'POST', data, function(err,res){
    cb&&cb(err,res);
  });
};

Instagram.prototype.unsubscribe = function(type){

  switch(type){
    case 'all':
    case 'tag':
    case 'location':
    case 'user':
    case 'geography':
      this._apiRequest( 'subscriptions', 'DELETE', {
        client_id:     this.clientId,
        client_secret: this.clientSecret,
        object: type
      }, function(){
        console.log('unsubscribe instagram', type, arguments)
      });
    break;
    default:
      var self = this;
      this.subscriptions( function(err,res){

        data = res.body.data;
        data = data instanceof Array ? data : [data];
        type = type instanceof Array ? type : [type];

        console.log('unsubscribing tags', type,data);

        for(var i in data) {
          d = data[ i];
          if( type.indexOf(d.object_id) !== -1 ){
            self._apiRequest( 'subscriptions', 'DELETE', {
              client_id:     self.clientId,
              client_secret: self.clientSecret,
              object: d.id
            }, function(err,res){
              console.log('unsubscribe instagram', err, d.object_id, res.body);
            });
          }
        };
      });
      
    break;
  }

};

Instagram.prototype.subscriptions = function(cb){
  this._apiRequest( 'subscriptions', 'GET', {
    client_id:     this.clientId,
    client_secret: this.clientSecret
  }, function(err,data){
    cb&&cb(err,data);
  });
};

Instagram.prototype._transform = function(chunk, encoding, done){

  // console.log("Instagram transform", chunk)

  var expected = 0
    , stream = this
    , obj = null
    , complete = _.after(chunk.length, function(){
      done();
    }) 
  ;
  for( var i in chunk){

    obj = chunk[i];
    switch( obj.object){
      case IG_OBJECT_TAG:
        this.getMediaByTag(chunk[i].object_id, function(err,res){
          //console.log('media response',res.body);
          var data = res.body.data;
          for( var j in data){

            if( stream.include(data[j])){

              stream.push(
                new Message(stream,data[j])
              );
            }
          }
          complete();
        });
        
        break;
      default: 
        complete();
        break;
    }
  }
  
};



Instagram.prototype.include = function(data){
  var pass = true;
  this._filters.forEach( function(cb){
    if( !cb(data)){
      pass = false;
      return false;
    }
  });
  return pass;
};


Instagram.prototype.getMediaByTag = function(tag, cb){
  this._apiRequest( 'tags/' + tag + '/media/recent', 'GET', {
    client_id: this.clientId
  }, function(err,res){
    cb&&cb(err, res);
  });
};

Instagram.prototype.getFeed = function(token, cb){
  this._apiRequest( 'users/self/feed', 'GET', {
    access_token: token
  }, function(err,res){
    cb&&cb(err, res);
  });
};

Instagram.prototype.findMediaAtLocation = function(id){
  this._apiRequest( 'locations/' + id + '/media/recent', 'GET', {
  }, function(err,res){
    cb&&cb(err, res);
  });
};

Instagram.prototype.getLocations = function(lat, lng){
  this._apiRequest( 'locations/search', 'GET', {
    lat: '',
    lng: ''
  }, function(err,res){
    cb&&cb(err, res);
  });
};

Instagram.prototype.getMediaByLocation = function(id){
  this._apiRequest( 'locations/' + id + '/media/recent', 'GET', {
  }, function(err,res){
    cb&&cb(err, res);
  });
};

Instagram.prototype.getMediaByGeo = function(id){
  this._apiRequest( 'geographies/' + id + '/media/recent', 'GET', {
    client_id: this.clientId
  }, function(err,res){
    cb&&cb(err, res);
  });
};



Instagram.prototype._apiRequest = function(endpoint, method, data, cb){

  var url = IG_API_URL + endpoint
  ;

  switch( method.toUpperCase()){

    case 'GET':

      request.get(url)
        .query(data)
        .end( function(err,res){
          cb&&cb(err,res);
        });
      break;

    case 'POST':

      request.post(url)
        .type('form')
        .send(data)
        .end( function(err,res){
          cb&&cb(err,res);
        });

      break;

    case 'DELETE':

      request.del(url)
        .type('form')
        .send(data)
        .end( function(err,res){
          cb&&cb(err,res);
        });
      break;
  }

};


module.exports = Instagram;
