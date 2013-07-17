const { reject, defer } = require('sdk/core/promise');
const L = require('logger');

let Pouch = require('./pouchdb/dist/pouchdb-nightly');

// DEBUG MODE
Pouch.DEBUG = false;

const DEFAULT_DB_LOCAL = 'idb://pouch_intro';
//const DEFAULT_DB_REMOTE = 'http://picl:brine@bigcouch.storage.profileinthecloud.net/pouch_intro';
const DEFAULT_DB_REMOTE = 'http://localhost:5984/content_history';
//const DEFAULT_DB_REMOTE = 'http://couch.storage.profileinthecloud.net/content_history';


function handleError(error) {
  if (error.json) throw error.json;
  else throw { code: error.status, error: error.statusText, message: error.text };
}

function PouchDbClient(options) {
  var options = options || {};

  this.db = options.db || null;
  this.dbLocal = options.dbLocal || DEFAULT_DB_LOCAL;
  this.dbRemote = options.dbRemote || DEFAULT_DB_REMOTE;

  this.DB_KEY = 0;
}

PouchDbClient.prototype.init = function () {
  let _that = this;
  let deferred = defer();

  if (!this.db) {
    Pouch(this.dbLocal, function (err, pouchdb) {
      if (err) {
        L.log("Can't open pouchdb database");
      } else {
        _that.db = pouchdb;
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
PouchDbClient.prototype.updateCollection = function (args) {
  let _that = this;
  let deferred = defer();
  let items = (args && args.items) ? { docs: args.items } : { docs: [] };

  this.db.bulkDocs(items, function (err, response) {
    if (!err) {
      Pouch.replicate(_that.db, _that.dbRemote, function (err, resp) {
        if (!err) {
          L.log("Replication failed!", err);
          deferred.reject(err);
        } else {
          L.log('REPLICATE COMPLETE: local -->>> remote', 'just put', items.docs.length, 'documents');
          // TODO: version needs to be specified
          deferred.resolve({version: -1, items: [] });
        }
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
PouchDbClient.prototype.readCollection = function (args) {
  let _that = this;
  let deferred = defer();

  // replicate remote to local
  Pouch.replicate(this.dbRemote, this.db, {}, function (err, resp) {
    if (!err) {
      // fetch local database info to get the latest local sequence number
      _that.db.info(function (err, info) {
        _that.db.changes({
          since: _that.DB_KEY,
          continuous: false,
          complete: function (err, response) {
            let len = response.results.length;
            var items = [];

            L.log('Results', len, 'since KEY #', _that.DB_KEY);
            if (len > 0) {
              _that.DB_KEY = response.results[len - 1].seq;
              var k = 0;
              response.results.forEach(function (change) {
                _that.db.get(change.id, function (err, doc) {
                  k++;
                  items.push(doc);
                  if (len === k) {
                    //L.log(items);
                    deferred.resolve({ version: -1, items: items });
                  }
                });
              });
            } else {
              // TODO: what exactly is version?
              deferred.resolve({ version: -1, items: [] });
            }
          }
        });
      });

    } else {
      deferred.reject("error in readCollection", err);
    }
  });
  return deferred.promise;
};


/**
 * Reset the local PouchDb
 */
PouchDbClient.prototype.reset = function () {
  let _that = this;

  Pouch.destroy(this.dbLocal, function (err1) {
    if (err1) {
      L.log("Database destruction error")
    } else {
      Pouch(_that.dbLocal, function (err2, pouchdb) {
        if (err2) {
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
PouchDbClient.prototype.getCollectionsInfo = function (args) {
  throw "must implement getCollectionsInfo";
};


module.exports = PouchDbClient;
