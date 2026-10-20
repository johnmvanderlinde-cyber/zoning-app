"use strict";
/* ---------------- 3D navigation hint ---------------- */
(function(){
  const touch=window.matchMedia&&window.matchMedia("(pointer: coarse)").matches;
  if(touch)$("hint3dText").textContent="Drag to rotate · Pinch to zoom · Two-finger drag to pan";
  let done=false;const fade=()=>{if(done)return;done=true;$("hint3d").classList.add("faded")};
  ["pointerdown","wheel"].forEach(ev=>$("v3d").addEventListener(ev,e=>{if(e.target.tagName==="CANVAS")fade()},{passive:true}));
})();

/* ---------------- Render all ---------------- */
function renderAll(fit){
  const G=compute();
  renderSidebar(G);renderPlan(G);
  try{render3d(G,fit)}catch(e){console.error(e)}
  renderMap(G,fit);
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>renderAll(false));

/* ---------------- Light / dark switch ----------------
   Follows the computer's setting until the button is used; the choice is then remembered in this browser. */
const darkMQ=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;
function isDark(){const t=document.documentElement.getAttribute("data-theme");return t?t==="dark":!!(darkMQ&&darkMQ.matches)}
function syncThemeBtn(){const d=isDark(),b=$("themeBtn");b.classList.toggle("isdark",d);const l=d?"Switch to light mode":"Switch to dark mode";b.setAttribute("aria-label",l);b.title=l}
function setTheme(t){document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("hle.theme",t)}catch(e){}syncThemeBtn();if(renderer)renderAll(false)}
(function(){let t=null;try{t=localStorage.getItem("hle.theme")}catch(e){}if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);syncThemeBtn()})();
$("themeBtn").addEventListener("click",()=>setTheme(isDark()?"light":"dark"));
if(darkMQ&&darkMQ.addEventListener)darkMQ.addEventListener("change",syncThemeBtn);

/* ---------------- Boot ---------------- */
function boot(){
  const missing=["L","ClipperLib","THREE"].filter(g=>!window[g]);
  if(missing.length){status("Some libraries did not load ("+missing.join(", ")+"). Open this file with an internet connection.",true);return}
  initMap();init3d();loadExample();
}
boot();
