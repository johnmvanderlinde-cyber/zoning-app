"use strict";
/* ---------------- Lookup flow ---------------- */
const $=id=>document.getElementById(id);
let busyCount=0;
function busy(msg){busyCount++;$("hudMsg").textContent=msg;$("hud").hidden=false}
function busyMsg(msg){if(busyCount)$("hudMsg").textContent=msg}
function idle(){busyCount=Math.max(0,busyCount-1);if(!busyCount)$("hud").hidden=true}
function status(msg,err){const s=$("status");s.textContent=msg||"";s.classList.toggle("err",!!err)}

let suggTimer=null, suggSeq=0;
$("q").addEventListener("input",()=>{clearTimeout(suggTimer);const t=$("q").value.trim();if(t.length<3){hideSugg();return}suggTimer=setTimeout(()=>suggest(t),220)});
$("q").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();const first=$("sugg").querySelector("button");if(first)first.click();else geocodeText($("q").value.trim())}if(e.key==="Escape")hideSugg()});
document.addEventListener("click",e=>{if(!e.target.closest(".search"))hideSugg()});
function hideSugg(){$("sugg").hidden=true}
async function suggest(text){
  const seq=++suggSeq;
  try{
    const d=await arc(SVC.locator+"/suggest",{text,maxSuggestions:6});
    if(seq!==suggSeq)return;
    const ul=$("sugg");ul.innerHTML="";
    (d.suggestions||[]).forEach(sg=>{const li=document.createElement("li");const b=document.createElement("button");b.type="button";b.textContent=sg.text;b.onclick=()=>{$("q").value=sg.text;hideSugg();geocodeText(sg.text,sg.magicKey)};li.appendChild(b);ul.appendChild(li)});
    ul.hidden=!ul.children.length;
  }catch(e){/* suggestions are optional; Enter still geocodes */}
}
async function geocodeText(text,magicKey){
  if(!text)return;
  status("Finding the address…");busy("Finding the address…");
  try{
    const p={SingleLine:text,outSR:4326,maxLocations:1,outFields:"*"};if(magicKey)p.magicKey=magicKey;
    const d=await arc(SVC.locator+"/findAddressCandidates",p);
    const c=(d.candidates||[])[0];
    if(!c){
      // fallback: search the parcel fabric's civic address field directly
      const t=text.toUpperCase().split(",")[0].replace(/\bSTREET\b/,"ST").replace(/\bAVENUE\b/,"AVE").replace(/\bROAD\b/,"RD").replace(/\bDRIVE\b/,"DR").replace(/\bEAST\b/,"E").replace(/\bWEST\b/,"W").replace(/'/g,"''");
      const q=await arc(SVC.parcels+"/query",{where:`LOCATION LIKE '${t}%'`,outFields:"*",returnGeometry:true,outSR:4326,resultRecordCount:1});
      if(!q.features||!q.features.length){status("No Hamilton address matched. Try the street number and name only.",true);return}
      const f=q.features[0];const r=f.geometry.rings[0];const cx=r.reduce((s,p)=>s+p[0],0)/r.length,cy=r.reduce((s,p)=>s+p[1],0)/r.length;
      return lookupPoint(cx,cy,f.attributes.LOCATION,true);
    }
    await lookupPoint(c.location.x,c.location.y,c.address,true);
  }catch(e){status(e.message,true)}
  finally{idle()}
}

async function lookupPoint(lon,lat,label,fromSearch){
  status("Loading the lot outline and zoning…");if(fromSearch)busy("Loading the lot and zoning…");
  const myId=(S.lookupId=(S.lookupId||0)+1);
  const pt={x:lon,y:lat,spatialReference:{wkid:4326}};
  const common={geometry:pt,geometryType:"esriGeometryPoint",inSR:4326,spatialRel:"esriSpatialRelIntersects",outSR:4326};
  try{
    let pq=await arc(SVC.parcels+"/query",{...common,outFields:"*",returnGeometry:true});
    if(!pq.features||!pq.features.length) pq=await arc(SVC.parcels+"/query",{...common,distance:12,units:"esriSRUnit_Meter",outFields:"*",returnGeometry:true});
    if(!pq.features||!pq.features.length){status("No property parcel found at that spot. Try clicking inside a lot on the map.",true);return}
    busyMsg("Reading zoning, buildings and contours…");
    const feat=pq.features.find(f=>f.attributes.PRIME_SUB==="0000")||pq.features[0];
    const rings=feat.geometry.rings;
    // outer ring = largest
    let outer=rings[0],best=0;for(const r of rings){let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1]}if(Math.abs(a)>best){best=Math.abs(a);outer=r}}
    const cx=outer.reduce((s,p)=>s+p[0],0)/outer.length,cy=outer.reduce((s,p)=>s+p[1],0)/outer.length;
    const o={lon:cx,lat:cy};
    let ring=dedupe(outer.map(p=>toLocal(p[0],p[1],o)));if(area(ring)<0)ring.reverse();
    // bounding envelope for context queries
    const xs=outer.map(p=>p[0]),ys=outer.map(p=>p[1]);
    const pad=0.0006;
    const env={xmin:Math.min(...xs)-pad,ymin:Math.min(...ys)-pad*0.75,xmax:Math.max(...xs)+pad,ymax:Math.max(...ys)+pad*0.75,spatialReference:{wkid:4326}};
    const envQ={geometry:env,geometryType:"esriGeometryEnvelope",inSR:4326,spatialRel:"esriSpatialRelIntersects",outSR:4326,returnGeometry:true};
    const insidePt=pointInside(outer);
    const zpt={...common,geometry:{x:insidePt[0],y:insidePt[1],spatialReference:{wkid:4326}},outFields:"*",returnGeometry:false};
    const [zq,caq,sq,cq,bq,ctq,rq,pq5]=await Promise.all([
      arc(SVC.zoning+"/query",zpt),
      arc(SVC.zoningCA+"/query",zpt).catch(()=>({features:[]})),
      arc(SVC.streets+"/query",{...envQ,outFields:"*"}).catch(()=>({features:[]})),
      arc(SVC.parcels+"/query",{...envQ,outFields:"OBJECTID,PRIME_SUB",where:"PRIME_SUB='0000'",resultRecordCount:120}).catch(()=>({features:[]})),
      arc(SVC.buildings+"/query",{...envQ,outFields:"*"}).catch(()=>({features:[]})),
      arc(SVC.contours+"/query",{...envQ,outFields:"HEIGHT_IN_METRES"}).catch(()=>({features:[]})),
      arc(SVC.railways+"/query",{...envQ,outFields:"*"}).catch(()=>({features:[],failed:true})),
      arc(SVC.zoning+"/query",{...envQ,outFields:"ZONING_CODE",where:"ZONING_CODE LIKE 'P5%' OR ZONING_CODE LIKE 'P7%' OR ZONING_CODE LIKE 'P8%'"}).catch(()=>({features:[],failed:true}))
    ]);
    if(myId!==S.lookupId)return;
    S.example=false; S.law=null; S.origin=o; S.ring=ring; S.edges=buildEdges(ring); S.parcelAttrs=feat.attributes; S.address=label||feat.attributes.LOCATION;
    S.streets=(sq.features||[]).flatMap(f=>(f.geometry&&f.geometry.paths||[]).map(pa=>({pts:pa.map(p=>toLocal(p[0],p[1],o)),attrs:f.attributes})));
    S.context=(cq.features||[]).filter(f=>f.attributes.OBJECTID!==feat.attributes.OBJECTID&&f.geometry).map(f=>f.geometry.rings[0].map(p=>toLocal(p[0],p[1],o)));
    S.streetToken=streetToken(label||feat.attributes.LOCATION||"");
    const za=(zq.features&&zq.features[0])?zq.features[0].attributes:null;
    const ca=(caq.features&&caq.features[0])?caq.features[0].attributes:null;
    S.zone={code:za?za.ZONING_CODE:(ca?ca.ZONING_CODE:"?"),attrs:za,ca};
    S.zone.key=zoneKey(S.zone.code,za);
    if(!S.zone.key&&ca){const k=zoneKey(ca.ZONING_CODE,{PARENT_BY_LAW_NUMBER:"05-200"});if(k){S.zone.key=k;S.zone.fromCA=true}}
    S.edited={};
    // existing buildings: City footprints that sit mostly on this lot, trimmed to the lot lines
    S.buildings=(bq.features||[]).map(f=>{
      const r=f.geometry&&f.geometry.rings;if(!r)return null;
      let ring=dedupe(r[0].map(p=>toLocal(p[0],p[1],o)));if(ring.length<3)return null;if(area(ring)<0)ring.reverse();
      return makeBuilding(ring,f.attributes.NAME||"");
    }).filter(b=>b&&b.area>=Math.min(12,0.4*b.fullArea)).sort((a,b)=>b.area-a.area);
    S.contours=(ctq.features||[]).flatMap(f=>(f.geometry&&f.geometry.paths||[]).map(pa=>({h:f.attributes.HEIGHT_IN_METRES,pts:pa.map(p=>toLocal(p[0],p[1],o))})));
    S.rail=rq.failed?null:(rq.features||[]).flatMap(f=>(f.geometry&&f.geometry.paths||[]).map(pa=>pa.map(p=>toLocal(p[0],p[1],o))));
    S.pzones=pq5.failed?null:(pq5.features||[]).map(f=>({code:f.attributes.ZONING_CODE,rings:(f.geometry&&f.geometry.rings||[]).map(r=>r.map(p=>toLocal(p[0],p[1],o)))}));
    S.ground=S.buildings.length?groundAt(centroid(S.buildings[0].ring)):groundAt({x:0,y:0});
    S.show="exist";
    classifyEdges(); applyZoneDefaults(); renderAll(true);
    status(S.buildings.length?"":"No building footprint on this lot in the City's mapping.");
    if(myId===S.lookupId)runLawReview();
  }catch(e){status(e.message,true)}
  finally{if(fromSearch)idle()}
}
function pointInside(r){ // a point guaranteed inside the ring (centroid if inside, else scanline midpoint)
  const pts=r.map(p=>({x:p[0],y:p[1]}));
  const c={x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length};
  if(inRings(c,[pts]))return [c.x,c.y];
  const xs=[];for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>c.y)!==(b.y>c.y))xs.push((b.x-a.x)*(c.y-a.y)/(b.y-a.y)+a.x)}
  xs.sort((a,b)=>a-b);return xs.length>=2?[(xs[0]+xs[1])/2,c.y]:[c.x,c.y];
}
function streetToken(addr){
  const s=addr.split(",")[0].replace(/^\s*[\d\-A-Z]*\d[\dA-Z\-]*\s+/i,"").toUpperCase();
  const skip=new Set(["ST","STREET","AVE","AVENUE","RD","ROAD","DR","DRIVE","E","W","N","S","EAST","WEST","NORTH","SOUTH","CRES","CRESCENT","CT","COURT","BLVD","LANE","LN","PL","PLACE","WAY","HWY","THE"]);
  return (s.split(/\s+/).find(w=>w&&!skip.has(w)))||"";
}
function zoneKey(code,attrs){
  if(!code)return null;
  const m=String(code).trim().match(/^([A-Za-z]+\d*[a-z]?)/);if(!m)return null;
  const k=m[1].toUpperCase();
  const parent=attrs&&attrs.PARENT_BY_LAW_NUMBER?String(attrs.PARENT_BY_LAW_NUMBER):"05-200";
  if(!/05-200/.test(parent))return null;
  return ZONES[k]?k:null;
}
