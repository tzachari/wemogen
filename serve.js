var express = require('express');
var mdns    = require('mdns');
var wemo    = require('wemo-client');
var app     = express();

var delay   = 5*60*1000; // Delay for automatic shutoff (6 mins)
var timeout = null;

// Serve www/
app.use(express.static(__dirname + '/www'));
app.listen(0, function() {
  console.log(new Date(), 'Serving http://localhost:' + this.address().port);

  // Advertise over mDNS
  mdns.createAdvertisement(mdns.tcp('http'), this.address().port,{name:'WeMo'})
    .start();

  // Discover WeMos & bind events
  (new wemo()).discover(function(device) {
    if (device.deviceType === wemo.DEVICE_TYPE.Switch) {
      console.log(new Date(),'Wemo Switch found: ' + device.friendlyName);

      var state   = false;
      var present = false;
      var client  = this.client(device);
      
      var seq     = [
        mdns.rst.DNSServiceResolve(),
        'DNSServiceGetAddrInfo' in mdns.dns_sd ? 
          mdns.rst.DNSServiceGetAddrInfo() : 
          mdns.rst.getaddrinfo({families:[0]}),
        mdns.rst.makeAddressesUnique()
      ];

      var toggle  = function(req, res) {
        if (req) res.send(!state);
        client.setBinaryState(+!state);
      }

      var timer   = function() {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(toggle, delay);
      }

      // The switch changed its state
      client.on('binaryState', function(value) {
        state = (value == '1');
        if (state & !present) timer(); // Timer -- Comment out if undesired
      });

      client.soapAction('urn:Belkin:service:basicevent:1', 'GetSimulatedRuleData', null, function(err, data) {
        if (err) console.log(err);
        console.log(JSON.stringify(data,null,4));
      });

      // Detect iPhone presence over mDNS --  Comment out if undesired
      mdns.createBrowser(mdns.tcp('apple-mobdev2'), {resolverSequence:seq})
        .on('serviceUp', function() {
          console.log(new Date(), 'Present');
          present = true;
          clearTimeout(timeout);
        }).on('serviceDown', function() {
          console.log(new Date(), 'Absent');
          present = false;
          if (state) timer();
        }).on('error', function(e) {
          console.log(e);
        }).start();

      // Toggle switch
      app.get('/toggle', toggle);

      // Get state
      app.get('/state', function(req, res) {
        res.send(state);
      });
      
    }
  });

});
