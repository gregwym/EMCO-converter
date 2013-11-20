var debug = require('debug')('converter');
var sqlite = require('sqlite3').verbose();
var crypto = require('crypto');
var fs = require('fs');
var futures = require('futures');

var olddb = new sqlite.Database(process.argv[2], sqlite.OPEN_READONLY);
var newdb = new sqlite.Database(process.argv[3]);
var fromDir = process.argv[4];
var toDir = process.argv[5];
var fileMap = {};

console.log('Converting from ' + process.argv[2] + ' to ' + process.argv[3] + ', with from dir ' + fromDir + ' and to dir ' + toDir);

// Copy file to `toDir` and insert into files table
var fileDebug = require('debug')('file');
var insertAndCopyFile = function(name, next) {
  var path = fileMap[name];
  if (typeof path !== 'string') {
    return next(null);
  }

  // Get the file hash
  var sha = crypto.createHash('sha256');
  var file = fs.readFileSync(path);
  var hash = sha.update(file).digest('hex');
  var extension = path.substr(path.lastIndexOf('.') + 1, path.length);
  var fileName = hash + '.' + extension;

  fs.writeFileSync(toDir + fileName, file);
  newdb.run('INSERT INTO files (hash, file_extension) VALUES (?, ?)', [hash, extension], function(err) {
    if (err) { fileDebug(err); process.exit(1); }
    fileDebug('#' + this.lastID + ' ' + fileName + ': ' + path);
    next(this.lastID);
  });
};

// Walk through all files and mapping their name to the dir.
var buildFileMap = function(next) {
  var debug = require('debug')('walker');
  var walk = require('walk');

  console.log('Start building file map');
  var walker = walk.walkSync(fromDir, null);

  walker.on('file', function (root, fileStats) {
    // debug(root + fileStats.name);
    fileMap[fileStats.name] = root + '/' + fileStats.name;
  });

  walker.on('end', function() {
    debug(JSON.stringify(fileMap, null, ' '));
    console.log('File map built successfully');
    next();
  });
};

// Convert all vendor info
var convertVendor = function(next) {
  var join = futures.join();

  console.log('Start converting vendor data');
  olddb.each('SELECT * FROM vendors', function(err, row) {
    console.log('Vendor: ' + row.name);
    var inserted = join.add();
    // Insert icon file
    insertAndCopyFile(row.logo, function(iconID) {
      // Insert vendor
      var values = [row.name, iconID, row.url, row.address];
      newdb.run('INSERT INTO vendors (name, icon_id, url, address_line1) VALUES (?, ?, ?, ?)', values, function(err) {
        if (err) { debug(err); process.exit(1); }
        debug('Vendor #' + this.lastID + ': ' + JSON.stringify(values));
        inserted();
      });
    });
  }, function(err, numOfRows) {
    // Continue when all vendors were inserted
    join.when(function() {
      next();
    });
  });
};

// All done
var complete = function() {
  console.log('Convertion complete. ');
};

// Execute each step in sequence
var sequence = futures.sequence();
sequence
  .then(function(next) {
    // Serialize all new db operations
    newdb.serialize();
    next();
  })
  .then(buildFileMap)
  .then(convertVendor)
  .then(complete);
