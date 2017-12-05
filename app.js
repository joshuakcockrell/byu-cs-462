const fs = require('fs');
const util = require('util');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');

// Override console.log to write to output.log file
const log_file = fs.createWriteStream('output.log', {flags : 'w'});
console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
};

app.get('/', function (req, res) {
  console.log('Index');
  res.sendFile(path.join(__dirname + '/index.html'));
});

var server = app.listen(8000, function() {
  console.log('╔══════════════════════════╗');
  console.log('║ Server Started Port 8000 ║');
  console.log('╚══════════════════════════╝');
});