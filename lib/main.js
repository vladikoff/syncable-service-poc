const SyncMediator = require('sync-mediator');
const L = require('logger');

// var pageWorker = require("sdk/page-worker").Page({
//   contentScript: "",
//   contentURL: require("sdk/self").data.url("pouchdb.html")
// });

let Pouch = require('./pouchdb/dist/pouchdb');

let syncMediator = Object.create(SyncMediator).init();
//syncMediator.start();

var db = null;
var dbname = 'idb://pouch_intro';
var dbnameRemote = "http://picl:brine@remote.couch.profileinthecloud.net/pouch_intro";
var bigdbnameRemote = "http://picl:brine@bigremote.couch.profileinthecloud.net/pouch_intro";
//var dbname = 'http://localhost:9292/localhost:5984/pouch_intro';

function loadPouch() {
  Pouch(dbname, function(err, pouchdb){
    if (err) {
      L.log("Can't open pouchdb database");
    } else {
      db = pouchdb;
      L.log("PouchDB creation success");
      db.changes({continuous: true,
        complete: function(err, response) { L.log("complete", response); },
        onChange: function(change) { L.log("onChange", change); }});
      //pull();
      //allDocs();
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
    }
  });
};

var reset= function(){
    Pouch.destroy(dbname, function(err1){
        if(err1){
            L.log("Database destruction error")
        } else {
            Pouch(dbname, function(err2, pouchdb){
                if(err2){
                    L.log("Database creation error")
                } else {

                    db= pouchdb;
//
                } })
        }
    });
};

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


var push= function(){
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

var pull= function(){
    Pouch.replicate(bigdbnameRemote, dbname,
    function(err,resp){
        if(err){
          L.log("Pull failed!")
        }
        else {
          L.log("Pull yeah!");
          allDocs();
        }
    })
};

loadPouch();