'use strict';

var R = require('ramda');
var moment = require('moment');
var uuid = require('node-uuid');
var gzip = require('gulp-gzip');
var gunzip = require('gulp-gunzip');
var through2 = require('through2');
var vfs = require('vinyl-fs');
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
  return function () {
    var root = options.root || './output';
    var format = options.format || ['YYYY'];

    return R.reduce(function (string, elem) {
      string += '/' + timestamp.format(elem);
      return string;
    }, root, format);
  };
}

var cs = {
  'vinylToStream': function (obj) {
    var stream = through2.obj();

    stream.push(obj);
    stream.push(null);

    return stream;
  },
  'getVinylStream': function(filePath) {
    var stream = vfs.src(filePath);

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
  'write': function (options) {
    options = options ? options : {};

    return through2.obj(function (file, _, next) {
      var timestamp = options.timestamp ? moment(options.timestamp) : moment();

      if (file.isNull()) {
        return next(null, file);
      }

      if (file.isStream()) {
        return next(new gutil.PluginError('chronostore', 'Streaming not supported'));
      }

      var stream = cs.vinylToStream(file);

      stream = stream.pipe(rename(fileRename(timestamp)));

      if (options.gzip) {
        stream = stream.pipe(gzip());
      }

      stream = stream.pipe(vfs.dest(fileDestination(options, timestamp)));

      stream.on('data', function () {
        next(null, file);
      });
    });
  }
  //'search': function (from, to, options) {
  //  from = from ? from : 0;
  //  to = to ? to : Date.now();
  //  options = options ? options : {};
  //
  //
  //}
};

module.exports = cs;
