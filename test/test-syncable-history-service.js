var main = require("main");
let SyncableHistoryService = require('syncable-history-service').module;
let MockHistoryService = require('./mock-history-service').module;
let SyncData = require('sync-data');
let SyncChange = require('sync-change');
let L = require('logger');
const { setInterval, clearInterval, setTimeout } = require('timers');

let HISTORY = SyncData.dataTypes.HISTORY;

function createSyncData(itemInfo) {
  return SyncData.create(HISTORY, itemInfo);
}

function createAddChange(itemInfo) {
  return SyncChange.create(
          SyncChange.changeTypes.ADD,
          SyncData.create(HISTORY, itemInfo));
}


function createDeleteChange(itemInfo) {
  return SyncChange.create(
          SyncChange.changeTypes.DELETE,
          SyncData.create(HISTORY, itemInfo));
}

function createUpdateChange(itemInfo) {
  return SyncChange.create(
          SyncChange.changeTypes.UPDATE,
          SyncData.create(HISTORY, itemInfo));
}

let MockSyncChangeProcessor = {
  init: function () {
    this.processCalls = [];
    return this;
  },

  processSyncChanges: function (dataType, changes) {
    L.log("processSyncChanges", changes);
    this.processCalls.push({ dataType: dataType, changes: changes });
  }
}

function createMockSyncChangeProcessor() {
  return Object.create(MockSyncChangeProcessor).init();
}

function createMockHistoryService(historyItems) {
  return Object.create(MockHistoryService).init(historyItems || []);
}

function sortItems(items, fieldName) {
  return items.sort(function (a,b) {
    if (a[fieldName] > b[fieldName]) return 1;
    if (a[fieldName] === b[fieldName]) return 0;
    if (a[fieldName] < b[fieldName]) return -1;
  });
}

function checkSortedListsEqual(items1, items2, itemEqualCheckFunc) {
  if (items1.length !== items2.length) return false;
  for (var i=0; i<items1.length; i++) {
    if (!itemEqualCheckFunc(items1[i], items2[i])) return false;
  }
  return true;
}

function checkHistoryRecordsEqual(item1, item2) {
  let visits1 = sortItems(item1.visits || [], "date");
  let visits2 = sortItems(item2.visits || [], "date");
  return item1.id === item2.id &&
    item1.title === item2.title &&
    item1.histUri === item2.histUri &&
    checkSortedListsEqual(visits1, visits2, function (visit1, visit2) {
      return visit1.date === visit2.date && visit1.type === visit2.type;
    });
}

function checkArraysOfHistoryRecordsEqual(items1, items2) {
  items1 = sortItems(items1, 'id');
  items2 = sortItems(items2, 'id');
  return checkSortedListsEqual(items1, items2, function (item1, item2) {
    return checkHistoryRecordsEqual(item1, item2);
  });
};

let YAHOO_HISTORY_RECORD =
  { histUri:"http://www.yahoo.com/", title: "Yahoo!", visits:[{ date:1370976276051693, type:5 }, { date:1370876136011641, type:5 }], id:"s2K46zr7ALaJ" };

let YAHOO_HISTORY_RECORD2 =
  { histUri:"http://www.yahoo.com/", title: "Yahoo!", visits:[{ date:1370976276051693, type:5 }, { date:1370874231041650, type:5 }], id:"s2K46zr7ALaJ" };

let MERGED_YAHOO_HISTORY_RECORD = { histUri:"http://www.yahoo.com/", title: "Yahoo!", visits:[{ date:1370976276051693, type:5 }, { date:1370876136011641, type:5 }, { date:1370874231041650, type:5 }], id:"s2K46zr7ALaJ" };

let YAHOO_DELETE_RECORD =
  { histUri:"http://www.yahoo.com/", delete: true, id:"s2K46zr7ALaJ" };


let YAHOO_SYNC_DATA = createSyncData(YAHOO_HISTORY_RECORD);
let YAHOO_SYNC_DATA2 = createSyncData(YAHOO_HISTORY_RECORD2);
let YAHOO_DELETE_SYNC_DATA = createSyncData(YAHOO_DELETE_RECORD);
let GOOGLE_HISTORY_RECORD =
  { id:"_mM-uphBQ_V9", histUri:"http://www.google.com/", title:"Google", visits:[{ date:1370976175051421, type:5}] };
let GOOGLE_SYNC_DATA = createSyncData(GOOGLE_HISTORY_RECORD);

