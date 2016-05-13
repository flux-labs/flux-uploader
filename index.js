'use strict';

var express = require('express');

var app = express();

app.set('port', process.env.PORT||8001);


app.use('/',express.static('.'));

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});