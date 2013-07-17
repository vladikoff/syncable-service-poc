const L = require('logger');
const StorageServerClient = require('storage-server-client');
const PouchDbClient = require('pouch-db-client');
const SyncData = require('sync-data');
const SyncChange = require('sync-change');
const { setInterval, clearInterval, setTimeout } = require('timers');
const { defer } = require('sdk/core/promise');

const syncableHistoryService = require('syncable-history-service').get();
const SyncDataTypes = SyncData.dataTypes;

const USER_ID = "test24352345235";
const USER_TOKEN = USER_ID;

let SyncMediator = {

  init: function () {
    let _that = this;
    let deferred = defer();

    this.ssClient = new PouchDbClient();
    this.syncableServices = {};
    this.syncableServices[SyncDataTypes.HISTORY] = syncableHistoryService;
    this.collectionsInfo = { collections: {} };

    this.ssClient.init().
      then(function () {
        deferred.resolve(_that);
      });

    return deferred.promise;
  },

  start: function () {
    let self = this;

    // for each content type
    Object.keys(this.syncableServices).forEach(function (syncableDataType) {
      // get the service that will sync this content type
      let syncableService = self.syncableServices[syncableDataType];

      self.startSyncingDataType(
          syncableDataType,
          syncableService,
          self
        ).
        then(function () {
          setInterval(function () {
            self.pullChangesForDataType(syncableDataType, syncableService);
          }, 10000);
        }).
        then(null, function (err) {
          L.log("Error in start", err.message, err.stack);
        });
    });
  },

  // type: Sync type of these changes
  // changes: an array of SyncChange objects
  // Merge in this list of changes from the server and/or push any necessary changes
  // to the the syncChangeProcessor given in mergeDataAndStartSyncing
  processSyncChanges: function (dataType, changes) {   // TODO
    let self = this;
    L.log('syncChangeProcessor: got sync changes', dataType, changes);
    self.updateRemoteCollectionForDataType(dataType, changes.map(function (change) {
        let specifics = change.syncData.specifics;
        if (change.isDelete()) {
          specifics.delete = true;
        }
        return specifics;
      })).
      then(function (version) {
        self.setCollectionsInfo(dataType, version);
        L.log("processSyncChanges success", dataType, version);
      });
  },

  readRemoteCollectionForDataType: function (dataType, newer) {
    let args = { collection: dataType };
    if (newer) args.newer = newer;
    return this.ssClient.readCollection(args).
      then(function (result) {
        // L.log("Read collection success");// result);
        return { version: result.version, items: result.items.map(function (item) {
          return SyncData.create(dataType, item);
        }) };
      }).
      then(null, function (err) {
        if (err.code === 404) {
          L.log("Collection not found", dataType);
          return { version: -1, items: [] };
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
    let self = this;

    return self.readRemoteCollectionForDataType(dataType).
      then(function (result) {
        let items = result && result.items ? result.items : [];

        self.setCollectionsInfo(dataType, result.version);
        return syncableService.mergeDataAndStartSyncing(dataType, items, syncChangeProcessor);
      }).
      then(null, function (err) {
        L.log("error in startSyncingDataType", dataType, err.message, err.stack);
      });
  },

  pullChangesForDataType: function (dataType, syncableService) {
    let self = this;

    return self.readRemoteCollectionForDataType(dataType, self.getCollectionsInfo(dataType)).
      then(function (result) {
        let items = result && result.items ? result.items : [];

        let changes = items.map(function (syncData) {
          let changeType = syncData.specifics.delete ? SyncChange.changeTypes.DELETE : SyncChange.changeTypes.UPDATE;
          return SyncChange.create(changeType, syncData);
        });
        self.setCollectionsInfo(dataType, result.version);
        //L.log("pullChangesForDataType, # of documents: ", changes.length);
        if (changes.length > 0) return syncableService.processSyncChanges(dataType, changes);

      }).
      then(null, function (err) {
        L.log("error in startSyncingDataType", dataType, err.message, err.stack);
      });
  },

  setCollectionsInfo: function (dataType, version) {
    this.collectionsInfo.collections[dataType] = version;
  },

  getCollectionsInfo: function (dataType) {
    return this.collectionsInfo.collections[dataType] || 0;
  },

  existsCollectionsInfoForCollection: function (dataType) {
    //L.log(dataType, this.collectionsInfo.collections[dataType]);
    return typeof(this.collectionsInfo.collections[dataType]) === 'number';
  }
};

module.exports = SyncMediator;
