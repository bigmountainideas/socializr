socializr
=========

Read data streams from several social networks.

### Install

``` npm install socializr ```

### API


.stream({
  tag: 'atag',
  access_token: 'token for this stream'
})

.stream({
  user: 'username | id',
  access_token: 'token for this stream'
})

.stream({
  location: 'location id',
  access_token: 'token for this stream'
}, {
  reconnection_timeout: 5000,
  retry_limit: 10
})

.stream({
  
})




### Examples

#### Twitter
```
  var tw = new socializr.Twitter({
    key: ‘your twitter application id',
    secret: ‘your twitter application secret',
  })

  // add tag to follow
  .addTerm(['#sxsw’])
  // add user id to follow
  .addUser([1351038806])
  // add geo bounds to search
  .addLocation([{
    sw: { lat: '43.6387773', lng: '-79.3964338' },
    ne: { lat: '43.65082659999999', lng: '-79.37785149999999’ }
  }])

  .on('error', function(err){
    // handle error
  })
  .on('data', function(tweet, match){
    // process tweet
  })
  .stream();
```

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
