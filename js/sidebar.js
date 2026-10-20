"use strict";
/* ---------------- Sidebar rendering ---------------- */
function renderSidebar(G){
  const a=S.parcelAttrs||{};
  const frontLen=S.edges.filter(e=>e.type==="front").reduce((s,e)=>s+e.len,0);
  const fr=a.FRONTAGE,dp=a.DEPTH;const cityLot=cityLotSize(a);
  $("facts").innerHTML=`
    <dt>Address</dt><dd style="font-family:var(--f-body);text-align:right">${esc(S.address||a.LOCATION||"–")}</dd>
    <dt>Lot area (mapped)</dt><dd>${fmt(G.lotArea)} m² · ${fmt(G.lotArea*10.7639)} ft²</dd>
    <dt>Front lot line</dt><dd>${fmt(frontLen,1)} m · ${fmt(frontLen*3.28084,1)} ft</dd>
    ${cityLot.size?`<dt>Lot size (City record)</dt><dd>${cityLot.size}</dd>`:""}
    ${fr?`<dt>Frontage × depth (City record)</dt><dd>${cityLot.dims}</dd>`:""}
    ${a.PROPERTY_NUM?`<dt>Roll number</dt><dd>${esc(a.PROPERTY_NUM)}</dd>`:""}
    <dt>Buildable envelope</dt><dd>${fmt(G.envArea)} m² (${fmt(G.envArea/G.lotArea*100)}% of lot)</dd>`;
  const z=zoneDef(),za=S.zone.attrs||{};
  const badge=$("zbadge");badge.textContent=S.zone.code||"?";$("sumAddr").textContent=S.example?"Example lot (40 × 120 ft)":(S.address||a.LOCATION||"–");badge.classList.toggle("unknown",!z);
  let meta=`<b>${esc(z?z.name:(za.ZONING_DESC||"Zone not in this tool"))}</b>`;
  const parent=za.PARENT_BY_LAW_NUMBER;
  if(z) meta+=`By-law 05-200, Section ${z.section}${S.zone.fromCA?" (Council approved)":""}`;
  else meta+=`${parent?"Parent by-law "+esc(parent)+". ":""}Regulations below are placeholders; enter the ones from the governing by-law.`;
  $("zmeta").innerHTML=meta;
  const chips=[];
  if(za.PARENT_BY_LAW_URL)chips.push(`<a class="chip" target="_blank" rel="noopener" href="${esc(za.PARENT_BY_LAW_URL)}">By-law ${esc(parent||"")}</a>`);
  else if(z)chips.push(`<a class="chip" target="_blank" rel="noopener" href="${BYLAW_URL}">By-law 05-200</a>`);
  if(za.BY_LAW_URL&&za.BY_LAW_NUMBER)chips.push(`<a class="chip" target="_blank" rel="noopener" href="${esc(za.BY_LAW_URL)}">Amending ${esc(za.BY_LAW_NUMBER)}</a>`);
  [1,2,3].forEach(i=>{const ex=za["EXCEPTION"+i];if(ex&&String(ex).trim()){const url=za[`EXCEPTION${i}_URL`];chips.push(url?`<a class="chip flag" target="_blank" rel="noopener" href="${esc(url)}">Exception ${esc(ex)}</a>`:`<span class="chip flag">Exception ${esc(ex)}</span>`)}
    const ho=za["HOLDING"+i];if(ho&&String(ho).trim()){const url=za[`HOLDING${i}_URL`];chips.push(url?`<a class="chip flag" target="_blank" rel="noopener" href="${esc(url)}">Holding ${esc(ho)}</a>`:`<span class="chip flag">Holding ${esc(ho)}</span>`)}});
  if(S.zone.ca&&S.zone.attrs)chips.push(`<span class="chip flag">Also Council-approved zone ${esc(S.zone.ca.ZONING_CODE)}</span>`);
  if(za.TEMPORARY_USE_1)chips.push(`<span class="chip flag">Temporary use ${esc(za.TEMPORARY_USE_1)}</span>`);
  $("zchips").innerHTML=chips.join("");


  const R=S.regs;
  $("regref").textContent=R.ref&&R.ref!=="assumed"?`· s. ${R.ref}${S.dtype==="single"&&zoneDef()&&/^R/.test(S.zone.key)?" (single detached)":""}`:"· assumed";
  const rows=[
    ["front","Front yard setback","m","var(--setback)"],["side","Side yard setback","m","var(--setback)"],
    ["flank","Flankage (corner) setback","m","var(--setback)"],["rear","Rear yard setback","m","var(--setback)"],
    ["height","Maximum building height","m","var(--zone)"],["coverage","Maximum lot coverage","%",""],
    ["landscaped","Minimum landscaped area","%",""],["sideAgg","Aggregate side yards","m",""]];
  $("regs").innerHTML=rows.filter(([k])=>R[k]!=null||["front","side","flank","rear","height"].includes(k)).map(([k,l,u,c])=>
    `<tr><td>${c?`<i class="swatch" style="background:${c}"></i>`:""}${l}</td><td><input id="reg_${k}" data-k="${k}" type="number" step="0.1" min="0" value="${R[k]??""}" class="${k in S.edited?"edited":""}" aria-label="${l}"> ${u}</td></tr>`).join("");
  $("regs").querySelectorAll("input").forEach(inp=>inp.addEventListener("change",()=>{const v=inp.value===""?null:parseFloat(inp.value);S.regs[inp.dataset.k]=v;S.edited[inp.dataset.k]=v;renderAll(false)}));

  renderExisting(G);
  renderLaw();
  renderProvisions(G);
  const notes=[...(z&&z.notes||[])];
  if(z&&z.restricted)notes.unshift(`This land is zoned for conservation or hazard protection. See Section ${z.section} and consult the Conservation Authority before planning any building.`);
  if(!z)notes.unshift("This zone is not one of the 05-200 zones loaded here (or it falls under a former municipal by-law). The setbacks shown are placeholders.");
  notes.push("Setbacks are drawn as true distances from each lot line. Permitted encroachments (porches, eaves, steps) under Section 4 are not shown.");
  $("notes").innerHTML=notes.map(n=>`<p style="margin:0 0 6px">${n}</p>`).join("");
  $("exampleTag").hidden=!S.example;
}
/* Lot size as recorded on the parcel (the Site Area / Frontage / Depth fields shown in the City of Hamilton property map).
   UNIT_OF_MEASURE: F = square feet & feet, A = acres & feet, M = metric. */
