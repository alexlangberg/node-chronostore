'use strict';

/*eslint-disable vars-on-top */
/*eslint-disable max-nested-callbacks */
/*eslint-disable handle-callback-err */

var test = require('tape');
var cs = require('../');
var Vinyl = require('vinyl');
var fs = require('fs-extra');
var through2 = require('through2');
var rimraf = require('rimraf');
var concat = require('concat-stream');

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

test('it can write a virtual file to disk', function(t) {
  t.plan(2);

  writeReadVinyl(cs.createVinyl(fileContents[0]), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(fileContents[0].contents).foo);
    rimraf.sync(options.root);
  });
});

test('it can write a file to disk with default options', function(t) {
  t.plan(2);

  writeReadVinyl(cs.createVinyl(fileContents[0]), null, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(fileContents[0].contents).foo);
    rimraf.sync(defaultDir);
  });
});

test('it can read and write a physical file back to disk', function(t) {
  t.plan(1);
  var filePath = testDir + '/' + 'foobars.json';
  var fileContent = {'foo': 'bars'};

  fs.outputJsonSync(filePath, fileContent);

  readVinyl(filePath, function(err, file, json) {
    t.equal(json.foo, fileContent.foo);
    rimraf.sync(options.root);
  });
});

test('it can have the timestamp overridden', function(t) {
  t.plan(2);

  var options = {
    'root': testDir,
    'timestamp': 123
  };

  writeReadVinyl(cs.createVinyl(fileContents[0]), options, function(err, file, json) {
    var filePath = file.history.slice(-1)[0];
    t.true(filePath.indexOf(options.timestamp + '') > -1);
    t.equal(json.foo, JSON.parse(fileContents[0].contents).foo);
    rimraf.sync(options.root);
  });
});

test('it can gzip files', function(t) {
  t.plan(2);
  var options = {'root': testDir, 'gzip': true};

  writeReadVinyl(cs.createVinyl(fileContents[0]), options, function(err, file, json) {
    t.equal(file.history.slice(-1)[0].split('.').pop(), 'json');
    t.equal(json.foo, JSON.parse(fileContents[0].contents).foo);
    rimraf.sync(options.root);
  });
});

test('it can parse vinyl contents as JSON and return that instead', function(t) {
  t.plan(1);
  var options = {
    'root': testDir,
    'parseJSON': true
  };

  writeVinyl(cs.createVinyl(fileContents[0]), options, function(err, result) {
    var filePath = result.history.slice(-1)[0];
    cs.read(filePath, options)
      .on('data', function(data) {
        t.equal(data.foo, JSON.parse(fileContents[0].contents).foo);
        rimraf.sync(options.root);
      });
  });
});

test('it can pass through other files when set to parse JSON', function(t) {
  t.plan(1);
  var options = {
    'root': testDir,
    'parseJSON': true
  };
  var input = {'contents': 'not valid JSON'};

  writeVinyl(cs.createVinyl(input), options, function(err, result) {
    var filePath = result.history.slice(-1)[0];
    cs.read(filePath, options)
      .on('data', function(data) {
        var content = data.contents.toString();
        t.equal(content, input.contents);
        rimraf.sync(options.root);
      });
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
    rimraf.sync(options.root);
  });
});

test('it can write input vinyls with streams as content', function(t) {
  t.plan(1);

  var buf = new Buffer(fileContents[0].contents);
  var stream = cs.objectToStream(buf);

  var file = new Vinyl({
    'path': 'chronostore.json',
    'contents': stream
  });

  writeVinyl(file, options, function(err, result) {
    readVinyl(result.path, function(err, final) {
      t.equals(
        JSON.parse(final.contents.toString()).foo,
        JSON.parse(fileContents[0].contents).foo
      );
      rimraf.sync(options.root);
    });
  });
});

test('it throws on write input as streams if gzip enabled', function(t) {
  t.plan(1);

  var file = new Vinyl({
    'path': 'chronostore.json',
    'contents': through2.obj()
  });

  var options = {
    'gzip': true,
    'root': testDir
  };

  cs.vinylsToStream(file)
    .pipe(cs.write(options))
    .on('error', function(error) {
      t.equal(error.message, 'Streaming not supported with gzip enabled');
      rimraf.sync(options.root);
    });
});

test('it can write a JS object to disk as JSON', function(t) {
  t.plan(1);
  var obj = {'foo': 'bar'};
  var stream = cs.objectToStream(obj);

  stream.pipe(cs.writeObject(options))
    .on('data', function() {
      cs.search(options)
        .on('data', function(file) {
          var json = JSON.parse(file.contents.toString());
          t.equal(json.foo, obj.foo);
          rimraf.sync(options.root);
        });
    });
});

test('it can read vinyl files with content as streams', function(t) {
  t.plan(2);

  writeVinyl(cs.createVinyl(fileContents[0]), options, function(err, file) {
    var readOptions = {
      'gulp': {
        'buffer': false
      }
    };

    cs.read(file.path, readOptions)
      .on('data', function(result) {
        t.true(result.isStream());

        result.contents
          .pipe(concat(function(data) {
            t.equals(
              JSON.parse(data.toString()).foo,
              JSON.parse(fileContents[0].contents).foo
            );
          }));

        rimraf.sync(options.root);
      });
  });
});

test('it can search with default options', function(t) {
  t.plan(1);

  var input = {'contents': '{"foo": "bars"}'};

  cs.vinylsToStream(cs.createVinyl(input))
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

  var file1 = cs.createVinyl(fileContents[0]);
  var file2 = cs.createVinyl(fileContents[1]);
  var file3 = cs.createVinyl(fileContents[2]);

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

            // let file system take a breath...
            setTimeout(function() {
              t.equal(json.foo, original.foo);
              rimraf.sync(options1.root);
            }, 100);
          });
      });
    });
  });
});
