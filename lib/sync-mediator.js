const L = require('logger');
const StorageServerClient = require('storage-server-client');
const SyncData = require('sync-data');

var syncableHistoryService = require('syncable-history-service').get();
var SyncDataTypes = SyncData.dataTypes;

const USER_ID = "test24352345233";
const USER_TOKEN = USER_ID;

let SyncMediator = {

  init: function() {
    this.ssClient = new StorageServerClient({ userId: USER_ID, token: USER_TOKEN });
    this.syncableServices = {};
    this.syncableServices[SyncDataTypes.HISTORY] = syncableHistoryService;
    return this;
  },

  start: function() {
    let self = this;
    Object.keys(this.syncableServices).forEach(function (syncableDataType) {
      self.startSyncingDataType(
        syncableDataType,
        self.syncableServices[syncableDataType],
        self
      );
    });
  },

  // type: Sync type of these changes
  // changes: an array of SyncChange objects
  // Merge in this list of changes from the server and/or push any necessary changes
  // to the the syncChangeProcessor given in mergeDataAndStartSyncing
  processSyncChanges: function (dataType, changes) {
    L.log('syncChangeProcessor: got sync changes', dataType, changes);
    this.updateRemoteCollectionForDataType(dataType, changes.map(function (change) {
      let specifics = change.syncData.specifics;
      if (change.isDelete()) {
        specifics.delete = true;
      }
      return specifics;
    })).
    then(function () {
      L.log("processSyncChanges success", dataType);
    });
  },

  readRemoteCollectionForDataType: function (dataType) {
    return this.ssClient.readCollection({ collection: dataType }).
    then(function (result) {
      L.log("Read collection success", dataType);// result);
      return result.items.map(function (item) { return SyncData.create(dataType, item); });
    }).
    then(null, function (err) {
      if (err.code === 404) {
        L.log("Collection not found", dataType);
        return [];
      }
      else {
        L.log("readCollection error", err.message, err.stack, err);
      }
    });
  },

  updateRemoteCollectionForDataType: function (dataType, items) {
    return this.ssClient.updateCollection({ collection: dataType, items: items }).
    then(function (result) {
      L.log("updateRemoteCollection success", result);
      return result.version;
    }).
    then(null, function (err) {
      L.log("updateRemoteCollection error", err.message, err.stack, err);
      throw err;
    });
  },

  startSyncingDataType: function (dataType, syncableService, syncChangeProcessor) {
    return this.readRemoteCollectionForDataType(dataType).
    then(function (items) {
      // L.log("startSyncingDataType", items);
      return syncableService.mergeDataAndStartSyncing(dataType, items, syncChangeProcessor);
    }).
    then(null, function (err) {
      L.log("error in startSyncingDataType", dataType, err.message, err.stack);
    });
  }
};

module.exports = SyncMediator;