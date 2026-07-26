(()=>{var nt=Object.freeze({"real-name":"\u672C\u540D\u30FB\u6C0F\u540D","school-name":"\u5B66\u6821\u540D","sns-id":"SNS ID","phone-number":"\u96FB\u8A71\u756A\u53F7",address:"\u4F4F\u6240"}),st=Object.freeze({"sexual-content":"\u6027\u7684\u5185\u5BB9",bullying:"\u3044\u3058\u3081","appearance-attack":"\u5BB9\u59FF\u653B\u6483",discrimination:"\u5DEE\u5225\u8868\u73FE"});function O(t){return[...new Set(t||[])].map(e=>nt[e]||st[e]||e)}var w=new Intl.Collator("ja",{sensitivity:"base",numeric:!0,ignorePunctuation:!0});function Q(t){return[...t||[]].sort((e,a)=>{let n=B(e==null?void 0:e.status)-B(a==null?void 0:a.status);if(n)return n;let s=w.compare(String((e==null?void 0:e.title)||""),String((a==null?void 0:a.title)||""));return s||w.compare(String((e==null?void 0:e.id)||""),String((a==null?void 0:a.id)||""))})}function T(t,e=.58){let a=(t||[]).filter(s=>it(s)&&s.status!=="disabled"),n=new Map(a.map(s=>[String(s.id),[]]));for(let s=0;s<a.length;s+=1)for(let o=s+1;o<a.length;o+=1){let r=a[s],c=a[o],p=ot(r,c);p<e||(n.get(String(r.id)).push(j(c,p)),n.get(String(c.id)).push(j(r,p)))}for(let s of n.values())s.sort((o,r)=>r.score-o.score||w.compare(o.title,r.title));return n}function ot(t,e){let a=x(t==null?void 0:t.title),n=x(e==null?void 0:e.title);if(!a||!n)return 0;let s=a===n?1:ct(a,n)?.9:M(a,n),o=rt(t==null?void 0:t.choices,e==null?void 0:e.choices);return g(t==null?void 0:t.choices).join("|")===g(e==null?void 0:e.choices).join("|")&&s>=.35?Math.max(.82,s):F(s*.72+o*.28)}function rt(t,e){let a=g(t),n=g(e);if(a.length!==5||n.length!==5)return 0;let s=a.map(o=>Math.max(...n.map(r=>o===r?1:M(o,r))));return s.reduce((o,r)=>o+r,0)/s.length}function g(t){return Array.isArray(t)?t.map(x).filter(Boolean):[]}function M(t,e){if(t===e)return 1;if(t.length<2||e.length<2)return 0;let a=R(t),n=R(e),s=0;for(let[o,r]of a)s+=Math.min(r,n.get(o)||0);return 2*s/(t.length-1+(e.length-1))}function R(t){let e=new Map;for(let a=0;a<t.length-1;a+=1){let n=t.slice(a,a+2);e.set(n,(e.get(n)||0)+1)}return e}function x(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").replace(/[、。・！？!?「」『』（）()【】［］\[\]\s"'’‘“”ー〜～….,/\\:：;；]/g,"")}function ct(t,e){return Math.min(t.length,e.length)>=6&&(t.includes(e)||e.includes(t))}function j(t,e){return{id:String(t.id),title:String(t.title||""),choices:Array.isArray(t.choices)?t.choices.slice(0,5):[],score:F(e)}}function F(t){return Math.round(t*1e3)/1e3}function B(t){return t==="disabled"?1:0}function it(t){return t&&t.id&&t.title&&Array.isArray(t.choices)&&t.choices.length===5}var dt=["\u72B6\u614B","\u554F\u984CID","\u554F\u984C\u6587","\u9078\u629E\u80A21","\u9078\u629E\u80A22","\u9078\u629E\u80A23","\u9078\u629E\u80A24","\u9078\u629E\u80A25","\u30AB\u30C6\u30B4\u30EA","\u8A00\u8A9E","\u4F5C\u6210\u5143","\u5143\u30C7\u30FC\u30BFID","\u901A\u5E38\u7248","LIVE\u7248","\u901A\u5831\u4EF6\u6570","\u6700\u7D42\u901A\u5831\u65E5\u6642","\u4F5C\u6210\u65E5\u6642","\u66F4\u65B0\u65E5\u6642"];function lt(t){let e=(t||[]).map(pt);return`\uFEFF${[dt,...e].map(mt).join(`\r
`)}\r
`}function ut(t=new Date){let e=[t.getFullYear(),f(t.getMonth()+1),f(t.getDate())],a=`${f(t.getHours())}${f(t.getMinutes())}`;return`streetboardgame-questions-${e.join("-")}_${a}.csv`}function _(t,e={}){let a=e.documentRef||globalThis.document,n=e.urlRef||globalThis.URL;if(!a||!(n!=null&&n.createObjectURL))throw new Error("question-backup-download-unavailable");let s=lt(t),o=new Blob([s],{type:"text/csv;charset=utf-8"}),r=n.createObjectURL(o),c=a.createElement("a");return c.href=r,c.download=ut(e.date||new Date),c.hidden=!0,a.body.appendChild(c),c.click(),c.remove(),setTimeout(()=>n.revokeObjectURL(r),0),{count:(t||[]).length,filename:c.download}}function pt(t){let e=Array.from({length:5},(n,s)=>{var o;return((o=t==null?void 0:t.choices)==null?void 0:o[s])||""}),a=(t==null?void 0:t.status)!=="disabled";return[a?"\u63A1\u7528":"\u7121\u52B9\u5316",(t==null?void 0:t.id)||"",(t==null?void 0:t.title)||"",...e,(t==null?void 0:t.category)||"\u307F\u3093\u306A\u306E\u304A\u984C",(t==null?void 0:t.language)==="en"||String((t==null?void 0:t.id)||"").startsWith("CUSEN")?"\u82F1\u8A9E":"\u65E5\u672C\u8A9E",(t==null?void 0:t.sourceKind)==="custom"?"\u63A1\u7528\u3057\u305F\u81EA\u4F5C":"\u6A19\u6E96\u306E\u304A\u984C",(t==null?void 0:t.sourceRef)||"",a?"\u4F7F\u7528":"\u505C\u6B62",a?"\u4F7F\u7528":"\u505C\u6B62",Number((t==null?void 0:t.reportCount)||0),I(t==null?void 0:t.lastReportedAt),I(t==null?void 0:t.createdAt),I(t==null?void 0:t.updatedAt)]}function mt(t){return t.map(ht).join(",")}function ht(t){let e=String(t!=null?t:""),a=/^\s*[=+\-@]/.test(e)?`'${e}`:e;return/[",\r\n]/.test(a)?`"${a.replaceAll('"','""')}"`:a}function I(t){if(t==null||t==="")return"";let e=new Date(Number(t));return Number.isNaN(e.getTime())?"":e.toISOString()}function f(t){return String(t).padStart(2,"0")}var S=document.getElementById("adminToken"),b=document.getElementById("adminOtp"),L=document.getElementById("dashboard"),C=document.getElementById("authStatus"),gt=xt(),m=new Set,v={catalog:[],submissions:[]},d=[],y=new Map;sessionStorage.removeItem("live:admin-token");S.value="";document.getElementById("loadQuestions").addEventListener("click",h);document.getElementById("forgetSession").addEventListener("click",()=>{sessionStorage.removeItem("live:admin-session"),S.value="",b.value="",L.hidden=!0,l("\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u6D88\u3057\u307E\u3057\u305F\u3002")});document.getElementById("questionSearch").addEventListener("input",A);document.getElementById("questionFilter").addEventListener("change",A);document.getElementById("saveAllQuestions").addEventListener("click",Et);document.getElementById("exportQuestionsCsv").addEventListener("click",wt);async function h(){try{(!sessionStorage.getItem("live:admin-session")||b.value.trim())&&await ft(),v=await $("/api/questions/admin/overview"),d=Q(It(gt,v.catalog)),y=T([...d,...(v.submissions||[]).filter(t=>t.status==="pending")]),m.clear(),L.hidden=!1,vt(),A()}catch(t){L.hidden=!0,l(E(t),!0)}}async function ft(){let t=await fetch("/api/live/admin/session",{method:"POST",headers:{"content-type":"application/json","x-live-admin-token":S.value.trim(),"x-live-admin-otp":b.value.trim()},body:"{}"}),e=await t.json().catch(()=>({}));if(!t.ok)throw X(e.error||"request-failed",t.status);sessionStorage.setItem("live:admin-session",e.sessionToken),S.value="",b.value="",l(`\u4E8C\u8981\u7D20\u8A8D\u8A3C\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u3002\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u6709\u52B9\u671F\u9650\uFF1A${q(e.expiresAt)}`)}function vt(){let t=(v.submissions||[]).filter(a=>a.status==="pending"),e=document.getElementById("pendingSubmissions");e.innerHTML=t.length?`
    <div class="table-wrap pending-table">
      <table class="question-table">
        <thead><tr>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${P()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u5BE9\u67FB</th>
        </tr></thead>
        <tbody>${t.map(St).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',e.querySelectorAll("[data-approve]").forEach(a=>a.addEventListener("click",()=>D(a.dataset.approve,"approved"))),e.querySelectorAll("[data-reject]").forEach(a=>a.addEventListener("click",()=>D(a.dataset.reject,"rejected"))),Z(e),G(e)}function St(t){let e=W(t.id);return`
    <tr data-submission="${i(t.id)}">
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${u(t.title)}</textarea>
        <div class="meta">
          <span class="pill warning">\u5BE9\u67FB\u5F85\u3061</span>
          <span class="pill">${t.sourceMode==="live-challenge"?"LIVE\u7248\u304B\u3089":"\u901A\u5E38\u7248\u304B\u3089"}</span>
          ${(t.safetyFlags||[]).length?`<span class="pill critical">\u91CD\u70B9\u5BE9\u67FB\uFF1A${u(O(t.safetyFlags).join("\u30FB"))}</span>`:""}
          <br>\u9001\u4FE1\uFF1A${q(t.submittedAt)}
        </div>
        <input data-field="reviewNote" maxlength="300" placeholder="\u5BE9\u67FB\u30E1\u30E2\uFF08\u975E\u516C\u958B\uFF09">
      </td>
      ${H(t)}
      <td>${V(t.id,e)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact good" data-approve="${i(t.id)}">\u63A1\u7528</button>
          <button class="button compact danger" data-reject="${i(t.id)}">\u5374\u4E0B</button>
        </div>
      </td>
    </tr>
    ${J(t.id,t,e)}
  `}function A(){let t=K(document.getElementById("questionSearch").value),e=document.getElementById("questionFilter").value,a=d.filter(c=>{let p=K(`${c.id} ${c.title} ${(c.choices||[]).join(" ")}`),tt=!t||p.includes(t),et=y.get(String(c.id))||[],at=e==="all"||e===c.status||e==="similar"&&et.length||e==="custom"&&c.sourceKind==="custom"&&c.status==="approved";return tt&&at}),n=d.filter(c=>c.status!=="disabled").length,s=d.length-n,o=d.filter(c=>(y.get(String(c.id))||[]).length).length;document.getElementById("questionCount").textContent=`${a.length}\u554F\u3092\u8868\u793A\uFF08\u63A1\u7528${n}\u554F\uFF0F\u7121\u52B9\u5316${s}\u554F\uFF0F\u5168${d.length}\u554F\uFF09`,document.getElementById("similaritySummary").textContent=`\u985E\u4F3C\u5019\u88DC\uFF1A${o}\u554F`;let r=document.getElementById("allQuestions");r.innerHTML=a.length?`
    <div class="table-wrap">
      <table class="question-table">
        <thead><tr>
          <th class="status-col">\u63A1\u7528</th>
          <th class="status-col">\u7121\u52B9\u5316</th>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${P()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u4FDD\u5B58</th>
        </tr></thead>
        <tbody>${a.map(bt).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u6761\u4EF6\u306B\u4E00\u81F4\u3059\u308B\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',r.querySelectorAll("[data-save]").forEach(c=>c.addEventListener("click",()=>Y(c.dataset.save))),r.querySelectorAll("input,textarea").forEach(c=>c.addEventListener("input",()=>z(c.closest("[data-catalog]")))),r.querySelectorAll("[data-status]").forEach(c=>c.addEventListener("change",()=>{let p=c.closest("[data-catalog]");p.dataset.statusRow=c.value,z(p)})),Z(r),G(r),N()}function bt(t){let e=String(t.id),a=t.status==="disabled",n=W(e);return`
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
      ${H(t)}
      <td>${V(e,n)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact" data-save="${i(e)}">\u3053\u306E\u884C\u3092\u4FDD\u5B58</button>
          <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
        </div>
      </td>
    </tr>
    ${J(e,t,n)}
  `}function P(){return[1,2,3,4,5].map(t=>`<th class="choice-col">\u9078\u629E\u80A2${t}</th>`).join("")}function H(t){return(t.choices||[]).slice(0,5).map((e,a)=>`
    <td><input class="sheet-input" data-choice="${a}" maxlength="60" value="${i(e)}"></td>
  `).join("")}function V(t,e){if(!e.length)return'<span class="meta">\u306A\u3057</span>';let a=e[0];return`
    <span class="pill similar">\u985E\u4F3C\u5019\u88DC ${Math.round(a.score*100)}%</span>
    <div class="meta">${u(a.title)}</div>
    <button class="button compact secondary" data-compare="${i(t)}">\u4E26\u3079\u3066\u6BD4\u8F03</button>
  `}function J(t,e,a){return a.length?`
    <tr class="compare-row" data-comparison="${i(t)}" hidden>
      <td colspan="10">
        <div class="comparison-grid">
          ${U("\u3053\u306E\u554F\u984C",e,t)}
          ${a.map((n,s)=>U(`\u985E\u4F3C\u5019\u88DC${s+1}\uFF08${Math.round(n.score*100)}%\uFF09`,n,t)).join("")}
        </div>
      </td>
    </tr>
  `:""}function U(t,e,a){let n=d.find(r=>String(r.id)===String(e.id));if(!n)return yt(t,e);let s=n.status==="disabled",o=`compare-status-${a}-${n.id}`;return`
    <div class="comparison-card" data-compare-catalog="${i(n.id)}" data-status-row="${s?"disabled":"approved"}">
      <div class="comparison-card-head">
        <span class="pill similar">${t}</span>
        <span class="pill">${u(n.id)}</span>
      </div>
      <div class="comparison-status" role="group" aria-label="${i(n.title)}\u306E\u63B2\u8F09\u72B6\u614B">
        <label class="status-choice"><input type="radio" name="${i(o)}" data-compare-status value="approved" ${s?"":"checked"}><span>\u63A1\u7528</span></label>
        <label class="status-choice disabled"><input type="radio" name="${i(o)}" data-compare-status value="disabled" ${s?"checked":""}><span>\u7121\u52B9</span></label>
      </div>
      <label class="comparison-field">
        <span>\u554F\u984C\u6587</span>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${u(n.title)}</textarea>
      </label>
      <div class="comparison-choices">
        ${(n.choices||[]).slice(0,5).map((r,c)=>`
          <label class="comparison-field">
            <span>\u9078\u629E\u80A2${c+1}</span>
            <input class="sheet-input" data-choice="${c}" maxlength="60" value="${i(r)}">
          </label>
        `).join("")}
      </div>
      <div class="comparison-actions">
        <button class="button compact" data-compare-save="${i(n.id)}">\u3053\u306E\u554F\u984C\u3092\u4FDD\u5B58</button>
        <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
      </div>
    </div>
  `}function yt(t,e){return`
    <div class="comparison-card comparison-card-readonly">
      <span class="pill similar">${t}</span>
      <strong>${u(e.title)}</strong>
      <ol>${(e.choices||[]).map(a=>`<li>${u(a)}</li>`).join("")}</ol>
      <span class="meta">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u4E0A\u306E\u5BE9\u67FB\u6B04\u3067\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002</span>
    </div>
  `}function Z(t){t.querySelectorAll("[data-compare]").forEach(e=>e.addEventListener("click",()=>{let a=t.querySelector(`[data-comparison="${CSS.escape(e.dataset.compare)}"]`);a&&(a.hidden=!a.hidden,e.textContent=a.hidden?"\u4E26\u3079\u3066\u6BD4\u8F03":"\u6BD4\u8F03\u3092\u9589\u3058\u308B")}))}function G(t){t.querySelectorAll("[data-compare-catalog]").forEach(e=>{e.querySelectorAll("input,textarea").forEach(a=>a.addEventListener("input",()=>{e.classList.add("dirty")})),e.querySelectorAll("[data-compare-status]").forEach(a=>a.addEventListener("change",()=>{e.dataset.statusRow=a.value,e.classList.add("dirty")}))}),t.querySelectorAll("[data-compare-save]").forEach(e=>e.addEventListener("click",()=>{$t(e.closest("[data-compare-catalog]"))}))}function W(t){return(y.get(String(t))||[]).slice(0,3)}async function D(t,e){let a=document.querySelector(`[data-submission="${CSS.escape(t)}"]`);if(a&&!(e==="rejected"&&!confirm("\u3053\u306E\u63B2\u8F09\u5019\u88DC\u3092\u5374\u4E0B\u3057\u307E\u3059\u304B\uFF1F"))&&!(e==="approved"&&!confirm("\u7DE8\u96C6\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3001\u901A\u5E38\u7248\u30FBLIVE\u7248\u306E\u5171\u901A\u304A\u984C\u3068\u3057\u3066\u63A1\u7528\u3057\u307E\u3059\u304B\uFF1F")))try{let n=e==="approved"?k(a):{decision:e,reviewNote:a.querySelector('[data-field="reviewNote"]').value.trim()};n.decision=e,await $(`/api/questions/admin/submissions/${t}/review`,{method:"POST",body:JSON.stringify(n)}),await h()}catch(n){alert(E(n))}}async function Y(t,{reload:e=!0}={}){var o;let a=document.querySelector(`[data-catalog="${CSS.escape(t)}"]`),n=d.find(r=>String(r.id)===String(t));if(!a||!n)return;let s={...k(a),sourceKind:n.sourceKind,sourceRef:n.sourceRef||n.id,status:((o=a.querySelector("[data-status]:checked"))==null?void 0:o.value)==="disabled"?"disabled":"approved"};await $(`/api/questions/admin/catalog/${encodeURIComponent(t)}`,{method:"PUT",body:JSON.stringify(s)}),m.delete(String(t)),e&&(l(`\u300C${s.title}\u300D\u3092${s.status==="approved"?"\u63A1\u7528":"\u7121\u52B9\u5316"}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h())}async function $t(t){var o;if(!t)return;let e=String(t.dataset.compareCatalog||""),a=d.find(r=>String(r.id)===e);if(!a)return;let n=t.querySelector("[data-compare-save]"),s={...k(t),sourceKind:a.sourceKind,sourceRef:a.sourceRef||a.id,status:((o=t.querySelector("[data-compare-status]:checked"))==null?void 0:o.value)==="disabled"?"disabled":"approved"};n.disabled=!0,n.textContent="\u4FDD\u5B58\u4E2D";try{await $(`/api/questions/admin/catalog/${encodeURIComponent(e)}`,{method:"PUT",body:JSON.stringify(s)}),l(`\u6BD4\u8F03\u6B04\u306E\u300C${s.title}\u300D\u3092${s.status==="approved"?"\u63A1\u7528":"\u7121\u52B9\u5316"}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h()}catch(r){n.disabled=!1,n.textContent="\u3053\u306E\u554F\u984C\u3092\u4FDD\u5B58",l(E(r),!0)}}async function Et(){let t=[...m];if(!t.length)return;let e=document.getElementById("saveAllQuestions");e.disabled=!0,e.textContent=`\u4FDD\u5B58\u4E2D 0/${t.length}`;try{for(let a=0;a<t.length;a+=1)await Y(t[a],{reload:!1}),e.textContent=`\u4FDD\u5B58\u4E2D ${a+1}/${t.length}`;l(`${t.length}\u554F\u306E\u5909\u66F4\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h()}catch(a){l(E(a),!0),N()}}function wt(){if(d.length&&!(m.size&&!confirm("\u672A\u4FDD\u5B58\u306E\u5909\u66F4\u306F\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306B\u542B\u307E\u308C\u307E\u305B\u3093\u3002\u4FDD\u5B58\u6E08\u307F\u306E\u5185\u5BB9\u3067\u7D9A\u3051\u307E\u3059\u304B\uFF1F")))try{let t=_(d);l(`\u63A1\u7528\u30FB\u7121\u52B9\u5316\u3092\u542B\u3080\u5168${t.count}\u554F\u3092\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u7528CSV\u306B\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`)}catch(t){l("CSV\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30D6\u30E9\u30A6\u30B6\u306E\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",!0)}}function k(t){var e;return{title:t.querySelector('[data-field="title"]').value.trim(),choices:Array.from(t.querySelectorAll("[data-choice]")).map(a=>a.value.trim()),category:"\u307F\u3093\u306A\u306E\u304A\u984C",reviewNote:((e=t.querySelector('[data-field="reviewNote"]'))==null?void 0:e.value.trim())||""}}function z(t){t&&(m.add(String(t.dataset.catalog)),t.classList.add("dirty"),N())}function N(){let t=document.getElementById("saveAllQuestions");t.disabled=m.size===0,t.textContent=m.size?`\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58\uFF08${m.size}\u554F\uFF09`:"\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58"}function xt(){let t=[...window.COMMON_QUESTION_CARDS||[]],e=new Set;return t.flatMap(a=>{let n=String(a.id);return!n||e.has(n)?[]:(e.add(n),[{...a,id:n,category:"\u307F\u3093\u306A\u306E\u304A\u984C",sourceKind:"static",sourceRef:n,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C",status:"approved"}])})}function It(t,e){let a=new Map((e||[]).map(o=>[String(o.id),o])),n=t.map(o=>{let r=a.get(String(o.id));return r?{...o,...r,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C"}:o}),s=new Set(t.map(o=>String(o.id)));for(let o of e||[])s.has(String(o.id))||n.push({...o,sourceLabel:"\u63A1\u7528\u3057\u305F\u81EA\u4F5C"});return n}async function $(t,e={}){let a=sessionStorage.getItem("live:admin-session")||"",n=new Headers(e.headers||{});n.set("x-live-admin-session",a),e.body&&n.set("content-type","application/json");let s=await fetch(t,{...e,headers:n,cache:"no-store"}),o=await s.json().catch(()=>({}));if(!s.ok)throw X(o.error||"request-failed",s.status);return o}function l(t,e=!1){C.hidden=!1,C.textContent=t,C.classList.toggle("error",e)}function E(t){return{"admin-forbidden":"\u7BA1\u7406\u30C8\u30FC\u30AF\u30F3\u304C\u9055\u3044\u307E\u3059\u3002","admin-otp-invalid":"6\u6841\u306E\u8A8D\u8A3C\u30B3\u30FC\u30C9\u304C\u9055\u3046\u304B\u3001\u6709\u52B9\u6642\u9593\u3092\u904E\u304E\u3066\u3044\u307E\u3059\u3002","admin-session-required":"\u7BA1\u7406\u8005\u8A8D\u8A3C\u3092\u884C\u3063\u3066\u304F\u3060\u3055\u3044\u3002","admin-session-expired":"15\u5206\u306E\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u5207\u308C\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u8A8D\u8A3C\u3057\u3066\u304F\u3060\u3055\u3044\u3002","admin-2fa-not-configured":"\u672C\u756A\u306E\u7BA1\u7406\u8005\u4E8C\u8981\u7D20\u8A8D\u8A3C\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002","question-invalid":"\u554F\u984C\u6587\u30685\u3064\u306E\u9078\u629E\u80A2\u3092\u3059\u3079\u3066\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002","question-personal-information-detected":"\u672C\u540D\u30FB\u5B66\u6821\u540D\u30FBSNS ID\u30FB\u96FB\u8A71\u756A\u53F7\u30FB\u4F4F\u6240\u3089\u3057\u3044\u5185\u5BB9\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002","submission-already-reviewed":"\u3053\u306E\u304A\u984C\u306F\u3059\u3067\u306B\u5BE9\u67FB\u6E08\u307F\u3067\u3059\u3002"}[t==null?void 0:t.message]||"\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u5165\u529B\u3068\u901A\u4FE1\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}function X(t,e){let a=new Error(t);return a.status=e,a}function K(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").trim()}function q(t){return t?new Date(Number(t)).toLocaleString("ja-JP"):"\u672A\u8A2D\u5B9A"}function u(t){return String(t!=null?t:"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e])}function i(t){return u(t)}})();
