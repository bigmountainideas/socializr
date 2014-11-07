var util     = require('util')
  , crypto   = require('crypto')
  , stream   = require('stream')
  , Transform= stream.Transform
  , oauth1a  = require('../auth/oauth1a')
;



function PubSubConnection(secret, stream){
  if( !secret){
    throw new Error('Invalid client secret.')
  }
  this.appSecret = secret;
  this.stream = stream;
  this._verifyTokens = {};
  Transform.call(this, {
    objectMode: false
  });
};
util.inherits(PubSubConnection, Transform);

PubSubConnection.prototype.isVerifyToken = function(token){
  token = token.toString();
  if(this._verifyTokens[ token]==token){
    delete this._verifyTokens[ token]==token
    return true;
  }
  return false;
};


PubSubConnection.prototype.verifyToken = function(){
  this._verifyToken = oauth1a.makeNonce();
  this._verifyTokens[ this._verifyToken] = this._verifyToken;
  return this._verifyToken;
};

PubSubConnection.prototype.isSignatureValid = function(data, signature){
  var hmac = crypto.createHmac('sha1', this.appSecret);
  hmac.update(
    typeof data == 'string' ? data : JSON.stringify(data),
    'utf8'
  );
  return signature.replace(/^sha1=/i,'') == hmac.digest('hex');
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

PubSubConnection.prototype.subscription = function(){
  var _this = this;
  return function(req, res, next){
    if( _this.isSignatureValid( 
        req.text, req.get('X-Hub-Signature'))
      ){
      _this.stream.write(req.body);
      res.send(200);
    }else{
      res.send(401);
    }
  };
};


module.exports = PubSubConnection;
