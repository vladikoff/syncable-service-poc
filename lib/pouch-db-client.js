const { reject, defer } = require('sdk/core/promise');
const L = require('logger');

let Pouch = require('./pouchdb/dist/pouchdb');
const DEFAULT_DB_LOCAL = 'idb://pouch_intro';
//const DEFAULT_DB_REMOTE = 'http://picl:brine@bigcouch.storage.profileinthecloud.net/pouch_intro';
//const DEFAULT_DB_REMOTE = 'http://localhost:9292/localhost:5984/pouch_intro';
const DEFAULT_DB_REMOTE = 'http://localhost:5984/pouch_intro';

function handleError(error) {
  if (error.json) throw error.json;
  else throw { code: error.status, error: error.statusText, message: error.text };
}

// should be called with a this context
function getUserId(args) {
  var userId = args.userId || this.userId;
  return userId;
}

function getToken(args) {
  return args.token || this.token;
}

function PouchDbClient(options, cb) {
  console.log('PouchDbClient');
  var _that = this;

  options = options || {};
  this.db = options.db || null;
  this.dbLocal = options.dbLocal || DEFAULT_DB_LOCAL;
  this.dbRemote = options.dbRemote || DEFAULT_DB_REMOTE;

  if (! this.db) {
    Pouch(this.dbLocal, function(err, pouchdb){
      if (err) {
        L.log("Can't open pouchdb database");
      } else {
        _that.db = pouchdb;
        L.log("PouchDB creation success");
      }
      console.log('callback');
      // TODO: fix this
      if (cb) cb();
    });
  }
}

/**
 * Update collection
 * @param args
 */
PouchDbClient.prototype.updateCollection = function(args) {
  let _that = this;
  let deferred = defer();

  var items = { docs: [] };
  if (args && args.items) {
    items = { docs: args.items };
  }

  L.log('putting items: ', items.docs.length);
  this.db.bulkDocs(items, function(err, response) {
    L.log("put response", response, err);
    //   push();
    //   allDocs();
    // });
    L.log('local ->>>> remote');
    Pouch.replicate(_that.dbLocal, _that.dbRemote,
      function(err,resp){
        if(err){
          L.log("Failed!");
        }
        deferred.resolve(resp);
      });
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

  L.log('remote ->>>> local');
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
  L.log('getCollectionsInfo');
};


module.exports = PouchDbClient;

/*
var addToDB = function(){
  //var text= document.getElementById('enter-text').value;
  db.post({text: text});
};

var allDocs = function() {
  db.allDocs({include_docs: true}, function(err, res){
    if (!err) {
      L.log("allDocs", res);
    }
    else {
      L.log("allDocs error", res);
    }
  });
};
*/

// var showTextAlternative= function(){
//     var map= function(doc){
//         if(doc.text){
//             emit(doc._id, doc.text);
//         }
//     };

//     db.query({map: map}, function(err, res){
//         if(!err){
//             var out= "";
//             res.rows.forEach(function(element){
//                 out+= element.value + '<br>';
//             });
//             document.getElementById('display-area').innerHTML= out;
//         }
//     })
// };

         /*
var push = function(){
  Pouch.replicate(dbname, bigdbnameRemote,
    function(err,resp){
      if(err){
        L.log("Push failed!");
      }
      else {
        L.log("Push yeah!");
      }
    })
};



          // db.changes({continuous: true,
          //   complete: function(err, response) { L.log("complete", response); },
          //   onChange: function(change) { L.log("onChange", change); }});
          pull();
          //push();
          allDocs();
          // db.put({ _id: 'mydoc'+Math.random(), title: 'Rock and Roll Heart' }, function(err, response) {
          //   L.log("put response", response, err);
          //   push();
          //   allDocs();
          // });
          // db.post({ title: 'Rock and Roll Heart' }, function(err, response) {
          //   L.log("response", response, err);
          //   allDocs();
          // });
          //allDocs();
           */