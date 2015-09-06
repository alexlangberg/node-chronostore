# node-chronostore
[![npm version](http://img.shields.io/npm/v/chronostore.svg)](https://www.npmjs.org/package/chronostore)
[![Build Status](http://img.shields.io/travis/alexlangberg/node-chronostore.svg)](https://travis-ci.org/alexlangberg/node-chronostore)
[![Dependency Status](https://david-dm.org/alexlangberg/node-goldwasher.svg)](https://david-dm.org/alexlangberg/node-goldwasher)
[![devDependency Status](https://david-dm.org/alexlangberg/node-goldwasher/dev-status.svg)](https://david-dm.org/alexlangberg/node-goldwasher#info=devDependencies)

Sometimes when collecting data, the most important attribute of the data will be the point in time at which it was collected. The data might all be structured in the same way, or simply awaiting analysis in the future. The datum itself might not have any relevance, without relation to a collection of data collected over time for comparison. It not have any meaningful identification except a timestamp, which is often the case with automated data collection.

While the file properties of files in normal file systems can certainly be useful, they are also fragile in the sense that some file systems will change the timestamps and an essential attribute of the data might be lost. And if you have to move the file to another storage solution, you might have no idea what will happen to the timestamps.

To solve all these problems, I have created chronostore. You simply hand it some files, and it will rename them to a timestamp plus a UUID in a folder structure of your choice, using plain files in your file system. Afterwards, you can search for files according to the time at which you handed them to chronostore, and you will be handed back a stream of files for the timespan you select. It also supports automatic gzipping of files, if you turn it on with an option.

Linted with ESLint, tested with tape and 100% coverage with covert.

## Installation
```
npm install chronostore
```

## Methods
### chronostore.write(*[options]*)
A write stream that accepts a stream of [vinyl](https://www.npmjs.com/package/vinyl) files. You can use [vinyl-source-stream](https://www.npmjs.com/package/vinyl-source-stream), [vinyl-fs](https://www.npmjs.com/package/vinyl-fs)(.src), [gulp](https://www.npmjs.com/package/gulp)(.src) or whatever you feel like that streams a source of vinyl files. If you want to write JavaScript objects as JSON directly, have a look at ```chronostore.writeObject()```. See *example.js*.

options (object):
- ```root``` (string) - the root of the chronostore file system. Defaults to ```./chronostore```.
- ```format``` (string[]) - an array of [moment](https://www.npmjs.com/package/moment) format strings, indicating the folder structure, one folder level per entry. Defaults to ```['YYYY']```.
- ```gzip``` (boolean) - turn on gzip compression (only works with vinyl files with Buffer contents). 
- ```timestamp``` (number) - override the timestamp, to make the file appear from a different time.

### chronostore.writeObject(*[options]*)
A wrapper function around ```chronostore.write()``` for writing a stream of JavaScript objects to JSON format directly. Conversion to vinyl files will be done on the fly. Remember that functions cannot be parsed. See *exampleObject.js*.

options (object):
- Same as ```chronostore.write()```

### chronostore.search(*[options]*)
Find files within a timespan. Basically just calls ```chronostore.read()``` with a glob set to ```'/**/*.*'```.

options (object):
- ```root``` (string) - the root of the chronostore file system. Defaults to ```./chronostore```.
- ```from``` (number) - a timestamp from which the search should begin. Defaults to ```0``` (Unix epoch).
- ```to``` (number) - a timestamp at which the search should end. Defauls to ```Date.now()``` (current time).
- All other options of ```chronostore.read()``` can also be applied and will be passed through.

### chronostore.read(glob, *[, options]*)
You most likely want to use ```chronostore.search()``` for most tasks. However, if for some reason you want to refine your search, you can call this function directly. A read stream that in itself streams through all files and finds the ones within an optional timespan. If no timespan is provided, all files will be returned. Will automatically gunzip compressed gz files on the fly.

glob (string): a glob string to find the file(s) you want.

options (object):
- ```root``` (string) - the root of the chronostore file system. Defaults to ```./chronostore```.
- ```from``` (number) - a timestamp from which the search should begin. Defaults to ```0``` (Unix epoch).
- ```to``` (number) - a timestamp at which the search should end. Defauls to ```Date.now()``` (current time).
- ```parseJSON``` (boolean) - set to ```true``` to enable automatic parsing of JSON files to return a JS object instead of the usual vinyl file.
- ```gulp``` (object) - an options object that will be passed on to ```gulp.src()``` internally. Can be used to e.g. set files to be read as streams instead of buffers.

### Additional methods
Other methods are publicly exposed, most of them for handling streams and vinyl files. See lib folder for source code.

## Example
```javascript
var cs = require('chronostore');
var gulp = require('gulp');

var options = {
  'root': 'foobaz'
};

// create a vinyl stream
var stream = gulp.src('README.md');

// write file to disk
stream.pipe(cs.write(options))
  .on('data', function() {
    // when file has been written, search for it
    cs.search(options)
      .on('data', function(file) {
        console.log(file);
        console.log(file.contents.toString());
      });
  });
```

## Example writeObject
```javascript
var cs = require('chronostore');
var through2 = require('through2');

// set object and root
var obj = {'foo': 'bar'};
var options = {
  'root': 'foobar',
  'parseJSON': true
};

// create a stream and end it with null
var stream = through2.obj();
stream.push(obj);
stream.push(null);

// write object to disk
stream.pipe(cs.writeObject(options))
  .on('data', function() {
    // when object has been written, search for it
    cs.search(options)
      .on('data', function(file) {
        console.log(file);
      });
  });
```
