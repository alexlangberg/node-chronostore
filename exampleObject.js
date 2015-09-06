'use strict';

var cs = require('./');
var through2 = require('through2');

// set object and root
var obj = {'foo': 'bar'};
var options = {
  'root': 'foobar',
  'parseJSON': true
};

// create a stream and end it with null
var stream = through2.obj();
stream.push(obj);
stream.push(null);

// write object to disk
stream.pipe(cs.writeObject(options))
  .on('data', function() {
    // when object has been written, search for it
    cs.search(options)
      .on('data', function(file) {
        console.log(file);
      });
  });
