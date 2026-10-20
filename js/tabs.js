"use strict";
/* Tab navigation for the left panel. The active tab is kept in the URL hash (#law, #building...) so a view can be bookmarked. */
const TAB_IDS=["site","rules","law","building","section4","report"];
function showTab(id,focus){
  if(!TAB_IDS.includes(id))id="site";
  TAB_IDS.forEach(t=>{
    const on=t===id,btn=document.getElementById("tab-"+t);
    btn.setAttribute("aria-selected",on);btn.tabIndex=on?0:-1;
    document.getElementById("pane-"+t).hidden=!on;
    if(on&&focus)btn.focus();
  });
  document.querySelector(".panes").scrollTop=0;
  try{history.replaceState(null,"","#"+id)}catch(e){}
}
function setBadge(id,n,bad){
  const el=document.getElementById("bd-"+id);if(!el)return;
  el.hidden=!n;el.textContent=n||"";el.classList.toggle("bad",!!bad);
}
(function(){
  const tabs=document.querySelector(".tabs");
  tabs.addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b)showTab(b.dataset.tab)});
  tabs.addEventListener("keydown",e=>{
    const i=TAB_IDS.indexOf(document.activeElement&&document.activeElement.dataset.tab);if(i<0)return;
    let n=null;
    if(e.key==="ArrowRight")n=(i+1)%TAB_IDS.length;else if(e.key==="ArrowLeft")n=(i+TAB_IDS.length-1)%TAB_IDS.length;
    else if(e.key==="Home")n=0;else if(e.key==="End")n=TAB_IDS.length-1;
    if(n!==null){e.preventDefault();showTab(TAB_IDS[n],true)}
  });
  showTab((location.hash||"").slice(1));
  window.addEventListener("hashchange",()=>showTab((location.hash||"").slice(1)));
})();
