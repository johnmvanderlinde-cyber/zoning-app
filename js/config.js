"use strict";
/* ---------------- City of Hamilton services (from the Interactive Zoning web map) ---------------- */
const SVC = {
  locator: "https://spatialsolutions.hamilton.ca/webgis/rest/services/Geocoders/Address_Locator/GeocodeServer",
  parcels: "https://spatialsolutions.hamilton.ca/webgis/rest/services/General/Property/MapServer/6",
  zoning:  "https://spatialsolutions.hamilton.ca/webgis/rest/services/General/Zoning/MapServer/9",
  zoningCA:"https://spatialsolutions.hamilton.ca/webgis/rest/services/General/Zoning/MapServer/8",
  zoningMap:"https://spatialsolutions.hamilton.ca/webgis/rest/services/General/Zoning/MapServer",
  propertyMap:"https://spatialsolutions.hamilton.ca/webgis/rest/services/General/Property/MapServer",
  streets: "https://spatialsolutions.hamilton.ca/webgis/rest/services/General/SearchLayers/MapServer/3",
  buildings:"https://spatialsolutions.hamilton.ca/webgis/rest/services/General/Topographic/MapServer/6",
  contours:"https://spatialsolutions.hamilton.ca/webgis/rest/services/General/Topographic/MapServer/5",
  railways:"https://spatialsolutions.hamilton.ca/webgis/rest/services/General/Topographic/MapServer/3"
};
const BYLAW_URL = "https://www.hamilton.ca/build-invest-grow/planning-development/zoning/zoning-law-05-200";

/* ---------------- Zoning By-law 05-200 regulations (from the sections supplied) ----------------
   Distances in metres, areas in square metres, percentages as whole numbers. */
const BASE = {front:4.0, flank:3.0, rear:7.5, height:10.5};
const ZONES = {
  R1:{name:"Low Density Residential (R1) Zone", section:"15.1",
    types:{
      single:  {ref:"15.1.2.1", lotArea:360, lotWidth:12, side:1.2, landscaped:30, ...BASE},
      semi:    {ref:"15.1.2.2", lotAreaPerUnit:270, lotWidthPerUnit:9, side:1.2, landscaped:30, ...BASE},
      town:    {ref:"15.1.2.3", lotAreaPerUnit:180, unitWidth:6, side:1.2, ...BASE},
      fourplex:{ref:"15.1.2.4", lotArea:360, lotWidth:12, side:1.2, sideAgg:3.5, coverage:40, landscaped:30, ...BASE}},
    notes:["On lots shown on Figure 36 of Schedule F, the front setback may match neighbouring dwellings (within 10% of their average), but never less than 0.5 m.",
           "Fourplex: amenity areas are not permitted in the side yard or on the roof; outdoor waste storage must be enclosed and not in the front yard."]},
  R1A:{name:"Low Density Residential – Small Lot (R1a) Zone", section:"15.2",
    types:{
      single:  {ref:"15.2.2.1", lotArea:270, lotWidth:9, side:1.2, landscaped:30, ...BASE},
      semi:    {ref:"15.2.2.2", lotAreaPerUnit:225, lotWidthPerUnit:7.5, side:1.2, landscaped:30, ...BASE},
      town:    {ref:"15.2.2.3", lotAreaPerUnit:180, unitWidth:6, side:1.2, ...BASE},
      fourplex:{ref:"15.2.2.4", lotArea:300, lotWidth:10, side:1.2, sideAgg:3.5, landscaped:30, ...BASE}},
    notes:["On lots shown on Figure 36 of Schedule F, the front setback may match neighbouring dwellings (within 10% of their average), but never less than 0.5 m."]},
  R2:{name:"Low Density Residential – Large Lot (R2) Zone", section:"15.3",
    types:{
      single:  {ref:"15.3.2.1", lotArea:630, lotWidth:18, side:2.0, coverage:35, landscaped:40, ...BASE},
      semi:    {ref:"15.3.2.2", lotAreaPerUnit:315, lotWidthPerUnit:9, side:2.0, landscaped:35, ...BASE},
      town:    {ref:"15.3.2.3", lotAreaPerUnit:180, unitWidth:6, side:1.2, ...BASE},
      fourplex:{ref:"15.3.2.4", lotArea:630, lotWidth:18, side:2.0, coverage:35, landscaped:40, ...BASE}},
    notes:[]},
  S1:{name:"Settlement Residential (S1) Zone", section:"12.3",
    types:{single:{ref:"12.3.3", lotArea:4000, lotWidth:30, front:7.5, side:3.0, flank:3.0, rear:7.5, height:10.5}},
    notes:["Rural settlement lots: the 0.4 ha minimum reflects private servicing."]},
  A1:{name:"Agriculture (A1) Zone", section:"12.1",
    types:{single:{ref:"12.1.3.3", lotArea:4000, lotWidth:30, front:10, side:3.0, flank:10, rear:10, height:10.5}},
    notes:["Shown for a single detached dwelling. Agricultural buildings use 15 m yards and 20% lot coverage (12.1.3.1)."]},
  A2:{name:"Rural (A2) Zone", section:"12.2",
    types:{single:{ref:"12.2.3", lotArea:4000, lotWidth:30, front:10, side:3.0, flank:10, rear:10, height:10.5}},
    notes:["Shown for a single detached dwelling. Agricultural buildings use 15 m yards and 20% lot coverage."]},
  P5:{name:"Conservation/Hazard Land (P5) Zone", section:"7.5", restricted:true},
  P6:{name:"Conservation/Hazard Land – Rural (P6) Zone", section:"7.6", restricted:true},
  P7:{name:"Conservation/Hazard Land – Rural (P7) Zone", section:"7.7", restricted:true},
  P8:{name:"Conservation/Hazard Land – Rural (P8) Zone", section:"7.8", restricted:true}
};
const DTYPES = {
  single:{label:"Single detached dwelling", rules:"single", units:1},
  duplex:{label:"Duplex dwelling", rules:"single", units:2},
  triplex:{label:"Triplex dwelling", rules:"single", units:3},
  semi:{label:"Semi-detached dwelling", rules:"semi", units:2},
  town:{label:"Street townhouses", rules:"town", units:0},
  fourplex:{label:"Fourplex dwelling", rules:"fourplex", units:4},
  custom:{label:"Building (enter regulations)", rules:"custom", units:1}
};
const ASSUMED = {ref:"assumed", front:6, side:1.2, flank:3, rear:7.5, height:10.5};
