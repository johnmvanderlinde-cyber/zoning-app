"use strict";
/* ---------------- Applicable law review ----------------
   Each overlay is tested against the lot shrunk 0.5 m inward, so a neighbouring area that only touches a lot line is not reported. */
const NEC = "https://ws.services.geospatial.gov.on.ca/arcgis1/rest/services/NEC/NEC_Map/MapServer";
const NEC_VIEWER = "https://www.lioapplications.lrc.gov.on.ca/NEC/index.html?viewer=NiagaraEscarpmentCommission.NiagaraEscarpmentCommission&locale=en-CA";
const HAM = "https://spatialsolutions.hamilton.ca/webgis/rest/services/General";
const LAW_LINKS = {
  planning:"https://www.ontario.ca/laws/statute/90p13", nepda:"https://www.ontario.ca/laws/statute/90n02",
  reg826:"https://www.ontario.ca/laws/regulation/900826", reg828:"https://www.ontario.ca/laws/regulation/900828",
  nep:"https://www.escarpment.org/niagara-escarpment-plan/", caa:"https://www.ontario.ca/laws/statute/90c27",
  reg41:"https://www.ontario.ca/laws/regulation/240041", oha:"https://www.ontario.ca/laws/statute/90o18",
  greenbelt:"https://www.ontario.ca/laws/statute/05g01", cwa:"https://www.ontario.ca/laws/statute/06c22",
  bca:"https://www.ontario.ca/laws/statute/92b23"
};
/* Public map viewers, so each finding can be confirmed on the agency's own map.
   Web AppBuilder viewers accept center/level/marker in the URL and open on the property. */
