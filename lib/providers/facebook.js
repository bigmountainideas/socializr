var debug    = require('debug')('socializr:provider:facebook')
  , stream   = require('stream')
  , util     = require('util')
  , request  = require('superagent')
  , uuid     = require('node-uuid')
  , _        = require('underscore')
  , oauth1a  = require('../auth/oauth1a')
  , PubSubConnection  = require('../auth/pubsub')
  , Message = require('../message')

  , Transform = stream.Transform

  , FB_GRAPH_URL = 'https://graph.facebook.com/v2.2/'

  , FB_DEFAULT_PAGE_SUBSCRIBED_FIELDS = [
    'feed'
  ]
;




function Facebook(options){

  options = _.extend({
    filters: []
  },options);

  Transform.call(this, {
    objectMode: true
  });

  this.appId          = options.appId;
  this.appSecret      = options.appSecret;
  this.appAccessToken = this.getApplicationToken();
  this.subscriptionCallbackURL = options.subscriptionCallbackURL;
  this.pubsub         = options.pubsub || new PubSubConnection( this.appSecret, this);
  this.uuid           = uuid.v1();

  this._filters = options.filters;
  this._pages = [];
};
util.inherits(Facebook, Transform);


Facebook.prototype.stream = function(request, auth, socializr){
  if( !this._piped){
    this._piped = true;
    this.pubsub
    .pipe( this)
    .pipe( socializr);
    this.on('warning', socializr._onError.bind(socializr));
    var data, i;
    this._pages = this._pages.concat( request.pages);
    for( i=0; i<request.pages.length; i++){
      data = request.pages[i];
      debug('Subscribing to [ %s ]',data.name);
      this.subscribeTo( data.page, data.access_token, function(res){
        debug('Subscription responded %s',res.error||res.text);
      });
    }
  }
  return this;
};

Facebook.prototype.unstream = function(request, auth, socializr){

  return this;
};

Facebook.prototype.auth = function(auth){
  auth._provider = this;
  return auth;
};


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

Facebook.prototype.subscribeTo = function(id,token,cb){
  this._graphRequest( id + '/subscribed_apps', 'POST', {
    access_token: token
  },function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.unsubscribe = function(id,token,cb){
  this._graphRequest( id + '/subscribed_apps', 'DELETE', {
    access_token: token
  },function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.subscribe = function(type,cb){
  this.subscribedFields = FB_DEFAULT_PAGE_SUBSCRIBED_FIELDS;

  var verify_token = this.pubsub.verifyToken();

  this._graphRequest( this.appId + '/subscriptions', 'POST', {
    object:       type || 'page',
    callback_url: this.subscriptionCallbackURL,
    fields:       this.subscribedFields.join(','),
    verify_token: verify_token,
    access_token: this.appAccessToken
  },function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.getUserAccounts = function(user, token, cb){
  this._graphRequest( user + '/accounts', 'GET', {
    access_token: token
  }, function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.install = function(pageId, token, cb){
  this._graphRequest( pageId + '/tabs', 'POST', {
    app_id:       this.appId,
    access_token: token
  }, function(res){
    cb&&cb(res);
  });
};

Facebook.prototype.uninstall = function(pageId, token, cb){
  var self = this;
  this._graphRequest( pageId + '/tabs/app_' + this.appId, 'DELETE', {
    access_token: token
  }, function(res){
    cb&&cb(res);
  });
};


Facebook.prototype._transform = function(chunk, encoding, done){
  var expected = 0
    , stream = this
  ;
  for( var i in chunk.entry){
    var auth = this.oauthConnections.get( chunk.entry[i].id);
    for( var j in chunk.entry[i].changes){
      expected++;
      this._graphRequest( chunk.entry[i].changes[j].value.post_id, 'GET', {
        access_token: auth.accessToken
      }, function(res){
        expected--;

        if( res.error){
          debug('Error requesting data. Server responded %s', res.error);
        }else{

          try {
            var data = JSON.parse(res.text);
            if( this.include(data)) {
              stream.push(
                new Message( this, data )
              );
            }
          }catch(err){
            debug('Data parse error. Error parsing chunk. Parser trew %j',err);
          }
        }

        if( !expected){
          done();
        }
      })
    }
  }
};

Facebook.prototype.include = function(data){
  var pass = true;
  this._filters.forEach( function(cb){
    if( !cb(data)){
      pass = false;
      return false;
    }
  });
  return pass;
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
