"use strict";
/* ---------------- Map (Leaflet + City layers) ---------------- */
let map,lotLayer;
function initMap(){
  map=L.map("map",{zoomControl:true,attributionControl:true}).setView([43.2557,-79.8711],18);
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:21,maxNativeZoom:19,attribution:"Imagery © Esri · Zoning & parcels © City of Hamilton"}).addTo(map);
  if(L.esri){
    L.esri.dynamicMapLayer({url:SVC.zoningMap,layers:[9],opacity:0.35,f:"image"}).addTo(map);
    L.esri.dynamicMapLayer({url:SVC.propertyMap,layers:[6],opacity:0.9,f:"image",minZoom:17}).addTo(map);
    L.esri.dynamicMapLayer({url:NEC,layers:[10],opacity:0.3,f:"image"}).addTo(map); // NEC Area of Development Control
  }
  lotLayer=L.layerGroup().addTo(map);
  map.on("click",e=>{$("q").value="";lookupPoint(e.latlng.lng,e.latlng.lat,null)});
}
function renderMap(G,fit){
  if(!map)return;lotLayer.clearLayers();
  const o=S.origin;const css=getComputedStyle(document.documentElement);
  L.polygon(S.ring.map(p=>toLL(p,o)),{color:"#ffffff",weight:2,fillOpacity:0}).addTo(lotLayer);
  G.envRings.forEach(r=>L.polygon(r.map(p=>toLL(p,o)),{color:css.getPropertyValue("--zone").trim(),weight:2,dashArray:"4 3",fillOpacity:0.25}).addTo(lotLayer));
  S.buildings.forEach(b=>b.rings.forEach(r=>L.polygon(r.map(p=>toLL(p,o)),{color:"#2A3A2E",weight:1.2,fillColor:css.getPropertyValue("--exist").trim(),fillOpacity:0.85}).addTo(lotLayer)));
  if(G.house&&S.show!=="exist"){const H=G.house;L.polygon([H.FL,H.FR,H.BR,H.BL].map(p=>toLL(p,o)),{color:"#1c2a2d",weight:1.5,fillColor:"#f7f3ea",fillOpacity:0.9}).addTo(lotLayer)}
  if(fit)map.fitBounds(L.polygon(S.ring.map(p=>toLL(p,o))).getBounds(),{padding:[40,40],maxZoom:20});
}
