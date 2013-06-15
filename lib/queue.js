var Queue = {
  init: function() {
    this.queue = [];
  },

  enqueue: function(item) {
    this.queue.unshift(item);
  },

  dequeue: function() {
    return this.queue.pop();
  },

  hasItems: function() {
    return this.queue.length > 0;
  }
};

module.exports = Queue;