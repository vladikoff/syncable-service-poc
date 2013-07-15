const SyncMediator = require('sync-mediator');
const L = require('logger');

// var pageWorker = require("sdk/page-worker").Page({
//   contentScript: "",
//   contentURL: require("sdk/self").data.url("pouchdb.html")
// });

let Pouch = require('./pouchdb/dist/pouchdb');

let syncMediator = Object.create(SyncMediator).init(function() {
  syncMediator.start();
});
