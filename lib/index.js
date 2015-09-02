'use strict';

var R = require('ramda');
var moment = require('moment');
var uuid = require('node-uuid');
var gzip = require('gulp-gzip');
var through2 = require('through2');
var vinylFs = require('vinyl-fs');
var rename = require('gulp-rename');
var zlib = require('zlib');
var fs = require('fs');

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
  'objectToStream': function (obj) {
    var stream = through2.obj();

    stream.push(obj);
    stream.push(null);
    return stream;
  },
  'getJSONgzStream': function (filePath) {
    return fs.createReadStream(filePath)
      .pipe(zlib.createGunzip())
      .pipe(through2.obj(function (obj, _, next) {
        next(null, JSON.parse(obj));
      }));
  },
  'write': function (options) {
    if (!options) {
      options = {};
    }

    return through2.obj(function (obj, _, next) {
      var timestamp = options.timestamp ? moment(options.timestamp) : moment();

      cs.objectToStream(obj)
        .pipe(rename(fileRename(timestamp)))
        .pipe(gzip())
        .pipe(vinylFs.dest(fileDestination(options, timestamp)))
        .on('data', function (data) {
          next(null, data);
        });
    });
  }
};

module.exports = cs;
