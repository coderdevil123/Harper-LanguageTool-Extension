function f(t){var i,l;const e=t.grammar||[],n=((i=t.harper)==null?void 0:i.tone)||[],o=((l=t.harper)==null?void 0:l.terminology)||[];m(),[...e,...n,...o].forEach((r,d)=>{x(r,d)})}function m(){document.querySelectorAll(".hlt-highlight").forEach(t=>{t.replaceWith(t.innerText)})}function x(t,e){var i;const n=((i=t.context)==null?void 0:i.text)||t.text;if(!n)return;t.id=e,y(document.body).forEach(l=>{if(!l.nodeValue.includes(n))return;const r=l.nodeValue.split(n);if(r.length<=1)return;const d=document.createDocumentFragment();r.forEach((u,g)=>{if(d.appendChild(document.createTextNode(u)),g<r.length-1){const c=document.createElement("span");c.className="hlt-highlight",c.dataset.hltPayload=encodeURIComponent(JSON.stringify(t)),c.dataset.hltId=e,c.style.borderBottom="2px solid red",c.style.cursor="pointer",c.textContent=n,d.appendChild(c)}}),l.replaceWith(d)})}function y(t){let e=[];const n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT);let o;for(;o=n.nextNode();)e.push(o);return e}console.log("Inject UI loaded 💬");let a=null;function h(t,e,n,o){p(),a=document.createElement("div"),a.className="hlt-bubble",a.style.cssText=`
        position: fixed;
        top: ${o+15}px;
        left: ${n}px;
        background: #ffffff;
        border: 1px solid #ccc;
        padding: 10px 14px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.15);
        border-radius: 10px;
        z-index: 999999;
        max-width: 300px;
        font-size: 14px;
    `;let i=`<strong>${t}</strong><hr/>`;e.length===0?i+="<div>No suggestions</div>":i+=e.map((l,r)=>{const d=(l==null?void 0:l.value)||l;return`<div class="hlt-suggestion" data-index="${r}"
                        style="padding:6px;cursor:pointer;">
                        ${d}
                        </div>`}).join(""),a.innerHTML=i,document.body.appendChild(a)}function p(){a&&(a.remove(),a=null)}document.addEventListener("click",t=>{if(t.target.classList.contains("hlt-highlight")){const e=t.target.getAttribute("data-hlt-payload");window.__hlt_last_clicked_span=t.target,chrome.runtime.sendMessage({type:"GET_SUGGESTIONS",payload:{raw:e}},n=>{const o=t.target.getBoundingClientRect();h(t.target.innerText,(n==null?void 0:n.suggestions)||[],o.left,o.top)})}else p()});console.log("Harper-LT: content script loaded");let s=null;chrome.runtime.onMessage.addListener(t=>{if(t.type==="COMBINED_RESULTS"&&f(t.payload),t.type==="SHOW_SUGGESTIONS"){const{text:e,suggestions:n,position:o}=t.payload;h(e,n,o.x,o.y)}t.type==="APPLY_SUGGESTION"&&S(t.payload)});document.addEventListener("click",t=>{const e=t.target;if(e.classList.contains("hlt-highlight")){s=JSON.parse(decodeURIComponent(e.dataset.hltPayload||"{}"));const n=e.getBoundingClientRect();chrome.runtime.sendMessage({type:"GET_SUGGESTIONS",payload:{issue:s,position:{x:n.left,y:n.top}}})}else p()});function S({replacement:t}){if(!s)return;const e=document.querySelector(`span[data-hlt-id="${s.id}"]`);e&&(e.outerText=t)}
