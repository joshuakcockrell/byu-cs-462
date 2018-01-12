'using strict';

const uuidv4 = require('uuid/v4');
const request = require('request');

function User(name, endpoint='http://localhost:'+process.argv[2]+'/send-gossip/', id=uuidv4().substring(0, 4), createdRumors=[], rumors={}, wants={}, knownNeighbors=[]) {
  console.log('NEW USER ADDED WITH ID: ' + id);
  this.id = id;
  this.name = name;
  this.createdRumors = createdRumors;
  this.rumors = rumors; //{'aaaa': {1: 'hi', 3: 'skipped'}, ..}
  this.wants = wants; // {'http://endpoint': [{aaa: 1}]}
  // this.endpoint = 'https://gobyu.ga/send-gossip/' + this.id;
  this.endpoint = endpoint + this.id;
  this.knownNeighbors = new Set(knownNeighbors);
}

// Create a rumor from this user with this text
User.prototype.createRumor = function(text) {

  let messageNum = this.createdRumors.length

  let rumor = { 
    'rumor': { 
      'messageId': ''+this.id+':'+(messageNum),
      'userId': this.id,
      'messageNum': (messageNum),
      'originator': this.name,
      'text': text 
    },
    'endpoint': this.endpoint
  }

  // Send it to ourselves
  this.createdRumors.push(rumor);
  this.receiveRumor(rumor);
  return rumor;
}

// {"want": {"ABCD-1234-ABCD-1234-ABCD-125A": 3,
//           "ABCD-1234-ABCD-1234-ABCD-129B": 5,
//           "ABCD-1234-ABCD-1234-ABCD-123C": 10 
//          },
//  "endpoint": "https://example.com/gossip/asff3" 
// }

User.prototype.notifyOfNewUserEndpoint = function(endpoint) {
  console.log('notifyOfNewUserEndpoint..');

  // Don't keep reference to ourselves
  if (this.endpoint === endpoint) {
    console.log('..our own endpoint');
    return;
  }

  this.knownNeighbors.add(endpoint);
}

// Receive a message
User.prototype.receiveMessage = function(message) {

  if (message.endpoint === this.endpoint) { return }
  this.notifyOfNewUserEndpoint(message.endpoint);

  if (Object.keys(message).includes('rumor')) {
    this.receiveRumor(message.rumor);
  } else if (Object.keys(message).includes('want')) {
    this.receiveWant(message.endpoint, message.want);
  } else {
    console.log('ERROR 798234789');
  }
}

User.prototype.getRandomNeighbor = function() {
  console.log('getRandomNeighbor..');
  console.dir(this.knownNeighbors);
  let neighborsArr = Array.from(this.knownNeighbors);
  let randNeighbor = neighborsArr[Math.floor(Math.random()*neighborsArr.length)];
  return randNeighbor;
}

User.prototype.receiveRumor = function(rumor) {
  if (!(rumor.rumor.userId in this.rumors)) {
    this.rumors[rumor.rumor.userId] = {};
  }

  this.rumors[rumor.rumor.userId][rumor.rumor.messageNum] = rumor;
}

User.prototype.receiveWant = function(endpoint, want) {
  this.wants[endpoint] = want;
}

User.prototype.getRandomRumor = function() {

  let randId = Object.keys(this.rumors)[Math.floor(Math.random() * Object.keys(this.rumors).length)];
  let randRumorNum = Object.keys(this.rumors[randId])[Math.floor(Math.random() * Object.keys(this.rumors[randId]).length)];
  let randRumor = this.rumors[randId][randRumorNum];

  return randRumor;
}

// Get our wants
User.prototype.getOurWants = function() {

  let wants = [];

  // Haven't seen rumors, so dont know what we want
  if (Object.entries(this.rumors).length === 0) {
    return wants;
  }

  // Get all rumor chunks
  Object.entries(this.rumors).forEach( entry => {

    let user = entry[0];
    let messages = entry[1];
    let added = false;

    // grab last seen one
    for (i = 0; i < Object.keys(messages).length; i++) {
      if (!(i in messages)) {
        wants.push({[user]: i-1})
        added = true;
        break;
      }
    }

    // Add the end if we didn't find one
    if (!added) {
      wants.push({[user]: Object.entries(messages).length-1,})
    }
  });

  return wants;
}

User.prototype.getFulfillingRumor = function(want) {

  let output = undefined;

  if (want === undefined || want.length === 0) {
    return output;
  }
  Object.entries(want[0]).forEach(w =>{
    let id = w[0];
    let num = w[1];

    // Send rumor if we have it
    if (this.rumors[id] && this.rumors[id][num+1]) {
      output = this.rumors[id][num+1];
    }
  });

  return output;
};

// Either fulfill a want or send our wants
User.prototype.prepareMessage = function() {

  // Send our wants to random neighbor
  if (Math.random() > 0.5) {    
    console.log('Send our wants..');

    let want = this.getOurWants(); // Get our wants
    let output = {
      want: want, 
      endpoint: this.endpoint, 
      sendTo: this.getRandomNeighbor()
    }
    return output;
  
  // Fulfill a want
  } else {

    console.log('Fulfill a want..');
    // If no rumors to send
    if (Object.entries(this.rumors).length === 0) { 
      console.log('No rumors to send..');
      return;
    }

    // If no wants to fulfill
    if (Object.values(this.wants).length === 0) { 
      console.log('no wants to fulfill..')
      return;
    }

    // Get rand want
    let allWantKeys = Object.keys(this.wants);
    let wantingEndpoint = allWantKeys[allWantKeys.length * Math.random() << 0];
    let wantData = this.wants[wantingEndpoint];

    // // Get next want
    // let wantData = this.wants.pop(); // Get other's wants
    // let wantingEndpoint = wantData.endpoint;

    // Get rumor to fulfill want (or random)
    let fulfillingRumor = this.getFulfillingRumor(wantData);
    if (fulfillingRumor === undefined) {
      fulfillingRumor = this.getRandomRumor();
    }

    return {rumor: fulfillingRumor, endpoint: this.endpoint, sendTo: wantingEndpoint}
  }
}


module.exports = User;
































