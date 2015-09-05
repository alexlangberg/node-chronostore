'use strict';

var R = require('ramda');
var moment = require('moment');
var uuid = require('node-uuid');
var gzip = require('gulp-gzip');
var gunzip = require('gulp-gunzip');
var through2 = require('through2');
var gulp = require('gulp');
var gulpfilter = require('gulp-filter');
var rename = require('gulp-rename');
var gutil = require('gulp-util');
var gulpif = require('gulp-if');

function padTimestamp(timestamp) {
  return ('0000000000000' + timestamp + '').slice(-13);
}

function vinylFileName(file) {
  return R.last(R.split('/', file.path));
}

function vinylFileExtension(file) {
  var fileName = vinylFileName(file);
  return R.last(R.split('.', fileName));
}

function vinylIsZipped(file) {
  return vinylFileExtension(file) === 'gz';
}

function vinylTimestamp(file) {
  var fileName = vinylFileName(file);
  return parseInt(fileName.slice(0, 13), 10);
}

function vinylRename(timestamp) {
  return function(file) {
    file.basename = padTimestamp(timestamp) + '-' + uuid.v1();
  };
}

function vinylDestination(options, timestamp) {
  return function() {
    var root = options.root || './chronostore';
    var format = options.format || ['YYYY'];

    return R.reduce(function(string, elem) {
      string += '/' + timestamp.format(elem);
      return string;
    }, root, format);
  };
}

function filterVinylByTimestamp(from, to) {
  return function(file) {
    var timestamp = vinylTimestamp(file);
    return from <= timestamp && timestamp <= to;
  };
}

var cs = {
  'write': function(options) {
    options = options ? options : {};

    return through2.obj(function(file, _, next) {
      var timestamp = options.timestamp ? moment(options.timestamp) : moment();
      var stream;

      if (file.isNull()) {
        return next(null, file);
      }

      if (file.isStream() && options.gzip) {
        return next(new gutil.PluginError(
          'chronostore',
          'Streaming not supported with gzip enabled'
        ));
      }

      stream = cs.vinylsToStream(file);
      stream = stream.pipe(rename(vinylRename(timestamp)));
      if (options.gzip) {
        stream = stream.pipe(gzip());
      }
      stream = stream.pipe(gulp.dest(vinylDestination(options, timestamp)));

      stream.on('data', function() {
        next(null, file);
      });
    });
  },
  'read': function(glob, options) {
    options = options || {};
    var from = options.from || 0;
    var to = options.to || Date.now();

    return gulp.src(glob, options.gulp)
      .pipe(gulpif(
        options.from || options.to,
        gulpfilter(filterVinylByTimestamp(from, to))
      ))
      .pipe(gulpif(vinylIsZipped, gunzip()));
  },
  'search': function(options) {
    options = options || {};
    var root = options.root || './chronostore';

    // make write.json, read.json and search.json for wrapping JS objects
    // make it work with streams as content?
    return cs.read(root + '/**/*.*', options);
  },
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
  }
};

module.exports = cs;
