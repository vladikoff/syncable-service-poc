const L = require('logger');

function createSyncChange(changeType, syncData) {
  return Object.create(SyncChange).init(changeType, syncData);
}

const SyncChange = {
  init: function(changeType, syncData) {
    this.changeType = changeType;
    this.syncData = syncData;
    return this;
  },

  isDelete: function () {
    return this.changeType === SyncChangeTypes.DELETE;
  },

  isUpdate: function () {
    return this.changeType === SyncChangeTypes.UPDATE;
  },

  isAdd: function () {
    return this.changeType === SyncChangeTypes.ADD;
  }

};

const SyncChangeTypes = {
  ADD: "ADD",
  UPDATE: "UPDATE",
  DELETE: "DELETE"
}

module.exports = {
  changeTypes: SyncChangeTypes,
  create: createSyncChange
}