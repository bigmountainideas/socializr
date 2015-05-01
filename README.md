socializr
=========

Read data streams from several social networks.

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

### INSTALLING

```$ npm install socializr --save```

### API


### Examples


####

```js

var socializr = require('socializr');

var twitterProvider = new socializr.Twitter({
  key: 'a valid twitter api key',
  secret: 'a valid twitter api secret',
  filters: [
    function(obj) {
      return !obj.data.hasOwnProperty('retweeted_status');
    }
  ]
});



var gplusProvider = new socializr.GooglePlus({
  key: 'a valid api key',
  filters: [
    function(obj) {
      return !(obj.provider && obj.provider.title === 'Reshared Post');
    }
  ]
});


callback_domain.pathname = '/pubsub/__cb__/facebook';

var facebookProvider = new socializr.Facebook({
  appId: 'a valid facebook app id',
  appSecret: 'a valid facebook app secret',
  subscriptionCallbackURL: url.format(callback_domain)
});

callback_domain.pathname = '/pubsub/__cb__/instagram';

var instagramProvider = new socializr.Instagram({
  appId: 'a valid instagram app/ client id',
  appSecret: 'a valid instagram app/ client secret',
  subscriptionCallbackURL: url.format(callback_domain),
  filters: [
    function(obj) {
      return obj.caption && obj.caption.text && obj.caption.text.length;
    }
  ]
});

var social = socializr();




var auths_twitter    = twitterProvider.auth auth.twitter.users[0]
var auths_gplus      = gplusProvider.auth auth.gplus.app
var auths_facebook   = facebookProvider.auth auth.facebook.app
var auths_instagram  = instagramProvider.auth auth.instagram.app


instagramProvider.subscribe( {type: 'user'}, function(){

});

facebookProvider.subscribe( 'page', function(){

});


social.on( 'warning', function(warn){
  debug( 'Socializr warning', warn);
});


social.on( 'data', function(obj){

});


```


#### Twitter

```js
var twitter = new socializr.Twitter({
  key: 'TWITTER_API_KEY',
  secret: 'TWITTER_API_SECRET'
}, {
  filters: [
    function(obj) {
      return !obj.hasOwnProperty('retweeted_status');
    }
  ]
});

var social = socializr([twitter]);

var auths = [
  twitter.auth({
    user: 'USER_ID',
    token: 'USER_ACCESS_TOKEN',
    secret: 'USER_TOKEN_SECRET'
  })
];

social.on('warning', function(err) {
    return console.log('error', err);
  });

social.on('data', function(msg) {
    return console.log(msg);
  });
```

Add data to stream
```js
social.stream({
  tags: ['Toronto', '#applehot'],
  users: [972651, 759251],
  language: 'en'
}, auths);
```

If you need to add new tags or users just call the `stream` function again with the updated data.



### Issues & Feature Requests

If you have any issues or feature requests please file them in github.com issues. Thanks for your support and comments.

### TODO

* Twitter stream fallback



### LICENSE

```
(The MIT License)

Copyright (c) 20014 Big Mountain Ideas + Innovations <jovan@bigmountainideas.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```


[npm-image]: https://img.shields.io/npm/v/socializr.svg
[npm-url]: https://npmjs.org/package/socializr
[downloads-image]: https://img.shields.io/npm/dm/socializr.svg
[downloads-url]: https://npmjs.org/package/socializr
[travis-image]: https://img.shields.io/travis/bigmountainideas/socializr/master.svg
[travis-url]: https://travis-ci.org/bigmountainideas/socializr
[coveralls-image]: https://coveralls.io/repos/bigmountainideas/socializr/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/r/bigmountainideas/socializr?branch=master
