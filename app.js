const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');

app.get('/', function (req, res) {
  console.log('Index');
  res.sendFile(path.join(__dirname + '/index.html'));
});

var server = app.listen(8000, function() {
  console.log('╔══════════════════════════╗');
  console.log('║ Server Started Port 8000 ║');
  console.log('╚══════════════════════════╝');
});