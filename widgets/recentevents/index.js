
var when = require('when');
var config = require('./config.json');
var Cache = null;

module.exports = config;

function datetime(ts) {
  return new Date(ts || Date.now()).toISOString().slice(0, 19).replace('T', ' ');
}

module.exports.exec = function (req, res, collections) {

  if (Cache) {
    return when(Cache);
  }

  var events = new collections.Events();

  return events.fetchBy('dt', {
    limit: 3,
    where: ['dt', '<', datetime()]
  })
  .then(function (collection) {
    config.collection = collection;
    Cache = config;

    return config;
  });
};