exports["test SyncableHistoryService.mergeDataAndStartSyncing with a new remote record"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ YAHOO_SYNC_DATA, GOOGLE_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    assert.equal(mockSyncChangeProcessor.processCalls.length, 0, "Upstream SyncChangeProcessor should not be called.");
    mockHistoryService.readAllItems().
    then(function (items) {
      let result = checkArraysOfHistoryRecordsEqual([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ], items);
      assert.ok(result, "HistoryService contains new remote record and old records");
      done();
    });
  }).
  then(null, function(err) {
    L.log("error", err.message, err.stack);
    assert.fail();
    done();
  });
};

exports["test SyncableHistoryService.mergeDataAndStartSyncing with a new local record"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ GOOGLE_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    assert.equal(mockSyncChangeProcessor.processCalls.length, 1, "Upstream SyncChangeProcessor should receive one upsteam change.");
    var upsteamChange = mockSyncChangeProcessor.processCalls[0].changes[0];
    assert.ok(upsteamChange.isAdd(), "Upsteam stream change should be an ADD");
    assert.ok(checkHistoryRecordsEqual(upsteamChange.syncData.specifics, YAHOO_HISTORY_RECORD), "Upstream change should contain new local record.");
    mockHistoryService.readAllItems().
    then(function (items) {
      let result = checkArraysOfHistoryRecordsEqual([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ], items);
      assert.ok(result, "HistoryService should be unchanged");
      done();
    });
  }).
  then(null, function(err) {
    L.log("error", err.message, err.stack);
    assert.fail();
    done();
  });
};

exports["test SyncableHistoryService.mergeDataAndStartSyncing with a record with different local and remote visits"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ YAHOO_SYNC_DATA2, GOOGLE_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    assert.equal(mockSyncChangeProcessor.processCalls.length, 1, "Upstream SyncChangeProcessor should receive one upsteam change.");
    var upsteamChange = mockSyncChangeProcessor.processCalls[0].changes[0];
    assert.ok(upsteamChange.isUpdate(), "Upsteam stream change should be an UPDATE");
    assert.ok(checkHistoryRecordsEqual(upsteamChange.syncData.specifics, MERGED_YAHOO_HISTORY_RECORD), "Upstream change should contain the merged record.");
    mockHistoryService.readAllItems().
    then(function (items) {
      let result = checkArraysOfHistoryRecordsEqual([ MERGED_YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ], items);
      assert.ok(result, "HistoryService should contain the merged record.");
      done();
    });
  }).
  then(null, function(err) {
    L.log("error", err.message, err.stack);
    assert.fail();
    done();
  });
};

exports["test SyncableHistoryService.mergeDataAndStartSyncing with a remote deleted record"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ YAHOO_DELETE_SYNC_DATA, GOOGLE_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    assert.equal(mockSyncChangeProcessor.processCalls.length, 0, "Upstream SyncChangeProcessor should not be called.");
    mockHistoryService.readAllItems().
    then(function (items) {
      let result = checkArraysOfHistoryRecordsEqual([ GOOGLE_HISTORY_RECORD ], items);
      assert.ok(result, "HistoryService should not contain the deleted record.");
      done();
    });
  }).
  then(null, function(err) {
    L.log("error", err.message, err.stack);
    assert.fail();
    done();
  });
};

exports["test SyncableHistoryService.processSyncChanges with a new remote record"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ GOOGLE_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    shs.processSyncChanges(HISTORY, [ createAddChange(YAHOO_HISTORY_RECORD) ]).
    then(function () {
      assert.equal(mockSyncChangeProcessor.processCalls.length, 0, "Upstream SyncChangeProcessor should not be called.");
      mockHistoryService.readAllItems().
      then(function (items) {
        let result = checkArraysOfHistoryRecordsEqual([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ], items);
        assert.ok(result, "HistoryService contains new remote record and old records");
        done();
      });
    }).
    then(null, function(err) {
      L.log("error", err.message, err.stack);
      assert.fail();
      done();
    });
  });
};

exports["test SyncableHistoryService.processSyncChanges with a new remote record"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ GOOGLE_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    shs.processSyncChanges(HISTORY, [ createAddChange(YAHOO_HISTORY_RECORD) ]).
    then(function () {
      assert.equal(mockSyncChangeProcessor.processCalls.length, 0, "Upstream SyncChangeProcessor should not be called.");
      mockHistoryService.readAllItems().
      then(function (items) {
        let result = checkArraysOfHistoryRecordsEqual([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ], items);
        assert.ok(result, "HistoryService contains new remote record and old records.");
        done();
      });
    }).
    then(null, function(err) {
      L.log("error", err.message, err.stack);
      assert.fail();
      done();
    });
  });
};

