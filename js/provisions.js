"use strict";
/* ---------------- General provisions: Zoning By-law 05-200, Section 4, residential uses ---------------- */
function ringsToLines(rings,lines){let d=Infinity;for(const r of rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];for(const l of lines)for(let j=1;j<l.length;j++)d=Math.min(d,segSegDist(a,b,l[j-1],l[j]))}return d}
function ringsToEdges(rings,edges){return ringsToLines(rings,edges.map(e=>e.pts))}
function ringsToPoly(rings,poly){ // 0 when the building is inside or overlaps the polygon
  for(const r of rings)for(const p of r)if(inRings(p,poly))return 0;
  return ringsToLines(rings,poly.map(r=>r.concat([r[0]])));
}
const RURAL=k=>k==="A1"||k==="A2";
function provisions(G){
  const z=zoneDef(),key=S.zone.key||"",R=S.regs,za=S.zone.attrs||{};
  const res=/^(R1|R1A|R2|S1|A1|A2)$/.test(key);
  const law=S.law&&S.law.state==="done"?S.law.res:null;
  const main=S.buildings.find(b=>!b.accessory)||null;
  const acc=S.buildings.filter(b=>b.accessory);
  const C=[],X=[];const ok=(v)=>v; // checks and reference rules
  const byType=t=>S.edges.filter(e=>e.type===t);
  // 4.31 NEC development control
  if(law&&law.necDC&&!law.necDC.error&&law.necDC.feats.length)
    C.push({ok:false,s:"flag",ref:"4.31",t:"Niagara Escarpment development control",v:"The lot is in the NEC Development Control Area, so zoning has no effect and is for information only. The NEC Development Permit governs."});
  // 4.12 vacuum clause
  if(/^(R1|R1A|R2)$/.test(key))C.push({ok:null,s:"applies",ref:"4.12 j)",t:"Existing buildings deemed to comply",v:`In a Residential Zone, a lot and any building on it that existed when this zoning took effect are deemed to comply with the by-law.${za.FINALBINDING_DATE?` Zoning record final and binding: ${new Date(za.FINALBINDING_DATE).toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"})}.`:""} Any shortfall shown in the existing building checks may be protected by this clause; confirm the building's age.`});
  else if(/^(A1|A2|S1)$/.test(key))C.push({ok:null,s:"applies",ref:"4.12 d)",t:"Existing buildings deemed to comply",v:"In a Rural Zone, a lot and any building on it that existed when this by-law took effect are deemed to comply with setbacks, yards, lot width, lot area and height."});
  // 4.5 one dwelling per lot
  const mains=S.buildings.filter(b=>!b.accessory);
  if(mains.length>1)C.push({ok:null,s:"check",ref:"4.5",t:"One dwelling per lot",v:`${mains.length} buildings larger than 45 m² (484 ft²) are mapped on this lot. Only one single, semi, duplex, triplex or fourplex dwelling is allowed per lot; the second building may be a detached additional dwelling unit, a large garage or part of a neighbouring building. Confirm on site.`});
  else if(main)C.push({ok:true,s:"ok",ref:"4.5",t:"One dwelling per lot",v:"One principal building is mapped on the lot."});
  // 4.7 reduced yards for undersized lots
  const t1=z&&!z.restricted&&z.types&&z.types.single;
  if(t1&&t1.lotArea){
    const front=byType("front").reduce((s,e)=>s+e.len,0);const depth=front>0?G.lotArea/front:0;
    const small=G.lotArea<t1.lotArea||front<t1.lotWidth;
    if(small){const sy=Math.max(0.9,0.10*front),ry=Math.max(3.0,0.25*depth);
      C.push({ok:null,s:"applies",ref:"4.7",t:"Reduced yards for an undersized lot",v:`The lot is below the zone's minimum ${G.lotArea<t1.lotArea?`area (${M2(t1.lotArea)})`:`width (${M(t1.lotWidth)})`}. If it was legally created before the by-law, a dwelling may use reduced yards: each side or flankage yard at least ${M(sy)} (10% of lot width, not under 0.9 m (2′-11″)) and a rear yard at least ${M(ry)} (25% of lot depth, not under 3.0 m (9′-10″)).`});
    }
  }
  // 4.8 accessory buildings
  if(acc.length&&main){
    const totalAcc=acc.reduce((s,b)=>s+b.area,0);
    if(RURAL(key)){const lim=Math.min(200,0.05*G.lotArea);C.push({ok:totalAcc<=lim+0.05,s:totalAcc<=lim+0.05?"ok":"bad",ref:"4.8.1.2 b)",t:"Accessory building floor area",v:`${M2(totalAcc)} vs max ${M2(lim)} (lesser of 200 m² or 5% of lot). Footprint used as floor area.`})}
    else{const lim=Math.min(45,0.075*G.lotArea);C.push({ok:totalAcc<=lim+0.05,s:totalAcc<=lim+0.05?"ok":"bad",ref:"4.8.1.1 a)",t:"Accessory building coverage",v:`${M2(totalAcc)} combined vs max ${M2(lim)} (lesser of 45 m² or 7.5% of lot).`})}
    acc.forEach((b,i)=>{
      const nm=`Accessory building ${S.buildings.indexOf(b)+1}`;
      ["front","flank"].forEach(t=>{const E=byType(t);if(!E.length)return;const da=ringsToEdges(b.rings,E),dm=ringsToEdges(main.rings,E);
        if(da<dm-0.5)C.push({ok:false,s:"bad",ref:"4.8 b)",t:`${nm} · location`,v:`It sits in the ${t==="front"?"front":"flankage"} yard (${M(da)} from the ${t==="front"?"front":"flankage"} lot line, closer than the house at ${M(dm)}). Accessory buildings are not permitted in a front or flankage yard.`})});
      const big=b.area>=18;const reqSR=RURAL(key)?1.0:(big?1.2:1.0);
      const ds=byType("side").length?ringsToEdges(b.rings,byType("side")):Infinity,dr=byType("rear").length?ringsToEdges(b.rings,byType("rear")):Infinity;
      const dsr=Math.min(ds,dr);
      if(isFinite(dsr))C.push({ok:dsr>=reqSR-0.05,s:dsr>=reqSR-0.05?"ok":"bad",ref:RURAL(key)?"4.8.1.2 c)":(big?"4.8.1.1 d)":"4.8.1.1 c)"),t:`${nm} · side and rear setback`,v:`${M(dsr)} vs min ${M(reqSR)}${RURAL(key)?"":` (${big?"18 m² (194 ft²) or more":"under 18 m² (194 ft²)"} floor area)`}.`});
      const fl=byType("flank");if(fl.length){const req=R.flank!=null?R.flank:1.2;const df=ringsToEdges(b.rings,fl);C.push({ok:df>=req-0.05,s:df>=req-0.05?"ok":"bad",ref:"4.8.1.1",t:`${nm} · flankage setback`,v:`${M(df)} vs min ${M(req)} (same as the principal building).`})}
      const hmax=RURAL(key)?6.0:4.5;
      C.push({ok:b.src==="assumed"?null:b.ridge<=hmax+0.05,s:b.src==="assumed"?"info":(b.ridge<=hmax+0.05?"ok":"bad"),ref:RURAL(key)?"4.8.1.2 a)":"4.8 g)",t:`${nm} · height`,v:`${M(b.ridge)}${b.src==="assumed"?" (assumed; enter the measured height)":""} vs max ${M(hmax)}.`});
    });
  } else if(main)C.push({ok:null,s:"info",ref:"4.8",t:"Accessory buildings",v:"None mapped on this lot. A new one must stay out of the front and flankage yards, be at most 4.5 m (14′-9″) high, and keep combined coverage to the lesser of 45 m² (484 ft²) or 7.5% of the lot."});
  // 4.23 special setbacks measured from mapped data
  if(main){
    const resZone=/^(R1|R1A|R2)$/.test(key); // 4.23 b) applies in Residential (and Institutional) zones only
    if(resZone&&S.rail===null)C.push({ok:null,s:"check",ref:"4.23 b)",t:"Railway setback",v:"The City railway layer did not answer."});
    else if(resZone&&S.rail&&S.rail.length){const d=ringsToLines(main.rings,S.rail);if(d<45)C.push({ok:null,s:"check",ref:"4.23 b)",t:"Railway setback",v:`A railway track centreline is ${M(d)} from the house. Residential buildings must be at least ${M(30)} from a railway right-of-way, measured to the right-of-way edge, which is closer than the track. Confirm the right-of-way limit.`})}
    if(S.pzones===null)C.push({ok:null,s:"check",ref:"4.23 d)",t:"Setback from P5, P7 or P8 zone",v:"The City zoning layer did not answer."});
    else if(S.pzones&&S.pzones.length){let d=Infinity,code="";for(const pz of S.pzones){const dd=ringsToPoly(main.rings,pz.rings);if(dd<d){d=dd;code=pz.code}}
      if(isFinite(d)&&d<30)C.push({ok:d>=7.5-0.05,s:d>=7.5-0.05?"ok":"bad",ref:"4.23 d)",t:`Setback from ${esc(code)} zone`,v:`${M(d)} from the ${esc(code)} zone boundary vs min ${M(7.5)}. The boundary follows conservation authority flood and fill mapping.`})}
  }
  // 4.33 additional dwelling units
  if(/^(R1|R1A|R2)$/.test(key)){
    const room=0.45*G.lotArea-(main?S.buildings.reduce((s,b)=>s+b.area,0):0);
    C.push({ok:null,s:"applies",ref:"4.33",t:"Additional dwelling units",v:`A single detached dwelling may contain up to two additional units, plus one detached additional unit (garden suite), to a maximum of four units on the lot. A detached unit goes in the rear or interior side yard, at least ${M(1.2)} from side and rear lot lines and ${M(4.0)} from the house, at most ${M(6.0)} high and ${M2(75)} in floor area. Lot coverage of all buildings is then capped at 45%: ${room>0?`about ${M2(room)} of coverage remains`:"existing coverage already exceeds this"}.`});
  } else if(/^(A1|A2|S1)$/.test(key)){
    const ha=G.lotArea/10000;
    C.push({ok:null,s:"applies",ref:"4.33.3–4.33.4",t:"Additional dwelling units",v:`One additional unit is allowed only on lots over 0.6 ha (1.48 ac): this lot is ${fmt(ha,2)} ha (${fmt(ha*2.47105,2)} ac), so it ${ha>0.6?"qualifies":"does not qualify"}. A detached additional unit needs at least 1.5 ha (3.71 ac): ${ha>=1.5?"qualifies":"does not qualify"}. Not permitted on lands in Special Figures 24.1 to 24.5. Septic and well must meet Section 4.22.`});
  }
  // reference rules (not measurable from map data)
  X.push({ref:"4.6",t:"Permitted yard encroachments",v:`Into a required yard: sills, eaves, chimney breasts and similar ${M(0.6)}; porch, deck or canopy ${M(1.5)}; fire escape or exterior stair (side or rear yard) ${M(1.5)}; balcony ${M(1.0)} (side yard: one-third of the yard width or 1.0 m, whichever is less); bay window without foundation ${M(0.6)}, max ${M(3.0)} wide; each limited to half the required yard. Recladding an existing building ${M(0.15)}; wall-mounted EV charger ${M(0.3)}; wheelchair ramps unlimited.`});
  X.push({ref:"4.8",t:"Accessory buildings, general",v:`Not to be used as a dwelling unit (except an additional dwelling unit). Not built before the house. Eaves may project ${M(0.45)} into a required yard. No rooftop amenity area. A garage door facing a street must be at least ${M(6.0)} from the street line. Gazebos, pergolas and carports count as accessory buildings but not toward lot coverage.`});
  X.push({ref:"4.9",t:"Mechanical equipment",v:`Air conditioners, heat pumps and pool pumps: in a side or rear yard at least ${M(0.6)} from the lot line; in a front yard at least ${M(3.0)} from the street line, ${M(0.6)} from a side lot line, and screened.`});
  X.push({ref:"4.10",t:"Satellite dishes over 1.0 m",v:`One per lot, not in the front yard, within the minimum side and rear yards, max ${M(4.5)} high.`});
  X.push({ref:"4.11",t:"Swimming pools and hot tubs",v:`Any yard except the required front yard, with the water's edge at least ${M(1.25)} from every lot line.`});
  X.push({ref:"4.19",t:"Visual barrier",v:`Where required: ${M(1.8)} to ${M(2.5)} high fence or wall, or planting or berm, and not within ${M(3.0)} of a street line.`});
  X.push({ref:"4.21",t:"Home business",v:`Single and semi-detached: one business per unit (plus an office), one non-resident employee, no outdoor storage, up to 25% of the unit's floor area or ${M2(50)}, whichever is less, with parking at one space per unit, employee and business. Duplex, triplex, fourplex and townhouses: office, academic instruction or craftsperson only, up to ${M2(15)}.`});
  X.push({ref:"4.35.1",t:"Landscaping",v:`At least 50% of the front yard and 50% of any flankage yard must be landscaped, with one tree area at least ${M(3.75)} per side and free of hard surfaces. Fourplex rear parking needs ${M(1.5)} side and ${M(3.0)} rear landscaped strips.`});
  X.push({ref:"4.23",t:"Other special setbacks",v:`Provincial highway right-of-way ${M(14.0)}; pipeline right-of-way ${M(10.0)} (TransCanada ${M(7.0)}); Lincoln Alexander Parkway ${M(22.86)} for residential buildings; Lake Ontario top of bank ${M(7.5)}.`});
  X.push({ref:"4.24",t:"Conservation authority regulation area",v:"Mapped regulation areas need the conservation authority's approval before development or site alteration. See the applicable law review."});
  if(/^(A1|A2|S1)$/.test(key))X.push({ref:"4.22",t:"Adequate services",v:"In a Rural Zone, an approved septic system and water supply must be provided to the Chief Building Official's satisfaction."});
  X.push({ref:"4.2, 4.39, 4.40",t:"Other residential rules",v:"No living in vehicles or trailers. Home child care is permitted in any dwelling. No industrial use on a lot with a residential use."});
  return {C,X,res};
}
function renderProvisions(G){
  const P={ok:["ok","OK"],bad:["bad","NO"],flag:["flag","NOTE"],applies:["info","APPLIES"],info:["info","INFO"],check:["bad","CHECK"]};
  const {C,X,res}=provisions(G);setBadge("section4",C.filter(c=>c.s==="bad").length,true);
  const head=res||S.example?"":`<li><span class="pill info law">NOTE</span><span class="lt">Zone not loaded</span><span class="ld">These are the residential provisions of Section 4. They apply where the lot is used for a dwelling.</span></li>`;
  $("gp").innerHTML=head+C.map(c=>`<li><span class="pill ${P[c.s][0]} law">${P[c.s][1]}</span><span class="lt">${c.t} <span class="ref">s. ${c.ref}</span></span><span class="ld">${c.v}</span></li>`).join("");
  $("gpRef").innerHTML=X.map(c=>`<li><span class="ref" style="padding-top:2px">s. ${c.ref}</span><span class="lt">${c.t}</span><span class="ld">${c.v}</span></li>`).join("");
}
