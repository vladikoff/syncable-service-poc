let SyncChangeProcessor = {

  // type: Sync type of these changes
  // changes: an array of SyncChange objects
  // ProcessSyncChanges processes the given list of sync changes for the given type,
  // which eventually gets propagated to the sync server and then to other clients.
  processSyncChanges: function (dataType, changes) {
    throw "must implement processSyncChanges";
  }

};

module.exports = SyncChangeProcessor;