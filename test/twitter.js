var socializr = require('../')
  , creds = require('./fixtures/tw-creds')
  , mockTwitter
;



describe('Twitter', function(done){

  this.timeout(15000);

  it('should create a Twitter Provider', function(done){

    var tw = new socializr.Twitter(creds.app, {
      delimited: false,
      stall_warnings: false,
      filter_level: 'none',
      language: 'en'
    });

    done();

  })

  it('should fail with invalid credentials object', function(done){

    var tw = new socializr.Twitter(creds.app);

    (function(){
      tw.connect(null);
    }).should.throw(/Invalid User Authentication info/i);
    done();

  })

  it('should track a hashtag', function(done){

    var tw = new socializr.Twitter(creds.app);

    tw.connect(creds.users)
    .addTerm(['#sxsw'])
    .on('error', function(err){

      console.log(err);
      done();

    })
    .on('data', function(tweet, match){

      done();
      tw.close();

    })
    .stream();

  })

  it('should follow a user', function(done){

    var tw = new socializr.Twitter(creds.app);

    tw.connect(creds.users)
    .addUser([1351038806])
    .on('error', function(err){

      console.log(err);
      done();

    })
    .on('data', function(tweet, match){

      tw.close();
      done();

    })
    .stream();

  })

  it('should track a location', function(done){

    var tw = new socializr.Twitter(creds.app);

    tw.connect(creds.users)
    .addLocation([{
      sw: { lat: '43.6387773', lng: '-79.3964338' },
      ne: { lat: '43.65082659999999', lng: '-79.37785149999999' }
    }])
    .on('error', function(err){

      console.log(err);
      done();

    })
    .on('data', function(tweet, match){

      tw.close();
      done();

    })
    .stream();

  })



})
