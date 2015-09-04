'use strict';

/*eslint-disable vars-on-top */
/*eslint-disable max-nested-callbacks */
/*eslint-disable handle-callback-err */

var test = require('tape');
var cs = require('../');
var Vinyl = require('vinyl');
var fs = require('fs-extra');
var through2 = require('through2');
var testDir = './testdata';
var options = {'root': testDir};

//function log(object) {
//  for (var property in object) {
//    if (object.hasOwnProperty(property)) {
//      console.log(property, object[property]);
//    }
//  }
//}

function createVinyl(contents) {
  return new Vinyl({
    'path': 'chronostore.json',
    'contents': new Buffer(contents)
  });
}

function writeVinyl(file, options, callback) {
  cs.vinylToStream(file)
    .pipe(cs.write(options))
    .on('data', function(result) {
      return callback(null, result);
    });
}

function readVinyl(filePath, callback) {
  cs.getVinylStream(filePath)
    .on('data', function(file) {
      var json = JSON.parse(file.contents.toString());
      return callback(null, file, json);
    });
}

function writeReadVinyl(file, options, callback) {
  writeVinyl(file, options, function(err, result) {
    var filePath = result.history.slice(-1)[0];
    readVinyl(filePath, callback);
  });
}

test('it can write a virtual file', function (t) {
  t.plan(2);
  var fileContent = '{"foo": "bars"}';

  writeReadVinyl(createVinyl(fileContent), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(fileContent).foo);
  });
});

test('it can write with default options', function (t) {
  t.plan(2);
  var fileContent = '{"foo": "bars"}';
  var options = null;

  writeReadVinyl(createVinyl(fileContent), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(fileContent).foo);
  });
});

test('it write physical file', function (t) {
  t.plan(1);
  var filePath = testDir + '/' + 'foobars.json';
  var fileContent = {'foo': 'bars'};

  fs.outputJsonSync(filePath, fileContent);

  readVinyl(filePath, function(err, file, json) {
    t.equal(json.foo, fileContent.foo);
  });
});

test('it can have the timestamp overridden', function (t) {
  t.plan(2);

  var fileContent = '{"foo": "bars"}';
  var options = {
    'root': testDir,
    'timestamp': 123
  };

  writeReadVinyl(createVinyl(fileContent), options, function(err, file, json) {
    var filePath = file.history.slice(-1)[0];
    t.true(filePath.indexOf(options.timestamp + '') > -1);
    t.equal(json.foo, JSON.parse(fileContent).foo);
  });
});

test('it can gzip file', function (t) {
  t.plan(2);

  var fileContent = '{"foo": "bars"}';
  var options = {'root': testDir, 'gzip': true};

  writeReadVinyl(createVinyl(fileContent), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(fileContent).foo);
  });
});

test('it ignores empty files', function(t) {
  t.plan(3);

  var file = new Vinyl({
    'path': 'chronostore.json',
    'contents': null
  });

  writeVinyl(file, options, function(err, result) {
    t.equal(result.contents, null);
    t.equal(result.history.length, 1);
    t.equal(result.history[0], 'chronostore.json');
  });
});

test('it throws on streams', function(t) {
  t.plan(1);

  var file = new Vinyl({
    'path': 'chronostore.json',
    'contents': through2.obj()
  });

  cs.vinylToStream(file)
    .pipe(cs.write(options))
    .on('error', function(error) {
      t.equal(error.message, 'Streaming not supported');
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
