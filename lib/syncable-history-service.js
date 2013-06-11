const {Cc, Ci, Cu} = require("chrome");
const { defer, resolve, promised } = require('sdk/core/promise');
const group = function (array) { return promised(Array).apply(null, array); };
const SyncData = require('sync-data');
const HISTORY = SyncData.dataTypes.HISTORY;
const SyncChange = require('sync-change');
const L = require('logger');

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
  newItem.visits = mergedVisits.slice(0,10);
  let change = SyncChange.create(SyncChange.changeTypes.UPDATE, SyncData.create(SyncData.dataTypes.HISTORY, newItem));
  if (localItem.visits.length !== mergedVisits.length) {
    changes.localChange = change;
  }
  if (remoteItem.visits.length !== mergedVisits.length) {
    changes.remoteChange = change;
  }
  return changes;
}

function reconcileLocalItemsWithRemoteItems(localItems, remoteItems) {
  //L.log("reconcile", localItems, remoteItems);
  let result = { localChanges: [], remoteChanges: [] };
  let localItemGuidMap = createGuidMap(localItems);
  remoteItems.forEach(function (remoteItem) {
    let localItem = localItemGuidMap[remoteItem.id];
    if (!localItem) {
      result.localChanges.push(SyncChange.create(
                                 SyncChange.changeTypes.ADD,
                                 SyncData.create(SyncData.dataTypes.HISTORY, remoteItem)));
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
    result.remoteChanges.push(
      SyncChange.create(SyncChange.changeTypes.ADD,
                        SyncData.create(SyncData.dataTypes.HISTORY, localItemGuidMap[id]))
    );
  });
  return result;
}


var historyObserver = {
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsINavHistoryObserver,
    Ci.nsISupportsWeakReference
  ]),

  isTracking: true,

  init: function(syncChangeProcessor) {
    this.syncChangeProcessor = syncChangeProcessor;
    return this;
  },

  onDeleteAffectsGUID: function (uri, guid, reason, source, increment) {
    L.log("onDeleteAffectsGUID", uri.asciiSpec, guid);
  },

  onDeleteVisits: function (uri, visitTime, guid, reason) {
    if (!this.isTracking) return;
    let change = SyncChange.create(
                  SyncChange.changeTypes.DELETE,
                  SyncData.create(SyncData.dataTypes.HISTORY, { id: guid, histUri: uri.asciiSpec }));
    this.syncChangeProcessor.processSyncChanges(SyncData.dataTypes.HISTORY, [ change ]);
    L.log("onDeleteVisits", uri.asciiSpec, guid, visitTime);
  },

  onDeleteURI: function (uri, guid, reason) {
    if (!this.isTracking) return;
    let change = SyncChange.create(
                  SyncChange.changeTypes.DELETE,
                  SyncData.create(SyncData.dataTypes.HISTORY, { id: guid, histUri: uri.asciiSpec }));
    this.syncChangeProcessor.processSyncChanges(SyncData.dataTypes.HISTORY, [ change ]);
    L.log("onDeleteURI", uri.asciiSpec, guid);
  },

  onVisit: function (uri, vid, time, session, referrer, trans, guid) {
    if (!this.isTracking) return;
    L.log("OnVisit", uri.asciiSpec, guid);
    let historyService = require('history-service').get();
    let self = this;
    return historyService.getHistoryInfoForUri(uri.asciiSpec).
    then(function (historyItem) {
      let change = SyncChange.create(
                    SyncChange.changeTypes.UPDATE,
                    SyncData.create(SyncData.dataTypes.HISTORY, historyItem));
      self.syncChangeProcessor.processSyncChanges(SyncData.dataTypes.HISTORY, [ change ]);
    }).
    then(null, function (err) {
      L.log("error", err.message, err.stack);
    });
  },

  onClearHistory: function () {
  },

  onBeginUpdateBatch: function () {},
  onEndUpdateBatch: function () {},
  onPageChanged: function () {},
  onTitleChanged: function () {},
  onBeforeDeleteURI: function () {},
};


