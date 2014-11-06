var debug = require('debug')('socializr:core')
  , https = require('https')
  , http = require('http')
  , stream = require('stream')
  , util     = require('util')
  , PubSub = require('./auth/pubsub')
  , Transform = stream.Transform
  , Twitter = require('./providers/twitter')
  , Facebook = require('./providers/facebook')
  , Instagram = require('./providers/instagram')
  , GooglePlus = require('./providers/gplus')
;

/**
 * Set maximum number of socket connections allowed
 */
https.globalAgent.maxSockets = Number.MAX_VALUE;
http.globalAgent.maxSockets = Number.MAX_VALUE;



/**
 *
 */
var Socializr  = function(providers){

  debug('Initializing socializr with %s providers',providers?providers.length:0);

  Transform.call(this, {
    objectMode: true
  });
  this.providers = providers;
};
util.inherits(Socializr, Transform);



Socializr.prototype.stream = function(request, auths){
  auths = auths instanceof Array ? auths : [auths];
  var self = this;
  for (var i = auths.length - 1; i >= 0; i--) {
    debug('Streaming data %j from %j with uuid %s',request,auths[i]._provider.__proto__,auths[i]._provider.uuid);
    auths[i]._provider.stream( request, auths[i], this);
  };
};

Socializr.prototype.unstream = function(request, auths){
  auths = auths instanceof Array ? auths : [auths];
  var self = this;
  for (var i = auths.length - 1; i >= 0; i--) {
    debug('Unstreaming data %j from %j with uuid %s',request,auths[i]._provider,auths[i]._provider.uuid);
    auths[i]._provider.unstream( request, auths[i], this);
  };
};

Socializr.prototype._onError = function(err, conn){
  debug('Socializr captured an error %j with connection %s',err,conn);
  this.emit('warning', err, conn);
};


/**
  *
  *
  * @param
  * @api private
  * @method _transform
  * @memberOf Socializr
  */
Socializr.prototype._transform = function(chunk, encoding, done){
  this.push( chunk);
  done();
};


/**
 *
 */
module.exports = function(providers){
  return new Socializr(providers);
};


/**
 *
 */
module.exports.rawBody = function(){
  return function(req, res, next){
    var data = '';
    req.on('data', function(chunk){
      data += chunk;
    });
    req.on('end', function(){
      req.text = data;
    });
    next();
  };
};



/**
 *
 */
module.exports.Socializr   = Socializr;


/**
 *
 */
module.exports.Twitter   = Twitter;

/**
 *
 */
module.exports.Facebook  = Facebook;


/**
 *
 */
module.exports.Instagram  = Instagram;

/**
 *
 */
module.exports.GooglePlus  = GooglePlus;
