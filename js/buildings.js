"use strict";
/* ---------------- Existing buildings ---------------- */
function centroid(r){let a=0,x=0,y=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];const c=p.x*q.y-q.x*p.y;a+=c;x+=(p.x+q.x)*c;y+=(p.y+q.y)*c}if(Math.abs(a)<1e-9)return r[0];return {x:x/(3*a),y:y/(3*a)}}
function makeBuilding(ring,name){
  const fullArea=Math.abs(area(ring));
  const cl=clip([toPath(ring)],[toPath(S.ring)],ClipperLib.ClipType.ctIntersection);
  const rings=cl.map(fromPath).filter(r=>area(r)>0.5);
  const small=fullArea<45; // likely a garage or shed
  return {ring,name,fullArea,rings:rings.length?rings:[ring],area:pathsArea(cl),
    eave:small?2.7:5.8, ridge:small?4.0:8.5, pitch:null, src:"assumed", accessory:small};
}
function groundAt(p){
  if(!S.contours.length)return null;
  const best={};
  for(const c of S.contours){let d=Infinity;for(let i=1;i<c.pts.length;i++)d=Math.min(d,segDist(p,c.pts[i-1],c.pts[i]));if(c.h!=null&&(!(c.h in best)||d<best[c.h]))best[c.h]=d}
  const list=Object.entries(best).map(([h,d])=>({h:+h,d})).sort((a,b)=>a.d-b.d);
  if(!list.length||list[0].d>60)return null;
  const a=list[0],b=list.find(x=>x.h!==a.h);
  if(!b||a.d<0.3)return {h:a.h,src:"City 2017 contours"};
  return {h:(a.h*b.d+b.h*a.d)/(a.d+b.d),src:"City 2017 contours"};
}
function convexHull(pts){const P=pts.slice().sort((a,b)=>a.x-b.x||a.y-b.y);const cr=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);const lo=[],up=[];
  for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
  for(const p of P.slice().reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
  return lo.slice(0,-1).concat(up.slice(0,-1))}
function obb(ring){ // minimum-area oriented box
  const h=convexHull(ring);let best=null;
  for(let i=0;i<h.length;i++){const a=h[i],b=h[(i+1)%h.length];const L=dist(a,b);if(L<1e-6)continue;const u={x:(b.x-a.x)/L,y:(b.y-a.y)/L},v={x:-u.y,y:u.x};
    let s0=Infinity,s1=-Infinity,t0=Infinity,t1=-Infinity;for(const p of h){const s=p.x*u.x+p.y*u.y,t=p.x*v.x+p.y*v.y;s0=Math.min(s0,s);s1=Math.max(s1,s);t0=Math.min(t0,t);t1=Math.max(t1,t)}
    const ar=(s1-s0)*(t1-t0);if(!best||ar<best.ar)best={ar,u,v,s0,s1,t0,t1}}
  let {u,v,s0,s1,t0,t1}=best;const sm=(s0+s1)/2,tm=(t0+t1)/2;let L=(s1-s0)/2,W=(t1-t0)/2;
  if(W>L){[u,v]=[v,{x:-v.x,y:-v.y}];[L,W]=[W,L]}
  return {c:{x:sm*best.u.x+tm*best.v.x,y:sm*best.u.y+tm*best.v.y},u,v,L,W};
}
function segSegDist(a,b,c,d){
  const o=(p,q,r)=>Math.sign((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));
  if(o(a,b,c)!==o(a,b,d)&&o(c,d,a)!==o(c,d,b))return 0;
  return Math.min(segDist(a,c,d),segDist(b,c,d),segDist(c,a,b),segDist(d,a,b));
}
function existingAnalysis(lotArea){
  if(!S.buildings.length)return null;
  const main=S.buildings[0],R=S.regs,out=[];
  const total=S.buildings.reduce((s,b)=>s+b.area,0);
  const req={front:R.front,side:R.side,flank:R.flank,rear:R.rear};
  const minBy={};
  S.edges.forEach(e=>{let d=Infinity;for(const r of main.rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];for(let j=1;j<e.pts.length;j++)d=Math.min(d,segSegDist(a,b,e.pts[j-1],e.pts[j]))}
    if(!(e.type in minBy)||d<minBy[e.type])minBy[e.type]=d});
  ["front","side","flank","rear"].forEach(t=>{if(t in minBy&&req[t]!=null)out.push({ok:minBy[t]>=req[t]-0.05,label:`${t==="flank"?"Flankage":t[0].toUpperCase()+t.slice(1)} yard`,val:`${M(minBy[t])} vs min ${M(req[t])}`})});
  if(R.coverage!=null)out.push({ok:total/lotArea*100<=R.coverage+0.05,label:"Lot coverage (all buildings)",val:`${fmt(total/lotArea*100,1)}% vs max ${R.coverage}%`});
  else out.push({ok:null,label:"Lot coverage (all buildings)",val:`${fmt(total/lotArea*100,1)}%`});
  if(R.height!=null)out.push({ok:main.ridge<=R.height+0.05,label:"Height (to ridge)",val:`${M(main.ridge)} vs max ${M(R.height)}`});
  return {total,checks:out,main};
}
