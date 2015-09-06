'use strict';

var cs = require('./');
var gulp = require('gulp');

var options = {
  'root': 'foobaz'
};

// create a vinyl stream
var stream = gulp.src('README.md');

// write file to disk
stream.pipe(cs.write(options))
  .on('data', function() {
    // when file has been written, search for it
    cs.search(options)
      .on('data', function(file) {
        console.log(file);
        console.log(file.contents.toString());
      });
  });
