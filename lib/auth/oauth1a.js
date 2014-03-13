/*!
 * Module dependencies.
 */
var _ = require('underscore')
  , crypto = require('crypto')
  , nonceChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
;


/**
 *
 * Export lib
 */
module.exports = {

/**
 * OAuth Spec version conformance
 *
 */
  OAUTH_VERSION: '1.0a',

/**
 * Generate OAuth header string.
 *
 * @params {Object} params
 * @params {String} signature
 * @return {String}
 */
authHeader: function( params, signature){
  params['oauth_signature'] = signature;
  var auth = [];
  for( var k in params){
    auth.push(
      encodeURIComponent(k)+'="'+encodeURIComponent( params[k])+'"'
    );
  }
  auth.sort();
  return 'OAuth ' + auth.join(', ');
},


/**
 * Generate OAuth compatible representation
 * of data and header values for signing.
 *
 * @params {Object} data
 * @params {Object} params
 * @return {String}
 */
paramsString: function( data, params){
  params = _.extend(data, params);
  var paramsString = [];
  for( var k in params){
    paramsString.push(
      encodeURIComponent(k)+'='+encodeURIComponent(params[ k])
    );
  }
  paramsString.sort();
  return paramsString.join('&');
},

/**
  * Generate base string for creating OAuth signature
  *
  * @params {String} method
  * @params {String} url
  * @params {String} paramsString
  * @return {String}
  */
signatureBaseString: function( method, url, paramsString){
  return [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(paramsString)
    ].join('&');
},


/**
  * Generate OAuth 1.0a signing key
  *
  * @params {String} appSecret Application/ Client secret
  * @params {String} tokenSecret User access token secret
  * @return {String}
  */
signingKey: function( appSecret, tokenSecret){
  return [
    encodeURIComponent(appSecret),
    tokenSecret ? encodeURIComponent(tokenSecret) : ''
  ].join('&');
},

/**
 * Generate OAuth 1.0a signature
 *
 * @params {String} signatureBase
 * @params {String} key
 * @return {String} Base64 encoded string encrypted with SHA1
 */
signature: function( signatureBase, key){
  return crypto.createHmac("sha1", key)
          .update(signatureBase)
          .digest("base64");
},

/**
 * Random 32 bit string
 *
 * @return {String}
 */
makeNonce: function(){
  var nonce = [], nonceRange = nonceChars.length-1;
  while( nonce.length<32){
    nonce.push(
      nonceChars[ Math.round(Math.random()*nonceRange)]
    );
  }
  return nonce.join('');
},

/**
 * Generate OAuth 1.0a Authorization header string
 * from parameters
 *
 * @params {Object} opts
 * @return {String} Authorization string
 */
createAuthHeaders: function(opts){
  var params = {
        oauth_nonce:            this.makeNonce(),
        oauth_timestamp:        Date.now()/1000,
        oauth_consumer_key:     opts.appKey,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version:          '1.0'
      }
  ;
  if( opts.token){
    params.oauth_token = opts.token;
  }
  var paramsString  = this.paramsString(opts.data, params)
    , sigBaseString = this.signatureBaseString( opts.method, opts.url, paramsString)

    , signingKey    = this.signingKey( opts.appSecret, opts.tokenSecret)
    , signature     = this.signature( sigBaseString, signingKey)
  ;
  return this.authHeader( params, signature);
}

};