let SyncableHistoryService = {

  init: function() {
    this.historyService = require('history-service').get();
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
  mergeDataAndStartSyncing: function (dataType, listOfSyncData, syncChangeProcessor) {
    let deferred = defer();
    if (dataType !== SyncData.dataTypes.HISTORY) {
      deferred.resolve();
      return deferred.promise;
    }
    let self = this;

    // register sync change processor to propagate additional changes
    self.changeProcessor = syncChangeProcessor;
    // start listening to history changes
    self.historyObserver = Object.create(historyObserver).init(syncChangeProcessor);

    return this.historyService.readAllItems().
    then(function (localHistoryItems) {
      L.log("SyncableHistoryService.mergeDataAndStartSyncing #localItems", localHistoryItems.length);
      L.log("SyncableHistoryService.mergeDataAndStartSyncing #remoteItems", listOfSyncData.length);
      //L.log("localHistoryItems", localHistoryItems);
      //L.log("listOfSyncData", listOfSyncData);
      var remoteDeleteChanges = listOfSyncData.
        filter(function (syncData) { return syncData.isTombstone(); }).
        map(function (syncData) { return SyncChange.create(
                                           SyncChange.changeTypes.DELETE,
                                           syncData);});
      //L.log("processing delete changes", remoteDeleteChanges);
      self.processSyncChanges(dataType, remoteDeleteChanges).
      then(function () {
        var remoteHistoryItems = listOfSyncData.
          filter(function (syncData) { return !syncData.isTombstone(); }).
          map(function (syncData) { return syncData.specifics; });
        //L.log("processing adds and updates", remoteHistoryItems);
        var changes = reconcileLocalItemsWithRemoteItems(localHistoryItems, remoteHistoryItems);

        // process local changes
        if (changes.localChanges.length > 0) self.processSyncChanges(dataType, changes.localChanges);
        // push up necessary remote changes
        if (changes.remoteChanges.length > 0) syncChangeProcessor.processSyncChanges(dataType, changes.remoteChanges);
        // Use nsINavHistoryObserver to observe changes to history for
        // this proof of concept, but we ultimately would like something
        // better integrated with the underlying history service
        PlacesUtils.history.addObserver(self.historyObserver, true);
      });
    }).
    then(null, function (err) {
      L.log("error in mergeDataAndStartSyncing", err.message, err.stack);
    });
  },

  // Stop syncing for <dataType>. Release local handle on syncChangeProcessor
  // for <dataType>.
  stopSyncing: function (dataType) {
    let deferred = defer();
    if (dataType !== HISTORY) {
      deferred.resolve();
      return deferred.promise;
    }
    delete this.changeProcessor;
    // stop listening to history changes
    PlacesUtils.history.removeObserver(self.historyObserver);
    return deferred.promise;
  },

  // type: Sync type of these changes
  // changes: an array of SyncChange objects
  // Merge in this list of changes from the server and/or push any necessary changes
  // to the the syncChangeProcessor given in mergeDataAndStartSyncing
  processSyncChanges: function (dataType, changes) {
    // fetch local record, if deleted then push out deleted record
    // if doesn't exist then create, otherwise merge visits and push out new record if different
    //L.log("SyncableHistoryService.processSyncChanges", dataType, changes);
    let deferred = defer();
    let self = this;
    if (dataType !== HISTORY) {
      deferred.resolve();
      return deferred.promise;
    }
    var deletions = changes.filter(function (change) { return change.isDelete(); });
    var updates = changes.filter(function (change) { return change.isAdd() || change.isUpdate(); });
    self.historyObserver.isTracking = false;
    return group([
      this.historyService.updateItems(updates.map(function (change) { return change.syncData.specifics; })),
      this.historyService.deleteItems(deletions.map(function (change) { return change.syncData.specifics; }))
    ]).
    then(function (results) {
      self.historyObserver.isTracking = true;
      return results;
    });
  }
};

let syncableHistoryService = Object.create(SyncableHistoryService).init();

module.exports = {
  module: SyncableHistoryService,
  get: function() { return syncableHistoryService; }
};

