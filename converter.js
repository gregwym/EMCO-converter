var debug = require('debug')('converter');
var sqlite = require('sqlite3').verbose();
var crypto = require('crypto');
var fs = require('fs');

var olddb = new sqlite.Database(process.argv[2], sqlite.OPEN_READONLY);
var newdb = new sqlite.Database(process.argv[3]);
var fromDir = process.argv[4];
var toDir = process.argv[5];
var fileMap = {};

console.log('Converting from ' + process.argv[2] + ' to ' + process.argv[3] + ', with from dir ' + fromDir + ' and to dir ' + toDir);

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

  fileDebug(fileName + ': ' + path);

  fs.writeFileSync(toDir + fileName, file);
  newdb.run('INSERT INTO files (hash, file_extension) VALUES (?, ?)', [extension, hash], function(err) {
    if (err) { fileDebug(err); process.exit(1); }
    next(this.lastID);
  });
};

(function(end) {
  // Walk through all files and mapping their name to the dir.
  var debug = require('debug')('walker');
  var walk = require('walk');

  console.log('Start building file map');
  var walker = walk.walkSync(fromDir, null);

  walker.on('file', function (root, fileStats, next) {
    // debug(root + fileStats.name);
    fileMap[fileStats.name] = root + '/' + fileStats.name;
  });

  walker.on('end', function() {
    debug(JSON.stringify(fileMap, null, ' '));
    console.log('File map built successfully');
    end();
  });
})(function() {
  // Convert all vendor info into new db
  console.log('Start converting vendor data');
  olddb.all('SELECT * FROM vendors', function(err, rows) {
    rows.forEach(function(row) {
      console.log('Vendor: ' + rows.name);
      // Insert icon file
      insertAndCopyFile(row.logo, function(iconID) {
        // Insert vendor
        var values = [row.name, iconID, row.url, row.address];
        newdb.run('INSERT INTO vendors (name, icon_id, url, address_line1) VALUES (?, ?, ?, ?)', values, function(err) {
          if (err) { debug(err); process.exit(1); }
          debug('Vendor inserted: ' + this.sql + ' ' + JSON.stringify(values));
        });
      });
    });
  });
});
