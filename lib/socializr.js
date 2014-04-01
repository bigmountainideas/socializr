var os = require('os')
  , https = require('https')

;

/**
 * Set maximum number of socket connections allowed by 
 */
https.globalAgent.maxSockets = 10000;



/**
 *
 */
var Socializr  = {};


Socializr._ip4 = function(){
  var interfaces = os.networkInterfaces()
    , addresses = []
  ;
  for (var i in interfaces) {
    for (j in interfaces[i]) {
      var address = interfaces[i][j];
      if (address.family == 'IPv4' && !address.internal) {
        addresses.push(address.address)
      }
    }
  }
  return addresses;
};


/**
 *
 */
Socializr.gobId = function(){
  var ips = Socializr._ip4();
  return [
    ips.join(','),
    process.env.PORT,
    process.pid
  ].join('|');
};

/**
 *
 */
Socializr.Twitter   = require('./providers/twitter');

/**
 *
 */
Socializr.Facebook  = require('./providers/facebook');


/**
 *
 */
Socializr.Instagram  = require('./providers/instagram');



/**
 *
 */
module.exports = Socializr;
