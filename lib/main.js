const SyncMediator = require('sync-mediator');
const L = require('logger');

Object.create(SyncMediator).
  init().
  then(function (syncMediator) {
    syncMediator.start();
  });
