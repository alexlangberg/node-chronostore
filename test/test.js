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
var defaultDir = './chronostore';
var options = {'root': testDir};
var fileContents = [
  {'path': 'file1.json', 'contents': '{"foo":1}'},
  {'path': 'file2.json', 'contents': '{"foo":2}'},
  {'path': 'file3.json', 'contents': '{"foo":3}'}
];

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

function writeVinyl(file, options, callback) {
  cs.vinylsToStream(file)
    .pipe(cs.write(options))
    .on('data', function(result) {
      return callback(null, result);
    });
}

function readVinyl(filePath, callback) {
  cs.read(filePath)
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
  var input = {'contents': '{"foo": "bars"}'};

  writeReadVinyl(createVinyl(input), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(input.contents).foo);
    rimraf.sync(testDir);
  });
});

test('it can write with default options', function (t) {
  t.plan(2);
  var input = {'contents': '{"foo": "bars"}'};
  var options = null;

  writeReadVinyl(createVinyl(input), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(input.contents).foo);
    rimraf.sync(defaultDir);
  });
});

test('it write physical file', function (t) {
  t.plan(1);
  var filePath = testDir + '/' + 'foobars.json';
  var fileContent = {'foo': 'bars'};

  fs.outputJsonSync(filePath, fileContent);

  readVinyl(filePath, function(err, file, json) {
    t.equal(json.foo, fileContent.foo);
    rimraf.sync(testDir);
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
    rimraf.sync(testDir);
  });
});

test('it can gzip file', function (t) {
  t.plan(2);

  var input = {'contents': '{"foo": "bars"}'};
  var options = {'root': testDir, 'gzip': true};

  writeReadVinyl(createVinyl(input), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(input.contents).foo);
    rimraf.sync(testDir);
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
    rimraf.sync(testDir);
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
      rimraf.sync(testDir);
    });
});

test('it can search for everything', function(t) {
  t.plan(3);
  var files = R.map(createVinyl, fileContents);
  var asserts = 0;

  cs.vinylsToStream(files)
    .pipe(cs.write(options))
    .on('data', function() {})
    .on('end', function() {
      cs.search(options)
        .on('data', function(file) {
          var json = JSON.parse(file.contents.toString());
          var input = JSON.parse(fileContents[asserts].contents);
          t.equal(json.foo, input.foo);
          asserts++;
        })
        .on('end', function() {
          rimraf.sync(testDir);
        });
    });
});

test('it can search with default options', function(t) {
  t.plan(1);

  var input = {'contents': '{"foo": "bars"}'};

  cs.vinylsToStream(createVinyl(input))
    .pipe(cs.write())
    .on('data', function() {})
    .on('end', function() {
      cs.search()
        .on('data', function(file) {
          var json = JSON.parse(file.contents.toString());
          var original = JSON.parse(input.contents);
          t.equal(json.foo, original.foo);
        })
        .on('end', function() {
          rimraf.sync(defaultDir);
        });
    });
});

test('it can search for specific time period', function(t) {
  t.plan(1);


  var file1 = createVinyl(fileContents[0]);
  var file2 = createVinyl(fileContents[1]);
  var file3 = createVinyl(fileContents[2]);

  var options1 = {'root': testDir, 'timestamp': 1000};
  var options2 = {'root': testDir, 'timestamp': 2000};
  var options3 = {'root': testDir, 'timestamp': 3000};

  writeVinyl(file1, options1, function() {
    writeVinyl(file2, options2, function() {
      writeVinyl(file3, options3, function() {
        cs.search({'from': 1500, 'to': 2500, 'root': testDir})
          .on('data', function(file) {
            var json = JSON.parse(file.contents.toString());
            var original = JSON.parse(fileContents[1].contents);
            t.equal(json.foo, original.foo);
          })
          .on('end', function() {
            rimraf.sync(testDir);
          });
      });
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
