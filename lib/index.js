'use strict';

var R = require('ramda');
var moment = require('moment');
var uuid = require('node-uuid');
var gzip = require('gulp-gzip');
var through2 = require('through2');
var vinylFs = require('vinyl-fs');
var rename = require('gulp-rename');
var tap = require('gulp-tap');
var zlib = require('zlib');
var fs = require('fs');

/**
 * Gets a timestamp either from a the file or moment()
 * @param {{chronostore:number}} file Incoming vinyl-fs file
 * @returns {object} moment timestamp
 */
function getTimestamp(file) {
  if (file.stat && file.stat.mtime) {
    return moment(file.stat.mtime);
  }
  return moment();
}

/**
 * Renames the file to a timestamp and a uuid
 * @param {object} file Incoming vinyl-fs file
 * @returns {undefined} Per gulp-rename spec
 */
function fileRename(file) {
  file.basename = getTimestamp(file) + '-' + uuid.v1();
}

/**
 * Returns a function to determine the file destination (fs.dest)
 * @param {object} options Options object
 * @returns {Function} File destination determination function
 */
function fileDestination(options) {
  return function (file) {
    var timestamp = getTimestamp(file);
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
      cs.objectToStream(obj)
        .pipe(rename(fileRename))
        .pipe(gzip())
        .pipe(vinylFs.dest(fileDestination(options)))
        .on('data', function (data) {
          next(null, data);
        });
    });
  }
};

module.exports = cs;
