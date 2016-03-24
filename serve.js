var express = require('express');
var mdns    = require('mdns');
var wemo    = require('wemo-client');
var app     = express();

// Serve www/
app.use(express.static(__dirname+'/www'));
app.listen(0,function(){
  console.log('Serving http://localhost:' + this.address().port);

  // Advertise over mDNS
  mdns.createAdvertisement(
  	mdns.tcp('http'),
    this.address().port,
    {name:'Wemo Switch'}
  ).start();

  // Discover WeMos & bind events
  (new wemo()).discover(function(device){
    if (device.deviceType === wemo.DEVICE_TYPE.Switch) {
      console.log('Wemo Switch found: %s', device.friendlyName);

      var state = 0;
      var client = this.client(device);

      // The switch changed its state
      client.on('binaryState', function(value) {
        state = (value=='1');
      });

      // Toggle switch
      app.get('/toggle', function(req, res) {
        res.send(!state);
        client.setBinaryState(+!state);
      });

      // Get state
      app.get('/state',function(req, res) {
        res.send(state);
      });
      

    }
  });
});
