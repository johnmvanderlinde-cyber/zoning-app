"use strict";
/* ---------------- State ---------------- */
const S = {
  example:true, address:"", parcelAttrs:null, origin:null,
  ring:[], edges:[], streets:[], context:[], streetToken:"",
  zone:{code:"R1", key:"R1", attrs:null, ca:null},
  dtype:"single", storeys:2, cover:35, roof:"gable", regs:{}, edited:{}, townUnits:3,
  buildings:[], contours:[], ground:null, show:"exist"
};

/* Example lot: 12.2 m x 36.6 m (40 ft x 120 ft) facing a street to the south. */
function loadExample(){
  S.origin={lon:-79.8711,lat:43.2557};
  const w=12.2,d=36.6;
  S.ring=[{x:0,y:0},{x:w,y:0},{x:w,y:d},{x:0,y:d}];
  S.edges=buildEdges(S.ring);
  S.streets=[[{x:-60,y:-10},{x:80,y:-10}]];
  S.context=[];
  for(let i=-2;i<=2;i++){if(i)S.context.push([{x:i*w,y:0},{x:i*w+w,y:0},{x:i*w+w,y:d},{x:i*w,y:d}])}
  S.parcelAttrs={LOCATION:"Example lot (40 × 120 ft)",FRONTAGE:40,DEPTH:120,SITE_AREA:4800,UNIT_OF_MEASURE:"F"};
  S.buildings=[makeBuilding([{x:1.5,y:6.5},{x:10.6,y:6.5},{x:10.6,y:16.5},{x:1.5,y:16.5}],"Example house"),
               makeBuilding([{x:6.5,y:30},{x:10.7,y:30},{x:10.7,y:35},{x:6.5,y:35}],"Example garage")];
  S.contours=[];S.ground=null;S.show="exist";S.rail=[];S.pzones=[];
  S.zone={code:"R1",key:"R1",attrs:{ZONING_DESC:"Example: Low Density Residential",PARENT_BY_LAW_NUMBER:"05-200"},ca:null};
  classifyEdges(); applyZoneDefaults(); renderAll(true);
}
