var util     = require('util')
  , crypto   = require('crypto')
  , oauth1a  = require('../auth/oauth1a')
;



function PubSubConnection(secret){
  this.appSecret = secret;
};

PubSubConnection.prototype.verifyToken = function(){
  return this.verifyToken = oauth1a.makeNonce();
};

PubSubConnection.prototype.validateSignature = function(data){
  var decipher = crypto.createDecipher('AES-128-CBC-HMAC-SHA1', this.appSecret);
  decipher.update('sha1='+data, 'hex');
  return decipher.final('utf8');
};


module.exports = PubSubConnection;
