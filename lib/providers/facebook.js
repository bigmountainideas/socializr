var stream   = require('stream')
  , util     = require('util')
  , request  = require('superagent')
  , oauth1a  = require('../auth/oauth1a')
  , PubSubConnection  = require('../auth/pubsub')

  , Transform = stream.Transform

  , FB_GRAPH_URL = 'https://graph.facebook.com/'

  , FB_DEFAULT_PAGE_SUBSCRIBED_FIELDS = [

    'feed'

  ]
;


function OAuthConnection(accessToken, ownerId){
  this.accessToken = accessToken;
  this.tokenOwner = ownerId;
};

function OAuthConnectionStore() {
  this._connections = {};
};


OAuthConnectionStore.prototype.add = function(accessToken, ownerId){
  var conn = this._connections[ ownerId] = new OAuthConnection( accessToken, ownerId);
  return conn;
};

OAuthConnectionStore.prototype.get = function(ownerId){
  return this._connections.hasOwnProperty(ownerId) ? 
          this._connections[ ownerId] : 
          null;
};

OAuthConnectionStore.prototype.drop = function(ownerId){
  if( this._connections.hasOwnProperty(ownerId) ){
    delete this._connections[ ownerId];
    return true;
  }
  return false;
};



function Backlog(){

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

  this.pubsubConnections = {};
  this.oauthConnections = new OAuthConnectionStore();

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
  this.pubsubConnections[ verify_token] = conn;

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
  this.oauthConnections.add( token, pageId);
  this._graphRequest( pageId + '/tabs', 'POST', {
    app_id:       this.appId,
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
  var fb = this;
  return function(req, res, next){
    console.log(req.get('X-Hub-Signature'));
    console.log(req.body);
    fb.write(req.body);
    next();
  };
};

Facebook.prototype.isVerifyToken = function(token){
  return this.pubsubConnections.hasOwnProperty( token);
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

  console.log('_transforming');

  var expected = 0
    , fb = this
  ;
  for( var i in chunk.entry){

    console.log(chunk.entry[i].changes);

    var auth = this.oauthConnections.get( chunk.entry[i].id);

    for( var j in chunk.entry[i].changes){


      //console.log(chunk.entry[i].changes[j]);

      expected++;
      this._graphRequest( chunk.entry[i].changes[j].value.post_id, 'GET', {
        access_token: auth.accessToken
      }, function(res){
        expected--;

        
        console.log("post:",res.text, res.body);

        if( res.error){
          console.log(res.error);
        }else {
          fb.push(JSON.parse(res.text));
        }
        

        if( !expected){
          done();
        }
      })

    }

  }
  
};


Facebook.prototype._graphRequest = function(endpoint, method, data, cb){

  var url = FB_GRAPH_URL + endpoint
    , req
  ;

  if( method!='GET' && !data.hasOwnProperty('access_token')){
    data.access_token = this.appAccessToken;
  }

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
              .send(data)
              .end( function(res){
                cb&&cb( res);
              })
      break;

    case 'DELETE':

      req = request.del(url)
              .query(data)
              .send(data)
              .end( function(res){
                cb&&cb( res);
              })
      break;

  }


};


module.exports = Facebook;
