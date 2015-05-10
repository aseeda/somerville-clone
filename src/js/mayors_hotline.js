'use strict';

// Create charts and assign ids to them
var statusChart = dc.rowChart("#status-chart");
var serviceTypeChart = dc.rowChart("#serviceType-chart");
var openDaysChart = dc.rowChart("#opendays-chart");
var dataTable = dc.dataTable("#data-table")
var dataCount = dc.dataCount('.data-count');

var allCharts = [
  {chart: statusChart, id: "#status-chart"},
  {chart: serviceTypeChart, id: "#serviceType-chart"},
  {chart: openDaysChart, id: "#opendays-chart"}
];

var singleColor = ["#1a8bba"];


var smallIcon = L.divIcon({className: "small-div-marker"});
var mapClustersLayer = L.markerClusterGroup({maxClusterRadius: 50});
var map = L.map('map', {
  center: [42.393,-71.104],
  zoom: 12,
  maxZoom: 18,
  layers: [mapClustersLayer]
});

L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',{
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    maxZoom:18
}).addTo(map);

var locations = null;
var onFiltered = function(chart, filter) {
  updateMap(locations.top(Infinity));
};

function isNumber(n) {
  return n != null && !isNaN(parseFloat(n)) && isFinite(n);
}

function validCoordinates(d) {
  return d["Date "] != null && d.g.latitude != undefined && 
    d.g.longitude != undefined &&
    isNumber(d.g.latitude) && 
    isNumber(d.g.logitude)
}

var updateMap = function(locs) {
  mapClustersLayer.clearLayers();
  var markers = locs.map(function(item){
    if( item.g.latitude!=null && item.g.latitude!=undefined) {

      return L.marker([item.g.latitude, item.g.longitude],
        {icon: smallIcon}).bindPopup(
          "<br/><strong>Address: </strong>" + item.Total_Location + 
          "<br/><strong>Days Open: </strong>" + item.days_open+ 
          "<br/><strong>Status: </strong>" + item.current_status
        );
    }
  });
  mapClustersLayer.addLayers(markers);          
};

var today = new Date();
var thirty_days_ago = d3.time.day(new Date(today.getTime() - 30*24*60*60*1000));
var tda_date = thirty_days_ago.toISOString().substring(0,10);

var data;
function handleFiles(fileList) {
  var selectedFile = fileList[0]
  Papa.parse(selectedFile,
  {
    encoding:'utf8', 
    header:true,
    delimiter: ",",
    complete: 
      function(results, file) {
      data = results.data

      var dateFormat = d3.time.format("%m/%d/%Y");
      data.forEach(function(d) {

        if ( !d["Date "] )
          //skip processing; 
          //this happens at the end of the file
          return; 

        d.date_opened = dateFormat.parse(d["Date "])
        d.days_open = Number(d["Days Open"])
        d.days_late = Number(d["Days Late"])
        d.current_status = (d.Closed == "Y" ? "Closed":"Open")

        var lat = Number(d.GeoLocation_Lat_Long.split(',')[0])
        var lon = Number(d.GeoLocation_Lat_Long.split(',')[1])
        d.g = { latitude: lat, longitude: lon };
        //d.time_to_close = Math.round((d.date_closed - d.date_opened)/1000/60/60/24);
      });

      //remove last element because it has null information
      data.pop();

      var index = crossfilter(data);
      var all = index.groupAll();

      //var open_dates = index.dimension( function(d) { return d3.time.day(d.date_opened); } );
      var open_dates = index.dimension( function(d) { return d.date_opened; } );
      var are_closed = index.dimension( function(d) { return d.current_status; } );
      var service_type = index.dimension( function(d) { return d["Service Type "]; } );

      locations = index.dimension( function(d) { return d.g; });
      var days_open = index.dimension( function(d) { return d.days_open; });

      dataCount
      .dimension(index)
      .group(all);

      statusChart
      .width($('#status-chart').innerWidth()-30)
      .height(60)
      .margins({top: 10, left:5, right: 10, bottom:-1})
      .colors(singleColor)
      .dimension(are_closed)
      .group(are_closed.group())
      .gap(1)
      .elasticX(true)
      .xAxis().ticks(0);

      

      serviceTypeChart
      .width($('#serviceType-chart').innerWidth()-30)
      .height(435)
      .margins({top: 10, left:5, right: 10, bottom:20})
      .colors(singleColor)
      .group(service_type.group())
      .gap(1)
      .dimension(service_type)
      .elasticX(true)
      .ordering(function(i) { return -i.value; })
      .labelOffsetY(12)
      .xAxis().ticks(3)
      
      serviceTypeChart.on("postRedraw", onFiltered);

      openDaysChart
      .width($('#opendays-chart').innerWidth()-30)
      .height(533)
      .margins({top: 10, left:5, right: 10, bottom:20})
      .colors(singleColor)
      .group(days_open.group())
      .dimension(days_open)
      .elasticX(true)
      .gap(1)
      .label(function(d) { return ""; })
      //.labelOffsetY(12)
      .ordering(function(i) { return -i.value; })
      .xAxis().ticks(3);

      dataTable
      .dimension(open_dates)
      .group(function (d) { 
        return tda_date + " &ndash; present";
      })
      .size(100) // (optional) max number of records to be shown, :default = 25
      .columns([
              function(d) { return d.date_opened; },
              function(d) { return d.Closed; },
              function(d) { return d.days_open; },
              // function(d) { return d.t; },
              // function(d) { return d.l; },
              // function(d) { return d.s; },
              // function(d) { return d.c_exp; }
      ])
      .sortBy( function(d) { return d.days_open })
      .order(d3.descending); 

      dc.renderAll();
      updateMap(locations.top(Infinity));

    }})
}

window.onresize = function(event) {
  allCharts.forEach(function(chart) {
    // Disable redraw animation first to prevent jitter while resizing window
    chart.chart.transitionDuration(0).width($(chart.id).innerWidth()-30);
  });
  dc.renderAll();
  // Set transition back to default:
  allCharts.forEach(function(chart) {
    chart.chart.transitionDuration(750);
  });
};
