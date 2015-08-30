'use strict';

var R = require('ramda');
var moment = require('moment');
var uuid = require('node-uuid');
var gzip = require('gulp-gzip');
var through2 = require('through2');
var fs = require('vinyl-fs');
var rename = require('gulp-rename');
var tap = require('gulp-tap');

/**
 * Gets a timestamp either from a the file or moment()
 * @param {{chronostore:number}} file Incoming vinyl-fs file
 * @returns {object} moment timestamp
 */
function getTimestamp(file) {
  if (file.chronostore && file.chronostore.timestamp) {
    return moment(file.chronostore.timestamp);
  }

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
  return function(file) {
    var timestamp = getTimestamp(file);
    var root = options.root || './output';
    var format = options.format || ['YYYY'];

    return R.reduce(function (string, elem) {
      string += '/' + timestamp.format(elem);
      return string;
    }, root, format);
  };
}

module.exports = {
  'write': function(options) {
    if (!options) {
      options = {};
    }

    return through2.obj(function (obj, _, callback) {
      var save = through2.obj();
      save.push(obj);
      save.push(null);
      save
        .pipe(rename(fileRename))
        .pipe(gzip())
        .pipe(fs.dest(fileDestination(options)))
        .pipe(tap(function(obj) {
          callback(null, obj);
        }));
    });
  }
};
