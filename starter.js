
"use strict";

/*
 *  Application point of entry
**/

var config = require('./config');
var _ = require('lodash');
var app = require('widget-cms');


app.config(_.extend({
  port: 3000, // default 3000

  db: {
    client: 'mysql', // pg
    connection: config.mysql
  },

  cache: true,

  redis: {expire: 60 * 5}, // assumes localhost, port 6379

  log: true,

  rootDir: process.cwd(),

  middleware: {
    forms: true,
    csrf: true,
    sessions: true
  }
}, config));



app.start();