var util     = require('util')
  , crypto   = require('crypto')
  , oauth1a  = require('../auth/oauth1a')
;



function PubSubConnection(token, secret){
  this.appToken = token;
  this.appSecret = secret;
};

PubSubConnection.prototype.isVerifyToken = function(token){
  return this._verifyToken==token.toString();
};

PubSubConnection.prototype.verify = function(){
  var _this = this;
  return function(req, res){
    if( _this.isVerifyToken( req.query['hub.verify_token'])){
      res.send( req.query['hub.challenge']);
    }else {
      res.send(401);
    }
  };
};

PubSubConnection.prototype.verifyToken = function(){
  return this._verifyToken = oauth1a.makeNonce();
};

PubSubConnection.prototype.isSignatureValid = function(data, signature){
  var hmac = crypto.createHmac('sha1', this.appSecret);
  hmac.update(
    typeof data == 'string' ? data : JSON.stringify(data),
    'utf8'
  );
  return signature == hmac.digest('hex');
};


/**
 *
 */
PubSubConnection.prototype.subscription = function(){
  var stream = this;
  return function(req, res, next){
    if( stream.pubsub.isSignatureValid( 
        req.rawBody, req.get('X-Hub-Signature'))
      ){
      stream.write(req.body);
      res.send(200);
    }else{
      res.send(401);
    }
  };
};


module.exports = PubSubConnection;
