"use strict";
/* ---------------- 3D (three.js) ---------------- */
let renderer,scene,camera,controls,site,needs=true,sceneSpan=40,sceneCenter=new THREE.Vector3();
function init3d(){
  const host=$("v3d");
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(40,1,0.5,5000);
  controls=new THREE.OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.maxPolarAngle=Math.PI*0.495;
  controls.addEventListener("change",()=>needs=true);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8899aa,0.75));
  const sun=new THREE.DirectionalLight(0xffffff,0.75);sun.position.set(-40,80,30);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);scene.add(sun);scene.userData.sun=sun;
  site=new THREE.Group();scene.add(site);
  new ResizeObserver(resize3d).observe(host);resize3d();
  (function loop(){requestAnimationFrame(loop);controls.update();if(needs){renderer.render(scene,camera);needs=false}})();
}
function resize3d(){const host=$("v3d");const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();needs=true}
const V=(p,y=0)=>new THREE.Vector3(p.x,y,-p.y);
function shapeFrom(rings){ // rings: arrays of {x,y}; outer CCW / holes CW by area sign
  const outers=rings.filter(r=>area(r)>0),holes=rings.filter(r=>area(r)<0);
  return outers.map(o=>{const s=new THREE.Shape(o.map(p=>new THREE.Vector2(p.x,p.y)));
    holes.filter(hh=>inRings(hh[0],[o])).forEach(hh=>s.holes.push(new THREE.Path(hh.map(p=>new THREE.Vector2(p.x,p.y)))));return s});
}
function flat(rings,color,y,opacity=1){
  const g=new THREE.ShapeGeometry(shapeFrom(rings));g.rotateX(-Math.PI/2);
  const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color,transparent:opacity<1,opacity,side:THREE.DoubleSide,depthWrite:opacity>=1}));
  m.position.y=y;m.receiveShadow=true;return m;
}
function outline(pts,color,y,closed=true,opacity=1){
  const arr=pts.map(p=>V(p,y));if(closed)arr.push(V(pts[0],y));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));
}
function label(text,color,size){
  const c=document.createElement("canvas");const ctx=c.getContext("2d");const fs=46,font=`600 ${fs}px "Inter Tight", Arial, sans-serif`;
  ctx.font=font;const w=Math.ceil(ctx.measureText(text).width)+44;
  c.width=w;c.height=fs+30;ctx.font=font;
  const r=c.height/2;ctx.fillStyle="rgba(250,247,242,0.94)";ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(1,1,c.width-2,c.height-2,r);else ctx.rect(1,1,c.width-2,c.height-2);
  ctx.fill();ctx.strokeStyle="rgba(0,0,0,0.08)";ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=color;ctx.textBaseline="middle";ctx.textAlign="center";ctx.fillText(text,c.width/2,c.height/2+2);
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false}));s.scale.set(size*c.width/c.height,size,1);s.renderOrder=10;return s;
}
function render3d(G,fit){
  const css=getComputedStyle(document.documentElement);const col=n=>new THREE.Color(css.getPropertyValue(n).trim()||"#888");
  scene.background=col("--ground");
  while(site.children.length){const o=site.children.pop();o.traverse(x=>{x.geometry&&x.geometry.dispose();if(x.material){x.material.map&&x.material.map.dispose();x.material.dispose()}})}
  const xs=S.ring.map(p=>p.x),ys=S.ring.map(p=>p.y);
  const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const span=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),15);
  // ground
  const gs=span*8;const ground=new THREE.Mesh(new THREE.PlaneGeometry(gs,gs),new THREE.MeshLambertMaterial({color:col("--ground")}));
  ground.rotation.x=-Math.PI/2;ground.position.set(cx,-0.02,-cy);ground.receiveShadow=true;site.add(ground);
  // streets
  S.streets.forEach(s=>{const p=Array.isArray(s)?s:s.pts;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];const L=dist(a,b);if(L<0.1)continue;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(L+8,8),new THREE.MeshLambertMaterial({color:col("--ink-2"),transparent:true,opacity:0.25,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);m.position.set((a.x+b.x)/2,-0.01,-(a.y+b.y)/2);site.add(m)}});
  S.context.forEach(r=>site.add(outline(r,col("--ink-2"),0.02,true,0.45)));
  // lot, setbacks, envelope footprint
  site.add(flat([S.ring],col("--lot"),0.0));
  const sb=G.setbackArea.map(fromPath);if(sb.length)site.add(flat(sb,col("--setback"),0.03,0.55));
  site.add(outline(S.ring,col("--ink"),0.06));
  const H=S.regs.height||10.5;
  if(G.envRings.length){
    const shapes=shapeFrom(G.envRings);
    const eg=new THREE.ExtrudeGeometry(shapes,{depth:H,bevelEnabled:false});eg.rotateX(-Math.PI/2);
    const env=new THREE.Mesh(eg,new THREE.MeshLambertMaterial({color:col("--zone"),transparent:true,opacity:0.10,depthWrite:false,side:THREE.DoubleSide}));
    site.add(env);
    site.add(new THREE.LineSegments(new THREE.EdgesGeometry(eg,25),new THREE.LineBasicMaterial({color:col("--zone")})));
    const top=G.envRings[0];const tp=top.reduce((a,p)=>({x:a.x+p.x/top.length,y:a.y+p.y/top.length}),{x:0,y:0});
    const hl=label(`max height ${fmt(H,1)} m`,"#7A5A1E",Math.max(1.1,span/28));hl.position.copy(V(tp,H+span/30));site.add(hl);
  }
  // setback labels
  S.edges.forEach(e=>{if(e.len<2||!e.setback)return;const p={x:e.mid.x+e.n.x*e.setback/2,y:e.mid.y+e.n.y*e.setback/2};
    const l=label(`${TYPE_LABEL[e.type]} ${fmt(e.setback,1)} m`,"#9A4A2B",Math.max(0.9,span/34));l.position.copy(V(p,0.9));site.add(l)});
  // existing buildings (City footprint, heights assumed or entered)
  S.buildings.forEach(b=>addExisting(b,col,1,span));
  // sun & camera
  const sun=scene.userData.sun;sun.position.set(cx-span*1.2,span*2.2,-cy+span*0.9);sun.target.position.set(cx,0,-cy);scene.add(sun.target);
  const sc=sun.shadow.camera;sc.left=-span*1.5;sc.right=span*1.5;sc.top=span*1.5;sc.bottom=-span*1.5;sc.far=span*8;sc.updateProjectionMatrix();
  sceneSpan=span;sceneCenter.set(cx,0,-cy);
  if(fit)setCam("iso");
  needs=true;
}
/* Roof surface over an arbitrary footprint. Height at a point = eave + slope × distance to the nearest wall,
   with the slope chosen so the farthest point from every wall reaches the ridge height. The planes meet in
   hips, valleys and ridges along the footprint's medial axis, the way a hip roof sits on an L- or T-shaped plan.
   Built on a fine grid clipped to the footprint so the triangles share vertices and the surface has no gaps. */
