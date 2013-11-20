var debug = require('debug')('converter');
var sqlite = require('sqlite3').verbose();
var olddb = new sqlite.Database(process.argv[2], sqlite.OPEN_READONLY);
var newdb = new sqlite.Database(process.argv[3]);
var fileDir = process.argv[4];
var fileMap = {};

console.log('Converting from ' + process.argv[2] + ' to ' + process.argv[3] + ', with file dir ' + process.argv[4]);

(function(end) {
  // Walk through all files and mapping their name to the dir.
  var debug = require('debug')('walker');
  var walk = require('walk');

  debug('Start walking');
  var walker = walk.walkSync(fileDir, null);

  walker.on("file", function (root, fileStats, next) {
    // debug(root + fileStats.name);
    fileMap[fileStats.name] = root + fileStats.name;
  });

  walker.on("end", function() {
    debug(JSON.stringify(fileMap, null, ' '));
    debug('Finished walking');
    end();
  });
})(function() {
  // Convert all vendor info into new db
  olddb.all('SELECT * FROM vendors', function(err, rows) {
    rows.forEach(function(row) {
      debug(JSON.stringify(row));
    });
  });
});
