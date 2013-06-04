const {Cc, Ci, Cu} = require("chrome");
const { defer, resolve, promised } = require('sdk/core/promise');
const group = function (array) { return promised(Array).apply(null, array); };
const PlacesAdapter = require('places-adapter');
const L = require('logger');
const ios = Cc["@mozilla.org/network/io-service;1"]
              .getService(Ci.nsIIOService);
const asyncHistory = Cc["@mozilla.org/browser/history;1"]
                        .getService(Ci.mozIAsyncHistory);
const HISTORY = require('sync-types').HISTORY;

Cu.import("resource://gre/modules/PlacesUtils.jsm", this);
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

const MAX_RESULTS = 1000;

const ALL_PLACES_QUERY =
      "SELECT guid, url, id as localId, title " +
      "FROM moz_places " +
      "WHERE last_visit_date > :cutoff_date " +
      "ORDER BY frecency DESC " +
      "LIMIT " + MAX_RESULTS;
var ALL_PLACES_STMT = PlacesAdapter.createAsyncStatement(ALL_PLACES_QUERY);

const VISITS_QUERY =
      "SELECT visit_type type, visit_date date " +
      "FROM moz_historyvisits " +
      "WHERE place_id = (SELECT id FROM moz_places WHERE url = :url) " +
      "ORDER BY date DESC LIMIT 10";
var VISITS_STMT = PlacesAdapter.createAsyncStatement(VISITS_QUERY);

let SyncableHistoryService = {

  init: function() {
    this.changeProcessors = {};
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
  mergeDataAndStartSyncing: function (syncType, listOfsyncData, syncChangeProcessor) {
    let deferred = defer();
    if (syncType !== HISTORY) {
      deferred.resolve();
      return deferred.promise;
    }

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