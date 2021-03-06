(function(){

  var types = {
    markers: [],
    bounds: [],
    results: [],
    people: []
  };

  var map;
  var currentMarker;
  var origin;

  // todo: wrap this up into a route object
  var clear = function(type) {
    for (var i = 0; i < types[type].length; i++) {
      types[type][i].setMap(null);
    }
    types[type].length = 0;
  };

  //places a marker at given lat and lon, inserts position into DB if there is no current marker by user
  var placeMarker = function(lat, lon) {

    var position = new google.maps.LatLng(lat, lon);
    currentMarker = new google.maps.Marker({
      position: position,
    });

    origin = origin || currentMarker;
    if (currentMarker !== origin) {
      types.markers.push(currentMarker);
    }
    currentMarker.setMap(map);
    Session.set('origin', origin.position);
  };

  var googleClickHandler = function(event) {
    var newLat = event.latLng.lat();
    var newLon = event.latLng.lng();

    app.routeToPosition(newLat, newLon);
  };

  //Renders map and puts marker at lat/lon passed into argument.
  var initMap = function(lat, lon) {
    var myPosition = new google.maps.LatLng(lat, lon);
    var mapOptions = {
      center: myPosition,
      zoom: 13,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
    service = new google.maps.places.PlacesService(map);

    google.maps.event.addListener(map, 'click', googleClickHandler);
  };

  var placeResult = function(lat, lon, resultObj) {
    var position = new google.maps.LatLng(lat, lon);

    var result = new google.maps.Marker({
      position: position,
    });

    var infowindow = new google.maps.InfoWindow({
      content: '<h1 class="cafeName">' + resultObj.name + '</h1><em class="cafeLocation">' + resultObj.vicinity + '</em>'
    });

    google.maps.event.addListener(result, 'click', function() {
      infowindow.open(map, this);
    });

    types.results.push(result);
    result.setMap(map);
  };

  var placeOtherUsers = function(lat, lon, otherUser) {
    var position = new google.maps.LatLng(lat, lon);
    var thisUser = Meteor.users.findOne({_id: otherUser._id});

    var userMarker = new google.maps.Marker({
      position: position,
      icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
      title: thisUser.profile.name || 'other user'
    });

    types.people.push(userMarker)
    userMarker.setMap(map);
  };

  //function draws bounding box
  var drawBounds = function(newLat, newLon) {
    var bound;

    var polyCoords =[
      new google.maps.LatLng(myLat, newLon),
      new google.maps.LatLng(myLat, myLon),
      new google.maps.LatLng(newLat, myLon),
      new google.maps.LatLng(newLat, newLon),
    ];

    var mostNorth = Math.max(myLat, newLat);
    var mostEast  = Math.max(myLon, newLon);
    var mostWest  = Math.min(myLon, newLon);
    var mostSouth = Math.min(myLat, newLat);

    var NE = new google.maps.LatLng(mostNorth, mostEast);
    var SW = new google.maps.LatLng(mostSouth, mostWest);
    var boundz = new google.maps.LatLngBounds(SW, NE);

    var request = {
      bounds: boundz,
      types: ['cafe']
    };

    bound = new google.maps.Polygon({paths: polyCoords, strokeColor: "#333", strokeOpacity: 0.8, strokeWeight: 3, fillColor: "rgb(70, 182, 66)", fillOpacity: 0.25});

    types.bounds.push(bound);
    bound.setMap(map);

    service.nearbySearch(request, function(results) {
      clear('results');
      for (var i = 0; i < results.length; i++) {
        if (results[i].rating > 4) {
          placeResult(results[i].geometry.location.jb, results[i].geometry.location.kb, results[i]);
        }
      }
    });
  };

  window.app = {
    routeToPosition: function(lat, lon) {
      clear('markers');
      placeMarker(lat, lon);
      clear('bounds');
      drawBounds(lat, lon);
    },

    //Sets the latitude and longitude of the user, calls map and marker makers
    setPosition : function(position) {
      var lat = position.coords.latitude;
      var lon = position.coords.longitude;
      myLat = lat;
      myLon = lon;
      initMap(lat, lon);
      placeMarker(lat, lon);
    },

    findOthers : function() {
      var user = Meteor.userId();
      if (!beating) {
        Meteor.setInterval(function() {
          var others = LoggedIn.find({user: {$ne: user}}).fetch();
          clear('people');
          for (var i = 0; i < others.length; i++) {
            var otherInfo = others[i];
            var otherUser = Meteor.users.findOne({_id: others[i].user});
            placeOtherUsers(otherInfo.position.kb, otherInfo.position.lb, otherUser);
            placeOtherUsers(otherInfo.position.jb, otherInfo.position.kb, otherUser);
          }
        }, 1500);
      }
    },

    //Initialises heartbeat interval
    startBeating : function() {
      if (!beating) {
        var heartbeat =
        Meteor.setInterval(function() {
        Meteor.call('heartbeat', Meteor.userId());
      }, 500)
        beating = true;
      } else {
        return false;
      }
    }
  };

}());
