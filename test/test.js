'use strict';

/*eslint-disable vars-on-top */

var test = require('tape');
var subject = require('../');
var Vinyl = require('vinyl');
var through2 = require('through2');
var tap = require('gulp-tap');
var fs = require('fs');

var log = function(file) {
  for (var property in file) {
    if (file.hasOwnProperty(property)) {
      console.log(property, file[property]);
    }
  }
};

test('returns true', function(t) {
  t.plan(1);
  t.equal(typeof subject.write, 'function');
});

test('can write file', function(t) {
  t.plan(2);

  var file = new Vinyl({
    'path': 'tests.json',
    'contents': new Buffer('{"foo":"barssss"}')
  });

  var input = through2.obj();
  input.push(file);
  input.push(null);
  input
    .pipe(subject.write({ 'root': './testdata' }))
    .pipe(tap(function(obj) {
      //log(obj);
      var filename = obj.history[obj.history.length - 1];
      var file = fs.readFileSync(filename);

      t.true(filename.indexOf('.json.gz') > -1);
      t.true(Buffer.isBuffer(file));
    }));
});
