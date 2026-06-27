const { EventEmitter } = require('events');
const emitter = new EventEmitter();
emitter.setMaxListeners(200); // tránh warning khi nhiều client connect
module.exports = emitter;
