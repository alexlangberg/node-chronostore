'use strict';

var R = require('ramda');
var moment = require('moment');
var uuid = require('node-uuid');
var gzip = require('gulp-gzip');
var gunzip = require('gulp-gunzip');
var through2 = require('through2');
var gulp = require('gulp');
var filter = require('gulp-filter');
var rename = require('gulp-rename');
var gutil = require('gulp-util');

function padTimestamp(timestamp) {
  return ('0000000000000' + timestamp + '').slice(-13);
}

function fileRename(timestamp) {
  return function(file) {
    file.basename = padTimestamp(timestamp) + '-' + uuid.v1();
  };
}

function fileDestination(options, timestamp) {
  return function() {
    var root = options.root || './chronostore';
    var format = options.format || ['YYYY'];

    return R.reduce(function(string, elem) {
      string += '/' + timestamp.format(elem);
      return string;
    }, root, format);
  };
}

function filterVinylByTimestamp(file) {
  //console.log(file);
  return true;
}

var cs = {
  'vinylsToStream': function(files) {
    var stream = through2.obj();

    if (!R.isArrayLike(files)) {
      files = [files];
    }

    R.forEach(function(file) {
      stream.push(file);
    }, files);
    stream.push(null);

    return stream;
  },
  'getVinylStream': function(filePath) {
    var stream = gulp.src(filePath);

    if (filePath.split('.').pop() === 'gz') {
      stream = stream.pipe(gunzip())
        .pipe(through2.obj(function(file, _, next) {
          file.history.unshift(file.history[0]);
          file.history[0] += '.gz';
          next(null, file);
        }));
    }

    return stream;
  },
  'write': function(options) {
    options = options ? options : {};

    return through2.obj(function(file, _, next) {
      var timestamp = options.timestamp ? moment(options.timestamp) : moment();
      var stream;

      if (file.isNull()) {
        return next(null, file);
      }

      if (file.isStream()) {
        return next(new gutil.PluginError('chronostore', 'Streaming not supported'));
      }

      stream = cs.vinylsToStream(file);
      stream = stream.pipe(rename(fileRename(timestamp)));
      if (options.gzip) {
        stream = stream.pipe(gzip());
      }
      stream = stream.pipe(gulp.dest(fileDestination(options, timestamp)));

      stream.on('data', function() {
        next(null, file);
      });
    });
  },
  'search': function(options) {
    options = options || {};
    var from = options.from || 0;
    var to = options.to || Date.now();
    var root = options.root || { 'root': './chronostore'};

    return gulp.src(root + '/**/*.*')
      .pipe(filter(filterVinylByTimestamp));
  }
};

module.exports = cs;
