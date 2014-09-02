var https = require('https')
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
 * Set maximum number of socket connections allowed by 
 */
https.globalAgent.maxSockets = 10000;



/**
 *
 */
var Socializr  = function(providers){

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
    auths[i]._provider.stream( request, auths[i], this);
  };
};

Socializr.prototype.unstream = function(request, auths){
  auths = auths instanceof Array ? auths : [auths];
  var self = this;
  for (var i = auths.length - 1; i >= 0; i--) {
    auths[i]._provider.unstream( request, auths[i], this);
  };
};

Socializr.prototype._onError = function(err, conn){
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
