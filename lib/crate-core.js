var EventEmitter = require('events').EventEmitter;
var util = require('util');

var LSEQTree = require('lseqtree');
var GUID = require('./guid.js');

var MInsertOperation = require('./messages.js').MInsertOperation;
var MRemoveOperation = require('./messages.js').MRemoveOperation;
var MCaretMovedOperation = require('./messages.js').MCaretMovedOperation;

util.inherits(CrateCore, EventEmitter);

/*!
 * \brief link together all components of the model of the CRATE editor
 * \param id the unique site identifier
 * \param options the webrtc specific options
 */
function CrateCore(id, broadcast){
    EventEmitter.call(this);

    this.id = id || GUID();
    this.broadcast = broadcast;
    this.sequence = new LSEQTree(this.id);

    var self = this;
    // #A regular receive
    this.broadcast.on('message', function(message){
        var receivedBroadcastMessage = JSON.parse(message);

        switch (receivedBroadcastMessage.type){
        case 'MRemoveOperation':
            self.remoteRemove(receivedBroadcastMessage.remove,
                              receivedBroadcastMessage.origin);
            break;
        case 'MInsertOperation':
            self.remoteInsert(receivedBroadcastMessage.insert,
                              receivedBroadcastMessage.origin);
            break;
        case 'MCaretMovedOperation':
            self.remoteCaretMoved(receivedBroadcastMessage.range,
                                  receivedBroadcastMessage.origin);
            break;
        };
    });
};

/*!
 * \brief create the core from an existing object
 * \param object the object to initialize the core model of crate containing a
 * sequence and causality tracking metadata
 */
CrateCore.prototype.init = function(object){
    this.sequence.fromJSON(object.sequence);
    this.sequence._s = local.e;
    this.sequence._c = local.v;
};

/*!
 * \brief local insertion of a character inside the sequence structure. It
 * broadcasts the operation to the rest of the network.
 * \param character the character to insert in the sequence
 * \param index the index in the sequence to insert
 * \return the identifier freshly allocated
 */
CrateCore.prototype.insert = function(character, index){
    var ei = this.sequence.insert(character, index);
    var _e = ei._i._s[ei._i._s.length-1];
    this.broadcast.send(JSON.stringify(new MInsertOperation(ei, _e)));
    return ei;
};

/*!
 * \brief local deletion of a character from the sequence structure. It
 * broadcasts the operation to the rest of the network.
 * \param index the index of the element to remove
 * \return the identifier freshly removed
 */
CrateCore.prototype.remove = function(index){
    var i = this.sequence.remove(index);
    var _e = this.sequence._s;
    this.broadcast.send(JSON.stringify(new MRemoveOperation(i, _e)));
    return i;
};

CrateCore.prototype.caretMoved = function(range){
    var _e = this.sequence._s;
    this.broadcast.send(JSON.stringify(new MCaretMovedOperation(range, _e)));
    return range;
};

/*!
 * \brief insertion of an element from a remote site. It emits 'remoteInsert'
 * with the index of the element to insert, -1 if already existing.
 * \param ei the result of the remote insert operation
 * \param origin the origin id of the insert operation
 */
CrateCore.prototype.remoteInsert = function(ei, origin){
    var index = this.sequence.applyInsert(ei._e, ei._i, false);
    this.emit('remoteInsert', ei._e, index);
    if (index >= 0 && origin){
        this.emit('remoteCaretMoved', {start: index, end: index}, origin);
    };
};

/*!
 * \brief removal of an element from a remote site.  It emits 'remoteRemove'
 * with the index of the element to remove, -1 if does not exist
 * \param id the result of the remote insert operation
 * \param origin the origin id of the removal
 */
CrateCore.prototype.remoteRemove = function(id, origin){
    var index = this.sequence.applyRemove(id);
    this.emit('remoteRemove', index);
    if (index >= 0 && origin){
        this.emit('remoteCaretMoved', {start: index-1, end: index-1}, origin);
    };
};

CrateCore.prototype.remoteCaretMoved = function(range, origin){
    this.emit('remoteCaretMoved', range, origin);
};

module.exports = CrateCore;
