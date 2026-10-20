"use strict";
/* Imperial companions for metric values: feet-and-inches for lengths, square feet for areas, rise/12 for roof pitch */
const ftIn=m=>{if(m==null||!isFinite(m))return "–";const t=Math.round(Math.abs(m)*39.3701);return `${m<0?"-":""}${Math.floor(t/12)}′-${t%12}″`};
const M=(v,d=1)=>`${fmt(v,d)} m (${ftIn(v)})`;
const M2=v=>`${fmt(v)} m² (${fmt(v*10.7639)} ft²)`;
const pitch12=deg=>`${fmt(Math.tan(deg*Math.PI/180)*12,1)}/12`;
const fmt=(v,d=0)=>v==null||!isFinite(v)?"–":Number(v).toLocaleString("en-CA",{minimumFractionDigits:d,maximumFractionDigits:d});
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
