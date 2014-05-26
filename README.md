socializr
=========

Read data streams from several social networks.

### Install

``` npm install socializr ```

### API





### Examples

#### Twitter
```javascript
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
```javascript
social.stream({
  tags: ['Toronto', '#applehot'],
  users: [972651, 759251],
  language: 'en'
}, auths);
```

If you need to add new tags or users just call the `stream` function again with the updated data.


#### Facebook
```
  Coming soon
```

#### Instagram
```
  Coming soon
```

### Issues & Feature Requests

If you have any issues or feature requests please file them in github.com issues. Thanks for your support and comments.

### TODO

* Twitter stream fallback
* Facbeook integration
* Instagram integration


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
