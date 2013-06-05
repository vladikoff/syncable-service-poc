const {Cc, Ci, Cu} = require("chrome");
const { defer, resolve, promised } = require('sdk/core/promise');
const group = function (array) { return promised(Array).apply(null, array); };
const L = require('logger');
const HISTORY = require('sync-types').HISTORY;
var historyService = Object.create(require('history-service')).init();

Cu.import("resource://gre/modules/PlacesUtils.jsm", this);
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

function createGuidMap(items) {
  let result = {};
  items.forEach(function (item) {
    result[item.id] = item;
  });
  return result;
}

function mergeLocalItemWithRemoteItem(localItem, remoteItem) {
  let changes = { localChange: null, remoteChange: null };
  let mergedVisitsStrings = {};
  let mergedVisits = [];
  localItem.visits.forEach(function (visit) {
    let visitString = visit.date+","+visit.type;
    if (!mergedVisitsStrings[visitString]) {
      mergedVisitsStrings[visitString] = 1;
      mergedVisits.push(visit);
    }
  });
  remoteItem.visits.forEach(function (visit) {
    let visitString = visit.date+","+visit.type;
    if (!mergedVisitsStrings[visitString]) {
      mergedVisitsStrings[visitString] = 1;
      mergedVisits.push(visit);
    }
  });
  if (localItem.visits.length === mergedVisits.length && remoteItem.visits.length === mergedVisits.length) return changes;
  let newItem = Object.create(localItem);
  newItem.visits = mergedVisits;
  let change = { changeType: "UPDATE", data: newItem };
  if (localItem.visits.length !== mergedVisits.length) {
    changes.localChange = change;
  }
  if (remoteItem.visits.length !== mergedVisits.length) {
    changes.remoteChange = change;
  }
  return changes;
}

function reconcileLocalItemsWithRemoteItems(localItems, remoteItems) {
  let result = { localChanges: [], remoteChanges: [] };
  let localItemGuidMap = createGuidMap(localItems);
  remoteItems.forEach(function (remoteItem) {
    let localItem = localItemGuidMap[remoteItem.id];
    if (!localItem) {
      result.localChanges.push({ changeType: "ADD", data: remoteItem });
    }
    else {
      delete localItemGuidMap[remoteItem.id];
      let mergeResult = mergeLocalItemWithRemoteItem(localItem, remoteItem);
      if (mergeResult.localChange) {
        result.localChanges.push(mergeResult.localChange);
      }
      if (mergeResult.remoteChange) {
        result.remoteChanges.push(mergeResult.remoteChange);
      }
    }

  });
  Object.keys(localItemGuidMap).forEach(function (id) {
    result.remoteChanges.push({ changeType: "ADD", data: localItemGuidMap[id] });
  });
  return result;
}

let SyncableHistoryService = {

  init: function() {
    this.changeProcessors = {};
    this.historyService = Object.create(require('history-service')).init();
    return this;
  },

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
  mergeDataAndStartSyncing: function (syncType, listOfSyncData, syncChangeProcessor) {
    let deferred = defer();
    if (syncType !== HISTORY) {
      deferred.resolve();
      return deferred.promise;
    }

    historyService.readAll().
    then(function (localHistoryItems) {
      L.log("localHistoryItems", localHistoryItems);
      var remoteHistoryItems = listOfSyncData.
        filter(function (syncData) { return sync.data.syncType === HISTORY; }).
        map(function (syncData) { return syncData.specifics; });
      var todo = reconcileLocalItemsWithRemoteItems(localHistoryItems, remoteHistoryItems);
      L.log("TODO", todo);
    }).
    then(null, function (err) {
      L.log("error", err.message);
    });
    // read all the records
    // go throught list of sync data and resolve with local data
    // start tracking changed records
    // add syncChangeProcessor to set of changeProcessors

  },

  // Stop syncing for <syncType>. Release local handle on syncChangeProcessor
  // for <syncType>.
  stopSyncing: function (syncType) {
    let deferred = defer();
    if (syncType !== HISTORY) {
      deferred.resolve();
      return deferred.promise;
    }
  },

  // type: Sync type of these changes
  // changes: an array of SyncChange objects
  // Merge in this list of changes from the server and/or push any necessary changes
  // to the the syncChangeProcessor given in mergeDataAndStartSyncing
  processSyncChanges: function (syncType, changes) {
    throw "must implement processSyncChanges";
  }
};

module.exports = SyncableHistoryService;