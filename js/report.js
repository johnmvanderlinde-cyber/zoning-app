"use strict";
/* ---------------- Report letter (PDF via print, and Word .docx) ---------------- */
const RP_FIELDS=["rpFor","rpBy","rpFirm","rpFile"];
RP_FIELDS.forEach(id=>{const el=$(id);try{el.value=localStorage.getItem("hle."+id)||""}catch(e){}
  el.addEventListener("change",()=>{try{localStorage.setItem("hle."+id,el.value)}catch(e){}})});
const stripTags=h=>String(h).replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');

/* Render the plan in the light theme and capture it as the report figure, framed like the on-screen plan panel,
   then restore the viewer's theme. */
async function captureFigures(){
  const root=document.documentElement,prevTheme=root.getAttribute("data-theme");
  root.setAttribute("data-theme","light");
  renderAll(false);
  const planEl=$("plan"),cs=getComputedStyle(root);
  // frame: the plan's viewBox widened to the panel's shape (between 1.25:1 and 2.2:1) so neighbouring lots and streets show
  let [vx,vy,vw,vh]=planEl.getAttribute("viewBox").split(" ").map(Number);
  const r=planEl.getBoundingClientRect();let asp=r.width&&r.height?r.width/r.height:1.6;asp=Math.min(2.2,Math.max(1.25,asp));
  if(vw/vh<asp){const nw=vh*asp;vx-=(nw-vw)/2;vw=nw}else{const nh=vw/asp;vy-=(nh-vh)/2;vh=nh}
  let svg=new XMLSerializer().serializeToString(planEl).replace(/var\((--[\w-]+)\)/g,(m,n)=>cs.getPropertyValue(n).trim()||"#888");
  svg=svg.replace(/viewBox="[^"]*"/,`viewBox="${vx} ${vy} ${vw} ${vh}"`);
  // a standalone SVG needs exactly one namespace declaration and an explicit font
  if(!/<svg[^>]*\sxmlns="/.test(svg))svg=svg.replace("<svg",'<svg xmlns="http://www.w3.org/2000/svg"');
  svg=svg.replace("<svg",'<svg font-family="-apple-system, BlinkMacSystemFont, Inter, Helvetica Neue, Arial, sans-serif"');
  const ground=cs.getPropertyValue("--ground").trim()||"#eef0f3";
  const pw=2000,ph=Math.round(pw/asp);
  const planPng=await new Promise(res=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=pw;c.height=ph;const x=c.getContext("2d");x.fillStyle=ground;x.fillRect(0,0,pw,ph);x.drawImage(img,0,0,pw,ph);res(c.toDataURL("image/png"))};img.onerror=()=>res(null);
    img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg.replace(/<svg([^>]*?)>/,`<svg$1 width="${pw}" height="${ph}">`))});
  if(prevTheme)root.setAttribute("data-theme",prevTheme);else root.removeAttribute("data-theme");
  renderAll(false);
  return {planPng,arPlan:pw/ph};
}