function footprintRoof(rings,eave,ridge){
  const segs=[];rings.forEach(r=>{for(let i=0;i<r.length;i++)segs.push([r[i],r[(i+1)%r.length]])});
  if(!segs.length)return null;
  const dWall=p=>{let d=Infinity;for(const [a,b] of segs)d=Math.min(d,segDist(p,a,b));return d};
  const pts=rings.flat();const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const ar=Math.abs(rings.reduce((s,r)=>s+area(r),0));
  const c=Math.max(0.25,Math.sqrt(ar/3500));            // ~3,500 cells whatever the building size
  const nx=Math.ceil((x1-x0)/c),ny=Math.ceil((y1-y0)/c);
  // farthest distance from the walls (inradius) sets the slope
  let dMax=0;for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){const p={x:x0+i*c,y:y0+j*c};if(inRings(p,rings))dMax=Math.max(dMax,dWall(p))}
  if(dMax<0.05)return null;
  const k=(ridge-eave)/dMax;
  const hAt=p=>eave+Math.min(dWall(p),dMax)*k;
  const pos=[];const cache=new Map();
  const vert=p=>{const key=Math.round(p.x*1000)+","+Math.round(p.y*1000);let h=cache.get(key);if(h===undefined){h=hAt(p);cache.set(key,h)}return [p.x,h,-p.y]};
  const tri=(a,b,d)=>pos.push(...vert(a),...vert(b),...vert(d));
  const polyPath=rings.map(toPath);
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
    const a={x:x0+i*c,y:y0+j*c},b={x:a.x+c,y:a.y},d={x:a.x+c,y:a.y+c},e={x:a.x,y:a.y+c};
    const mid={x:a.x+c/2,y:a.y+c/2};
    if(dWall(mid)>c*0.75){ // clear of the walls: the whole cell is in or out
      if(inRings(mid,rings)){tri(a,b,d);tri(a,d,e)}
      continue;
    }
    // cell straddles a wall: keep only the part inside the footprint
    const piece=clip([toPath([a,b,d,e])],polyPath,ClipperLib.ClipType.ctIntersection);
    piece.forEach(pp=>{const poly=fromPath(pp);if(poly.length<3||Math.abs(area(poly))<1e-6)return;
      const ccw=area(poly)>0?poly:poly.slice().reverse();
      THREE.ShapeUtils.triangulateShape(ccw.map(p=>new THREE.Vector2(p.x,p.y)),[]).forEach(t=>tri(ccw[t[0]],ccw[t[1]],ccw[t[2]]));
    });
  }
  // the roof surface must face up: grid cells are counter-clockwise in plan, which faces up after the y→-z flip
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  return g;
}
function addExisting(b,col,op,span){
  const tr=op<1;const wallMat=new THREE.MeshLambertMaterial({color:col("--exist"),transparent:tr,opacity:op,depthWrite:!tr});
  const roofMat=new THREE.MeshLambertMaterial({color:col("--exist-roof"),transparent:tr,opacity:op,side:THREE.DoubleSide,depthWrite:!tr,flatShading:true});
  const flatRoof=b.ridge-b.eave<0.4;
  const g=new THREE.ExtrudeGeometry(shapeFrom(b.rings),{depth:flatRoof?b.ridge:b.eave,bevelEnabled:false});g.rotateX(-Math.PI/2);
  const m=new THREE.Mesh(g,wallMat);m.castShadow=!tr;m.receiveShadow=true;site.add(m);
  site.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,30),new THREE.LineBasicMaterial({color:col("--exist-roof")})));
  if(!flatRoof){ // hip roof that follows the footprint: every wall gets a roof plane sloping up from its eave
    const rg=footprintRoof(b.rings,b.eave,b.ridge);
    if(rg){const rm=new THREE.Mesh(rg,roofMat);rm.castShadow=!tr;site.add(rm);
      site.add(new THREE.LineSegments(new THREE.EdgesGeometry(rg,18),new THREE.LineBasicMaterial({color:col("--ink"),transparent:true,opacity:0.55})));}
  }
  if(b===S.buildings[0]&&op===1){const c=centroid(b.rings[0]);const l=label(`existing · ${fmt(b.ridge,1)} m${b.src==="assumed"?" (assumed)":""}`,"#2A3A2E",Math.max(0.9,span/32));l.position.copy(V(c,b.ridge+span/22));site.add(l)}
}
function setCam(kind){
  const s=sceneSpan,c=sceneCenter;const F=S.frontEdge;const n=F?F.n:{x:0,y:1};
  // view from the street: camera sits outside the front lot line, looking into the lot
  const out=new THREE.Vector3(-n.x,0,n.y);
  if(kind==="top"){camera.position.set(c.x+0.01,s*2.4,c.z+0.01)}
  else if(kind==="street"){camera.position.copy(c).addScaledVector(out,s*1.15).add(new THREE.Vector3(0,3.5,0));controls.target.set(c.x,4,c.z)}
  else {const side=new THREE.Vector3(out.z,0,-out.x);camera.position.copy(c).addScaledVector(out,s*1.1).addScaledVector(side,s*0.8).add(new THREE.Vector3(0,s*0.95,0))}
  if(kind!=="street")controls.target.copy(c).add(new THREE.Vector3(0,2,0));
  controls.update();needs=true;
}
document.querySelectorAll("[data-cam]").forEach(b=>b.addEventListener("click",()=>setCam(b.dataset.cam)));
