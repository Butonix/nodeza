/**
 * Module dependencies.
 */
var MySql  = require('bookshelf').PG;


module.exports = MySql.Model.extend({

  tableName: 'meetups',


  hasTimestamps: true
});
