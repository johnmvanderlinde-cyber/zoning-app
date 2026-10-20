"use strict";
/* ---------------- Parking: Zoning By-law 05-200, Section 5, residential uses ----------------
   Source: City of Hamilton Section 5 posting dated August 2026, marked "not final" (consolidation of By-law 24-052 and later
   amendments: 25-075, 25-155, 25-189, 26-016). Parts of Section 5 remain under appeal (OLT-24-000544), and the residential
   electric vehicle rates in 5.7.4 are marked "NOT FINAL & BINDING". Check the in-force text before relying on any of this.
   Which Parking Rate Area (PRA) a lot is in is not read from the map, so each rate is shown for every area. */
function parking(G){
  const key=S.zone.key||"",byType=t=>S.edges.filter(e=>e.type===t);
  const res=/^(R1|R1A|R2|S1|A1|A2)$/.test(key);
  const rural=/^(A1|A2)$/.test(key);
  const C=[],X=[];
  const dt=DTYPES[S.dtype]||DTYPES.single;
  const units=S.dtype==="town"?(S.townUnits||1):(dt.units||1);
  const front=byType("front").reduce((s,e)=>s+e.len,0);
  const corner=byType("flank").length>0;
  // 5.7.1 minimum parking by dwelling type and Parking Rate Area
  const rates={
    single:{n:"single detached dwelling",pra1:0,pra2:units,pra3:units,other:units,per:"1 per unit"},
    semi:{n:"semi-detached dwelling",pra1:0,pra2:units,pra3:units,other:units,per:"1 per unit"},
    town:{n:"street townhouse",pra1:0,pra2:units,pra3:units,other:units,per:"1 per unit"},
    duplex:{n:"duplex dwelling",pra1:0,pra2:1,pra3:1,other:1,per:"a total of 1 space"},
    triplex:{n:"triplex dwelling",pra1:0,pra2:2,pra3:3,other:3,per:"a total of 2 spaces in PRA 2 and 1 per unit elsewhere"},
    fourplex:{n:"fourplex dwelling",pra1:0,pra2:3,pra3:4,other:4,per:"a total of 3 spaces in PRA 2 and 1 per unit elsewhere"}
  }[S.dtype];
  if(rates){
    const same=rates.pra2===rates.pra3&&rates.pra3===rates.other;
    C.push({ok:null,s:"applies",ref:"5.7.1",t:"Minimum parking spaces",v:
      `A ${rates.n}${S.dtype==="town"?` of ${units} units`:""} needs ${rates.per}. In Parking Rate Area 1 (the downtown core) no spaces are required. ${same?`Everywhere else that is ${rates.other} space${rates.other===1?"":"s"} for this lot.`:`Here that is ${rates.pra2} space${rates.pra2===1?"":"s"} in PRA 2 and ${rates.other} elsewhere (PRA 3 and all other areas).`} Fractions round down (5.1.1 c). Confirm the lot's Parking Rate Area on the City's PRA map.`});
  } else if(S.dtype==="custom"){
    C.push({ok:null,s:"info",ref:"5.7.1",t:"Minimum parking spaces",v:"The building type is set to custom, so no rate is applied. Choose a dwelling type on the Rules tab to see the minimum."});
  }
  C.push({ok:null,s:"applies",ref:"5.7.1",t:"Additional dwelling units",v:"An additional dwelling unit, attached or detached, needs no parking in Parking Rate Areas 1, 2 and 3. In all other areas it needs 1 space per unit."});
  C.push({ok:null,s:"info",ref:"5.1.1 b)",t:"Existing buildings",v:"No parking is required for an existing building if the spaces it already has continue to be provided. An addition only triggers 5.7.1 for the added floor area."});
  // 5.3.2 driveways (not in A1 and A2)
  if(!rural&&/^(R1|R1A|R2|S1)$/.test(key)&&/^(single|semi|duplex|triplex|fourplex|custom)$/.test(S.dtype)){
    const cap=front>0?Math.min(0.5*front,8.0):null;
    C.push({ok:null,s:"applies",ref:"5.3.2 a)",t:"Driveway width and number",v:
      `With an attached garage, the driveway may not be wider than the garage and may not come closer to a side lot line than the nearest part of the dwelling (i). If the garage is under ${M(5.0)} wide, the driveway may widen to at most ${M(5.0)}, no closer than ${M(0.6)} to the side lot line next to the garage (ii). Without an attached garage, a front yard driveway is capped at 50% of the lot width or ${M(8.0)}, whichever is less${cap!=null?`: ${M(cap)} for the ${M(front,1)} front lot line mapped here`:""} (iii). One driveway per dwelling unit${corner?"; this corner lot may have one from each street":""}${front>=30?"; a lot at least 30 m (98′-5″) wide may have two":""} (iv). No driveway may cross the daylight triangle of a corner lot (v).`});
  } else if(rural){
    C.push({ok:null,s:"info",ref:"5.3.2",t:"Driveway width and number",v:`The Section 5.3.2 driveway limits do not apply in the A1 and A2 zones. A driveway must still be at least ${M(2.7)} wide (5.2.4 b).`});
  }
  if(S.dtype==="town"){
    C.push({ok:null,s:"applies",ref:"5.3.3",t:"Street townhouse parking",v:`Each required space must be at least ${M(5.8)} from the street line the driveway enters from. Parking is not permitted in the required front or flankage yard.`});
  }
  C.push({ok:null,s:"info",ref:"5.3.1 b)",t:"3.0 m setback and planting strip",v:`The ${M(3.0)} setback and planting strip that Section 5.3.1 a) puts between a street line and parking does not apply to single, semi-detached, street townhouse, duplex, triplex or fourplex dwellings.`});
  X.push({ref:"5.1.1 d), 5.6.1",t:"Location of parking",v:`Required spaces go on the same lot as the use. Off-site parking may be up to ${M(300.0)} away, in a Residential Zone only for a residential use, and needs an agreement registered on the title of both lots.`});
  X.push({ref:"5.2.1",t:"Parking space size",v:`${M(2.8)} wide by ${M(5.8)} long. Add ${M(0.3)} of width for each side against a wall, column or other obstruction. Where 10 or more spaces are provided, up to 10% may be ${M(2.6)} by ${M(5.5)} if signed for small cars only. Parallel spaces are ${M(2.4)} by ${M(6.7)}, or ${M(5.5)} long for an end space with a clear approach. A space in an attached garage is lengthened by any stairs that project into it.`});
  X.push({ref:"5.2.2",t:"Accessible parking space size",v:`${M(3.4)} wide by ${M(5.8)} long, with one side next to a marked accessibility aisle at least ${M(1.5)} wide. Where two or more are provided, up to 50% (rounded up) may be ${M(2.4)} wide. Two spaces may share one aisle.`});
  X.push({ref:"5.2.3",t:"Drive aisle width",v:`By parking angle: 0°, 15° and 30° ${M(3.7)}; 45° ${M(4.5)}; 60° ${M(5.5)}; 75° and 90° ${M(6.0)}.`});
  X.push({ref:"5.2.4",t:"Access to spaces",v:`Access may not interfere with public use of a street or laneway. A driveway is at least ${M(2.7)} wide. Every space must be reachable without moving another vehicle, except that one space at a single detached dwelling may be blocked by another vehicle. For a dwelling with an attached garage, the garage floor at the entry must be higher than the driveway centreline where it meets the street-side lot line.`});
  X.push({ref:"5.3.4",t:"Surfaces and permeability",v:"Spaces, driveways and widenings need a stable, dust-free surface: asphalt, concrete, other hard surface, crushed stone, permeable pavers or gravel. In a Residential Zone, any parking beyond the 5.7.1 requirement must be permeable and does not count as landscaped area."});
  X.push({ref:"5.1.3 b), 5.7.3",t:"Accessible parking",v:"The accessible parking counts in 5.7.3 do not apply to single, semi-detached, duplex, triplex, fourplex or street townhouse dwellings."});
  X.push({ref:"5.7.4, 5.1.4",t:"Electric vehicle parking (not final)",v:`The draft rate for single, semi-detached, street townhouse, duplex, triplex and fourplex dwellings is 100% of parking spaces, but it is marked "NOT FINAL & BINDING" and takes effect with the electric vehicle space definition, which is under appeal. A1, A2 and Open Space zones, existing buildings and existing parking lots are exempt; only additions and expansions are caught. A wall-mounted or pedestal charger may sit in any required yard if it is at least ${M(0.6)} from a lot line and outside a visibility triangle (5.6.7).`});
  X.push({ref:"5.6.2",t:"Commercial motor vehicles",v:rural?`One unenclosed commercial vehicle is allowed per lot in the A1 and A2 zones, set back ${M(20)} from every lot line and ${M(50)} from a dwelling on an adjacent lot. Agricultural vehicles are excluded.`:`One per lot, kept in a garage or enclosed building. It may be parked on the driveway only if it weighs no more than 3,000 kg, is no longer than ${M(6.0)} and no higher than ${M(2.4)}, and does not take up a required space. Short-term delivery and service vehicles are exempt.`});
  X.push({ref:"5.6.3",t:"Trailers",v:rural?`One unenclosed trailer is allowed in the A1 and A2 zones, set back ${M(20)} from lot lines and ${M(50)} from an adjacent dwelling.`:`One trailer may be stored in a garage or enclosed building, or on the driveway if attached to a motor vehicle, with the two together no longer than ${M(6.0)}, no higher than ${M(2.4)} and no wider than ${M(2.5)}, and not taking up a required space.`});
  X.push({ref:"5.6.4",t:"Major recreational equipment",v:rural?"In a Rural Zone it must be enclosed, owned by a resident of the lot, and may park on the driveway from May 1 to October 31.":`May be kept in a garage. Not permitted in the front or flankage yard. In the rear yard it needs a visual barrier (4.19) screening it from the street and neighbours. In a carport or side yard it needs a visual barrier and ${M(1.2)} from the side lot line. It may park on a driveway wholly inside the lot line from May 1 to October 31.`});
  X.push({ref:"5.4, 5.7.5",t:"Bicycle parking",v:"Required only for multiple dwellings, mixed use buildings with more than 4 units, townhouse blocks and lodging houses. Single, semi-detached, duplex, triplex, fourplex and street townhouse dwellings need none."});
  return {C,X,res};
}
function renderParking(G){
  const P={ok:["ok","OK"],bad:["bad","NO"],flag:["flag","NOTE"],applies:["info","APPLIES"],info:["info","INFO"],check:["bad","CHECK"]};
  const {C,X,res}=parking(G);setBadge("section5",C.filter(c=>c.s==="bad").length,true);
  const head=res||S.example?"":`<li><span class="pill info law">NOTE</span><span class="lt">Zone not loaded</span><span class="ld">These are the residential parking rules of Section 5. They apply where the lot is used for a dwelling.</span></li>`;
  $("pk").innerHTML=head+C.map(c=>`<li><span class="pill ${P[c.s][0]} law">${P[c.s][1]}</span><span class="lt">${c.t} <span class="ref">s. ${c.ref}</span></span><span class="ld">${c.v}</span></li>`).join("");
  $("pkRef").innerHTML=X.map(c=>`<li><span class="ref" style="padding-top:2px">s. ${c.ref}</span><span class="lt">${c.t}</span><span class="ld">${c.v}</span></li>`).join("");
}
