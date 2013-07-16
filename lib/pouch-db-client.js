const { reject, defer } = require('sdk/core/promise');
const L = require('logger');

let Pouch = require('./pouchdb/dist/pouchdb');
const DEFAULT_DB_LOCAL = 'idb://pouch_intro';
//const DEFAULT_DB_REMOTE = 'http://picl:brine@bigcouch.storage.profileinthecloud.net/pouch_intro';
const DEFAULT_DB_REMOTE = 'http://localhost:5984/pouch_intro';

function handleError(error) {
  if (error.json) throw error.json;
  else throw { code: error.status, error: error.statusText, message: error.text };
}

function PouchDbClient(options) {
  options = options || {};

  this.db = options.db || null;
  this.dbLocal = options.dbLocal || DEFAULT_DB_LOCAL;
  this.dbRemote = options.dbRemote || DEFAULT_DB_REMOTE;
}

PouchDbClient.prototype.init = function() {
  let _that = this;
  let deferred = defer();

  if (! this.db) {
    Pouch(this.dbLocal, function(err, pouchdb){
      if (err) {
        L.log("Can't open pouchdb database");
      } else {
        _that.db = pouchdb;
        L.log("PouchDB creation success");
      }

      deferred.resolve();
    });
  }

  return deferred.promise;
};

/**
 * Update collection
 * @param args
 */
PouchDbClient.prototype.updateCollection = function(args) {
  let _that = this;
  let deferred = defer();
  let items = (args && args.items) ? { docs: args.items } : { docs: [] };

  L.log('Putting Items: ', items.docs.length);
  this.db.bulkDocs(items, function(err, response) {
    L.log('local ->>>> remote');
    if (!err) {
      Pouch.replicate(_that.dbLocal, _that.dbRemote,
        function(err,resp){
          if(err){
            L.log("Failed!");
          }
          deferred.resolve(resp);
        });
    } else {
      L.log('error in updateCollection', 'this.db.bulkDocs');
    }
  });

  return deferred.promise;
};

/**
 * Read collection
 * @param args
 */
PouchDbClient.prototype.readCollection = function(args) {
  let _that = this;
  let deferred = defer();

  L.log('local <<<<- remote');
  Pouch.replicate(this.dbRemote, this.dbLocal, {}, function(err,resp){
      if(err) {
        deferred.reject("Pull failed!");
      } else {
        L.log("Pull yeah!", resp);
        _that.db.allDocs({include_docs: true}, function(err, res){
          if (!err) {
            L.log("allDocs", res.total_rows);
          }
          else {
            L.log("allDocs error", res);
          }
          var records = {version: null, items: [] };
          if (res.rows.length > 0) {
            records = { version: res._rev, items: res.rows };
          }
          deferred.resolve(records);
        });
      }
    });
  return deferred.promise;
};


/**
 * Reset the local Pouch database
 */
PouchDbClient.prototype.reset = function() {
  let _that = this;

  Pouch.destroy(this.dbLocal, function(err1){
    if(err1){
      L.log("Database destruction error")
    } else {
      Pouch(_that.dbLocal, function(err2, pouchdb){
        if(err2){
          L.log("Database creation error")
        } else {
          _that.db = pouchdb;
        }
      })
    }
  });
};


/**
 * Get database collection information
 * @param args
 */
PouchDbClient.prototype.getCollectionsInfo = function(args) {
  throw "must implement getCollectionsInfo";
};


module.exports = PouchDbClient;
