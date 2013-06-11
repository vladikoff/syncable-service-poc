const {Cc, Ci, Cu} = require("chrome");
const { defer, resolve, promised } = require('sdk/core/promise');
const group = function (array) { return promised(Array).apply(null, array); };
const PlacesAdapter = require('places-adapter');
const L = require('logger');
const ios = Cc["@mozilla.org/network/io-service;1"]
              .getService(Ci.nsIIOService);
const asyncHistory = Cc["@mozilla.org/browser/history;1"]
                        .getService(Ci.mozIAsyncHistory);
var HistoryItem = require('history-item');

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

const SINGLE_PLACE_QUERY =
      "SELECT guid, url, id as localId, title " +
      "FROM moz_places " +
      "WHERE last_visit_date > :cutoff_date AND url = :url " +
      "ORDER BY frecency DESC " +
      "LIMIT " + MAX_RESULTS;
var SINGLE_PLACE_STMT = PlacesAdapter.createAsyncStatement(SINGLE_PLACE_QUERY);

const VISITS_QUERY =
      "SELECT visit_type type, visit_date date " +
      "FROM moz_historyvisits " +
      "WHERE place_id = (SELECT id FROM moz_places WHERE url = :url) " +
      "ORDER BY date DESC LIMIT 10";
var VISITS_STMT = PlacesAdapter.createAsyncStatement(VISITS_QUERY);

function processReadPlacesQueryRow(row, results) {
  var oneResult,
      guid = row.getResultByName('guid'),
      url = row.getResultByName('url'),
      localId = row.getResultByName('localId'),
      title = row.getResultByName('title');
  results.push(HistoryItem({ uri: url, localId: localId, id: guid, title: title }));
}

function getVisitsForUri(uri) {
  var stmt = VISITS_STMT;
  var params = stmt.newBindingParamsArray();
  let bp = params.newBindingParams();
  bp.bindByName('url', uri);
  params.addParams(bp);
  stmt.bindParameters(params);
  return PlacesAdapter.runAsyncQuery(stmt, function (row, results) {
    results.push({ date: row.getResultByName('date'), type: row.getResultByName('type') });
  }, []);
}

function getHistoryInfoForUri(uri) {

}

var HistoryService = {

  init: function() {
    return this;
  },

  getVisitsForUri: getVisitsForUri,

  getHistoryInfoForUri: function(uri) {
    let stmt = SINGLE_PLACE_STMT;
    let params = stmt.newBindingParamsArray();
    let bp = params.newBindingParams();
    // up to 30 days ago
    var thirtyDaysAgo = (Date.now() - 2592000000) * 1000;
    bp.bindByName('cutoff_date', thirtyDaysAgo);
    params.addParams(bp);
    bp = params.newBindingParams();
    bp.bindByName('url', uri);
    params.addParams(bp);
    stmt.bindParameters(params);
    return PlacesAdapter.runAsyncQuery(stmt, processReadPlacesQueryRow, []).
    then(function (historyItems) {
      // Only expecting one result
      if (historyItems.length === 0) return null;
      let item = historyItems[0];
      return getVisitsForUri(item.uri).then(function (visits) { item.visits = visits; return item.toJSON(); });
    });
  },

  readAllItems: function() {
    var stmt = ALL_PLACES_STMT;
    var params = stmt.newBindingParamsArray();
    let bp = params.newBindingParams();
    // up to 30 days ago
    var thirtyDaysAgo = (Date.now() - 2592000000) * 1000;
    bp.bindByName('cutoff_date', thirtyDaysAgo);
    params.addParams(bp);
    stmt.bindParameters(params);
    return PlacesAdapter.runAsyncQuery(stmt, processReadPlacesQueryRow, []).
    then(function (historyItems) {
      return group(historyItems.map(function (item) {
        return getVisitsForUri(item.uri).then(function (visits) { item.visits = visits; return item.toJSON(); });
      }));
    });
  },

  updateItems: function(historyItems) {
    return group(historyItems.map(function (historyInfo) {
      return HistoryItem(historyInfo).toPlaceInfo();
    })).
    then(function (placeInfos) {
      let deferred = defer(),
          failed = [];
      let updatePlacesCallback = {
        handleResult: function handleResult() {},
        handleError: function handleError(resultCode, placeInfo) {
          L.log("encountered an error in updatePlaces", placeInfo, resultCode);
          failed.push(placeInfo.guid);
        },
        handleCompletion: function () {
          if (failed.length > 0) deferred.reject(failed);
          else deferred.resolve();
        }
      };
      placeInfos = placeInfos.filter(function (placeInfo) {
        return placeInfo.visits.length > 0;
      });
      if (placeInfos.length > 0) {
        asyncHistory.updatePlaces(placeInfos, updatePlacesCallback);
      }
      else {
        deferred.resolve();
      }
      return deferred.promise;
    });
  },

  deleteItems: function(historyItems) {
    let deferred = defer();
    //L.log("deleting", historyItems);
    try {
      historyItems.map(function (item) {
        if (item.histUri) {
          let uri = ios.newURI(item.histUri, null, null);
          PlacesUtils.history.removePage(uri);
        }
      });
      deferred.resolve();
    } catch(e) {
      deferred.reject(e);
    }
    return deferred.promise;
  }
};

let historyService = Object.create(HistoryService).init();

module.exports = {
  module: HistoryService,
  get: function() { return historyService; }
};