"use strict";

/**
 * Users collection
**/

var Base = require('widget-cms').Bookshelf;
var Role = require('../models/roles');


var Roles = Base.Collection.extend({

  model: Role

});


module.exports = Base.collection('Roles', Roles);