function reportData(){
  const G=compute(),R=S.regs,z=zoneDef(),za=S.zone.attrs||{},a=S.parcelAttrs||{};
  const E=existingAnalysis(G.lotArea);const city=cityLotSize(a);
  const front=S.edges.filter(e=>e.type==="front").reduce((s,e)=>s+e.len,0);
  const law=(S.law&&S.law.state==="done")?lawItems():null;
  const zoneName=z?z.name:(za.ZONING_DESC||"zone not loaded in this tool");
  const parent=za.PARENT_BY_LAW_NUMBER||(z?"05-200":"");
  const addr=S.address||a.LOCATION||"the subject property";
  const pass=c=>c.filter(x=>x.ok===true).length, tot=c=>c.filter(x=>x.ok!==null).length;
  const failing=c=>c.filter(x=>x.ok===false).map(x=>x.label.toLowerCase());
  // summary
  const P=[];
  P.push(`This letter summarizes a preliminary zoning and site review of ${addr}${a.PROPERTY_NUM?` (roll number ${a.PROPERTY_NUM})`:""}. The lot measures about ${fmt(G.lotArea)} m² (${fmt(G.lotArea*10.7639)} ft²) with a ${fmt(front,1)} m front lot line, and is zoned ${S.zone.code||"?"} (${zoneName})${parent?` under Zoning By-law ${parent}`:""}.`);
  if(z&&z.restricted)P.push(`The ${S.zone.code} zone protects conservation or hazard land, and new buildings are generally not permitted.`);
  else P.push(`Within the required setbacks, the zone allows building on about ${fmt(G.envArea)} m² of the lot (${fmt(G.envArea/G.lotArea*100)}%), up to a maximum height of ${fmt(R.height,1)} m.`);
  if(E){const m=E.main;const f=failing(E.checks);
    P.push(`The existing ${m.accessory?"building":"main building"} covers ${fmt(m.area)} m² and stands about ${fmt(m.ridge,1)} m to the ridge (${m.src==="assumed"?"height assumed, not measured":"height as entered"}). Total building coverage is ${fmt(E.total/G.lotArea*100,1)}% of the lot. It ${f.length?`does not meet the ${f.join(", ")} requirement${f.length>1?"s":""}, which may reflect a legal non-conforming condition or a past variance`:`meets the ${tot(E.checks)} zoning checks applied`}.`)}
  else P.push("No existing building footprint is mapped on this lot.");
  if(law){const flags=law.filter(i=>i.s==="flag").map(i=>stripTags(i.t));const checksL=law.filter(i=>i.s==="check").map(i=>stripTags(i.t));
    P.push(flags.length?`Approvals beyond zoning are likely to be needed for: ${flags.join("; ")}.`:"No provincial or City overlays requiring separate approval (Niagara Escarpment development control, conservation authority regulation, heritage, Greenbelt or interim control) were found on this lot.");
    if(checksL.length)P.push(`Some sources could not be checked and should be confirmed: ${checksL.join("; ")}.`)}
  else P.push("The applicable law review had not finished when this letter was produced and should be rerun.");
  const GP=provisions(G);const gpBad=GP.C.filter(c=>c.s==="bad").map(c=>`${stripTags(c.t).toLowerCase()} (s. ${c.ref})`);
  if(GP.C.length)P.push(gpBad.length?`Under the general provisions in Section 4, the following need attention: ${gpBad.join("; ")}.`:"No conflicts with the measurable general provisions in Section 4 were found.");
  const edited=Object.keys(S.edited);
  const RN={front:"front yard",side:"side yard",flank:"flankage yard",rear:"rear yard",height:"maximum height",coverage:"lot coverage",landscaped:"landscaped area",sideAgg:"aggregate side yards",lotArea:"minimum lot area",lotAreaPerUnit:"lot area per unit",lotWidth:"lot width",lotWidthPerUnit:"lot width per unit",unitWidth:"unit width"};
  if(edited.length)P.push(`Note: these regulations were changed from the by-law values to test a possible variance: ${edited.map(k=>`${RN[k]||k} (${fmt(R[k],1)})`).join(", ")}.`);

  const propRows=[["Address",addr],["Roll number",a.PROPERTY_NUM||"–"],["Lot area (mapped)",`${fmt(G.lotArea)} m² · ${fmt(G.lotArea*10.7639)} ft²`],
    ["Lot size (City record)",city.size||"–"],["Frontage × depth (City record)",city.dims||"–"],["Front lot line (mapped)",`${fmt(front,1)} m`],
    ["Buildable envelope",`${fmt(G.envArea)} m² (${fmt(G.envArea/G.lotArea*100)}% of lot)`]];
  const zoneRows=[["Zone",`${S.zone.code||"?"} · ${zoneName}`],["By-law",parent?`${parent}${z?`, Section ${z.section}`:""}`:"–"]];
  [1,2,3].forEach(i=>{if(za["EXCEPTION"+i])zoneRows.push([`Exception ${i}`,String(za["EXCEPTION"+i])]);if(za["HOLDING"+i])zoneRows.push([`Holding ${i}`,String(za["HOLDING"+i])])});
  if(za.BY_LAW_NUMBER)zoneRows.push(["Amending by-law",String(za.BY_LAW_NUMBER)]);
  if(S.zone.ca&&S.zone.attrs)zoneRows.push(["Council-approved zone (also applies)",String(S.zone.ca.ZONING_CODE)]);
  const regRows=[["front","Front yard","m"],["side","Side yard","m"],["flank","Flankage yard","m"],["rear","Rear yard","m"],["height","Maximum height","m"],["coverage","Maximum lot coverage","%"],["landscaped","Minimum landscaped area","%"],["sideAgg","Aggregate side yards","m"],["lotArea","Minimum lot area","m²"],["lotAreaPerUnit","Minimum lot area per unit","m²"],["lotWidth","Minimum lot width","m"],["lotWidthPerUnit","Minimum lot width per unit","m"],["unitWidth","Minimum unit width","m"]]
    .filter(([k])=>R[k]!=null&&!/^(lotArea|lotAreaPerUnit|lotWidth|lotWidthPerUnit|unitWidth)$/.test(k)).map(([k,l,u])=>[l,`${fmt(R[k],k==="lotArea"||k==="lotAreaPerUnit"?0:1)} ${u}`,k in S.edited?"Changed for testing":(R.ref==="assumed"?"Assumed":`s. ${R.ref}`)]);
  const existRows=E?S.buildings.map((b,i)=>[`${b.accessory?"Accessory":"Main"} building ${i+1}`,`${M2(b.area)} · eave ${M(b.eave)} · ridge ${M(b.ridge)}`,b.src==="assumed"?"Height assumed":"Height entered"]):[];
  const toCheckRows=c=>c.map(x=>[x.label,x.val,x.ok===null?"Info":x.ok?"Meets":"Does not meet"]);
  return {meta:{date:new Date().toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"}),addr,forWho:$("rpFor").value.trim(),byWho:$("rpBy").value.trim(),firm:$("rpFirm").value.trim()||"Vanderlinde Design",file:$("rpFile").value.trim(),example:S.example},
    summary:P,propRows,zoneRows,regRows,law,existRows,existChecks:E?toCheckRows(E.checks):[],
    gpRows:GP.C.map(c=>[`s. ${c.ref} · ${stripTags(c.t)}`,stripTags(c.v),GP_WORD[c.s]]),
    gpRefRows:GP.X.map(c=>[`s. ${c.ref} · ${c.t}`,c.v]),
    sources:["City of Hamilton open GIS: property parcels, Zoning By-law 05-200 zoning boundaries, building footprints, railways, 2017 contours, policy planning and heritage layers (spatialsolutions.hamilton.ca).",
      "Province of Ontario, Land Information Ontario: Niagara Escarpment Commission map service (Area of Development Control, Plan areas and designations).",
      "City of Hamilton Zoning By-law 05-200, sections supplied for review (Sections 1–5, 7.5–7.8, 12.1–12.3, 15.1–15.3, Schedule D)."]};
}

const reAddr=a=>/hamilton|,\s*ON\b/i.test(a)?a:a+", Hamilton, Ontario";
const GP_WORD={ok:"Meets",bad:"Does not meet",flag:"Zoning not in effect",applies:"Applies",info:"Information",check:"To be confirmed"};
const LAW_WORD={flag:"Permit or approval likely needed",applies:"Applies",clear:"Not applicable",check:"To be confirmed"};
function letterHtml(D,F){
  const m=D.meta;const tbl=(rows,head)=>`<table>${head?`<thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>`:""}<tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===r.length-1&&head&&/Does not meet|Permit/.test(c)?' class="neg"':""}>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const lawHtml=D.law?`<table><thead><tr><th>Law or policy</th><th>Finding</th><th>Status</th></tr></thead><tbody>${D.law.map(i=>`<tr><td><b>${i.t}</b></td><td>${i.d}</td><td class="${i.s==="flag"?"neg":""}">${LAW_WORD[i.s]}</td></tr>`).join("")}</tbody></table>`:"<p>The applicable law review was not complete.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Zoning review · ${esc(m.addr)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Inter+Tight:wght@400;600&display=swap">
<style>
@page{size:letter;margin:18mm 18mm 20mm}
body{font:10.5pt/1.5 "Source Serif 4",Georgia,serif;color:#2A3A2E;margin:0;background:#EDE7DA}
.page{max-width:8.5in;margin:24px auto;background:#fff;padding:0.8in 0.85in;box-shadow:0 2px 18px rgba(0,0,0,.12)}
.bar{position:sticky;top:0;background:#2A3A2E;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;font:14px "Inter Tight",sans-serif;z-index:2}
.bar button{font:600 14px "Inter Tight",sans-serif;background:#C89B4A;color:#2A3A2E;border:0;border-radius:4px;padding:8px 14px;cursor:pointer}
.lh{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #2A3A2E;padding-bottom:10px;margin-bottom:22px}
.lh .title{font:400 28pt/1.1 Georgia,"Times New Roman",serif}
.lh .by{font:600 13pt/1.3 "Inter Tight",sans-serif;color:#2A3A2E;margin-top:4px}
.lh .sub{font:9pt "Inter Tight",sans-serif;color:#566151;text-align:right}
.meta{font:10pt "Inter Tight",sans-serif;display:grid;grid-template-columns:auto 1fr;gap:2px 14px;margin-bottom:18px}
.meta b{color:#566151;font-weight:600}
.re{font-weight:600;margin:14px 0}
h2{font:400 14pt Georgia,"Times New Roman",serif;border-bottom:1px solid #D9D0BF;padding-bottom:3px;margin:22px 0 8px;break-after:avoid}
p{margin:0 0 9px;text-align:justify;hyphens:auto}
table{width:100%;border-collapse:collapse;font:9.5pt/1.4 "Inter Tight",sans-serif;margin:4px 0 10px;break-inside:auto}
th{text-align:left;background:#EFE8DA;font-weight:600;padding:5px 7px;border-bottom:1px solid #B9AE98}
td{padding:5px 7px;border-bottom:1px solid #E6DECF;vertical-align:top}
td:first-child{width:30%}
td.neg{color:#9A4A2B;font-weight:600}
tr{break-inside:avoid}
a{color:#3D4F3A}
figure{margin:8px 0 12px;break-inside:avoid}
figure img{width:100%;border:1px solid #D9D0BF}
figcaption{font:9pt "Inter Tight",sans-serif;color:#566151;margin-top:4px}
.figs{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.sig{margin-top:28px}
.sig .line{border-top:1px solid #2A3A2E;width:2.6in;margin-top:40px;padding-top:4px;font:10pt "Inter Tight",sans-serif}
.small{font:8.5pt/1.45 "Inter Tight",sans-serif;color:#566151}
.ex{background:#F6EBD0;border:1px solid #C89B4A;padding:6px 10px;font:10pt "Inter Tight",sans-serif;margin-bottom:12px}
@media print{body{background:#fff}.bar{display:none}.page{box-shadow:none;margin:0;padding:0;max-width:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print or save as PDF</button><span>Choose “Save as PDF” as the printer to keep a copy.</span></div>
<div class="page">
<div class="lh"><div><div class="title">Zoning report</div><div class="by">Prepared by ${esc(m.byWho||m.firm)}</div></div><div class="sub">Preliminary zoning and site review<br>City of Hamilton · Zoning By-law 05-200</div></div>
${m.example?`<div class="ex">This letter describes the built-in example lot, not a real property.</div>`:""}
<div class="meta"><b>Date</b><span>${esc(m.date)}</span>${m.forWho?`<b>To</b><span>${esc(m.forWho)}</span>`:""}${m.file?`<b>File</b><span>${esc(m.file)}</span>`:""}<b>Property</b><span>${esc(m.addr)}</span></div>
<p>${m.forWho?`Dear ${esc(m.forWho)},`:"To whom it may concern,"}</p>
<p class="re">Re: Zoning and site review, ${esc(reAddr(m.addr))}</p>
${D.summary.map(t=>`<p>${esc(t)}</p>`).join("")}
<h2>1. Property</h2>${tbl(D.propRows)}
<h2>2. Zoning</h2>${tbl(D.zoneRows)}
<h3 style="font:600 10.5pt 'Inter Tight',sans-serif;margin:10px 0 2px">Regulations applied</h3>${tbl(D.regRows,["Regulation","Requirement","Source"])}
<h2>3. Applicable law and approvals</h2>${lawHtml}
<h2>4. Existing building</h2>${D.existRows.length?tbl(D.existRows,["Building","Footprint and height","Source"])+tbl(D.existChecks,["Check","Measured","Result"]):"<p>No existing building footprint is mapped on this lot.</p>"}
<h2>5. General provisions (Section 4, residential)</h2>${D.gpRows.length?tbl(D.gpRows,["Provision","Finding","Status"]):"<p>No residential provisions were assessed.</p>"}
<h3 style="font:600 10.5pt 'Inter Tight',sans-serif;margin:10px 0 2px">Other Section 4 rules that apply to residential lots</h3>${tbl(D.gpRefRows)}
<h2>6. Figure</h2>
${F.planPng?`<figure><img src="${F.planPng}" alt="Plan of lot lines, setbacks and buildings"><figcaption>Figure 1. Plan of the lot: lot lines labelled by type with lengths and required setbacks in metres, setback areas hatched, buildable area in yellow, existing building footprint in grey.</figcaption></figure>`:""}
<h2>7. Sources and limitations</h2>
<p class="small">${D.sources.map(esc).join(" ")}</p>
<p class="small">This review is preliminary and relies on open map data, which may not match surveyed lot lines or current approvals. Site-specific exceptions, holding provisions, general provisions in Section 4 of the by-law, and special figures in Schedule F can change the limits shown. It is not a Zoning Verification Certificate, legal opinion or survey. Confirm zoning with the City of Hamilton, and Niagara Escarpment, conservation authority and heritage matters with the responsible agencies, before relying on these findings.</p>
<div class="sig"><p>Sincerely,</p><div class="line">${esc(m.byWho||m.firm)}${m.byWho&&m.firm&&m.firm!==m.byWho?`<br>${esc(m.firm)}`:""}</div></div>
</div></body></html>`;
}

async function exportPdf(){
  const win=window.open("","_blank"); // open now, inside the click, so pop-up blockers allow it
  $("exStatus").textContent="Preparing the letter…";
  try{
    const F=await captureFigures();const html=letterHtml(reportData(),F);
    if(win){win.document.open();win.document.write(html);win.document.close();$("exStatus").textContent="The letter opened in a new tab. Use Print to save it as a PDF."}
    else{$("exStatus").textContent="Your browser blocked the new tab. Allow pop-ups for this file and try again."}
  }catch(e){if(win)win.close();$("exStatus").textContent="Could not build the letter: "+e.message}
}

function dataUrlBytes(u){const b=atob(u.split(",")[1]);const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
async function exportDocx(){
  if(!window.docx){$("exStatus").textContent="The Word library did not load. Check your connection.";return}
  $("exStatus").textContent="Building the Word document…";
  try{
    const D=reportData(),F=await captureFigures(),m=D.meta;
    const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,HeadingLevel,AlignmentType,BorderStyle,ImageRun,Footer,PageNumber,ShadingType}=docx;
    const FONT="Calibri",INK="2A3A2E",GREY="566151";
    const t=(text,o={})=>new TextRun({text,font:FONT,size:o.size||21,bold:o.bold,color:o.color||INK,italics:o.italics});
    const para=(text,o={})=>new Paragraph({children:[t(text,o)],spacing:{after:o.after??140,line:276},alignment:o.align});
    const h=(text)=>new Paragraph({children:[t(text,{bold:true,size:24})],spacing:{before:300,after:100},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:"B9AE98",space:2}}});
    const border={top:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},left:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},right:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},bottom:{style:BorderStyle.SINGLE,size:4,color:"D5DCD8"}};
    const table=(rows,head)=>{const n=(head||rows[0]||[]).length||1;const w=n===2?[35,65]:[30,45,25];
      const cell=(txt,i,hd,neg)=>new TableCell({width:{size:w[i]||Math.floor(100/n),type:WidthType.PERCENTAGE},borders:border,shading:hd?{type:ShadingType.CLEAR,color:"auto",fill:"EFE8DA"}:undefined,margins:{top:60,bottom:60,left:90,right:90},
        children:[new Paragraph({children:[t(String(txt),{bold:hd,size:19,color:neg?"9A4A2B":INK})]})]});
      const out=[];if(head)out.push(new TableRow({tableHeader:true,children:head.map((c,i)=>cell(c,i,true))}));
      rows.forEach(r=>out.push(new TableRow({cantSplit:true,children:r.map((c,i)=>cell(c,i,false,i===r.length-1&&/Does not meet|Permit/.test(c)))})));
      return new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:out})};
    const img=(url,ar,cap)=>{const W=600;return [new Paragraph({children:[new ImageRun({data:dataUrlBytes(url),transformation:{width:W,height:Math.round(W/ar)}})],spacing:{before:120}}),para(cap,{size:18,color:GREY,italics:true})]};
    const kids=[
      new Paragraph({children:[t("Zoning report",{bold:true,size:44})],spacing:{after:40}}),
      new Paragraph({children:[t(`Prepared by ${m.byWho||m.firm}`,{bold:true,size:26})],border:{bottom:{style:BorderStyle.SINGLE,size:18,color:INK,space:6}},spacing:{after:80}}),
      para("Preliminary zoning and site review · City of Hamilton · Zoning By-law 05-200",{size:18,color:GREY,after:300}),
      ...(m.example?[para("This letter describes the built-in example lot, not a real property.",{bold:true,color:"8A6A00"})]:[]),
      para(m.date,{after:60}),...(m.forWho?[para("To: "+m.forWho,{after:60})]:[]),...(m.file?[para("File: "+m.file,{after:60})]:[]),
      para(`Property: ${m.addr}`,{after:240}),
      para(m.forWho?`Dear ${m.forWho},`:"To whom it may concern,"),
      para(`Re: Zoning and site review, ${reAddr(m.addr)}`,{bold:true}),
      ...D.summary.map(s=>para(s,{align:AlignmentType.JUSTIFIED})),
      h("1. Property"),table(D.propRows),
      h("2. Zoning"),table(D.zoneRows),para("Regulations applied",{bold:true,after:60}),table(D.regRows,["Regulation","Requirement","Source"]),
      h("3. Applicable law and approvals"),
      ...(D.law?[table(D.law.map(i=>[stripTags(i.t),stripTags(i.d),LAW_WORD[i.s]]),["Law or policy","Finding","Status"])]:[para("The applicable law review was not complete.")]),
      h("4. Existing building"),
      ...(D.existRows.length?[table(D.existRows,["Building","Footprint and height","Source"]),para("",{after:60}),table(D.existChecks,["Check","Measured","Result"])]:[para("No existing building footprint is mapped on this lot.")]),
      h("5. General provisions (Section 4, residential)"),
      ...(D.gpRows.length?[table(D.gpRows,["Provision","Finding","Status"])]:[para("No residential provisions were assessed.")]),
      para("Other Section 4 rules that apply to residential lots",{bold:true,after:60}),table(D.gpRefRows),
      h("6. Figure"),
      ...(F.planPng?img(F.planPng,F.arPlan,"Figure 1. Plan of the lot: lot lines labelled by type with lengths and required setbacks in metres, setback areas hatched, buildable area in yellow, existing building footprint in grey."):[para("The plan figure could not be produced.")]),
      h("7. Sources and limitations"),...D.sources.map(s=>para(s,{size:18,color:GREY,after:60})),
      para("This review is preliminary and relies on open map data, which may not match surveyed lot lines or current approvals. Site-specific exceptions, holding provisions, general provisions in Section 4 of the by-law, and special figures in Schedule F can change the limits shown. It is not a Zoning Verification Certificate, legal opinion or survey. Confirm zoning with the City of Hamilton, and Niagara Escarpment, conservation authority and heritage matters with the responsible agencies, before relying on these findings.",{size:18,color:GREY}),
      para("Sincerely,",{after:600}),
      new Paragraph({children:[t(m.byWho||m.firm)],border:{top:{style:BorderStyle.SINGLE,size:6,color:INK,space:4}}}),
      ...(m.byWho&&m.firm&&m.firm!==m.byWho?[para(m.firm)]:[])
    ];
    const doc=new Document({creator:m.byWho||"Hamilton Property Zoning",title:`Zoning review · ${m.addr}`,
      sections:[{properties:{page:{margin:{top:1080,bottom:1080,left:1080,right:1080}}},
        footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({children:[`${m.addr} · Page `,PageNumber.CURRENT," of ",PageNumber.TOTAL_PAGES],font:FONT,size:16,color:GREY})]})]})},
        children:kids}]});
    const blob=await Packer.toBlob(doc);
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`Zoning review - ${m.addr.replace(/[\\/:*?"<>|,]/g,"").slice(0,60)}.docx`;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);
    $("exStatus").textContent="Word document downloaded.";
  }catch(e){$("exStatus").textContent="Could not build the Word document: "+e.message}
}
$("exPdf").addEventListener("click",exportPdf);
$("exDocx").addEventListener("click",exportDocx);
