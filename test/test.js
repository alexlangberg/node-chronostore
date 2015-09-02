'use strict';

/*eslint-disable vars-on-top */
/*eslint-disable max-nested-callbacks */

var test = require('tape');
var cs = require('../');
var Vinyl = require('vinyl');
var fs = require('fs-extra');
var vfs = require('vinyl-fs');
var testDir = './testdata';

//function log(object) {
//  for (var property in object) {
//    if (object.hasOwnProperty(property)) {
//      console.log(property, object[property]);
//    }
//  }
//}

function createVinyl(contents) {
  return new Vinyl({
    'path': 'tests.json',
    'contents': new Buffer(contents)
  });
}

function writeAndReadObject(file, options, callback) {
  cs.objectToStream(file)
    .pipe(cs.write(options))
    .on('data', function(obj) {
      var filePath = obj.history.slice(-1)[0];
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

  var fileContent = '{"foo": "bars"}';

  writeAndReadObject(createVinyl(fileContent), {'root': testDir}, function(data) {
    t.true(data.filePath.indexOf('.json.gz') > -1);
    t.equal(data.content.foo, JSON.parse(fileContent).foo);
  });
});

test('can write with default options', function (t) {
  t.plan(2);

  var fileContent = '{"foo": "bars"}';

  writeAndReadObject(createVinyl(fileContent), null, function(data) {
    t.true(data.filePath.indexOf('.json.gz') > -1);
    t.equal(data.content.foo, JSON.parse(fileContent).foo);
  });
});

test('write physical file', function (t) {
  t.plan(1);

  var filePath = testDir + '/' + 'foobars.json';
  var fileContent = {'foo': 'bars'};

  fs.outputJsonSync(filePath, fileContent);

  vfs.src(filePath)
    .pipe(cs.write({'root': testDir}))
    .on('data', function(obj) {
      var newFilePath = obj.history.slice(-1)[0];
      cs.getJSONgzStream(newFilePath)
        .on('data', function(data) {
          t.equal(data.foo, fileContent.foo);
        });
    });
});

//test('write and read multiple files', function (t) {
//  t.plan(1);
//
//  var filePath1 = testDir + '/' + 'file1.json';
//  var filePath2 = testDir + '/' + 'file2.json';
//  var filePath3 = testDir + '/' + 'file3.json';
//  var fileContent1 = {'foo': '1bars'};
//  var fileContent2 = {'foo': '2bars'};
//  var fileContent3 = {'foo': '3bars'};
//  var counter = 0;
//  fs.outputJsonSync(filePath1, fileContent1);
//  fs.outputJsonSync(filePath2, fileContent2);
//  fs.outputJsonSync(filePath3, fileContent3);
//
//  vfs.src([filePath1, filePath2, filePath3])
//    .pipe(cs.write({'root': 'lols'}))
//    .on('data', function(obj) {
//      var newFilePath = obj.history.slice(-1)[0];
//      cs.getJSONgzStream(newFilePath)
//        .on('data', function(data) {
//          counter++;
//          console.log(data);
//          if (counter === 3) {
//            t.true(1);
//          }
//        });
//    });
//});

// this is a silly strategy... should probably rather
// make some way of fetching a date from the file if it is JSON
//
//test('keeps timestamp of physical file', function (t) {
//  t.plan(1);
//
//  var filePath = testDir + '/' + 'foobars.json';
//  var fileContent = {'foo': 'bars'};
//
//  fs.outputJsonSync(filePath, fileContent);
//  var stat = fs.statSync(filePath); // use stat.mtime
//  console.log(stat.mtime.getTime());
//
//  setTimeout(function() {
//    vfs.src(filePath)
//      .pipe(cs.write({'root': testDir}))
//      .on('data', function(obj) {
//        var newFilePath = obj.history.slice(-1)[0];
//        var newFileName = newFilePath.replace(obj.base + '/', '');
//        var newTimestamp = newFileName.slice(0, 13);
//        console.log(obj.history);
//        console.log(newTimestamp);
//        console.log(stat.mtime.getTime());
//        t.true(1);
//      });
//  }, 1000);
//});
