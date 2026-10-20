"use strict";
/* ---------------- Geometry helpers ---------------- */
const R_LAT=110540;
function toLocal(lon,lat,o){return {x:(lon-o.lon)*Math.cos(o.lat*Math.PI/180)*111320, y:(lat-o.lat)*R_LAT}}
function toLL(p,o){return [o.lat+p.y/R_LAT, o.lon+p.x/(Math.cos(o.lat*Math.PI/180)*111320)]}
function area(pts){let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p.x*q.y-q.x*p.y}return a/2}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function segDist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy;let t=L?((p.x-a.x)*dx+(p.y-a.y)*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function polylineLen(pl){let s=0;for(let i=1;i<pl.length;i++)s+=dist(pl[i-1],pl[i]);return s}
function polylineMid(pl){const L=polylineLen(pl)/2;let s=0;for(let i=1;i<pl.length;i++){const d=dist(pl[i-1],pl[i]);if(s+d>=L){const t=(L-s)/(d||1);return {x:pl[i-1].x+t*(pl[i].x-pl[i-1].x),y:pl[i-1].y+t*(pl[i].y-pl[i-1].y)}}s+=d}return pl[pl.length-1]}
function inRings(p,rings){let ins=false;for(const r of rings){for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))ins=!ins}}return ins}
function dedupe(pts){const out=[];for(const p of pts){if(!out.length||dist(out[out.length-1],p)>0.05)out.push(p)}if(out.length>2&&dist(out[0],out[out.length-1])<0.05)out.pop();return out}

/* Group the parcel ring into lot lines: consecutive segments that keep roughly the same bearing. */
function buildEdges(pts){
  const n=pts.length; const segs=[];
  for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];segs.push({a,b,ang:Math.atan2(b.y-a.y,b.x-a.x),len:dist(a,b)})}
  // start at the sharpest corner so a straight edge is never split across the ring seam
  let start=0,best=-1;
  for(let i=0;i<n;i++){const p=segs[(i-1+n)%n],c=segs[i];let d=Math.abs(c.ang-p.ang);if(d>Math.PI)d=2*Math.PI-d;if(d>best){best=d;start=i}}
  const edges=[];let cur=null;
  for(let k=0;k<n;k++){const s=segs[(start+k)%n];
    if(cur){let d=Math.abs(s.ang-cur.ang0);if(d>Math.PI)d=2*Math.PI-d;
      const dPrev=Math.abs(s.ang-cur.angLast)>Math.PI?2*Math.PI-Math.abs(s.ang-cur.angLast):Math.abs(s.ang-cur.angLast);
      if(d<0.21&&dPrev<0.21||s.len<0.4){cur.pts.push(s.b);cur.angLast=s.ang;continue}}
    cur={pts:[s.a,s.b],ang0:s.ang,angLast:s.ang};edges.push(cur)}
  return edges.map((e,i)=>{const a=e.pts[0],b=e.pts[e.pts.length-1];const L=dist(a,b)||1;
    const u={x:(b.x-a.x)/L,y:(b.y-a.y)/L};return {id:i,pts:e.pts,a,b,u,n:{x:-u.y,y:u.x},len:polylineLen(e.pts),mid:polylineMid(e.pts),type:"side"}});
}

/* ---------------- Clipper wrappers ---------------- */
const SC=1000;
const toPath=pts=>pts.map(p=>({X:Math.round(p.x*SC),Y:Math.round(p.y*SC)}));
const fromPath=pa=>pa.map(p=>({x:p.X/SC,y:p.Y/SC}));
function bufferLine(pl,d){const co=new ClipperLib.ClipperOffset(2,0.02*SC);co.AddPath(toPath(pl),ClipperLib.JoinType.jtRound,ClipperLib.EndType.etOpenRound);const sol=new ClipperLib.Paths();co.Execute(sol,d*SC);return sol}
function clip(subj,clp,type){const c=new ClipperLib.Clipper();c.AddPaths(subj,ClipperLib.PolyType.ptSubject,true);if(clp.length)c.AddPaths(clp,ClipperLib.PolyType.ptClip,true);const sol=new ClipperLib.Paths();c.Execute(type,sol,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);return sol}
const pathsArea=ps=>ps.reduce((s,p)=>s+ClipperLib.Clipper.Area(p),0)/(SC*SC);