function cityLotSize(a){
  const u=(a.UNIT_OF_MEASURE||"").toUpperCase(),v=a.SITE_AREA,f=a.FRONTAGE,d=a.DEPTH;
  let size="",m2=null;
  if(v!=null&&v>0){
    if(u==="F"){m2=v*0.092903;size=`${fmt(v)} ft² · ${fmt(m2)} m²`}
    else if(u==="A"){m2=v*4046.86;size=`${fmt(v,2)} ac · ${fmt(m2)} m²`}
    else if(u==="M"){if(v<100){m2=v*10000;size=`${fmt(v,3)} ha · ${fmt(m2)} m²`}else{m2=v;size=`${fmt(v)} m²`}}
    else size=fmt(v,2);
  }
  const metric=u==="M";
  const dims=f!=null?(metric?`${fmt(f,1)} × ${fmt(d,1)} m`:`${fmt(f,1)} × ${fmt(d,1)} ft · ${fmt(f*0.3048,1)} × ${fmt(d*0.3048,1)} m`):"";
  return {size,dims,m2};
}
function renderExisting(G){
  const E=existingAnalysis(G.lotArea);
  const c=S.buildings[0]?centroid(S.buildings[0].ring):centroid(S.ring);const [lat,lng]=toLL(c,S.origin);
  $("gLinks").innerHTML=`<a class="chip" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}">Open in Google Maps</a><a class="chip" target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}">Street View</a>`;
  if(!E){setBadge("building",0);$("exist").innerHTML=`<dt>Footprint</dt><dd style="font-family:var(--f-body)">None mapped on this lot</dd>`;$("existHt").innerHTML="";$("existChecks").innerHTML="";$("htNote").hidden=true;return}
  $("htNote").hidden=false;setBadge("building",E.checks.filter(c=>c.ok===false).length,true);
  const m=E.main;
  let h=S.buildings.slice(0,4).map((b,i)=>`<dt>${b.accessory?"Accessory building":"Main building"}${S.buildings.length>1?" "+(i+1):""}</dt><dd>${M2(b.area)}</dd>`).join("");
  h+=`<dt>Footprint source</dt><dd style="font-family:var(--f-body)">City Buildings layer</dd>`;
  h+=`<dt>Heights</dt><dd style="font-family:var(--f-body)">${m.src==="assumed"?"Assumed, adjust below":"Entered by you"}</dd>`;
  h+=`<dt>Total footprint</dt><dd>${M2(E.total)}</dd>`;
  h+=`<dt>Main building eave height</dt><dd>${M(m.eave)}</dd><dt>Main building ridge height</dt><dd>${M(m.ridge)}</dd>`;
  if(S.ground)h+=`<dt>Ground elevation (above sea level)</dt><dd>${fmt(S.ground.h,1)} m (${fmt(S.ground.h*3.28084,1)} ft)</dd>`;
  if(m.pitch!=null)h+=`<dt>Average roof pitch</dt><dd>${fmt(m.pitch)}° (${pitch12(m.pitch)})</dd>`;
  $("exist").innerHTML=h;
  $("existHt").innerHTML=S.buildings.slice(0,3).map((b,i)=>`<tr><td>${b.accessory?"Accessory":"Main"}${S.buildings.length>1?" "+(i+1):""} · eave / ridge</td><td><input id="ex_e${i}" data-i="${i}" data-k="eave" type="number" step="0.1" min="0" value="${b.eave.toFixed(1)}" aria-label="Eave height"> <input id="ex_r${i}" data-i="${i}" data-k="ridge" type="number" step="0.1" min="0" value="${b.ridge.toFixed(1)}" aria-label="Ridge height"> m<div class="ref">(${ftIn(b.eave)} / ${ftIn(b.ridge)})</div></td></tr>`).join("");
  $("existHt").querySelectorAll("input").forEach(inp=>inp.addEventListener("change",()=>{const b=S.buildings[+inp.dataset.i];const v=parseFloat(inp.value);if(isFinite(v)){b[inp.dataset.k]=v;if(b.ridge<b.eave)b.ridge=b.eave;b.src="entered by hand"}renderAll(false)}));
  $("existChecks").innerHTML=E.checks.map(c=>`<li><span class="pill ${c.ok===null?"info":c.ok?"ok":"bad"}">${c.ok===null?"INFO":c.ok?"OK":"NO"}</span><span>${c.label}</span><span class="num">${c.val}</span></li>`).join("")
    +(S.buildings.some(b=>b.accessory)?`<li><span class="pill info">NOTE</span><span>Accessory buildings follow Section 4 setbacks, not the yards above.</span><span></span></li>`:"");
}
