var express = require('express');
var mdns    = require('mdns');
var wemo    = require('wemo-client');
var app     = express();

var delay   = 6*60*1000; // Delay for automatic shutoff (6 mins)
var timeout = null;


// Serve www/
app.use(express.static(__dirname + '/www'));
app.listen(0,function(){
  console.log(new Date(),'Serving http://localhost:' + this.address().port);

  // Advertise over mDNS
  mdns.createAdvertisement(
  	mdns.tcp('http'),
    this.address().port,
    {name:'Wemo Switch'}
  ).start();

  // Discover WeMos & bind events
  (new wemo()).discover(function(device){
    if (device.deviceType === wemo.DEVICE_TYPE.Switch) {
      console.log(new Date(),'Wemo Switch found: ' + device.friendlyName);

      var state   = false;
      var present = false;
      var client  = this.client(device);

      var toggle  = function(req, res) {
        if (req) res.send(!state);
        client.setBinaryState(+!state);
      }

      // The switch changed its state
      client.on('binaryState', function(value) {
        state = (value=='1');
        if (state & !present) timeout = setTimeout(toggle, delay);
      });

      // Detect phone presence over mDNS
      mdns.createBrowser(mdns.tcp('apple-mobdev2')).on('serviceUp', function(){
        console.log(new Date(),'Present');
        present = true;
        clearTimeout(timeout);
      }).on('serviceDown', function() {
        console.log(new Date(),'Absent');
        present = false;
        if (state) timeout = setTimeout(toggle, delay);
      }).start();

      // Toggle switch
      app.get('/toggle', toggle);

      // Get state
      app.get('/state',function(req, res) {
        res.send(state);
      });

    }
  });

});
