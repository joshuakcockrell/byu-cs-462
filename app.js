const fs = require('fs');
const util = require('util');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const request = require('request');

console.log('starting at:');
console.log(__dirname);

// Override console.log to also write to output.log file
const log_file = fs.createWriteStream(__dirname + '/output.log', {flags : 'a'});
console.log = (d) => { //
  log_file.write(util.format(d) + '\n');
  process.stdout.write(d + '\n');
};

console.dir = (d) => {
  console.log(JSON.stringify(d, null, 2));
}

let saveDB = () => {
  json = JSON.stringify(db); //convert it back to json
  fs.writeFile('db.json', json, (err) => {
    if (err) {
      console.log(err);
    }
  });
}

let loadDB = (cb) => {
  if (!fs.existsSync('db.json')) {
    console.log('Empty db loaded..');
    return {users: []}
  }

  let data = fs.readFileSync('db.json');

  if (data.length === 0) {
    console.log('Empty db loaded..');
    return {users: []}
  }

  console.log('Existing db loaded..');
  return JSON.parse(data);
}

let db = loadDB();
console.dir(db);

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

app.get('/', (req, res) => {
  console.log('Index');
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.post('/user', (req, res) => {
  console.log('POST user');
  let user = {id: db.users.length + 1, name: req.body.fname, lastLogin: 'Havent logged in yet'};
  db.users.push(user);
  saveDB();
  return res.redirect('/users');
});

// Login
app.get('/user/:id', (req, res) => {
  console.dir(req.params);
  let user = db.users.find(user => user.id == req.params.id);
  if (user === undefined) {
    return res.json({message: 'user not found'});
  }
  let curDate = new Date();
  let curDateStr = curDate.toString();
  console.log('login at: ' + curDateStr);

  user.lastLogin = curDateStr;
  saveDB();

  res.cookie('user', user, { httpOnly : false });
  return res.redirect('/users');
});

app.get('/logout', (req, res) => {
  res.clearCookie('user');
  return res.redirect('/users');
});

app.get('/users', (req, res) => {

  console.log('cookieeee');

  let text = '';

  console.log(req.cookies.user);
  if (req.cookies.user !== undefined) {
    text += '<h1>Logged in as: '+req.cookies.user.name+'</h1>';
    text += "<h1><a href='https://foursquare.com/oauth2/authenticate?client_id=5PHHDV0NIRJYRKG5KPI0GVJWEXUIMMNZTMLURR3U32OE1QJO&response_type=code&redirect_uri=http://ec2-52-43-158-0.us-west-2.compute.amazonaws.com/fredirect1'>Connect Foursquare</a></h1>";
    text += "<h2>Foursquare Code: "+req.cookies.user.foursquareCode+"</h2>"
    text += "<h1><a href='/logout'>Log out</a></h1>";
  }

  text += `
<h1>Users</h1>
<table>
  <tr><th>Name</th><th>Last Login</th><th>Login</th></tr>
`;

  // Add users list
  db.users.forEach(user => {
    let link = '<tr><td>' + user.name + '</td><td>' + user.lastLogin + '</td><td><a href="/user/' + user.id + '">Login</a></td></tr>';
    text += link;
  });
  text += '</table>';

  // Add new user form
  text += `
<h1>Add User</h1>
<form action="/user" method="post">
  Name: <input type="text" name="fname"><br>
  <input type="submit" value="Submit">
</form>
`;
  return res.send(text);
});

app.get('/test', (req, res) => {
  console.log('GET');
  res.json({query: req.query, body: req.body, headers: req.headers});
});

app.post('/test', (req, res) => {
  console.log('POST');
  res.json({query: req.query, body: req.body, headers: req.headers});
});

app.get('/drop-db', (req, res) => {
  db = {users: []};
  saveDB();
  return res.redirect('/users');
});

app.get('/fredirect1', (req, res) => {
  console.log('--fredirect 1--');
  console.dir(req.body);
  console.dir(req.headers);
  console.dir(req.params);
  console.dir(req.query);

  var options = {
    uri: "https://foursquare.com/oauth2/access_token?client_id=5PHHDV0NIRJYRKG5KPI0GVJWEXUIMMNZTMLURR3U32OE1QJO&client_secret=USS0L4SRHHHOKBEZXS1IWC04OPBPNUIJZQUGRQ51P45EPWJJ&grant_type=authorization_code&redirect_uri=http://ec2-52-43-158-0.us-west-2.compute.amazonaws.com/users&code=" + req.query.code,
    method: 'GET'
  };

  request(options, (err, response, body) => {
    if (!err && response.statusCode == 200) {
      console.log(body) // Print the shortened url.

      let user = db.users.find(user => user.id == req.cookies.user.id);
      if (user === undefined) { return res.json({message: 'user not found'}); }

      user.foursquareCode = req.body.access_token;
      saveDB();
      res.cookie('user', user, { httpOnly : false });
      return res.redirect('/users');
    }
  });
});

app.get('/accept', (req, res) => {

  console.dir(req.headers.accept);

  if (req.headers.accept === 'application/vnd.byu.cs462.v1+json') {
    return res.json({"version": "v1" });
  }
  if (req.headers.accept === 'application/vnd.byu.cs462.v2+json') {
    return res.json({"version": "v2" });
  }
  return res.json({message: 'not a valid accept header', header: req.headers.accept});
});

app.get('/redirect', (req, res) => {
  console.log('redirect');

  if (req.query.site === 'site1') {
  	res.redirect('https://www.google.com/');
  }
  else if (req.query.site === 'site2') {
  	res.redirect('http://www.cnn.com/');
  }
  else if (req.query.site === 'site3') {
  	res.redirect('https://twitter.com/');
  }
  else {
  	res.json({message: 'not a valid site'});
  }
});

var server = app.listen(8000, function() {
  console.log('╔══════════════════════════╗');
  console.log('║ Server Started Port 8000 ║');
  console.log('╚══════════════════════════╝');
});






















