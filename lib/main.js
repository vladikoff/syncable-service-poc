const HISTORY = require('sync-types').HISTORY;
const L = require('logger');

var syncableHistoryService = Object.create(require('syncable-history-service')).init();

var syncChangeProcessor = {
  // type: Sync type of these changes
  // changes: an array of SyncChange objects
  // Merge in this list of changes from the server and/or push any necessary changes
  // to the the syncChangeProcessor given in mergeDataAndStartSyncing
  processSyncChanges: function (syncType, changes) {
    L.log('syncChangeProcessor: got sync changes', syncType, changes);
  }
};

syncableHistoryService.mergeDataAndStartSyncing(HISTORY, [], syncChangeProcessor);
