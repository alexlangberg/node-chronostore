'use strict';

var R = require('ramda');
var moment = require('moment');
var uuid = require('node-uuid');
var gzip = require('gulp-gzip');
var gunzip = require('gulp-gunzip');
var through2 = require('through2');
var gulp = require('gulp');
var gulpfilter = require('gulp-filter');
var rename = require('gulp-rename');
var gutil = require('gulp-util');
var gulpif = require('gulp-if');
var Vinyl = require('vinyl');
var rfs = require('rotating-file-stream');

function padTimestamp(timestamp) {
  return ('0000000000000' + timestamp + '').slice(-13);
}

function vinylFileName(file) {
  return R.last(R.split('/', file.path));
}

function vinylFileExtension(vinyl) {
  var fileName = vinylFileName(vinyl);
  return R.last(R.split('.', fileName));
}

function vinylIsZipped(vinyl) {
  return vinylFileExtension(vinyl) === 'gz';
}

function vinylTimestamp(vinyl) {
  var fileName = vinylFileName(vinyl);
  return parseInt(fileName.slice(0, 13), 10);
}

function vinylRename(timestamp) {
  return function(vinyl) {
    vinyl.basename = padTimestamp(timestamp) + '-' + uuid.v1();
  };
}

function vinylDestination(options, timestamp) {
  return function() {
    var root = options.root || './chronostore';
    var format = options.format || ['YYYY'];

    return R.reduce(function(path, timeFormat) {
      path += '/' + timestamp.format(timeFormat);
      return path;
    }, root, format);
  };
}

function filterVinylByTimestamp(from, to) {
  return function(vinyl) {
    var timestamp = vinylTimestamp(vinyl);
    return from <= timestamp && timestamp <= to;
  };
}

function logEntry(destination, filename) {
  var entry = {
    'folder': destination,
    'filename': filename
  };

  return JSON.stringify(entry) + '\n';
}

var cs = {
  'logger': null,
  'write': function(options) {
    options = options || {};

    if (options.log && !cs.logger) {
      cs.logger = rfs('chronostore.log', {
        'size': options.log.size || '10M',
        'path': options.log.path || './chronostore-logs'
      });
    }

    return through2.obj(function(vinyl, _, next) {
      var timestamp = options.timestamp ? moment(options.timestamp) : moment();
      var destination = vinylDestination(options, timestamp)();
      var stream;

      if (vinyl.isNull()) {
        return next(null, vinyl);
      }

      if (vinyl.isStream() && options.gzip) {
        return next(new gutil.PluginError(
          'chronostore',
          'Streaming not supported with gzip enabled'
        ));
      }

      stream = cs.vinylsToStream(vinyl);
      stream = stream.pipe(rename(vinylRename(timestamp)));
      if (options.gzip) {
        stream = stream.pipe(gzip());
      }
      stream = stream.pipe(gulp.dest(destination));

      stream.on('data', function() {
        if (options.log) {
          cs.logger.write(logEntry(destination, vinyl.basename));
        }

        next(null, vinyl);
      });

      return stream;
    });
  },
  'writeObject': function(options) {
    return through2.obj(function(obj, _, next) {
      var stream = cs.objectToStream(obj);

      stream.pipe(cs.objectToVinyl())
        .pipe(cs.write(options))
        .on('data', function(vinyl) {
          return next(null, vinyl);
        });
    });
  },
  'objectToStream': function(obj) {
    var stream = through2.obj();

    stream.push(obj);
    stream.push(null);

    return stream;
  },
  'read': function(glob, options) {
    options = options || {};
    var from = options.from || 0;
    var to = options.to || Date.now();
    var parseJSON = options.parseJSON || false;

    return gulp.src(glob, options.gulp)
      .pipe(gulpif(
        options.from || options.to,
        gulpfilter(filterVinylByTimestamp(from, to))
      ))
      .pipe(gulpif(vinylIsZipped, gunzip()))
      .pipe(gulpif(parseJSON, cs.vinylStreamParseToJSON()));
  },
  'search': function(options) {
    options = options || {};
    var root = options.root || './chronostore';

    return cs.read(root + '/**/*.*', options);
  },
  'createVinyl': function(options) {
    return new Vinyl({
      'path': options.path || 'chronostore.json',
      'contents': new Buffer(options.contents)
    });
  },
  'objectToVinyl': function() {
    return through2.obj(function(obj, _, next) {
      var options = {'contents': JSON.stringify(obj)};
      var vinyl = cs.createVinyl(options);

      return next(null, vinyl);
    });
  },
  'vinylsToStream': function(vinyls) {
    var stream = through2.obj();

    if (!R.isArrayLike(vinyls)) {
      vinyls = [vinyls];
    }

    R.forEach(function(vinyl) {
      stream.push(vinyl);
    }, vinyls);
    stream.push(null);

    return stream;
  },
  'vinylStreamParseToJSON': function() {
    return through2.obj(function(vinyl, _, next) {
      var result;

      try {
        result = JSON.parse(vinyl.contents.toString());
      } catch (err) {
        result = vinyl;
      }

      return next(null, result);
    });
  }
};

module.exports = cs;
