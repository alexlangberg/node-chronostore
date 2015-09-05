'use strict';

/*eslint-disable vars-on-top */
/*eslint-disable max-nested-callbacks */
/*eslint-disable handle-callback-err */

var R = require('ramda');
var test = require('tape');
var cs = require('../');
var Vinyl = require('vinyl');
var fs = require('fs-extra');
var through2 = require('through2');
var rimraf = require('rimraf');
var testDir = './testdata';
var options = {'root': testDir};

//function log(object) {
//  for (var property in object) {
//    if (object.hasOwnProperty(property)) {
//      console.log(property, object[property]);
//    }
//  }
//}

function createVinyl(options) {
  return new Vinyl({
    'path': options.path || 'chronostore.json',
    'contents': new Buffer(options.contents)
  });
}

function writeVinyls(files, options, callback) {
  cs.vinylsToStream(files)
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
  writeVinyls(file, options, function(err, result) {
    var filePath = result.history.slice(-1)[0];
    readVinyl(filePath, callback);
  });
}

test('it can write a virtual file', function (t) {
  t.plan(2);
  var input = {'contents': '{"foo": "bars"}'};

  writeReadVinyl(createVinyl(input), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(input.contents).foo);
  });
});

test('it can write with default options', function (t) {
  t.plan(2);
  var input = {'contents': '{"foo": "bars"}'};
  var options = null;

  writeReadVinyl(createVinyl(input), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(input.contents).foo);
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

  var input = {'contents': '{"foo": "bars"}'};
  var options = {
    'root': testDir,
    'timestamp': 123
  };

  writeReadVinyl(createVinyl(input), options, function(err, file, json) {
    var filePath = file.history.slice(-1)[0];
    t.true(filePath.indexOf(options.timestamp + '') > -1);
    t.equal(json.foo, JSON.parse(input.contents).foo);
  });
});

test('it can gzip file', function (t) {
  t.plan(2);

  var input = {'contents': '{"foo": "bars"}'};
  var options = {'root': testDir, 'gzip': true};

  writeReadVinyl(createVinyl(input), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(input.contents).foo);
  });
});

test('it ignores empty files', function(t) {
  t.plan(3);

  var file = new Vinyl({
    'path': 'chronostore.json',
    'contents': null
  });

  writeVinyls(file, options, function(err, result) {
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

  cs.vinylsToStream(file)
    .pipe(cs.write(options))
    .on('error', function(error) {
      t.equal(error.message, 'Streaming not supported');
    });
});

test('it can search', function(t) {
  t.plan(1);

  var fileContents = [
    {'path': 'file1.json', 'contents': '{"foo":1}'},
    {'path': 'file2.json', 'contents': '{"foo":2}'},
    {'path': 'file3.json', 'contents': '{"foo":3}'}
  ];

  var files = R.map(createVinyl, fileContents);

  cs.vinylsToStream(files)
    .pipe(cs.write(options))
    .on('data', function(file) {})
    .on('end', function() {
      setTimeout(function() {
        cs.search(options)
          .on('data', function(file) {
            console.log(file);
          })
          .on('end', function() {
            t.true(1);
          });
      }, 3000);
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
