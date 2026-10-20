"use strict";
/* ---------------- Plan view (SVG) ---------------- */
const TYPE_ORDER=["front","side","flank","rear"];
const TYPE_LABEL={front:"Front",side:"Side",flank:"Flank",rear:"Rear"};
function renderPlan(G){
  const svg=$("plan");const pts=S.ring;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const span=Math.max(maxx-minx,maxy-miny);const pad=span*0.22+4;
  const vb=[minx-pad,-(maxy+pad),maxx-minx+2*pad,maxy-miny+2*pad];
  svg.setAttribute("viewBox",vb.join(" "));svg.setAttribute("preserveAspectRatio","xMidYMid meet");
  const k=span/100; // stroke/text scale
  const P=p=>`${p.x.toFixed(2)},${(-p.y).toFixed(2)}`;
  const pathD=rings=>rings.map(r=>"M"+r.map(P).join("L")+"Z").join("");
  let h=`<defs><pattern id="hatch" width="${1.2*k*3}" height="${1.2*k*3}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${1.2*k*3}" stroke="var(--setback)" stroke-width="${0.45*k}"/></pattern></defs>`;
  S.context.forEach(r=>{h+=`<path d="${pathD([r])}" fill="none" stroke="var(--rule)" stroke-width="${0.35*k}"/>`});
  S.streets.forEach(s=>{const p=Array.isArray(s)?s:s.pts;h+=`<polyline points="${p.map(P).join(" ")}" fill="none" stroke="var(--ink-2)" stroke-opacity=".35" stroke-width="${Math.max(6,k*5)}" stroke-linecap="round"/>`});
  h+=`<path d="${pathD([pts])}" fill="var(--lot)" stroke="none"/>`;
  h+=`<path d="${pathD(G.setbackArea.map(fromPath))}" fill="url(#hatch)" fill-rule="evenodd" fill-opacity=".9"/>`;
  h+=`<path d="${pathD(G.envRings)}" fill="var(--zone)" fill-opacity=".28" stroke="var(--zone)" stroke-width="${0.5*k}" stroke-dasharray="${1.5*k} ${k}" fill-rule="evenodd"/>`;
  S.buildings.forEach(b=>{h+=`<path d="${pathD(b.rings)}" fill="var(--exist)" fill-opacity="0.85" stroke="var(--exist-roof)" stroke-width="${0.45*k}" fill-rule="evenodd"/>`;
    const c=centroid(b.rings[0]);h+=`<text x="${c.x}" y="${-c.y}" font-size="${3.8*k}" text-anchor="middle" dominant-baseline="middle" fill="var(--ink)" font-weight="600">${fmt(b.area)} m²</text>`});
  if(G.house&&S.show!=="exist"){const H=G.house;const u=H.u;
    h+=`<path d="M${P(H.FL)}L${P(H.FR)}L${P(H.BR)}L${P(H.BL)}Z" fill="var(--bldg)" stroke="var(--ink)" stroke-width="${0.5*k}"/>`;
    for(let i=1;i<G.units;i++){const t=i/G.units;const a={x:H.FL.x+(H.FR.x-H.FL.x)*t,y:H.FL.y+(H.FR.y-H.FL.y)*t},b={x:H.BL.x+(H.BR.x-H.BL.x)*t,y:H.BL.y+(H.BR.y-H.BL.y)*t};h+=`<line x1="${a.x}" y1="${-a.y}" x2="${b.x}" y2="${-b.y}" stroke="var(--ink)" stroke-width="${0.3*k}"/>`}
    if(S.roof==="gable"){const m1={x:(H.FL.x+H.BL.x)/2,y:(H.FL.y+H.BL.y)/2},m2={x:(H.FR.x+H.BR.x)/2,y:(H.FR.y+H.BR.y)/2};h+=`<line x1="${m1.x}" y1="${-m1.y}" x2="${m2.x}" y2="${-m2.y}" stroke="var(--ink-2)" stroke-width="${0.3*k}" stroke-dasharray="${k} ${k}"/>`}
    const c={x:(H.FL.x+H.BR.x)/2,y:(H.FL.y+H.BR.y)/2};
    h+=`<text x="${c.x}" y="${-c.y}" font-size="${4.6*k}" text-anchor="middle" dominant-baseline="middle" fill="var(--ink)">${fmt(H.w,1)} × ${fmt(H.d,1)} m</text>`;
  }
  const col={front:"var(--accent)",side:"var(--ink-2)",flank:"var(--warn)",rear:"var(--ink)"};
  S.edges.forEach(e=>{
    const m=e.mid, lab={x:m.x+e.n.x*(e.setback/2+2.6*k),y:m.y+e.n.y*(e.setback/2+2.6*k)};
    const out={x:m.x-e.n.x*3.4*k,y:m.y-e.n.y*3.4*k};
    let ang=-Math.atan2(e.u.y,e.u.x)*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180; // letter along the line, never upside down
    const rot=q=>`transform="rotate(${ang.toFixed(1)} ${q.x.toFixed(2)} ${(-q.y).toFixed(2)})"`;
    h+=`<g class="edge" data-id="${e.id}" tabindex="0" role="button" aria-label="${TYPE_LABEL[e.type]} lot line, ${fmt(e.len,1)} metres. Click to change.">
      <polyline points="${e.pts.map(P).join(" ")}" fill="none" stroke="transparent" stroke-width="${4*k}"/>
      <polyline points="${e.pts.map(P).join(" ")}" fill="none" stroke="${col[e.type]}" stroke-width="${(e.type==="front"?1.1:0.7)*k}"/>
      ${e.len>2?`<text x="${lab.x}" y="${-lab.y}" ${rot(lab)} font-size="${4.2*k}" text-anchor="middle" dominant-baseline="middle" fill="${col[e.type]}" font-weight="600">${TYPE_LABEL[e.type]} ${fmt(e.setback,1)}</text>
      <text x="${out.x}" y="${-out.y}" ${rot(out)} font-size="${3.6*k}" text-anchor="middle" dominant-baseline="middle" fill="var(--ink-2)">${fmt(e.len,1)} m</text>`:""}</g>`;
  });
  // north arrow + scale
  const na={x:maxx+pad*0.55,y:maxy+pad*0.3};
  h+=`<g transform="translate(${na.x},${-na.y})"><path d="M0,${-4*k} L${1.6*k},${2*k} L0,${1*k} L${-1.6*k},${2*k}Z" fill="var(--ink)"/><text y="${6.5*k}" font-size="${3.8*k}" text-anchor="middle" fill="var(--ink)">N</text></g>`;
  const sl=span>60?20:span>25?10:5;const sp={x:minx-pad*0.7,y:miny-pad*0.6};
  h+=`<g><line x1="${sp.x}" y1="${-sp.y}" x2="${sp.x+sl}" y2="${-sp.y}" stroke="var(--ink)" stroke-width="${0.6*k}"/><text x="${sp.x+sl/2}" y="${-sp.y-1.5*k}" font-size="${3.6*k}" text-anchor="middle" fill="var(--ink)">${sl} m</text></g>`;
  svg.innerHTML=h;
  svg.querySelectorAll(".edge").forEach(g=>{const cyc=()=>{const e=S.edges[+g.dataset.id];e.type=TYPE_ORDER[(TYPE_ORDER.indexOf(e.type)+1)%4];if(e.type==="front")S.frontEdge=e;else if(S.frontEdge===e)S.frontEdge=S.edges.find(x=>x.type==="front")||S.frontEdge;renderAll(false)};
    g.addEventListener("click",cyc);g.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();cyc()}})});
}
