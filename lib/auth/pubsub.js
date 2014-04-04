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

PubSubConnection.prototype.isSignatureValid = function(data, signature){
  var hmac = crypto.createHmac('sha1', this.appSecret);
  hmac.update(
    typeof data == 'string' ? data : JSON.stringify(data),
    'utf8'
  );
  return signature == hmac.digest('hex');
};


module.exports = PubSubConnection;
