'use strict';

const fs = require('fs');
const util = require('util');
const express = require('express');
const https = require('https');
const http = require('http');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const request = require('request');

var User = require("./user.js");

app.use(express.static('public'));

console.log('starting at:');
console.log(__dirname);

const timeBetweenUpdates = 200;
const httpsPort = 8000;
const httpPort = process.argv[2];
const dbPath = httpPort+'db.json';

// Override console.log to also write to output.log file
const log_file = fs.createWriteStream(__dirname + '/output.log', {flags : 'a'});
console.log = (d) => { //
  log_file.write(util.format(d) + '\n');
  process.stdout.write(d + '\n');
};

console.dir = (d) => {
  console.log(JSON.stringify(d, null, 2));
}

let clone = (a) => {
   return JSON.parse(JSON.stringify(a));
}

// DB Methods
let saveDB = () => {
  db.usersSaved = users;
  let json = JSON.stringify(db); //convert it back to json
  fs.writeFileSync(dbPath, json);
}

let loadDB = (cb) => {
  if (!fs.existsSync(dbPath)) {
    console.log('Empty db loaded..');
    return {users: [], usersSaved: []}
  }

  let data = fs.readFileSync(dbPath);

  if (data.length === 0) {
    console.log('Empty db loaded..');
    return {users: [], usersSaved: []}
  }

  console.log('Existing db loaded..');
  return JSON.parse(data);
}

let convertToUserObjects = (users) => {

  let outputUsers = [];
  if (users.length === 0) { return outputUsers; }

  users.forEach(u => {
    let newUser = new User(u.name, u.endpoint, u.id, u.createdRumors, u.rumors, u.wants, u.knownNeighbors);
    console.dir(newUser);
    console.dir(newUser.id);
    outputUsers.push({id: newUser.id, user: newUser});
  });

  // Update with all previously existing users
  outputUsers.forEach(u => {
    let user = u.user;
    outputUsers.forEach(u2 => {
      let user2 = u2.user;
      user2.notifyOfNewUserEndpoint(user.endpoint);
    });
  });
  return outputUsers;
}

let db = loadDB();
let users = [];
users = db.usersSaved;
users = convertToUserObjects(users);
console.dir(db);

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

////////////////
// Gossip Lab //
////////////////

let getUser = (id) => {
  let result = undefined;
  users.forEach(u1 => {
    let u = u1.user;
    if (u.id == id) {
      result = u;
    }
  });
  return result;
}

let addKnownUser = (endpoint) => {
  console.log('addKnownUser: ' + endpoint);
  users.forEach(u => { 
    let user = u.user;
    user.notifyOfNewUserEndpoint(endpoint);
  });
}

let randomLocalUser = function() {
  console.dir(users);
  let randNeighbor = users[Math.floor(Math.random()*users.length)];
  console.log(999);
  console.dir(randNeighbor);
  console.log(1999)
  console.log(Object.getOwnPropertyNames(randNeighbor.user));
  return randNeighbor.user;
}

let runGossip = () => {

  if (users.length === 0) {
    return;
  }

  // Log what each user has
  users.forEach(u => {
    let user = u.user;
    console.log(user.id);
    Object.entries(user.rumors).forEach(r => {
      console.log('-'+r[0] + ' ' + Object.entries(r[1]).map(x => x[0]));
    });
  });

  let randUser = randomLocalUser();
  if (randUser === undefined) { 
    console.log('no users..');
    return; 
  }

  let message = randUser.prepareMessage();
  if (message === undefined) { 
    console.log('nothing to send..');
    return; 
  }

  console.log('send to user: ' + message.sendTo + ' from ' + randUser.id);

  // console.dir(message);

  request.post({
    url: message.sendTo,
    body: JSON.stringify(message),
    headers: {
      'Content-Type': 'application/json',
    }
  }, function(error, response, body){
    if (response !== undefined) {
      console.log(response.statusCode);
    }
  });
}

// Index page
app.get('/', (req, res) => {
  console.log('Index');
  res.sendFile(path.join(__dirname + '/index.html'));
});

