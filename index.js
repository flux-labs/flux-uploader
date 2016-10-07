'use strict';

var express = require('express');

var app = express();

app.set('port', process.env.PORT||8001);

app.get('*',function(req,res,next){
  // if(req.headers['x-forwarded-proto']!='https')
  //   res.redirect('https://flux-3d-model-uploader.herokuapp.com'+req.url)
  // else
    next() /* Continue to other routes if we're not redirecting */
});

app.use('/',express.static('.'));

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
