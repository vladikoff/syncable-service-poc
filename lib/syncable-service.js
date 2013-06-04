// Inspired by this: http://dev.chromium.org/developers/design-documents/sync/syncable-service-api

let SyncableService = {

  // type: Sync type of these changes
  // listOfSyncData: an array of sync data from the server of the above type
  // syncChangeProcessor: a SyncChangeProcessor object that this service
  //                      should use to reflect new upstream changes
  //                      (by calling processSyncChanges on it)
  //
  // When mergeDataAndStartSyncing is called, it must do an "initial sync".
  // It must merge syncData with its local data and/or push changes to
  // syncChangeProcessor such that, after the function returns, the local sync
  // state matches the state represented by syncData plus any changes pushed to
  // syncChangeProcessor.  It should also store the given syncChangeProcessor
  // reference and use it to send changes for type until StopSyncing is called
  // for type.
  mergeDataAndStartSyncing: function (syncType, listOfsyncData, syncChangeProcessor) {
    throw "must implement mergeDataAndStartSyncing";
  },

  // Stop syncing for <syncType>. Release local handle on syncChangeProcessor
  // for <syncType>.
  stopSyncing: function (syncType) {
    throw "must implement stopSyncing";
  },

  // type: Sync type of these changes
  // changes: an array of SyncChange objects
  // Merge in this list of changes from the server and/or push any necessary changes
  // to the the syncChangeProcessor given in mergeDataAndStartSyncing
  processSyncChanges: function (syncType, changes) {
    throw "must implement processSyncChanges";
  }
};

module.exports = SyncableService;