// Create user
app.post('/user', (req, res) => {
  console.log('POST user');
  console.dir(req.body);

  // Create gossiping user instance
  let userObj = new User(req.body.fname);

  // Update with all previously existing users
  users.forEach(u => {
    let user = u.user;
    userObj.notifyOfNewUserEndpoint(user.endpoint);
  });

  let userEndpoint = userObj.endpoint;
  users.push({id: userObj.id, user: userObj});
  addKnownUser(userEndpoint);

  console.log(users);

  let user = {id: db.users.length + 1, name: req.body.fname, lastLogin: 'Havent logged in yet', userObjId: userObj.id};
  db.users.push(user);
  saveDB();
  return res.redirect('/users');
});

app.post('/remote-user', (req, res) => {
  console.log('POST remote user');
  console.dir(req.body);
  addKnownUser(req.body.fendpoint);
  return res.redirect('./users');
});

// Create rumor for logged in user
app.post('/create-gossip', (req, res) => {
  let curGossipUser = users.find(user => user.id == req.cookies.user.userObjId);
  console.log(req.body.gossip);
  curGossipUser.user.createRumor(req.body.gossip);
  res.redirect('./users');
});

// Send rumor direct to user
app.post('/send-gossip/:id', (req, res) => {
  // console.log('gossip received!');
  // return res.end();
  // console.log(req.params.id);
  let targetUser = getUser(req.params.id);

  if (targetUser === undefined) {
    return res.send({success: false, error: 'incorrect id'});
  }

  targetUser.receiveMessage(req.body);
  return res.send('gossip rumor/want received..');
});

// View user profile
app.get('/view/:id', (req, res) => {
  let user = db.users.find(user => user.id == req.params.id);
  if (user === undefined) { return res.json({message: 'user not found'}); }

  let text = '';

  text += '<h1>User: '+user.name+'</h1>';
  text += '<h1><a href="/users">Back to users</a></h1>';

  if (user.foursquareUser !== undefined) {
    text += '<img src="'+ user.foursquareUser.photo.prefix + '100x100' + user.foursquareUser.photo.suffix +'"/>';
    text += '<h2>'+ user.foursquareUser.firstName+' '+user.foursquareUser.lastName +'</h2>';
    text += '<h2>'+ user.foursquareUser.gender +'</h2>';
  }

  // If logged in as this user
  if (req.cookies.user !== undefined && (''+user.id === ''+req.cookies.user.id)) {
    if (user.checkins !== undefined && user.checkins.count > 0) {
      let checkins = user.checkins.items;
      text += '<h2>Checkins</h2>';
      checkins.forEach(i => {
        text += '<h4>'+ i.venue.name+', '+i.venue.city+'</h4>';
      });
    }

    text += "<h1><a href='/logout'>Log out</a></h1>";
    text += "<h1><a href='https://foursquare.com/oauth2/authenticate?client_id=5PHHDV0NIRJYRKG5KPI0GVJWEXUIMMNZTMLURR3U32OE1QJO&response_type=code&redirect_uri=https://gobyu.ga/fredirect'>Connect Foursquare</a></h1>";

  } else {
    if (user.checkins !== undefined && user.checkins.count > 0) {
      text += '<h2>Last Checkin</h2>';
      let checkins = user.checkins.items;
      text += '<h4>'+ checkins[0].venue.name+', '+checkins[0].venue.city+'</h4>';        
    }
  }

  return res.send(text);
});

// Login
app.get('/user/:id', (req, res) => {
  let user = db.users.find(user => user.id == req.params.id);
  if (user === undefined) { return res.json({message: 'user not found'}); }
  
  let curDate = new Date();
  let curDateStr = curDate.toString();
  console.log('login at: ' + curDateStr);

  user.lastLogin = curDateStr;
  saveDB();

  res.cookie('user', user);
  return res.redirect('/users');
});

app.get('/logout', (req, res) => {
  res.clearCookie('user');
  return res.redirect('/users');
});

