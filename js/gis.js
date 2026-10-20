"use strict";
/* ---------------- Network: fetch with JSONP fallback (ArcGIS REST supports callback=) ---------------- */
let cbn = 0;
function qs(p){return Object.entries(p).map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(typeof v==="object"?JSON.stringify(v):v)).join("&")}
function jsonp(url, params){
  return new Promise((res,rej)=>{
    const name="__arc"+(++cbn); const s=document.createElement("script");
    const t=setTimeout(()=>{cleanup();rej(new Error("The City map server did not respond."))},20000);
    function cleanup(){clearTimeout(t);delete window[name];s.remove()}
    window[name]=d=>{cleanup();res(d)};
    s.onerror=()=>{cleanup();rej(new Error("Could not reach the City map server. Check your connection."))};
    s.src=url+"?"+qs({...params,f:"json",callback:name}); document.head.appendChild(s);
  });
}
async function arc(url, params){
  let data;
  try{ const r=await fetch(url+"?"+qs({...params,f:"json"})); data=await r.json(); }
  catch(e){ data=await jsonp(url,params); }
  if(data && data.error) throw new Error(data.error.message||"Map server error");
  return data;
}
