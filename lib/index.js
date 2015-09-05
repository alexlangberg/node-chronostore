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
  if (vinylFileExtension(file) === 'gz') {
    return true;
  }
  return false;
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

    if (from <= timestamp && timestamp <= to) {
      return true;
    }

    return false;
  };
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
  'read': function(filePath, options) {
    options = options || {};
    var from = options.from || 0;
    var to = options.to || Date.now();

    return gulp.src(filePath)
      .pipe(gulpif(options.from || options.to, gulpfilter(filterVinylByTimestamp(from, to))))
      .pipe(gulpif(vinylIsZipped, gunzip()));
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
  'search': function(options) {
    options = options || {};
    var root = options.root || './chronostore';

    // make write.obj for wrapping JS objects
    return cs.read(root + '/**/*.*', options);
  }
};

module.exports = cs;
