var debug = require('debug')('converter');
var sqlite = require('sqlite3').verbose();
var olddb = new sqlite.Database('./vendor_db.sqlite', sqlite.OPEN_READONLY);
var newdb = new sqlite.Database('./catalogue.sqlite');

olddb.all('SELECT * FROM vendors', function(err, rows) {
  rows.forEach(function(row) {
    debug(JSON.stringify(row));
  });
});