const VIEWERS = {
  heritage:{name:"City heritage map",url:"https://spatialsolutions.maps.arcgis.com/apps/webappviewer/index.html?id=aba8025ce739485ca37130d56040bb84",wab:true},
  heritageAll:{name:"cultural heritage map",url:"https://spatialsolutions.maps.arcgis.com/apps/webappviewer/index.html?id=ef361312714b4caa863016bba9e6e68f",wab:true},
  register:{name:"Municipal Heritage Register",url:"https://www.hamilton.ca/build-invest-grow/planning-development/heritage-properties/municipal-heritage-register"},
  hca:{name:"HCA regulated areas map",url:"https://conservationhamilton.ca/regulated-areas-map-tool/",match:/hamilton/i},
  halton:{name:"Conservation Halton map",url:"https://camaps.maps.arcgis.com/apps/webappviewer/index.html?id=a2928bf280194294a4027111f8ff284a",wab:true,match:/halton/i},
  npca:{name:"NPCA Watershed Explorer",url:"https://camaps.maps.arcgis.com/apps/webappviewer/index.html?id=c7555050c8f24a7cbc829395557a7988",wab:true,match:/niagara|npca/i},
  grca:{name:"GRCA Map Your Property",url:"https://www.grandriver.ca/planning-development/map-your-property/",match:/grand/i}
};
function viewerLink(key,label){
  const v=VIEWERS[key];let u=v.url;
  if(v.wab&&S.lotLL){const [lo,la]=S.lotLL.pt;u+=`&center=${lo.toFixed(6)},${la.toFixed(6)},4326&level=19&marker=${lo.toFixed(6)},${la.toFixed(6)},4326,,,${encodeURIComponent(S.address||"Property")}`}
  return `<a target="_blank" rel="noopener" href="${esc(u)}">${label||v.name}</a>`;
}
const CA_KEYS=["hca","halton","npca","grca"];
function caLinksFor(authority){
  const k=authority?CA_KEYS.find(k=>VIEWERS[k].match.test(authority)):null;
  return k?viewerLink(k):CA_KEYS.map(k=>viewerLink(k)).join(" · ");
}
const OVERLAYS = {
  necDC:   {url:NEC+"/10", out:"Part"},
  necArea: {url:NEC+"/1",  out:"*"},
  necDes:  {url:NEC+"/2",  out:"DESIGNATION"},
  necMUC:  {url:NEC+"/3",  out:"*"},
  necPark: {url:NEC+"/0",  out:"*"},
  ca:      {url:HAM+"/PolicyPlanning/MapServer/18", out:"AUTHORITY"},
  greenbelt:{url:HAM+"/PolicyPlanning/MapServer/16", out:"DESIGNATION"},
  secPlan: {url:HAM+"/PolicyPlanning/MapServer/5", out:"SEC_PLAN_NAME,LINK_PDF_MAP,PLAN_STATUS"},
  noise:   {url:HAM+"/PolicyPlanning/MapServer/2", out:"MIN_DECIBEL,MAX_DECIBEL"},
  heritage:{url:HAM+"/Heritage/MapServer/6", out:"HERITAGE_STATUS,PART_IV,PART_V,HCD_NAME,BYLAW_NO,BYLAW_PDF,NAME,ACTIVE"},
  ehn:     {url:HAM+"/Heritage/MapServer/11", out:"NH_NAME"},
  icbl:    {url:HAM+"/Zoning/MapServer/19", out:"BY_LAW_NUMBER,FILE_NAME,PARENT_BY_LAW_NUMBER"},
  ipz:     {url:HAM+"/Environmental/MapServer/4", out:"*"},
  whpa:    {url:HAM+"/Environmental/MapServer/8", out:"*"},
  coa:     {url:HAM+"/Development/MapServer/0", out:"FILE_NUMBER"}
};
async function overlayQuery(key){
  const o=OVERLAYS[key];
  const params={geometry:S.lotLL.poly,geometryType:"esriGeometryPolygon",inSR:4326,spatialRel:"esriSpatialRelIntersects",outFields:o.out,returnGeometry:false,f:"json"};
  let d;
  try{ const r=await fetch(o.url+"/query",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:qs(params)}); d=await r.json(); }
  catch(e){ // browsers that block the cross-site POST: fall back to a point test inside the lot
    d=await jsonp(o.url+"/query",{geometry:{x:S.lotLL.pt[0],y:S.lotLL.pt[1],spatialReference:{wkid:4326}},geometryType:"esriGeometryPoint",inSR:4326,spatialRel:"esriSpatialRelIntersects",outFields:o.out,returnGeometry:false});
    if(d)d.pointOnly=true;
  }
  if(d&&d.error)throw new Error(d.error.message||"query failed");
  return {feats:(d.features||[]).map(f=>f.attributes),pointOnly:!!(d&&d.pointOnly)};
}
async function runLawReview(){
  const shrunk=(()=>{const co=new ClipperLib.ClipperOffset(2,0.02*SC);co.AddPath(toPath(S.ring),ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);const sol=new ClipperLib.Paths();co.Execute(sol,-0.5*SC);
    const r=sol.length?fromPath(sol.sort((a,b)=>Math.abs(ClipperLib.Clipper.Area(b))-Math.abs(ClipperLib.Clipper.Area(a)))[0]):S.ring;return r})();
  const rings=[shrunk.map(p=>{const [la,lo]=toLL(p,S.origin);return [+lo.toFixed(7),+la.toFixed(7)]})];rings[0].push(rings[0][0]);
  const c=centroid(shrunk);const inside=inRings(c,[shrunk])?c:shrunk[0];const [la,lo]=toLL(inside,S.origin);
  S.lotLL={poly:{rings,spatialReference:{wkid:4326}},pt:[lo,la]};
  const token=S.lookupId;
  S.law={state:"busy",res:{}};renderLaw();
  const keys=Object.keys(OVERLAYS);
  const results=await Promise.all(keys.map(k=>overlayQuery(k).then(r=>[k,r]).catch(e=>[k,{error:e.message}])));
  if(token!==S.lookupId)return; // a newer lookup started
  S.law={state:"done",res:Object.fromEntries(results)};renderLaw();
}
function lawItems(){
  const z=zoneDef(),za=S.zone.attrs||{},R=S.law&&S.law.res||{};
  const hit=k=>R[k]&&!R[k].error&&R[k].feats.length>0;
  const err=k=>!R[k]||!!R[k].error;
  const first=(k,f)=>{const v=R[k]&&R[k].feats&&R[k].feats.find(a=>a[f]!=null&&String(a[f]).trim()!=="");return v?v[f]:null};
  const L=(href,t)=>`<a target="_blank" rel="noopener" href="${href}">${t}</a>`;
  const items=[];
  // 1. Zoning
  const parent=za.PARENT_BY_LAW_NUMBER||(z?"05-200":"");
  items.push({s:"applies",t:`Zoning By-law ${esc(parent||"(see City)")} · ${esc(S.zone.code||"?")}`,
    d:`Made under the ${L(LAW_LINKS.planning,"Planning Act")}. Relief from a regulation needs a minor variance from the Committee of Adjustment; a change of use or zone needs a rezoning.${hit("coa")?` Past Committee of Adjustment files on this lot: <b>${R.coa.feats.map(f=>esc(f.FILE_NUMBER)).filter(Boolean).join(", ")}</b>.`:""}`});
  // 2. Niagara Escarpment
  if(err("necDC")&&err("necArea"))items.push({s:"check",t:"Niagara Escarpment Plan",d:`The provincial NEC service did not answer. Check the address in the ${L(NEC_VIEWER,"NEC map viewer")}.`});
  else if(hit("necDC")){
    const des=first("necDes","DESIGNATION");
    items.push({s:"flag",t:"Niagara Escarpment · Area of Development Control",
      d:`All or part of this lot is in the Area of Development Control (${L(LAW_LINKS.reg826,"R.R.O. 1990, Reg. 826")}) under the ${L(LAW_LINKS.nepda,"Niagara Escarpment Planning and Development Act")}. Most development, including new buildings and additions, needs a Development Permit from the Niagara Escarpment Commission before a building permit, unless exempt under ${L(LAW_LINKS.reg828,"O. Reg. 828/90")}.${des?` Plan designation: <b>${esc(des)}</b>.`:""}${hit("necMUC")?" Within a Minor Urban Centre.":""}${hit("necPark")?" Includes Niagara Escarpment parks and open space land.":""} Confirm in the ${L(NEC_VIEWER,"NEC map viewer")}.`});
  } else if(hit("necArea")||hit("necDes")){
    const des=first("necDes","DESIGNATION");
    items.push({s:"applies",t:"Niagara Escarpment Plan area (outside development control)",
      d:`The lot is inside the ${L(LAW_LINKS.nep,"Niagara Escarpment Plan")} area${des?` (<b>${esc(des)}</b>)`:""} but outside the Area of Development Control. No NEC permit is needed; municipal plans and zoning must conform to the Plan. Confirm in the ${L(NEC_VIEWER,"NEC map viewer")}.`});
  } else items.push({s:"clear",t:"Niagara Escarpment",d:`Not in the Niagara Escarpment Plan area or the Area of Development Control${R.necDC&&R.necDC.pointOnly?" (tested at the lot centre only)":""}. Source: ${L(NEC_VIEWER,"NEC map")}.`});
  // 3. Conservation authority
  if(err("ca"))items.push({s:"check",t:"Conservation authority regulation",d:`The City layer did not answer. Check the property on the conservation authority's map: ${caLinksFor(null)}.`});
  else if(hit("ca")){const a=first("ca","AUTHORITY");items.push({s:"flag",t:`Conservation authority regulated area${a?" · "+esc(a):""}`,
    d:`Development, site grading and filling here need a permit from ${a?esc(a):"the conservation authority"} under the ${L(LAW_LINKS.caa,"Conservation Authorities Act")} and ${L(LAW_LINKS.reg41,"O. Reg. 41/24")}. Expect setbacks from slopes, watercourses or wetlands beyond the zoning limits. Confirm the limits on the ${caLinksFor(a)}.`})}
  else items.push({s:"clear",t:"Conservation authority regulated area",d:`Not within a regulated area on the City's map. The authorities' own maps are the official source: ${caLinksFor(null)}.`});
  // 4. Heritage
  if(err("heritage"))items.push({s:"check",t:"Heritage",d:`The City heritage layer did not answer. Check the property on the ${viewerLink("heritage")} or the ${viewerLink("register")}.`});
  else if(hit("heritage")){const h=R.heritage.feats[0];const p4=String(h.PART_IV||"").trim(),p5=String(h.PART_V||"").trim();
    const parts=[];if(p4&&!/^(n|no|0)$/i.test(p4))parts.push("designated under Part IV");if(p5&&!/^(n|no|0)$/i.test(p5))parts.push(`in a Heritage Conservation District${h.HCD_NAME?" ("+esc(h.HCD_NAME)+")":""} under Part V`);
    items.push({s:"flag",t:`Heritage · ${esc(h.HERITAGE_STATUS||"on the heritage register")}`,
      d:`This property is ${parts.length?parts.join(" and "):"on the City's heritage inventory or register"} under the ${L(LAW_LINKS.oha,"Ontario Heritage Act")}. Designated properties need a heritage permit for alterations; listed properties need 60 days' notice to the City before demolition.${h.BYLAW_NO?` By-law ${esc(h.BYLAW_NO)}.`:""}${h.BYLAW_PDF?` ${L(esc(h.BYLAW_PDF),"Designation by-law")}.`:""} Confirm on the ${viewerLink("heritage")}.`})}
  else items.push({s:hit("ehn")?"applies":"clear",t:"Heritage",d:hit("ehn")?`No individual heritage record, but the lot is in the <b>${esc(first("ehn","NH_NAME"))}</b> Established Historical Neighbourhood, where the City may look at compatibility with existing character. See the ${viewerLink("heritageAll")}.`:`No heritage record on this lot. Source: ${viewerLink("heritage")}.`});
  // 5. Greenbelt
  if(hit("greenbelt"))items.push({s:"flag",t:`Greenbelt Plan · ${esc(first("greenbelt","DESIGNATION")||"designated")}`,d:`Land use is limited by the Greenbelt Plan under the ${L(LAW_LINKS.greenbelt,"Greenbelt Act, 2005")}.`});
  else if(!err("greenbelt"))items.push({s:"clear",t:"Greenbelt Plan",d:"Outside the Greenbelt designations."});
  // 6. Interim control
  if(hit("icbl"))items.push({s:"flag",t:`Interim control by-law ${esc(first("icbl","BY_LAW_NUMBER")||"")}`,d:`An interim control by-law (Planning Act, s. 38) covers this lot${first("icbl","FILE_NAME")?" ("+esc(first("icbl","FILE_NAME"))+")":""}. It can temporarily prohibit uses or development that the zone would otherwise allow.`});
  // 7. Secondary plan
  if(hit("secPlan")){const n=first("secPlan","SEC_PLAN_NAME"),u=first("secPlan","LINK_PDF_MAP");items.push({s:"applies",t:`Secondary plan · ${esc(n||"")}`,d:`Official Plan secondary plan policies apply (land use, density, built form).${u?" "+L(esc(u),"Plan map"):""}`})}
  // 8. Source water
  if(hit("ipz")||hit("whpa"))items.push({s:"flag",t:"Source water protection area",d:`The lot is in a ${hit("whpa")?"wellhead protection area":"intake protection zone"} under the ${L(LAW_LINKS.cwa,"Clean Water Act, 2006")}. Some activities, such as fuel or chemical storage and septic systems, may be restricted.`});
  // 9. Airport noise
  if(hit("noise")){const f=R.noise.feats[0];items.push({s:"applies",t:"Airport noise area",d:`Inside the 2010 airport noise contours${f.MIN_DECIBEL!=null?` (${f.MIN_DECIBEL}–${f.MAX_DECIBEL} NEF)`:""}. Noise studies or warning clauses may be needed for new homes.`})}
  // 10. Planning Act extras for residential zones
  if(z&&/^R/.test(S.zone.key))items.push({s:"applies",t:"Additional residential units",d:`Under the ${L(LAW_LINKS.planning,"Planning Act")}, up to three residential units are permitted on a lot with a single, semi-detached or townhouse dwelling in a serviced urban area, subject to the zoning by-law's other rules.`});
  const NAMES={greenbelt:"Greenbelt",secPlan:"secondary plans",noise:"airport noise",ehn:"historical neighbourhoods",icbl:"interim control by-laws",ipz:"intake protection zones",whpa:"wellhead protection areas",coa:"Committee of Adjustment files",necMUC:"NEC minor urban centres",necPark:"NEC parks"};
  const failed=Object.keys(NAMES).filter(k=>R[k]&&R[k].error);
  if(failed.length)items.push({s:"check",t:"Some layers did not answer",d:`Could not check: ${failed.map(k=>NAMES[k]).join(", ")}. Try the lookup again later or confirm with City planning staff.`});
  items.push({s:"applies",t:"Building permit",d:`New buildings, additions and most structural work need a building permit under the ${L(LAW_LINKS.bca,"Building Code Act, 1992")} and the Ontario Building Code. Zoning and any NEC, conservation or heritage permits above must be in place first.`});
  return items;
}
function renderLaw(){
  const ul=$("law"),ban=$("lawBanner");
  if(S.example){setBadge("law",0);ul.innerHTML=`<li><span class="pill info law">INFO</span><span class="lt">Search an address</span><span class="ld">The review checks the real lot against the Niagara Escarpment Commission map and the City's heritage, conservation and policy layers.</span></li>`;ban.hidden=true;return}
  if(!S.law||S.law.state==="busy"){setBadge("law",0);ul.innerHTML=`<li><span class="pill info law">…</span><span class="lt">Checking provincial and City layers</span><span class="ld">Niagara Escarpment, conservation authority, heritage, Greenbelt, interim control, secondary plans, source water and airport noise.</span></li>`;ban.hidden=true;return}
  const items=lawItems();setBadge("law",items.filter(i=>i.s==="flag").length);
  const P={flag:["flag","PERMIT"],applies:["info","APPLIES"],clear:["ok","CLEAR"],check:["bad","CHECK"]};
  ul.innerHTML=items.map(i=>`<li><span class="pill ${P[i.s][0]} law">${P[i.s][1]}</span><span class="lt">${i.t}</span><span class="ld">${i.d}</span></li>`).join("");
  const R=S.law.res;const dc=R.necDC&&!R.necDC.error&&R.necDC.feats.length;
  ban.hidden=!dc;
  if(dc)ban.innerHTML=`<b>Niagara Escarpment development control.</b> The zoning envelope below is only part of the picture. An NEC Development Permit decides what can be built here.`;
}
