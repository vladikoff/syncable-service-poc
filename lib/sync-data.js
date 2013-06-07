function createSyncData(dataType, specifics) {
  return Object.create(SyncData).init(dataType, specifics);
}

const SyncData = {
  init: function(dataType, specifics) {
    this.dataType = dataType;
    this.specifics = specifics;
    return this;
  }
};

const SyncDataTypes = {
  HISTORY: "history"
}

module.exports = {
  dataTypes: SyncDataTypes,
  create: createSyncData
}