// View all users
app.get('/users', (req, res) => {

  // Wipe cookie if user is gone
  console.log('/users');
  if (db.users.length === 0 || req.cookies.user === undefined || db.users.find(user => user.id == req.cookies.user.id) === undefined) {
    console.log('Clear users..');
    res.clearCookie('user');
  }

  let text = '';

  console.log(333);
  console.dir(users);

  if (req.cookies.user !== undefined && users.length !== 0) {
    text += '<h1>Logged in as: '+req.cookies.user.name+'</h1>';
    text += '<a href="/create-gossip">Create Gossip</a>';

    let curGossipUser = users.find(user => user.id == req.cookies.user.userObjId);

    console.dir(users);
    console.dir(req.cookies.user);
    console.dir(curGossipUser);
    let rumors = curGossipUser.user.rumors;

    console.log(111)
    console.dir(curGossipUser);
    console.log(rumors);

    // Keep all the important stuff
    let messages = [].concat.apply([], Object.values(rumors).map(a => Object.values(a))).map(b => b.rumor).map(x => {return {from:x.originator, rumor:x.text}});

    text += '<h3>Gossip</h3>';
    text += '<ul>';
    messages.forEach(m => {
      text += '<li>'+m.from+': '+m.rumor+'</li>';
    });
    text += '</ul>';

    // Create gossip form
    text += `
<h1>Create some gossip</h1>

<form action="/create-gossip" method="post">
  Gossip: <input type="text" name="gossip"><br>
  <input type="submit" value="Submit">
</form>

<a href="/users">Back to users</a>
`;

  }

  text += `
<h1>Users</h1>
<table style="border-collapse: collapse">
  <tr><th>Name</th><th>Last Login</th><th>Login</th><th>Profile</th><th>Endpoint</th></tr>
`;

  // Add users list
  db.users.forEach(user => {

    console.log(777);
    console.dir(user);
    console.dir(users);

    let notDBUser = getUser(user.userObjId);
    text += '<tr><td>' + user.name + '</td><td>' + user.lastLogin + '</td><td><a href="/user/' + user.id + '">Login</a></td><td><a href="/view/' + user.id + '">Profile</a></td><td>'+notDBUser.endpoint+'</td>';
    if (user.checkins !== undefined && user.checkins.items !== undefined && user.checkins.items.length > 0) {
      text += '<td>'+user.checkins.items[0].venue.name+', '+user.checkins.items[0].venue.city+ '</td>';
    }
    text += '</tr>';
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

  // Add remote user form
  text += `
<h1>Add User From Other Server</h1>
<form action="/remote-user" method="post">
  Name: <input type="text" name="fname"><br>
  Endpoint: <input type="text" name="fendpoint"><br>
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

// Drop db
app.get('/drop-db', (req, res) => {
  db = {users: []};
  users = [];
  saveDB();
  res.clearCookie('user');
  return res.redirect('/users');
});

// Foursquare redirect
app.get('/fredirect', (req, res) => {
  console.log('--fredirect--');

  request("https://foursquare.com/oauth2/access_token?client_id=5PHHDV0NIRJYRKG5KPI0GVJWEXUIMMNZTMLURR3U32OE1QJO&client_secret=USS0L4SRHHHOKBEZXS1IWC04OPBPNUIJZQUGRQ51P45EPWJJ&grant_type=authorization_code&redirect_uri=https://gobyu.ga/users&code=" + req.query.code, (err, response, body) => {
    if (!err && response.statusCode == 200) {

      let dbUser = db.users.find(user => user.id == req.cookies.user.id);
      let user = clone(dbUser);
      let userId = user.id;
      if (user === undefined) { return res.json({message: 'user not found'}); }

      body = JSON.parse(body);
      user.foursquareCode = body.access_token;

      ///////////////////
      // GET user info //
      request("https://api.foursquare.com/v2/users/self?v=20171201&oauth_token="+user.foursquareCode, (err, response, body) => {        
        console.log('BODY USER');
        let bodyParsed = JSON.parse(body);
        let parsedUser = bodyParsed.response.user;

        let newUser = {
          id: user.id, 
          name: user.name, 
          lastLogin: user.lastLogin,
          foursquareUser: {
            id: parsedUser.id,
            firstName: parsedUser.firstName,
            lastName: parsedUser.lastName,
            gender: parsedUser.gender,
            photo: parsedUser.photo,
            homeCity: parsedUser.homeCity,
            bio: parsedUser.bio
          },
          checkins: {
            count: parsedUser.checkins.count,
            items: []
          }
        }
        


        request("https://api.foursquare.com/v2/users/self/checkins?v=20171201&oauth_token="+user.foursquareCode, (err, response, bodyCheckins) => {
          console.log('BODY CHECKINS');
          let bodyCheckinsParsed = JSON.parse(bodyCheckins);
          let parsedCheckins = bodyCheckinsParsed.response.checkins;

          parsedCheckins.items.forEach(i => {
            newUser.checkins.items.push({
              venue: {
                name: i.venue.name,
                city: i.venue.location.city
              }
            });
          });

          // Remove that user from arr
          db.users = db.users.filter(u => !(u.id.toString() === ''+userId));
          db.users.push(clone(newUser));

          saveDB();

          res.cookie('user', clone(newUser));
          return res.redirect('/view/'+newUser.id);
        });
      });
    }
    else {
      console.dir(err);
      console.log(response.statusCode);
    }
  });
});

// View accept header
app.get('/accept', (req, res) => {

  if (req.headers.accept === 'application/vnd.byu.cs462.v1+json') {
    return res.json({"version": "v1" });
  }
  if (req.headers.accept === 'application/vnd.byu.cs462.v2+json') {
    return res.json({"version": "v2" });
  }
  return res.json({message: 'not a valid accept header', header: req.headers.accept});
});

// Redirect lab
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




setInterval(runGossip,timeBetweenUpdates);




// Force SSL
// app.use(function(req, res, next) {
//   if(!req.secure) {
//     return res.redirect(['https://', req.get('Host'), req.url].join(''));
//   }
//   next();
// });

// // HTTP
// http.createServer((req, res) => {
//   res.writeHead(301, {"Location": "https://" + req.headers['host'] + req.url});
//   res.end();
// }).listen(8080, () => {
//   console.log('http redirect on 8080..');
// });

// // Certificate locations for https
// var sslOptions = {
//   cert: fs.readFileSync('./sslcert/fullchain.pem'),
//   key: fs.readFileSync('./sslcert/privkey.pem')
// };

// // HTTPS
// https.createServer(sslOptions, app).listen(8000, () => {
//   console.log('╔══════════════════════════╗');
//   console.log('║ Server Started Port 8000 ║');
//   console.log('╚══════════════════════════╝');
// });

// Try to load HTTPS certs
let sslOptions;
try {
  sslOptions = {
    cert: fs.readFileSync('./sslcert/fullchain.pem'),
    key: fs.readFileSync('./sslcert/privkey.pem')
  };
} catch (e) {
  console.log("Error: Cannot load ssl certificates: " + e);
}


if (sslOptions !== undefined) {

  // HTTPS
  let httpsServer = https.createServer(sslOptions, app).listen(httpsPort, () => {
    console.log('╔═════════════════════════╗');
    console.log('║ HTTPS Started Port '+httpsPort+' ║');
    console.log('╚═════════════════════════╝');
  });

  // HTTP REDIRECT TO HTTPS
  http.createServer((req, res) => {
    res.writeHead(301, {"Location": "https://" + req.headers['host'] + req.url});
    res.end();
  }).listen(httpPort, () => {
    console.log('http redirect on '+httpPort+'..');
  });

} else {
  console.log('HTTPS unavailable (no SSL Certs)');
  // HTTP only
  let httpServer = http.createServer(app).listen(httpPort, () => {
    console.log('╔════════════════════════╗');
    console.log('║ HTTP Started Port '+httpPort+' ║');
    console.log('╚════════════════════════╝');
  });
}





















// app.get('/gossip', (req, res) => {
//   let curGossipUser = users.find(user => user.id == req.cookies.user.userObjId);
//   let rumors = curGossipUser.user.otherRumors;

//   // Keep all the important stuff
//   let messages = [].concat.apply([], Object.values(rumors).map(a => Object.values(a))).map(b => b.rumor).map(x => {return {from:x.originator, rumor:x.text}});

//   let text = '';

//   text += '<h3>Gossip</h3>';
//   text += '<ul>';
//   messages.forEach(m => {
//     text += '<li>'+m.from+': '+m.rumor+'</li>';
//   });
//   text += '</ul>'
//   return res.send(text);
// });

// app.get('/create-gossip', (req, res) => {

//   let text = `
// <h1>Create some gossip</h1>

// <form action="/create-gossip" method="post">
//   Gossip: <input type="text" name="gossip"><br>
//   <input type="submit" value="Submit">
// </form>

// <a href="/users">Back to users</a>
// `;

//   let curGossipUser = users.find(user => user.id == req.cookies.user.userObjId);
//   let rumors = curGossipUser.user.otherRumors;

//   // Keep all the important stuff
//   let messages = [].concat.apply([], Object.values(rumors).map(a => Object.values(a))).map(b => b.rumor).map(x => {return {from:x.originator, rumor:x.text}});

//   text += '<h3>Gossip</h3>';
//   text += '<ul>';
//   messages.forEach(m => {
//     text += '<li>'+m.from+': '+m.rumor+'</li>';
//   });
//   text += '</ul>';

//   res.send(text);
// });








