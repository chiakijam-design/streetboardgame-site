(()=>{var at=Object.freeze({"real-name":"\u672C\u540D\u30FB\u6C0F\u540D","school-name":"\u5B66\u6821\u540D","sns-id":"SNS ID","phone-number":"\u96FB\u8A71\u756A\u53F7",address:"\u4F4F\u6240"}),nt=Object.freeze({"sexual-content":"\u6027\u7684\u5185\u5BB9",bullying:"\u3044\u3058\u3081","appearance-attack":"\u5BB9\u59FF\u653B\u6483",discrimination:"\u5DEE\u5225\u8868\u73FE"});function O(t){return[...new Set(t||[])].map(e=>at[e]||nt[e]||e)}var w=new Intl.Collator("ja",{sensitivity:"base",numeric:!0,ignorePunctuation:!0});function B(t){return[...t||[]].sort((e,a)=>{let n=j(e==null?void 0:e.status)-j(a==null?void 0:a.status);if(n)return n;let o=w.compare(String((e==null?void 0:e.title)||""),String((a==null?void 0:a.title)||""));return o||w.compare(String((e==null?void 0:e.id)||""),String((a==null?void 0:a.id)||""))})}function Q(t,e=.58){let a=(t||[]).filter(it),n=a.filter(dt),o=new Map(a.map(s=>[String(s.id),[]]));for(let s of a)for(let c of n){if(String(s.id)===String(c.id))continue;let r=st(s,c);r<e||o.get(String(s.id)).push(ct(c,r))}for(let s of o.values())s.sort((c,r)=>r.score-c.score||w.compare(c.title,r.title));return o}function st(t,e){let a=C(t==null?void 0:t.title),n=C(e==null?void 0:e.title);if(!a||!n)return 0;let o=a===n?1:rt(a,n)?.9:T(a,n),s=ot(t==null?void 0:t.choices,e==null?void 0:e.choices);return h(t==null?void 0:t.choices).join("|")===h(e==null?void 0:e.choices).join("|")&&o>=.35?Math.max(.82,o):M(o*.72+s*.28)}function ot(t,e){let a=h(t),n=h(e);if(a.length!==5||n.length!==5)return 0;let o=a.map(s=>Math.max(...n.map(c=>s===c?1:T(s,c))));return o.reduce((s,c)=>s+c,0)/o.length}function h(t){return Array.isArray(t)?t.map(C).filter(Boolean):[]}function T(t,e){if(t===e)return 1;if(t.length<2||e.length<2)return 0;let a=R(t),n=R(e),o=0;for(let[s,c]of a)o+=Math.min(c,n.get(s)||0);return 2*o/(t.length-1+(e.length-1))}function R(t){let e=new Map;for(let a=0;a<t.length-1;a+=1){let n=t.slice(a,a+2);e.set(n,(e.get(n)||0)+1)}return e}function C(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").replace(/[、。・！？!?「」『』（）()【】［］\[\]\s"'’‘“”ー〜～….,/\\:：;；]/g,"")}function rt(t,e){return Math.min(t.length,e.length)>=6&&(t.includes(e)||e.includes(t))}function ct(t,e){return{id:String(t.id),title:String(t.title||""),choices:Array.isArray(t.choices)?t.choices.slice(0,5):[],score:M(e)}}function M(t){return Math.round(t*1e3)/1e3}function j(t){return t==="disabled"?1:0}function it(t){return t&&t.id&&t.title&&Array.isArray(t.choices)&&t.choices.length===5}function dt(t){return(t==null?void 0:t.status)==="approved"||!(t!=null&&t.status)}var lt=["\u72B6\u614B","\u554F\u984CID","\u554F\u984C\u6587","\u9078\u629E\u80A21","\u9078\u629E\u80A22","\u9078\u629E\u80A23","\u9078\u629E\u80A24","\u9078\u629E\u80A25","\u30AB\u30C6\u30B4\u30EA","\u8A00\u8A9E","\u4F5C\u6210\u5143","\u5143\u30C7\u30FC\u30BFID","\u901A\u5E38\u7248","LIVE\u7248","\u901A\u5831\u4EF6\u6570","\u6700\u7D42\u901A\u5831\u65E5\u6642","\u4F5C\u6210\u65E5\u6642","\u66F4\u65B0\u65E5\u6642"];function ut(t){let e=(t||[]).map(mt);return`\uFEFF${[lt,...e].map(ft).join(`\r
`)}\r
`}function pt(t=new Date){let e=[t.getFullYear(),g(t.getMonth()+1),g(t.getDate())],a=`${g(t.getHours())}${g(t.getMinutes())}`;return`streetboardgame-questions-${e.join("-")}_${a}.csv`}function F(t,e={}){let a=e.documentRef||globalThis.document,n=e.urlRef||globalThis.URL;if(!a||!(n!=null&&n.createObjectURL))throw new Error("question-backup-download-unavailable");let o=ut(t),s=new Blob([o],{type:"text/csv;charset=utf-8"}),c=n.createObjectURL(s),r=a.createElement("a");return r.href=c,r.download=pt(e.date||new Date),r.hidden=!0,a.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>n.revokeObjectURL(c),0),{count:(t||[]).length,filename:r.download}}function mt(t){let e=Array.from({length:5},(n,o)=>{var s;return((s=t==null?void 0:t.choices)==null?void 0:s[o])||""}),a=(t==null?void 0:t.status)!=="disabled";return[a?"\u63A1\u7528":"\u7121\u52B9\u5316",(t==null?void 0:t.id)||"",(t==null?void 0:t.title)||"",...e,(t==null?void 0:t.category)||"\u307F\u3093\u306A\u306E\u304A\u984C",(t==null?void 0:t.language)==="en"||String((t==null?void 0:t.id)||"").startsWith("CUSEN")?"\u82F1\u8A9E":"\u65E5\u672C\u8A9E",(t==null?void 0:t.sourceKind)==="custom"?"\u63A1\u7528\u3057\u305F\u81EA\u4F5C":"\u6A19\u6E96\u306E\u304A\u984C",(t==null?void 0:t.sourceRef)||"",a?"\u4F7F\u7528":"\u505C\u6B62",a?"\u4F7F\u7528":"\u505C\u6B62",Number((t==null?void 0:t.reportCount)||0),x(t==null?void 0:t.lastReportedAt),x(t==null?void 0:t.createdAt),x(t==null?void 0:t.updatedAt)]}function ft(t){return t.map(ht).join(",")}function ht(t){let e=String(t!=null?t:""),a=/^\s*[=+\-@]/.test(e)?`'${e}`:e;return/[",\r\n]/.test(a)?`"${a.replaceAll('"','""')}"`:a}function x(t){if(t==null||t==="")return"";let e=new Date(Number(t));return Number.isNaN(e.getTime())?"":e.toISOString()}function g(t){return String(t).padStart(2,"0")}var S=document.getElementById("adminToken"),b=document.getElementById("adminOtp"),A=document.getElementById("dashboard"),I=document.getElementById("authStatus"),gt=xt(),p=new Set,v={catalog:[],submissions:[]},d=[],y=new Map;sessionStorage.removeItem("live:admin-token");S.value="";document.getElementById("loadQuestions").addEventListener("click",m);document.getElementById("forgetSession").addEventListener("click",()=>{sessionStorage.removeItem("live:admin-session"),S.value="",b.value="",A.hidden=!0,l("\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u6D88\u3057\u307E\u3057\u305F\u3002")});document.getElementById("questionSearch").addEventListener("input",L);document.getElementById("questionFilter").addEventListener("change",L);document.getElementById("saveAllQuestions").addEventListener("click",wt);document.getElementById("exportQuestionsCsv").addEventListener("click",Ct);async function m(){try{(!sessionStorage.getItem("live:admin-session")||b.value.trim())&&await vt(),v=await $("/api/questions/admin/overview"),d=B(It(gt,v.catalog)),y=Q([...d,...(v.submissions||[]).filter(t=>t.status==="pending")]),p.clear(),A.hidden=!1,St(),L()}catch(t){A.hidden=!0,l(E(t),!0)}}async function vt(){let t=await fetch("/api/live/admin/session",{method:"POST",headers:{"content-type":"application/json","x-live-admin-token":S.value.trim(),"x-live-admin-otp":b.value.trim()},body:"{}"}),e=await t.json().catch(()=>({}));if(!t.ok)throw Y(e.error||"request-failed",t.status);sessionStorage.setItem("live:admin-session",e.sessionToken),S.value="",b.value="",l(`\u4E8C\u8981\u7D20\u8A8D\u8A3C\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u3002\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u6709\u52B9\u671F\u9650\uFF1A${X(e.expiresAt)}`)}function St(){let t=(v.submissions||[]).filter(a=>a.status==="pending"),e=document.getElementById("pendingSubmissions");e.innerHTML=t.length?`
    <div class="table-wrap pending-table">
      <table class="question-table">
        <thead><tr>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${K()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u5BE9\u67FB</th>
        </tr></thead>
        <tbody>${t.map(bt).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',e.querySelectorAll("[data-approve]").forEach(a=>a.addEventListener("click",()=>U(a.dataset.approve,"approved"))),e.querySelectorAll("[data-reject]").forEach(a=>a.addEventListener("click",()=>U(a.dataset.reject,"rejected"))),J(e),Z(e)}function bt(t){let e=G(t.id);return`
    <tr data-submission="${i(t.id)}">
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${u(t.title)}</textarea>
        <div class="meta">
          <span class="pill warning">\u5BE9\u67FB\u5F85\u3061</span>
          <span class="pill">${t.sourceMode==="live-challenge"?"LIVE\u7248\u304B\u3089":"\u901A\u5E38\u7248\u304B\u3089"}</span>
          ${(t.safetyFlags||[]).length?`<span class="pill critical">\u91CD\u70B9\u5BE9\u67FB\uFF1A${u(O(t.safetyFlags).join("\u30FB"))}</span>`:""}
          <br>\u9001\u4FE1\uFF1A${X(t.submittedAt)}
        </div>
        <input data-field="reviewNote" maxlength="300" placeholder="\u5BE9\u67FB\u30E1\u30E2\uFF08\u975E\u516C\u958B\uFF09">
      </td>
      ${P(t)}
      <td>${H(t.id,e)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact good" data-approve="${i(t.id)}">\u63A1\u7528</button>
          <button class="button compact danger" data-reject="${i(t.id)}">\u5374\u4E0B</button>
        </div>
      </td>
    </tr>
    ${V(t.id,t,e)}
  `}function L(){let t=z(document.getElementById("questionSearch").value),e=document.getElementById("questionFilter").value,a=d.filter(r=>{let f=z(`${r.id} ${r.title} ${(r.choices||[]).join(" ")}`),q=!t||f.includes(t),tt=y.get(String(r.id))||[],et=e==="all"||e===r.status||e==="similar"&&tt.length||e==="custom"&&r.sourceKind==="custom"&&r.status==="approved";return q&&et}),n=d.filter(r=>r.status!=="disabled").length,o=d.length-n,s=d.filter(r=>(y.get(String(r.id))||[]).length).length;document.getElementById("questionCount").textContent=`${a.length}\u554F\u3092\u8868\u793A\uFF08\u63A1\u7528${n}\u554F\uFF0F\u7121\u52B9\u5316${o}\u554F\uFF0F\u5168${d.length}\u554F\uFF09`,document.getElementById("similaritySummary").textContent=`\u985E\u4F3C\u5019\u88DC\uFF1A${s}\u554F`;let c=document.getElementById("allQuestions");c.innerHTML=a.length?`
    <div class="table-wrap">
      <table class="question-table">
        <thead><tr>
          <th class="status-col">\u63A1\u7528</th>
          <th class="status-col">\u7121\u52B9\u5316</th>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${K()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u4FDD\u5B58</th>
        </tr></thead>
        <tbody>${a.map(yt).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u6761\u4EF6\u306B\u4E00\u81F4\u3059\u308B\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',c.querySelectorAll("[data-save]").forEach(r=>r.addEventListener("click",()=>W(r.dataset.save))),c.querySelectorAll("input,textarea").forEach(r=>r.addEventListener("input",()=>D(r.closest("[data-catalog]")))),c.querySelectorAll("[data-status]").forEach(r=>r.addEventListener("change",()=>{let f=r.closest("[data-catalog]");f.dataset.statusRow=r.value,D(f)})),J(c),Z(c),N()}function yt(t){let e=String(t.id),a=t.status==="disabled",n=G(e);return`
    <tr data-catalog="${i(e)}" data-status-row="${a?"disabled":"approved"}">
      <td class="status-col"><label class="status-choice"><input type="radio" name="status-${i(e)}" data-status value="approved" ${a?"":"checked"}><span>\u63A1\u7528</span></label></td>
      <td class="status-col"><label class="status-choice disabled"><input type="radio" name="status-${i(e)}" data-status value="disabled" ${a?"checked":""}><span>\u7121\u52B9</span></label></td>
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${u(t.title)}</textarea>
        <div class="meta">
          <span class="pill ${t.sourceKind==="custom"?"info":""}">${t.sourceKind==="custom"?"\u63A1\u7528\u3057\u305F\u81EA\u4F5C":"\u6A19\u6E96\u306E\u304A\u984C"}</span>
          <span class="pill">${u(e)}</span>
          ${t.reportCount?`<span class="pill critical">\u901A\u5831${t.reportCount}\u4EF6\u30FB\u5373\u6642\u975E\u516C\u958B</span>`:""}
        </div>
      </td>
      ${P(t)}
      <td>${H(e,n)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact" data-save="${i(e)}">\u3053\u306E\u884C\u3092\u4FDD\u5B58</button>
          <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
        </div>
      </td>
    </tr>
    ${V(e,t,n)}
  `}function K(){return[1,2,3,4,5].map(t=>`<th class="choice-col">\u9078\u629E\u80A2${t}</th>`).join("")}function P(t){return(t.choices||[]).slice(0,5).map((e,a)=>`
    <td><input class="sheet-input" data-choice="${a}" maxlength="60" value="${i(e)}"></td>
  `).join("")}function H(t,e){if(!e.length)return'<span class="meta">\u306A\u3057</span>';let a=e[0];return`
    <span class="pill similar">\u985E\u4F3C\u5019\u88DC ${Math.round(a.score*100)}%</span>
    <div class="meta">${u(a.title)}</div>
    <button class="button compact secondary" data-compare="${i(t)}">\u4E26\u3079\u3066\u6BD4\u8F03</button>
  `}function V(t,e,a){return a.length?`
    <tr class="compare-row" data-comparison="${i(t)}" hidden>
      <td colspan="10">
        <div class="comparison-grid">
          ${_("\u3053\u306E\u554F\u984C",e,t)}
          ${a.map((n,o)=>_(`\u985E\u4F3C\u5019\u88DC${o+1}\uFF08${Math.round(n.score*100)}%\uFF09`,n,t)).join("")}
        </div>
      </td>
    </tr>
  `:""}function _(t,e,a){let n=d.find(c=>String(c.id)===String(e.id));if(!n)return $t(t,e);let o=n.status==="disabled",s=`compare-status-${a}-${n.id}`;return`
    <div class="comparison-card" data-compare-catalog="${i(n.id)}" data-status-row="${o?"disabled":"approved"}">
      <div class="comparison-card-head">
        <span class="pill similar">${t}</span>
        <span class="pill">${u(n.id)}</span>
      </div>
      <div class="comparison-status" role="group" aria-label="${i(n.title)}\u306E\u63B2\u8F09\u72B6\u614B">
        <label class="status-choice"><input type="radio" name="${i(s)}" data-compare-status value="approved" ${o?"":"checked"}><span>\u63A1\u7528</span></label>
        <label class="status-choice disabled"><input type="radio" name="${i(s)}" data-compare-status value="disabled" ${o?"checked":""}><span>\u7121\u52B9</span></label>
      </div>
      <label class="comparison-field">
        <span>\u554F\u984C\u6587</span>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${u(n.title)}</textarea>
      </label>
      <div class="comparison-choices">
        ${(n.choices||[]).slice(0,5).map((c,r)=>`
          <label class="comparison-field">
            <span>\u9078\u629E\u80A2${r+1}</span>
            <input class="sheet-input" data-choice="${r}" maxlength="60" value="${i(c)}">
          </label>
        `).join("")}
      </div>
      <div class="comparison-actions">
        <button class="button compact" data-compare-save="${i(n.id)}">\u3053\u306E\u554F\u984C\u3092\u4FDD\u5B58</button>
        <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
      </div>
    </div>
  `}function $t(t,e){return`
    <div class="comparison-card comparison-card-readonly">
      <span class="pill similar">${t}</span>
      <strong>${u(e.title)}</strong>
      <ol>${(e.choices||[]).map(a=>`<li>${u(a)}</li>`).join("")}</ol>
      <span class="meta">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u4E0A\u306E\u5BE9\u67FB\u6B04\u3067\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002</span>
    </div>
  `}function J(t){t.querySelectorAll("[data-compare]").forEach(e=>e.addEventListener("click",()=>{let a=t.querySelector(`[data-comparison="${CSS.escape(e.dataset.compare)}"]`);a&&(a.hidden=!a.hidden,e.textContent=a.hidden?"\u4E26\u3079\u3066\u6BD4\u8F03":"\u6BD4\u8F03\u3092\u9589\u3058\u308B")}))}function Z(t){t.querySelectorAll("[data-compare-catalog]").forEach(e=>{e.querySelectorAll("input,textarea").forEach(a=>a.addEventListener("input",()=>{e.classList.add("dirty")})),e.querySelectorAll("[data-compare-status]").forEach(a=>a.addEventListener("change",()=>{e.dataset.statusRow=a.value,e.classList.add("dirty")}))}),t.querySelectorAll("[data-compare-save]").forEach(e=>e.addEventListener("click",()=>{Et(e.closest("[data-compare-catalog]"))}))}function G(t){return(y.get(String(t))||[]).slice(0,3)}async function U(t,e){let a=document.querySelector(`[data-submission="${CSS.escape(t)}"]`);if(a&&!(e==="rejected"&&!confirm("\u3053\u306E\u63B2\u8F09\u5019\u88DC\u3092\u5374\u4E0B\u3057\u307E\u3059\u304B\uFF1F"))&&!(e==="approved"&&!confirm("\u7DE8\u96C6\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3001\u901A\u5E38\u7248\u30FBLIVE\u7248\u306E\u5171\u901A\u304A\u984C\u3068\u3057\u3066\u63A1\u7528\u3057\u307E\u3059\u304B\uFF1F")))try{let n=e==="approved"?k(a):{decision:e,reviewNote:a.querySelector('[data-field="reviewNote"]').value.trim()};n.decision=e,await $(`/api/questions/admin/submissions/${t}/review`,{method:"POST",body:JSON.stringify(n)}),await m()}catch(n){alert(E(n))}}async function W(t,{reload:e=!0}={}){var s;let a=document.querySelector(`[data-catalog="${CSS.escape(t)}"]`),n=d.find(c=>String(c.id)===String(t));if(!a||!n)return;let o={...k(a),sourceKind:n.sourceKind,sourceRef:n.sourceRef||n.id,status:((s=a.querySelector("[data-status]:checked"))==null?void 0:s.value)==="disabled"?"disabled":"approved"};await $(`/api/questions/admin/catalog/${encodeURIComponent(t)}`,{method:"PUT",body:JSON.stringify(o)}),p.delete(String(t)),e&&(l(`\u300C${o.title}\u300D\u3092${o.status==="approved"?"\u63A1\u7528":"\u7121\u52B9\u5316"}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await m())}async function Et(t){var s;if(!t)return;let e=String(t.dataset.compareCatalog||""),a=d.find(c=>String(c.id)===e);if(!a)return;let n=t.querySelector("[data-compare-save]"),o={...k(t),sourceKind:a.sourceKind,sourceRef:a.sourceRef||a.id,status:((s=t.querySelector("[data-compare-status]:checked"))==null?void 0:s.value)==="disabled"?"disabled":"approved"};n.disabled=!0,n.textContent="\u4FDD\u5B58\u4E2D";try{await $(`/api/questions/admin/catalog/${encodeURIComponent(e)}`,{method:"PUT",body:JSON.stringify(o)}),l(`\u6BD4\u8F03\u6B04\u306E\u300C${o.title}\u300D\u3092${o.status==="approved"?"\u63A1\u7528":"\u7121\u52B9\u5316"}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await m()}catch(c){n.disabled=!1,n.textContent="\u3053\u306E\u554F\u984C\u3092\u4FDD\u5B58",l(E(c),!0)}}async function wt(){let t=[...p];if(!t.length)return;let e=document.getElementById("saveAllQuestions");e.disabled=!0,e.textContent=`\u4FDD\u5B58\u4E2D 0/${t.length}`;try{for(let a=0;a<t.length;a+=1)await W(t[a],{reload:!1}),e.textContent=`\u4FDD\u5B58\u4E2D ${a+1}/${t.length}`;l(`${t.length}\u554F\u306E\u5909\u66F4\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await m()}catch(a){l(E(a),!0),N()}}function Ct(){if(d.length&&!(p.size&&!confirm("\u672A\u4FDD\u5B58\u306E\u5909\u66F4\u306F\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306B\u542B\u307E\u308C\u307E\u305B\u3093\u3002\u4FDD\u5B58\u6E08\u307F\u306E\u5185\u5BB9\u3067\u7D9A\u3051\u307E\u3059\u304B\uFF1F")))try{let t=F(d);l(`\u63A1\u7528\u30FB\u7121\u52B9\u5316\u3092\u542B\u3080\u5168${t.count}\u554F\u3092\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u7528CSV\u306B\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`)}catch(t){l("CSV\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30D6\u30E9\u30A6\u30B6\u306E\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",!0)}}function k(t){var e;return{title:t.querySelector('[data-field="title"]').value.trim(),choices:Array.from(t.querySelectorAll("[data-choice]")).map(a=>a.value.trim()),category:"\u307F\u3093\u306A\u306E\u304A\u984C",reviewNote:((e=t.querySelector('[data-field="reviewNote"]'))==null?void 0:e.value.trim())||""}}function D(t){t&&(p.add(String(t.dataset.catalog)),t.classList.add("dirty"),N())}function N(){let t=document.getElementById("saveAllQuestions");t.disabled=p.size===0,t.textContent=p.size?`\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58\uFF08${p.size}\u554F\uFF09`:"\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58"}function xt(){let t=[...window.COMMON_QUESTION_CARDS||[]],e=new Set;return t.flatMap(a=>{let n=String(a.id);return!n||e.has(n)?[]:(e.add(n),[{...a,id:n,category:"\u307F\u3093\u306A\u306E\u304A\u984C",sourceKind:"static",sourceRef:n,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C",status:"approved"}])})}function It(t,e){let a=new Map((e||[]).map(s=>[String(s.id),s])),n=t.map(s=>{let c=a.get(String(s.id));return c?{...s,...c,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C"}:s}),o=new Set(t.map(s=>String(s.id)));for(let s of e||[])o.has(String(s.id))||n.push({...s,sourceLabel:"\u63A1\u7528\u3057\u305F\u81EA\u4F5C"});return n}async function $(t,e={}){let a=sessionStorage.getItem("live:admin-session")||"",n=new Headers(e.headers||{});n.set("x-live-admin-session",a),e.body&&n.set("content-type","application/json");let o=await fetch(t,{...e,headers:n,cache:"no-store"}),s=await o.json().catch(()=>({}));if(!o.ok)throw Y(s.error||"request-failed",o.status);return s}function l(t,e=!1){I.hidden=!1,I.textContent=t,I.classList.toggle("error",e)}function E(t){return{"admin-forbidden":"\u7BA1\u7406\u30C8\u30FC\u30AF\u30F3\u304C\u9055\u3044\u307E\u3059\u3002","admin-otp-invalid":"6\u6841\u306E\u8A8D\u8A3C\u30B3\u30FC\u30C9\u304C\u9055\u3046\u304B\u3001\u6709\u52B9\u6642\u9593\u3092\u904E\u304E\u3066\u3044\u307E\u3059\u3002","admin-session-required":"\u7BA1\u7406\u8005\u8A8D\u8A3C\u3092\u884C\u3063\u3066\u304F\u3060\u3055\u3044\u3002","admin-session-expired":"15\u5206\u306E\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u5207\u308C\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u8A8D\u8A3C\u3057\u3066\u304F\u3060\u3055\u3044\u3002","admin-2fa-not-configured":"\u672C\u756A\u306E\u7BA1\u7406\u8005\u4E8C\u8981\u7D20\u8A8D\u8A3C\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002","question-invalid":"\u554F\u984C\u6587\u30685\u3064\u306E\u9078\u629E\u80A2\u3092\u3059\u3079\u3066\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002","question-personal-information-detected":"\u672C\u540D\u30FB\u5B66\u6821\u540D\u30FBSNS ID\u30FB\u96FB\u8A71\u756A\u53F7\u30FB\u4F4F\u6240\u3089\u3057\u3044\u5185\u5BB9\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002","submission-already-reviewed":"\u3053\u306E\u304A\u984C\u306F\u3059\u3067\u306B\u5BE9\u67FB\u6E08\u307F\u3067\u3059\u3002"}[t==null?void 0:t.message]||"\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u5165\u529B\u3068\u901A\u4FE1\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}function Y(t,e){let a=new Error(t);return a.status=e,a}function z(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").trim()}function X(t){return t?new Date(Number(t)).toLocaleString("ja-JP"):"\u672A\u8A2D\u5B9A"}function u(t){return String(t!=null?t:"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e])}function i(t){return u(t)}})();