exports["test SyncableHistoryService.processSyncChanges with a new delete remote record"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ GOOGLE_SYNC_DATA, YAHOO_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    shs.processSyncChanges(HISTORY, [ createDeleteChange(YAHOO_DELETE_RECORD) ]).
    then(function () {
      assert.equal(mockSyncChangeProcessor.processCalls.length, 0, "Upstream SyncChangeProcessor should not be called.");
      mockHistoryService.readAllItems().
      then(function (items) {
        let result = checkArraysOfHistoryRecordsEqual([ GOOGLE_HISTORY_RECORD ], items);
        assert.ok(result, "HistoryService should not contain deleted record.");
        done();
      });
    }).
    then(null, function(err) {
      L.log("error", err.message, err.stack);
      assert.fail();
      done();
    });
  });
};

exports["test SyncableHistoryService in response to a new local history entry"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [], mockSyncChangeProcessor).
  then(function () {
    // add a new yahoo record to the history
    mockHistoryService.updateItems([ YAHOO_HISTORY_RECORD ]);
    setTimeout(function() {
      assert.equal(mockSyncChangeProcessor.processCalls.length, 1, "Upstream SyncChangeProcessor should receive one upsteam change.");
      var upsteamChange = mockSyncChangeProcessor.processCalls[0].changes[0];
      assert.ok(upsteamChange.isUpdate(), "Upsteam stream change should be an UPDATE");
      assert.ok(checkHistoryRecordsEqual(upsteamChange.syncData.specifics, YAHOO_HISTORY_RECORD), "Upstream change should contain new local record.");
      done();
    }, 100);
  }).
  then(null, function(err) {
    L.log("error", err.message, err.stack);
    assert.fail();
    done();
  });
};

exports["test SyncableHistoryService in response to an updated local history entry"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ GOOGLE_SYNC_DATA, YAHOO_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    // add a new yahoo record to the history
    mockHistoryService.updateItems([ MERGED_YAHOO_HISTORY_RECORD ]);
    setTimeout(function() {
      assert.equal(mockSyncChangeProcessor.processCalls.length, 1, "Upstream SyncChangeProcessor should receive one upsteam change.");
      var upsteamChange = mockSyncChangeProcessor.processCalls[0].changes[0];
      assert.ok(upsteamChange.isUpdate(), "Upsteam stream change should be an UPDATE");
      assert.ok(checkHistoryRecordsEqual(upsteamChange.syncData.specifics, MERGED_YAHOO_HISTORY_RECORD), "Upstream change should contain updated local record.");
      done();
    }, 100);
  }).
  then(null, function(err) {
    L.log("error", err.message, err.stack);
    assert.fail();
    done();
  });
};

exports["test SyncableHistoryService in response to a deleted local history entry"] = function(assert, done) {
  let mockHistoryService = createMockHistoryService([ YAHOO_HISTORY_RECORD, GOOGLE_HISTORY_RECORD ]);
  let shs = Object.create(SyncableHistoryService).init(mockHistoryService);
  let mockSyncChangeProcessor = createMockSyncChangeProcessor();
  shs.mergeDataAndStartSyncing(HISTORY, [ GOOGLE_SYNC_DATA, YAHOO_SYNC_DATA ], mockSyncChangeProcessor).
  then(function () {
    // delete yahoo record in history
    mockHistoryService.deleteItems([ YAHOO_DELETE_RECORD ]);
    setTimeout(function() {
      assert.equal(mockSyncChangeProcessor.processCalls.length, 1, "Upstream SyncChangeProcessor should receive one upsteam change.");
      var upsteamChange = mockSyncChangeProcessor.processCalls[0].changes[0];
      assert.ok(upsteamChange.isDelete(), "Upsteam stream change should be a DELETE");
      L.log("upsteam change", upsteamChange);
      assert.ok(checkHistoryRecordsEqual(upsteamChange.syncData.specifics, YAHOO_DELETE_RECORD), "Upstream change should contain deleted local record.");
      done();
    }, 100);
  }).
  then(null, function(err) {
    L.log("error", err.message, err.stack);
    assert.fail();
    done();
  });
};


require("test").run(exports);
