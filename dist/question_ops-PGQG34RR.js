(()=>{var Y=Object.freeze({"real-name":"\u672C\u540D\u30FB\u6C0F\u540D","school-name":"\u5B66\u6821\u540D","sns-id":"SNS ID","phone-number":"\u96FB\u8A71\u756A\u53F7",address:"\u4F4F\u6240"}),tt=Object.freeze({"sexual-content":"\u6027\u7684\u5185\u5BB9",bullying:"\u3044\u3058\u3081","appearance-attack":"\u5BB9\u59FF\u653B\u6483",discrimination:"\u5DEE\u5225\u8868\u73FE"});function C(t){return[...new Set(t||[])].map(e=>Y[e]||tt[e]||e)}var b=new Intl.Collator("ja",{sensitivity:"base",numeric:!0,ignorePunctuation:!0});function k(t){return[...t||[]].sort((e,n)=>{let s=j(e==null?void 0:e.status)-j(n==null?void 0:n.status);if(s)return s;let a=b.compare(String((e==null?void 0:e.title)||""),String((n==null?void 0:n.title)||""));return a||b.compare(String((e==null?void 0:e.id)||""),String((n==null?void 0:n.id)||""))})}function B(t,e=.58){let n=(t||[]).filter(at),s=new Map(n.map(a=>[String(a.id),[]]));for(let a=0;a<n.length;a+=1)for(let o=a+1;o<n.length;o+=1){let i=n[a],r=n[o],d=et(i,r);d<e||(s.get(String(i.id)).push(N(r,d)),s.get(String(r.id)).push(N(i,d)))}for(let a of s.values())a.sort((o,i)=>i.score-o.score||b.compare(o.title,i.title));return s}function et(t,e){let n=$(t==null?void 0:t.title),s=$(e==null?void 0:e.title);if(!n||!s)return 0;let a=n===s?1:st(n,s)?.9:M(n,s),o=nt(t==null?void 0:t.choices,e==null?void 0:e.choices);return h(t==null?void 0:t.choices).join("|")===h(e==null?void 0:e.choices).join("|")&&a>=.35?Math.max(.82,a):Q(a*.72+o*.28)}function nt(t,e){let n=h(t),s=h(e);if(n.length!==5||s.length!==5)return 0;let a=n.map(o=>Math.max(...s.map(i=>o===i?1:M(o,i))));return a.reduce((o,i)=>o+i,0)/a.length}function h(t){return Array.isArray(t)?t.map($).filter(Boolean):[]}function M(t,e){if(t===e)return 1;if(t.length<2||e.length<2)return 0;let n=O(t),s=O(e),a=0;for(let[o,i]of n)a+=Math.min(i,s.get(o)||0);return 2*a/(t.length-1+(e.length-1))}function O(t){let e=new Map;for(let n=0;n<t.length-1;n+=1){let s=t.slice(n,n+2);e.set(s,(e.get(s)||0)+1)}return e}function $(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").replace(/[、。・！？!?「」『』（）()【】［］\[\]\s"'’‘“”ー〜～….,/\\:：;；]/g,"")}function st(t,e){return Math.min(t.length,e.length)>=6&&(t.includes(e)||e.includes(t))}function N(t,e){return{id:String(t.id),title:String(t.title||""),choices:Array.isArray(t.choices)?t.choices.slice(0,5):[],score:Q(e)}}function Q(t){return Math.round(t*1e3)/1e3}function j(t){return t==="disabled"?1:0}function at(t){return t&&t.id&&t.title&&Array.isArray(t.choices)&&t.choices.length===5}var f=document.getElementById("adminToken"),v=document.getElementById("adminOtp"),w=document.getElementById("dashboard"),E=document.getElementById("authStatus"),ot=ut(),p=new Set,g={catalog:[],submissions:[]},l=[],S=new Map;sessionStorage.removeItem("live:admin-token");f.value="";document.getElementById("loadQuestions").addEventListener("click",y);document.getElementById("forgetSession").addEventListener("click",()=>{sessionStorage.removeItem("live:admin-session"),f.value="",v.value="",w.hidden=!0,m("\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u6D88\u3057\u307E\u3057\u305F\u3002")});document.getElementById("questionSearch").addEventListener("input",I);document.getElementById("questionFilter").addEventListener("change",I);document.getElementById("saveAllQuestions").addEventListener("click",lt);async function y(){try{(!sessionStorage.getItem("live:admin-session")||v.value.trim())&&await it(),g=await A("/api/questions/admin/overview"),l=k(pt(ot,g.catalog)),S=B([...l,...(g.submissions||[]).filter(t=>t.status==="pending")]),p.clear(),w.hidden=!1,rt(),I()}catch(t){w.hidden=!0,m(L(t),!0)}}async function it(){let t=await fetch("/api/live/admin/session",{method:"POST",headers:{"content-type":"application/json","x-live-admin-token":f.value.trim(),"x-live-admin-otp":v.value.trim()},body:"{}"}),e=await t.json().catch(()=>({}));if(!t.ok)throw V(e.error||"request-failed",t.status);sessionStorage.setItem("live:admin-session",e.sessionToken),f.value="",v.value="",m(`\u4E8C\u8981\u7D20\u8A8D\u8A3C\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u3002\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u6709\u52B9\u671F\u9650\uFF1A${Z(e.expiresAt)}`)}function rt(){let t=(g.submissions||[]).filter(n=>n.status==="pending"),e=document.getElementById("pendingSubmissions");e.innerHTML=t.length?`
    <div class="table-wrap pending-table">
      <table class="question-table">
        <thead><tr>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${_()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u5BE9\u67FB</th>
        </tr></thead>
        <tbody>${t.map(ct).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',e.querySelectorAll("[data-approve]").forEach(n=>n.addEventListener("click",()=>R(n.dataset.approve,"approved"))),e.querySelectorAll("[data-reject]").forEach(n=>n.addEventListener("click",()=>R(n.dataset.reject,"rejected"))),D(e)}function ct(t){let e=U(t.id);return`
    <tr data-submission="${c(t.id)}">
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${u(t.title)}</textarea>
        <div class="meta">
          <span class="pill warning">\u5BE9\u67FB\u5F85\u3061</span>
          <span class="pill">${t.sourceMode==="live-challenge"?"LIVE\u7248\u304B\u3089":"\u901A\u5E38\u7248\u304B\u3089"}</span>
          ${(t.safetyFlags||[]).length?`<span class="pill critical">\u91CD\u70B9\u5BE9\u67FB\uFF1A${u(C(t.safetyFlags).join("\u30FB"))}</span>`:""}
          <br>\u9001\u4FE1\uFF1A${Z(t.submittedAt)}
        </div>
        <input data-field="reviewNote" maxlength="300" placeholder="\u5BE9\u67FB\u30E1\u30E2\uFF08\u975E\u516C\u958B\uFF09">
      </td>
      ${z(t)}
      <td>${K(t.id,e)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact good" data-approve="${c(t.id)}">\u63A1\u7528</button>
          <button class="button compact danger" data-reject="${c(t.id)}">\u5374\u4E0B</button>
        </div>
      </td>
    </tr>
    ${P(t.id,t,e)}
  `}function I(){let t=q(document.getElementById("questionSearch").value),e=document.getElementById("questionFilter").value,n=l.filter(r=>{let d=q(`${r.id} ${r.title} ${(r.choices||[]).join(" ")}`),G=!t||d.includes(t),W=S.get(String(r.id))||[],X=e==="all"||e===r.status||e==="similar"&&W.length||e==="custom"&&r.sourceKind==="custom"&&r.status==="approved";return G&&X}),s=l.filter(r=>r.status!=="disabled").length,a=l.length-s,o=l.filter(r=>(S.get(String(r.id))||[]).length).length;document.getElementById("questionCount").textContent=`${n.length}\u554F\u3092\u8868\u793A\uFF08\u63A1\u7528${s}\u554F\uFF0F\u7121\u52B9\u5316${a}\u554F\uFF0F\u5168${l.length}\u554F\uFF09`,document.getElementById("similaritySummary").textContent=`\u985E\u4F3C\u5019\u88DC\uFF1A${o}\u554F`;let i=document.getElementById("allQuestions");i.innerHTML=n.length?`
    <div class="table-wrap">
      <table class="question-table">
        <thead><tr>
          <th class="status-col">\u63A1\u7528</th>
          <th class="status-col">\u7121\u52B9\u5316</th>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${_()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u4FDD\u5B58</th>
        </tr></thead>
        <tbody>${n.map(dt).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u6761\u4EF6\u306B\u4E00\u81F4\u3059\u308B\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',i.querySelectorAll("[data-save]").forEach(r=>r.addEventListener("click",()=>H(r.dataset.save))),i.querySelectorAll("input,textarea").forEach(r=>r.addEventListener("input",()=>F(r.closest("[data-catalog]")))),i.querySelectorAll("[data-status]").forEach(r=>r.addEventListener("change",()=>{let d=r.closest("[data-catalog]");d.dataset.statusRow=r.value,F(d)})),D(i),x()}function dt(t){let e=String(t.id),n=t.status==="disabled",s=U(e);return`
    <tr data-catalog="${c(e)}" data-status-row="${n?"disabled":"approved"}">
      <td class="status-col"><label class="status-choice"><input type="radio" name="status-${c(e)}" data-status value="approved" ${n?"":"checked"}><span>\u63A1\u7528</span></label></td>
      <td class="status-col"><label class="status-choice disabled"><input type="radio" name="status-${c(e)}" data-status value="disabled" ${n?"checked":""}><span>\u7121\u52B9</span></label></td>
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${u(t.title)}</textarea>
        <div class="meta">
          <span class="pill ${t.sourceKind==="custom"?"info":""}">${t.sourceKind==="custom"?"\u63A1\u7528\u3057\u305F\u81EA\u4F5C":"\u6A19\u6E96\u306E\u304A\u984C"}</span>
          <span class="pill">${u(e)}</span>
          ${t.reportCount?`<span class="pill critical">\u901A\u5831${t.reportCount}\u4EF6\u30FB\u5373\u6642\u975E\u516C\u958B</span>`:""}
        </div>
      </td>
      ${z(t)}
      <td>${K(e,s)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact" data-save="${c(e)}">\u3053\u306E\u884C\u3092\u4FDD\u5B58</button>
          <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
        </div>
      </td>
    </tr>
    ${P(e,t,s)}
  `}function _(){return[1,2,3,4,5].map(t=>`<th class="choice-col">\u9078\u629E\u80A2${t}</th>`).join("")}function z(t){return(t.choices||[]).slice(0,5).map((e,n)=>`
    <td><input class="sheet-input" data-choice="${n}" maxlength="60" value="${c(e)}"></td>
  `).join("")}function K(t,e){if(!e.length)return'<span class="meta">\u306A\u3057</span>';let n=e[0];return`
    <span class="pill similar">\u985E\u4F3C\u5019\u88DC ${Math.round(n.score*100)}%</span>
    <div class="meta">${u(n.title)}</div>
    <button class="button compact secondary" data-compare="${c(t)}">\u4E26\u3079\u3066\u6BD4\u8F03</button>
  `}function P(t,e,n){return n.length?`
    <tr class="compare-row" data-comparison="${c(t)}" hidden>
      <td colspan="10">
        <div class="comparison-grid">
          ${T("\u3053\u306E\u554F\u984C",e)}
          ${n.map((s,a)=>T(`\u985E\u4F3C\u5019\u88DC${a+1}\uFF08${Math.round(s.score*100)}%\uFF09`,s)).join("")}
        </div>
      </td>
    </tr>
  `:""}function T(t,e){return`
    <div class="comparison-card">
      <span class="pill similar">${t}</span>
      <strong>${u(e.title)}</strong>
      <ol>${(e.choices||[]).map(n=>`<li>${u(n)}</li>`).join("")}</ol>
    </div>
  `}function D(t){t.querySelectorAll("[data-compare]").forEach(e=>e.addEventListener("click",()=>{let n=t.querySelector(`[data-comparison="${CSS.escape(e.dataset.compare)}"]`);n&&(n.hidden=!n.hidden,e.textContent=n.hidden?"\u4E26\u3079\u3066\u6BD4\u8F03":"\u6BD4\u8F03\u3092\u9589\u3058\u308B")}))}function U(t){return(S.get(String(t))||[]).slice(0,3)}async function R(t,e){let n=document.querySelector(`[data-submission="${CSS.escape(t)}"]`);if(n&&!(e==="rejected"&&!confirm("\u3053\u306E\u63B2\u8F09\u5019\u88DC\u3092\u5374\u4E0B\u3057\u307E\u3059\u304B\uFF1F"))&&!(e==="approved"&&!confirm("\u7DE8\u96C6\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3001\u901A\u5E38\u7248\u30FBLIVE\u7248\u306E\u5171\u901A\u304A\u984C\u3068\u3057\u3066\u63A1\u7528\u3057\u307E\u3059\u304B\uFF1F")))try{let s=e==="approved"?J(n):{decision:e,reviewNote:n.querySelector('[data-field="reviewNote"]').value.trim()};s.decision=e,await A(`/api/questions/admin/submissions/${t}/review`,{method:"POST",body:JSON.stringify(s)}),await y()}catch(s){alert(L(s))}}async function H(t,{reload:e=!0}={}){var o;let n=document.querySelector(`[data-catalog="${CSS.escape(t)}"]`),s=l.find(i=>String(i.id)===String(t));if(!n||!s)return;let a={...J(n),sourceKind:s.sourceKind,sourceRef:s.sourceRef||s.id,status:((o=n.querySelector("[data-status]:checked"))==null?void 0:o.value)==="disabled"?"disabled":"approved"};await A(`/api/questions/admin/catalog/${encodeURIComponent(t)}`,{method:"PUT",body:JSON.stringify(a)}),p.delete(String(t)),e&&(m(`\u300C${a.title}\u300D\u3092${a.status==="approved"?"\u63A1\u7528":"\u7121\u52B9\u5316"}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await y())}async function lt(){let t=[...p];if(!t.length)return;let e=document.getElementById("saveAllQuestions");e.disabled=!0,e.textContent=`\u4FDD\u5B58\u4E2D 0/${t.length}`;try{for(let n=0;n<t.length;n+=1)await H(t[n],{reload:!1}),e.textContent=`\u4FDD\u5B58\u4E2D ${n+1}/${t.length}`;m(`${t.length}\u554F\u306E\u5909\u66F4\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await y()}catch(n){m(L(n),!0),x()}}function J(t){var e;return{title:t.querySelector('[data-field="title"]').value.trim(),choices:Array.from(t.querySelectorAll("[data-choice]")).map(n=>n.value.trim()),category:"\u307F\u3093\u306A\u306E\u304A\u984C",reviewNote:((e=t.querySelector('[data-field="reviewNote"]'))==null?void 0:e.value.trim())||""}}function F(t){t&&(p.add(String(t.dataset.catalog)),t.classList.add("dirty"),x())}function x(){let t=document.getElementById("saveAllQuestions");t.disabled=p.size===0,t.textContent=p.size?`\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58\uFF08${p.size}\u554F\uFF09`:"\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58"}function ut(){let t=[...window.COMMON_QUESTION_CARDS||[]],e=new Set;return t.flatMap(n=>{let s=String(n.id);return!s||e.has(s)?[]:(e.add(s),[{...n,id:s,category:"\u307F\u3093\u306A\u306E\u304A\u984C",sourceKind:"static",sourceRef:s,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C",status:"approved"}])})}function pt(t,e){let n=new Map((e||[]).map(o=>[String(o.id),o])),s=t.map(o=>{let i=n.get(String(o.id));return i?{...o,...i,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C"}:o}),a=new Set(t.map(o=>String(o.id)));for(let o of e||[])a.has(String(o.id))||s.push({...o,sourceLabel:"\u63A1\u7528\u3057\u305F\u81EA\u4F5C"});return s}async function A(t,e={}){let n=sessionStorage.getItem("live:admin-session")||"",s=new Headers(e.headers||{});s.set("x-live-admin-session",n),e.body&&s.set("content-type","application/json");let a=await fetch(t,{...e,headers:s,cache:"no-store"}),o=await a.json().catch(()=>({}));if(!a.ok)throw V(o.error||"request-failed",a.status);return o}function m(t,e=!1){E.hidden=!1,E.textContent=t,E.classList.toggle("error",e)}function L(t){return{"admin-forbidden":"\u7BA1\u7406\u30C8\u30FC\u30AF\u30F3\u304C\u9055\u3044\u307E\u3059\u3002","admin-otp-invalid":"6\u6841\u306E\u8A8D\u8A3C\u30B3\u30FC\u30C9\u304C\u9055\u3046\u304B\u3001\u6709\u52B9\u6642\u9593\u3092\u904E\u304E\u3066\u3044\u307E\u3059\u3002","admin-session-required":"\u7BA1\u7406\u8005\u8A8D\u8A3C\u3092\u884C\u3063\u3066\u304F\u3060\u3055\u3044\u3002","admin-session-expired":"15\u5206\u306E\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u5207\u308C\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u8A8D\u8A3C\u3057\u3066\u304F\u3060\u3055\u3044\u3002","admin-2fa-not-configured":"\u672C\u756A\u306E\u7BA1\u7406\u8005\u4E8C\u8981\u7D20\u8A8D\u8A3C\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002","question-invalid":"\u554F\u984C\u6587\u30685\u3064\u306E\u9078\u629E\u80A2\u3092\u3059\u3079\u3066\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002","question-personal-information-detected":"\u672C\u540D\u30FB\u5B66\u6821\u540D\u30FBSNS ID\u30FB\u96FB\u8A71\u756A\u53F7\u30FB\u4F4F\u6240\u3089\u3057\u3044\u5185\u5BB9\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002","submission-already-reviewed":"\u3053\u306E\u304A\u984C\u306F\u3059\u3067\u306B\u5BE9\u67FB\u6E08\u307F\u3067\u3059\u3002"}[t==null?void 0:t.message]||"\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u5165\u529B\u3068\u901A\u4FE1\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}function V(t,e){let n=new Error(t);return n.status=e,n}function q(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").trim()}function Z(t){return t?new Date(Number(t)).toLocaleString("ja-JP"):"\u672A\u8A2D\u5B9A"}function u(t){return String(t!=null?t:"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e])}function c(t){return u(t)}})();
