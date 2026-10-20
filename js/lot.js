"use strict";
/* ---------------- Lot line classification ---------------- */
function classifyEdges(){
  const E=S.edges; if(!E.length)return;
  const streets=S.streets.map(s=>Array.isArray(s)?{pts:s,attrs:{}}:s);
  const tokenRe=S.streetToken?new RegExp("\\b"+S.streetToken.replace(/[^A-Z0-9]/g,"")+"\\b"):null;
  const named=tokenRe?streets.filter(s=>tokenRe.test(Object.values(s.attrs||{}).join(" ").toUpperCase())):[];
  const dTo=(p,list)=>{let d=Infinity;for(const s of list)for(let i=1;i<s.pts.length;i++)d=Math.min(d,segDist(p,s.pts[i-1],s.pts[i]));return d};
  E.forEach(e=>{e.dStreet=dTo(e.mid,streets);e.dNamed=named.length?dTo(e.mid,named):Infinity});
  const cand=E.filter(e=>e.len>=3);
  let front=null;
  if(named.length) front=cand.slice().sort((a,b)=>a.dNamed-b.dNamed)[0];
  if(!front||front.dNamed>25) front=cand.slice().sort((a,b)=>a.dStreet-b.dStreet)[0];
  if(!front||!isFinite(front.dStreet)) front=E.slice().sort((a,b)=>b.len-a.len)[0];
  E.forEach(e=>{
    if(e===front){e.type="front";return}
    const dot=e.n.x*front.n.x+e.n.y*front.n.y;
    if(dot>0.6&&e.dStreet<front.dStreet+4){e.type="front";return} // jog in the front line
    if(dot<-0.55){e.type="rear";return}
    if(e.len>=3&&e.dStreet<16&&Math.abs(dot)<0.6){e.type="flank";return}
    e.type="side";
  });
  S.frontEdge=front;
}

/* ---------------- Regulations ---------------- */
function zoneDef(){return S.zone.key?ZONES[S.zone.key]:null}
function permittedTypes(){
  const z=zoneDef();
  if(!z||z.restricted)return ["custom"];
  return Object.keys(DTYPES).filter(k=>DTYPES[k].rules==="custom"||z.types[DTYPES[k].rules]);
}
function applyZoneDefaults(){
  const types=permittedTypes();
  if(!types.includes(S.dtype))S.dtype=types[0];
  const z=zoneDef(); const r=(z&&!z.restricted&&z.types[DTYPES[S.dtype].rules])||ASSUMED;
  const keep=S.edited;
  S.regs={ref:r.ref,front:r.front,side:r.side,flank:r.flank,rear:r.rear,height:r.height,
    coverage:r.coverage??null,landscaped:r.landscaped??null,sideAgg:r.sideAgg??null,
    lotArea:r.lotArea??null,lotAreaPerUnit:r.lotAreaPerUnit??null,lotWidth:r.lotWidth??null,lotWidthPerUnit:r.lotWidthPerUnit??null,unitWidth:r.unitWidth??null};
  for(const k in keep)S.regs[k]=keep[k];
  if(S.regs.coverage) S.cover=Math.min(S.cover,S.regs.coverage);
}

/* ---------------- Envelope + massing ---------------- */
function compute(){
  const R=S.regs; const lot=[toPath(S.ring)];
  const lotArea=Math.abs(area(S.ring));
  const sides=S.edges.filter(e=>e.type==="side");
  const sb=e=>({front:R.front,rear:R.rear,flank:R.flank,side:R.side})[e.type]||0;
  // aggregate side yard (fourplex): widen the longer side to make up the difference
  const extra={};
  if(R.sideAgg&&sides.length>=2){const need=R.sideAgg-2*R.side;if(need>0){const big=sides.slice().sort((a,b)=>b.len-a.len)[0];extra[big.id]=need}}
  S.edges.forEach(e=>{e.setback=sb(e)+(extra[e.id]||0)});
  let bufs=[];S.edges.forEach(e=>{if(e.setback>0)bufs=bufs.concat(bufferLine(e.pts,e.setback))});
  const strips=bufs.length?clip(bufs,[],ClipperLib.ClipType.ctUnion):[];
  const env=clip(lot,strips,ClipperLib.ClipType.ctDifference).filter(p=>Math.abs(ClipperLib.Clipper.Area(p))>0.5*SC*SC);
  const setbackArea=clip(lot,env,ClipperLib.ClipType.ctDifference);
  const envArea=pathsArea(env);
  const envRings=env.map(fromPath);

  const house=null,units=1,wallH=0,ridgeH=0; // new-building mockup removed: the tool reports existing conditions only
  return {lotArea,env,envRings,envArea,setbackArea,house,units,wallH,ridgeH};
}
