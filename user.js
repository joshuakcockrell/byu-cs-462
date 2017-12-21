'using strict';

const uuidv4 = require('uuid/v4');
const request = require('request');

function User(name) {
  this.id = uuidv4().substring(0, 4);
  this.name = name;
  this.createdRumors = [];
  this.otherRumors = {}; //{'aaaa': {1: 'hi', 3: 'skipped'}, ..}
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
    'endpoint': 'https://gobyu.ga/send-gossip/' + this.id 
  }

  // Send it to ourselves
  this.createdRumors.push(rumor);
  this.receiveRumor(rumor);
  return rumor;
}

User.prototype.receiveRumor = function(rumor) {
  if (!(rumor.rumor.userId in this.otherRumors)) {
    this.otherRumors[rumor.rumor.userId] = {};
  }

  this.otherRumors[rumor.rumor.userId][rumor.rumor.messageNum] = rumor;
}

User.prototype.getWants = function() {

    // Get all rumor chunks
    let output = []
    Object.entries(this.otherRumors).forEach( entry => {

      let user = entry[0];
      let messages = entry[1];
      let added = false;

      // grab last seen one
      for (i = 0; i < Object.keys(messages).length; i++) {
        if (!(i in messages)) {
          output.push({[user]: i-1})
          added = true;
        }
      }

      // Add the end if we didn't find one
      if (!added) {
        output.push({[user]: Object.entries(messages).length-1})
      }

    });

    return output;
}

User.prototype.prepareMessage = function(otherUser) {

  // Random choice
  if (Math.random() > 0.5) {

    // Send our wants
    let content = this.getWants();
    return {type: 'wants', content: content}
  } else {

    // Fulfill their wants
    // If nothing to send
    if (Object.entries(this.otherRumors).length == 0) {
      // console.log('User '+this.id+' has no messages to send..');
      return;
    }

    let theirWants = otherUser.getWants();
    this.sendRumorToUser(otherUser, theirWants);

    return {type: 'rumor', content: this.getRandomRumor()}
  }
}


// EDIT THIS
User.prototype.gossipWith = function(otherUser) {

  if (this.id === otherUser.id) {
    // console.log('Cant send rumor to self..');
    return;
  }

  let otherMessage = otherUser.prepareMessage(this);

  // User has no messages to gossip
  if (otherMessage === undefined) {
    return;
  }

  if (otherMessage.type === 'want') {
    let wants = otherMessage.content;
    this.sendRumorToUser(otherUser, wants);
  } else if (otherMessage.type === 'rumor') {
    let rumor = otherMessage.content;
    
    request({ url: "https://gobyu.ga/send-gossip/"+this.id, 
      method: 'POST',
      json: {rumor: rumor}
    }, (err, response, body) => {
      console.log('SENT RUMOR');
    });
  }
}


// EDIT THIS
User.prototype.sendRumorToUser = function(otherUser, wants) {

  // If we don't have anything to send
  if (Object.entries(this.otherRumors).length == 0) {
    // console.log('User '+this.id+' has no messages to send..');
    return;
  }

  // console.log('Send '+this.id+' to '+otherUser.id)

  let sentRumor = false;

  wants.forEach(w => {
    console.log('11111111111111')
    console.dir(wants);
    w = Object.entries(w)[0];
    let id = w[0];
    let num = w[1];

    // Send rumor if we have it
    if (this.otherRumors[id] && this.otherRumors[id][num+1]) {

      request({ url: "https://gobyu.ga/send-gossip/"+otherUser.id,
        method: 'POST',
        json: {rumor: this.otherRumors[id][num+1]}
      }, (err, response, body) => {
        console.log('SENT RUMOR');
      });
      sentRumor = true;
      return
    }
  });

  // Send them a random rumor
  if (!sentRumor) {

    request({ url: "https://gobyu.ga/send-gossip/"+otherUser.id,
      method: 'POST',
      json: {rumor: this.getRandomRumor()}
    }, (err, response, body) => {
      console.log('SENT RUMOR');
    });
  }
}

User.prototype.getRandomRumor = function() {

  let randId = Object.keys(this.otherRumors)[Math.floor(Math.random() * Object.keys(this.otherRumors).length)];
  let randRumorNum = Object.keys(this.otherRumors[randId])[Math.floor(Math.random() * Object.keys(this.otherRumors[randId]).length)];
  let randRumor = this.otherRumors[randId][randRumorNum];

  return randRumor;
}

User.prototype.gossipWithUsers = function(users) {
  let randUser = users[Math.floor(Math.random() * users.length)].user;
  this.gossipWith(randUser);
}

module.exports = User;
































