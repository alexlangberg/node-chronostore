'use strict';

/*eslint-disable vars-on-top */

var test = require('tape');
var cs = require('../');
var Vinyl = require('vinyl');

//function log(object) {
//  for (var property in object) {
//    if (object.hasOwnProperty(property)) {
//      console.log(property, object[property]);
//    }
//  }
//}

function writeAndRead(file, options, callback) {
  cs.objectToStream(file)
    .pipe(cs.write(options))
    .on('data', function(obj) {
      var filePath = obj.history[obj.history.length - 1];
      cs.getJSONgzStream(filePath)
        .on('data', function(data) {
          callback({
            'filePath': filePath,
            'obj': obj,
            'content': data
          });
        });
    });
}

test('returns true', function (t) {
  t.plan(1);
  t.equal(typeof cs.write, 'function');
});

test('can write a virtual file', function (t) {
  t.plan(2);

  var fileContent = '{"foo":"bars"}';
  var file = new Vinyl({
    'path': 'tests.json',
    'contents': new Buffer(fileContent)
  });

  writeAndRead(file, {'root': './testdata'}, function(data) {
    t.true(data.filePath.indexOf('.json.gz') > -1);
    t.equal(data.content.foo, JSON.parse(fileContent).foo);
  });
});

test('can write with default options', function (t) {
  t.plan(2);

  var fileContent = '{"foo":"bars"}';
  var file = new Vinyl({
    'path': 'tests.json',
    'contents': new Buffer(fileContent)
  });

  writeAndRead(file, null, function(data) {
    t.true(data.filePath.indexOf('.json.gz') > -1);
    t.equal(data.content.foo, JSON.parse(fileContent).foo);
  });
});
