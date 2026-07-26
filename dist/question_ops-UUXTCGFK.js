(()=>{var gt=Object.freeze({"real-name":"\u672C\u540D\u30FB\u6C0F\u540D","school-name":"\u5B66\u6821\u540D","sns-id":"SNS ID","phone-number":"\u96FB\u8A71\u756A\u53F7",address:"\u4F4F\u6240"}),St=Object.freeze({"sexual-content":"\u6027\u7684\u5185\u5BB9",bullying:"\u3044\u3058\u3081","appearance-attack":"\u5BB9\u59FF\u653B\u6483",discrimination:"\u5DEE\u5225\u8868\u73FE"});function F(t){return[...new Set(t||[])].map(e=>gt[e]||St[e]||e)}var k=new Intl.Collator("ja",{sensitivity:"base",numeric:!0,ignorePunctuation:!0});function U(t){return[...t||[]].sort((e,a)=>{let n=K(e==null?void 0:e.status)-K(a==null?void 0:a.status);if(n)return n;let o=k.compare(String((e==null?void 0:e.title)||""),String((a==null?void 0:a.title)||""));return o||k.compare(String((e==null?void 0:e.id)||""),String((a==null?void 0:a.id)||""))})}function z(t,e=.58){let a=(t||[]).filter(Et),n=a.filter(wt),o=new Map(a.map(s=>[String(s.id),[]]));for(let s of a)for(let r of n){if(String(s.id)===String(r.id))continue;let i=vt(s,r);i<e||o.get(String(s.id)).push($t(r,i))}for(let s of o.values())s.sort((r,i)=>i.score-r.score||k.compare(r.title,i.title));return o}function vt(t,e){let a=T(t==null?void 0:t.title),n=T(e==null?void 0:e.title);if(!a||!n)return 0;let o=a===n?1:yt(a,n)?.9:P(a,n),s=bt(t==null?void 0:t.choices,e==null?void 0:e.choices);return g(t==null?void 0:t.choices).join("|")===g(e==null?void 0:e.choices).join("|")&&o>=.35?Math.max(.82,o):H(o*.72+s*.28)}function bt(t,e){let a=g(t),n=g(e);if(a.length!==5||n.length!==5)return 0;let o=a.map(s=>Math.max(...n.map(r=>s===r?1:P(s,r))));return o.reduce((s,r)=>s+r,0)/o.length}function g(t){return Array.isArray(t)?t.map(T).filter(Boolean):[]}function P(t,e){if(t===e)return 1;if(t.length<2||e.length<2)return 0;let a=D(t),n=D(e),o=0;for(let[s,r]of a)o+=Math.min(r,n.get(s)||0);return 2*o/(t.length-1+(e.length-1))}function D(t){let e=new Map;for(let a=0;a<t.length-1;a+=1){let n=t.slice(a,a+2);e.set(n,(e.get(n)||0)+1)}return e}function T(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").replace(/[、。・！？!?「」『』（）()【】［］\[\]\s"'’‘“”ー〜～….,/\\:：;；]/g,"")}function yt(t,e){return Math.min(t.length,e.length)>=6&&(t.includes(e)||e.includes(t))}function $t(t,e){return{id:String(t.id),title:String(t.title||""),choices:Array.isArray(t.choices)?t.choices.slice(0,5):[],score:H(e)}}function H(t){return Math.round(t*1e3)/1e3}function K(t){return t==="held"?1:t==="disabled"?2:0}function Et(t){return t&&t.id&&t.title&&Array.isArray(t.choices)&&t.choices.length===5}function wt(t){return(t==null?void 0:t.status)==="approved"||!(t!=null&&t.status)}var At=["\u72B6\u614B","\u554F\u984CID","\u554F\u984C\u6587","\u9078\u629E\u80A21","\u9078\u629E\u80A22","\u9078\u629E\u80A23","\u9078\u629E\u80A24","\u9078\u629E\u80A25","\u30AB\u30C6\u30B4\u30EA","\u8A00\u8A9E","\u4F5C\u6210\u5143","\u5143\u30C7\u30FC\u30BFID","\u901A\u5E38\u7248","LIVE\u7248","\u901A\u5831\u4EF6\u6570","\u6700\u7D42\u901A\u5831\u65E5\u6642","\u4F5C\u6210\u65E5\u6642","\u66F4\u65B0\u65E5\u6642"];function It(t){let e=(t||[]).map(Ct);return`\uFEFF${[At,...e].map(Lt).join(`\r
`)}\r
`}function xt(t=new Date){let e=[t.getFullYear(),S(t.getMonth()+1),S(t.getDate())],a=`${S(t.getHours())}${S(t.getMinutes())}`;return`streetboardgame-questions-${e.join("-")}_${a}.csv`}function V(t,e={}){let a=e.documentRef||globalThis.document,n=e.urlRef||globalThis.URL;if(!a||!(n!=null&&n.createObjectURL))throw new Error("question-backup-download-unavailable");let o=It(t),s=new Blob([o],{type:"text/csv;charset=utf-8"}),r=n.createObjectURL(s),i=a.createElement("a");return i.href=r,i.download=xt(e.date||new Date),i.hidden=!0,a.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>n.revokeObjectURL(r),0),{count:(t||[]).length,filename:i.download}}function Ct(t){let e=Array.from({length:5},(o,s)=>{var r;return((r=t==null?void 0:t.choices)==null?void 0:r[s])||""}),a=(t==null?void 0:t.status)==="held"?"held":(t==null?void 0:t.status)==="disabled"?"disabled":"approved",n=a==="approved";return[a==="held"?"\u4FDD\u7559":n?"\u63A1\u7528":"\u7121\u52B9\u5316",(t==null?void 0:t.id)||"",(t==null?void 0:t.title)||"",...e,(t==null?void 0:t.category)||"\u307F\u3093\u306A\u306E\u304A\u984C",(t==null?void 0:t.language)==="en"||String((t==null?void 0:t.id)||"").startsWith("CUSEN")?"\u82F1\u8A9E":"\u65E5\u672C\u8A9E",(t==null?void 0:t.sourceKind)==="custom"?"\u63A1\u7528\u3057\u305F\u81EA\u4F5C":(t==null?void 0:t.sourceKind)==="candidate"?"\u65B0\u898F\u5019\u88DC":"\u6A19\u6E96\u306E\u304A\u984C",(t==null?void 0:t.sourceRef)||"",n?"\u4F7F\u7528":"\u505C\u6B62",n?"\u4F7F\u7528":"\u505C\u6B62",Number((t==null?void 0:t.reportCount)||0),B(t==null?void 0:t.lastReportedAt),B(t==null?void 0:t.createdAt),B(t==null?void 0:t.updatedAt)]}function Lt(t){return t.map(kt).join(",")}function kt(t){let e=String(t!=null?t:""),a=/^\s*[=+\-@]/.test(e)?`'${e}`:e;return/[",\r\n]/.test(a)?`"${a.replaceAll('"','""')}"`:a}function B(t){if(t==null||t==="")return"";let e=new Date(Number(t));return Number.isNaN(e.getTime())?"":e.toISOString()}function S(t){return String(t).padStart(2,"0")}var v="live:admin-session",b="live:trusted-admin-session";function y(){return N(sessionStorage,v)||N(localStorage,b)}function Y(t,e){$();let a=e?localStorage:sessionStorage;Tt(a,e?b:v,t)}function $(){J(sessionStorage,v),J(localStorage,b)}function Z(){return!!N(localStorage,b)}function N(t,e){try{return t.getItem(e)||""}catch(a){return""}}function Tt(t,e,a){try{t.setItem(e,String(a||""))}catch(n){sessionStorage.setItem(v,String(a||""))}}function J(t,e){try{t.removeItem(e)}catch(a){}}var w=document.getElementById("adminToken"),A=document.getElementById("adminOtp"),Bt=document.getElementById("rememberDevice"),Nt=document.getElementById("authPanel"),tt=document.getElementById("forgetTrustedDevice"),R=document.getElementById("dashboard"),O=document.getElementById("authStatus"),Ot=Ut(),m=new Set,E={catalog:[],submissions:[]},l=[],I=new Map;sessionStorage.removeItem("live:admin-token");w.value="";document.getElementById("loadQuestions").addEventListener("click",h);document.getElementById("forgetSession").addEventListener("click",et);tt.addEventListener("click",et);document.getElementById("questionSearch").addEventListener("input",Q);document.getElementById("questionFilter").addEventListener("change",Q);document.getElementById("saveAllQuestions").addEventListener("click",Dt);document.getElementById("exportQuestionsCsv").addEventListener("click",Kt);y()&&h();async function h(){try{(!y()||A.value.trim())&&await Rt(),E=await C("/api/questions/admin/overview"),l=U(zt(Ot,E.catalog)),I=z([...l,...(E.submissions||[]).filter(t=>t.status==="pending")]),m.clear(),R.hidden=!1,j(!0),jt(),Q()}catch(t){t.status===401&&$(),R.hidden=!0,j(!1),u(L(t),!0)}}async function Rt(){let t=await fetch("/api/live/admin/session",{method:"POST",headers:{"content-type":"application/json","x-live-admin-token":w.value.trim(),"x-live-admin-otp":A.value.trim(),"x-live-admin-remember":Bt.checked?"1":"0"},body:"{}"}),e=await t.json().catch(()=>({}));if(!t.ok)throw ut(e.error||"request-failed",t.status);Y(e.sessionToken,!!e.trusted),w.value="",A.value="",u(`\u4E8C\u8981\u7D20\u8A8D\u8A3C\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u3002\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u6709\u52B9\u671F\u9650\uFF1A${pt(e.expiresAt)}`)}function j(t){Nt.hidden=t,tt.hidden=!t||!Z()}function et(){$(),w.value="",A.value="",R.hidden=!0,j(!1),u("\u3053\u306E\u7AEF\u672B\u306B\u4FDD\u5B58\u3057\u305F\u7BA1\u7406\u8A8D\u8A3C\u3092\u89E3\u9664\u3057\u307E\u3057\u305F\u3002")}function jt(){let t=(E.submissions||[]).filter(a=>a.status==="pending"),e=document.getElementById("pendingSubmissions");e.innerHTML=t.length?`
    <div class="table-wrap pending-table">
      <table class="question-table">
        <thead><tr>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${at()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u5BE9\u67FB</th>
        </tr></thead>
        <tbody>${t.map(Qt).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',e.querySelectorAll("[data-approve]").forEach(a=>a.addEventListener("click",()=>W(a.dataset.approve,"approved"))),e.querySelectorAll("[data-reject]").forEach(a=>a.addEventListener("click",()=>W(a.dataset.reject,"rejected"))),rt(e),ct(e)}function Qt(t){let e=it(t.id);return`
    <tr data-submission="${d(t.id)}">
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${p(t.title)}</textarea>
        <div class="meta">
          <span class="pill warning">\u5BE9\u67FB\u5F85\u3061</span>
          <span class="pill">${t.sourceMode==="live-challenge"?"LIVE\u7248\u304B\u3089":"\u901A\u5E38\u7248\u304B\u3089"}</span>
          ${(t.safetyFlags||[]).length?`<span class="pill critical">\u91CD\u70B9\u5BE9\u67FB\uFF1A${p(F(t.safetyFlags).join("\u30FB"))}</span>`:""}
          <br>\u9001\u4FE1\uFF1A${pt(t.submittedAt)}
        </div>
        <input data-field="reviewNote" maxlength="300" placeholder="\u5BE9\u67FB\u30E1\u30E2\uFF08\u975E\u516C\u958B\uFF09">
      </td>
      ${nt(t)}
      <td>${st(t.id,e)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact good" data-approve="${d(t.id)}">\u63A1\u7528</button>
          <button class="button compact danger" data-reject="${d(t.id)}">\u5374\u4E0B</button>
        </div>
      </td>
    </tr>
    ${ot(t.id,t,e)}
  `}function Q(){let t=q(document.getElementById("questionSearch").value),e=document.getElementById("questionFilter").value,a=l.filter(c=>{let f=q(`${c.id} ${c.title} ${(c.choices||[]).join(" ")}`),mt=!t||f.includes(t),ht=I.get(String(c.id))||[],ft=e==="all"||e===c.status||e==="similar"&&ht.length||e==="custom"&&c.sourceKind==="custom"&&c.status==="approved";return mt&&ft}),n=l.filter(c=>c.status==="approved").length,o=l.filter(c=>c.status==="held").length,s=l.filter(c=>c.status==="disabled").length,r=l.filter(c=>(I.get(String(c.id))||[]).length).length;document.getElementById("questionCount").textContent=`${a.length}\u554F\u3092\u8868\u793A\uFF08\u63A1\u7528${n}\u554F\uFF0F\u4FDD\u7559${o}\u554F\uFF0F\u7121\u52B9\u5316${s}\u554F\uFF0F\u5168${l.length}\u554F\uFF09`,document.getElementById("similaritySummary").textContent=`\u985E\u4F3C\u5019\u88DC\uFF1A${r}\u554F`;let i=document.getElementById("allQuestions");i.innerHTML=a.length?`
    <div class="table-wrap">
      <table class="question-table">
        <thead><tr>
          <th class="status-col">\u63A1\u7528</th>
          <th class="status-col">\u4FDD\u7559</th>
          <th class="status-col">\u7121\u52B9\u5316</th>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${at()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u4FDD\u5B58</th>
        </tr></thead>
        <tbody>${a.map(Mt).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u6761\u4EF6\u306B\u4E00\u81F4\u3059\u308B\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',i.querySelectorAll("[data-save]").forEach(c=>c.addEventListener("click",()=>dt(c.dataset.save))),i.querySelectorAll("input,textarea").forEach(c=>c.addEventListener("input",()=>X(c.closest("[data-catalog]")))),i.querySelectorAll("[data-status]").forEach(c=>c.addEventListener("change",()=>{let f=c.closest("[data-catalog]");f.dataset.statusRow=c.value,X(f)})),rt(i),ct(i),_()}function Mt(t){let e=String(t.id),a=x(t.status),n=it(e);return`
    <tr data-catalog="${d(e)}" data-status-row="${a}">
      <td class="status-col"><label class="status-choice"><input type="radio" name="status-${d(e)}" data-status value="approved" ${a==="approved"?"checked":""}><span>\u63A1\u7528</span></label></td>
      <td class="status-col"><label class="status-choice held"><input type="radio" name="status-${d(e)}" data-status value="held" ${a==="held"?"checked":""}><span>\u4FDD\u7559</span></label></td>
      <td class="status-col"><label class="status-choice disabled"><input type="radio" name="status-${d(e)}" data-status value="disabled" ${a==="disabled"?"checked":""}><span>\u7121\u52B9</span></label></td>
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${p(t.title)}</textarea>
        <div class="meta">
          <span class="pill ${t.sourceKind==="custom"?"info":t.sourceKind==="candidate"?"warning":""}">${Pt(t.sourceKind)}</span>
          <span class="pill">${p(e)}</span>
          ${t.reportCount?`<span class="pill critical">\u901A\u5831${t.reportCount}\u4EF6\u30FB\u5373\u6642\u975E\u516C\u958B</span>`:""}
        </div>
      </td>
      ${nt(t)}
      <td>${st(e,n)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact" data-save="${d(e)}">\u3053\u306E\u884C\u3092\u4FDD\u5B58</button>
          <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
        </div>
      </td>
    </tr>
    ${ot(e,t,n)}
  `}function at(){return[1,2,3,4,5].map(t=>`<th class="choice-col">\u9078\u629E\u80A2${t}</th>`).join("")}function nt(t){return(t.choices||[]).slice(0,5).map((e,a)=>`
    <td><input class="sheet-input" data-choice="${a}" maxlength="60" value="${d(e)}"></td>
  `).join("")}function st(t,e){if(!e.length)return'<span class="meta">\u306A\u3057</span>';let a=e[0];return`
    <span class="pill similar">\u985E\u4F3C\u5019\u88DC ${Math.round(a.score*100)}%</span>
    <div class="meta">${p(a.title)}</div>
    <button class="button compact secondary" data-compare="${d(t)}">\u4E26\u3079\u3066\u6BD4\u8F03</button>
  `}function ot(t,e,a){return a.length?`
    <tr class="compare-row" data-comparison="${d(t)}" hidden>
      <td colspan="11">
        <div class="comparison-grid">
          ${G("\u3053\u306E\u554F\u984C",e,t)}
          ${a.map((n,o)=>G(`\u985E\u4F3C\u5019\u88DC${o+1}\uFF08${Math.round(n.score*100)}%\uFF09`,n,t)).join("")}
        </div>
      </td>
    </tr>
  `:""}function G(t,e,a){let n=l.find(r=>String(r.id)===String(e.id));if(!n)return _t(t,e);let o=x(n.status),s=`compare-status-${a}-${n.id}`;return`
    <div class="comparison-card" data-compare-catalog="${d(n.id)}" data-status-row="${o}">
      <div class="comparison-card-head">
        <span class="pill similar">${t}</span>
        <span class="pill">${p(n.id)}</span>
      </div>
      <div class="comparison-status" role="group" aria-label="${d(n.title)}\u306E\u63B2\u8F09\u72B6\u614B">
        <label class="status-choice"><input type="radio" name="${d(s)}" data-compare-status value="approved" ${o==="approved"?"checked":""}><span>\u63A1\u7528</span></label>
        <label class="status-choice held"><input type="radio" name="${d(s)}" data-compare-status value="held" ${o==="held"?"checked":""}><span>\u4FDD\u7559</span></label>
        <label class="status-choice disabled"><input type="radio" name="${d(s)}" data-compare-status value="disabled" ${o==="disabled"?"checked":""}><span>\u7121\u52B9</span></label>
      </div>
      <label class="comparison-field">
        <span>\u554F\u984C\u6587</span>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${p(n.title)}</textarea>
      </label>
      <div class="comparison-choices">
        ${(n.choices||[]).slice(0,5).map((r,i)=>`
          <label class="comparison-field">
            <span>\u9078\u629E\u80A2${i+1}</span>
            <input class="sheet-input" data-choice="${i}" maxlength="60" value="${d(r)}">
          </label>
        `).join("")}
      </div>
      <div class="comparison-actions">
        <button class="button compact" data-compare-save="${d(n.id)}">\u3053\u306E\u554F\u984C\u3092\u4FDD\u5B58</button>
        <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
      </div>
    </div>
  `}function _t(t,e){return`
    <div class="comparison-card comparison-card-readonly">
      <span class="pill similar">${t}</span>
      <strong>${p(e.title)}</strong>
      <ol>${(e.choices||[]).map(a=>`<li>${p(a)}</li>`).join("")}</ol>
      <span class="meta">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u4E0A\u306E\u5BE9\u67FB\u6B04\u3067\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002</span>
    </div>
  `}function rt(t){t.querySelectorAll("[data-compare]").forEach(e=>e.addEventListener("click",()=>{let a=t.querySelector(`[data-comparison="${CSS.escape(e.dataset.compare)}"]`);a&&(a.hidden=!a.hidden,e.textContent=a.hidden?"\u4E26\u3079\u3066\u6BD4\u8F03":"\u6BD4\u8F03\u3092\u9589\u3058\u308B")}))}function ct(t){t.querySelectorAll("[data-compare-catalog]").forEach(e=>{e.querySelectorAll("input,textarea").forEach(a=>a.addEventListener("input",()=>{e.classList.add("dirty")})),e.querySelectorAll("[data-compare-status]").forEach(a=>a.addEventListener("change",()=>{e.dataset.statusRow=a.value,e.classList.add("dirty")}))}),t.querySelectorAll("[data-compare-save]").forEach(e=>e.addEventListener("click",()=>{Ft(e.closest("[data-compare-catalog]"))}))}function it(t){return(I.get(String(t))||[]).slice(0,3)}async function W(t,e){let a=document.querySelector(`[data-submission="${CSS.escape(t)}"]`);if(a&&!(e==="rejected"&&!confirm("\u3053\u306E\u63B2\u8F09\u5019\u88DC\u3092\u5374\u4E0B\u3057\u307E\u3059\u304B\uFF1F"))&&!(e==="approved"&&!confirm("\u7DE8\u96C6\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3001\u901A\u5E38\u7248\u30FBLIVE\u7248\u306E\u5171\u901A\u304A\u984C\u3068\u3057\u3066\u63A1\u7528\u3057\u307E\u3059\u304B\uFF1F")))try{let n=e==="approved"?M(a):{decision:e,reviewNote:a.querySelector('[data-field="reviewNote"]').value.trim()};n.decision=e,await C(`/api/questions/admin/submissions/${t}/review`,{method:"POST",body:JSON.stringify(n)}),await h()}catch(n){alert(L(n))}}async function dt(t,{reload:e=!0}={}){var s;let a=document.querySelector(`[data-catalog="${CSS.escape(t)}"]`),n=l.find(r=>String(r.id)===String(t));if(!a||!n)return;let o={...M(a),sourceKind:n.sourceKind,sourceRef:n.sourceRef||n.id,status:x((s=a.querySelector("[data-status]:checked"))==null?void 0:s.value)};await C(`/api/questions/admin/catalog/${encodeURIComponent(t)}`,{method:"PUT",body:JSON.stringify(o)}),m.delete(String(t)),e&&(u(`\u300C${o.title}\u300D\u3092${lt(o.status)}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h())}async function Ft(t){var s;if(!t)return;let e=String(t.dataset.compareCatalog||""),a=l.find(r=>String(r.id)===e);if(!a)return;let n=t.querySelector("[data-compare-save]"),o={...M(t),sourceKind:a.sourceKind,sourceRef:a.sourceRef||a.id,status:x((s=t.querySelector("[data-compare-status]:checked"))==null?void 0:s.value)};n.disabled=!0,n.textContent="\u4FDD\u5B58\u4E2D";try{await C(`/api/questions/admin/catalog/${encodeURIComponent(e)}`,{method:"PUT",body:JSON.stringify(o)}),u(`\u6BD4\u8F03\u6B04\u306E\u300C${o.title}\u300D\u3092${lt(o.status)}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h()}catch(r){n.disabled=!1,n.textContent="\u3053\u306E\u554F\u984C\u3092\u4FDD\u5B58",u(L(r),!0)}}async function Dt(){let t=[...m];if(!t.length)return;let e=document.getElementById("saveAllQuestions");e.disabled=!0,e.textContent=`\u4FDD\u5B58\u4E2D 0/${t.length}`;try{for(let a=0;a<t.length;a+=1)await dt(t[a],{reload:!1}),e.textContent=`\u4FDD\u5B58\u4E2D ${a+1}/${t.length}`;u(`${t.length}\u554F\u306E\u5909\u66F4\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h()}catch(a){u(L(a),!0),_()}}function Kt(){if(l.length&&!(m.size&&!confirm("\u672A\u4FDD\u5B58\u306E\u5909\u66F4\u306F\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306B\u542B\u307E\u308C\u307E\u305B\u3093\u3002\u4FDD\u5B58\u6E08\u307F\u306E\u5185\u5BB9\u3067\u7D9A\u3051\u307E\u3059\u304B\uFF1F")))try{let t=V(l);u(`\u63A1\u7528\u30FB\u4FDD\u7559\u30FB\u7121\u52B9\u5316\u3092\u542B\u3080\u5168${t.count}\u554F\u3092\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u7528CSV\u306B\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`)}catch(t){u("CSV\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30D6\u30E9\u30A6\u30B6\u306E\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",!0)}}function M(t){var e;return{title:t.querySelector('[data-field="title"]').value.trim(),choices:Array.from(t.querySelectorAll("[data-choice]")).map(a=>a.value.trim()),category:"\u307F\u3093\u306A\u306E\u304A\u984C",reviewNote:((e=t.querySelector('[data-field="reviewNote"]'))==null?void 0:e.value.trim())||""}}function X(t){t&&(m.add(String(t.dataset.catalog)),t.classList.add("dirty"),_())}function _(){let t=document.getElementById("saveAllQuestions");t.disabled=m.size===0,t.textContent=m.size?`\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58\uFF08${m.size}\u554F\uFF09`:"\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58"}function Ut(){let t=[...window.COMMON_QUESTION_CARDS||[]],e=new Set;return t.flatMap(a=>{let n=String(a.id);return!n||e.has(n)?[]:(e.add(n),[{...a,id:n,category:"\u307F\u3093\u306A\u306E\u304A\u984C",sourceKind:"static",sourceRef:n,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C",status:"approved"}])})}function zt(t,e){let a=new Map((e||[]).map(s=>[String(s.id),s])),n=t.map(s=>{let r=a.get(String(s.id));return r?{...s,...r,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C"}:s}),o=new Set(t.map(s=>String(s.id)));for(let s of e||[])o.has(String(s.id))||n.push({...s,sourceLabel:s.sourceKind==="candidate"?"\u65B0\u898F\u5019\u88DC":"\u63A1\u7528\u3057\u305F\u81EA\u4F5C"});return n}function x(t){return t==="held"?"held":t==="disabled"?"disabled":"approved"}function lt(t){return t==="held"?"\u4FDD\u7559":t==="disabled"?"\u7121\u52B9\u5316":"\u63A1\u7528"}function Pt(t){return t==="custom"?"\u63A1\u7528\u3057\u305F\u81EA\u4F5C":t==="candidate"?"\u65B0\u898F100\u554F\u5019\u88DC":"\u6A19\u6E96\u306E\u304A\u984C"}async function C(t,e={}){let a=y(),n=new Headers(e.headers||{});n.set("x-live-admin-session",a),e.body&&n.set("content-type","application/json");let o=await fetch(t,{...e,headers:n,cache:"no-store"}),s=await o.json().catch(()=>({}));if(!o.ok)throw ut(s.error||"request-failed",o.status);return s}function u(t,e=!1){O.hidden=!1,O.textContent=t,O.classList.toggle("error",e)}function L(t){return{"admin-forbidden":"\u7BA1\u7406\u30C8\u30FC\u30AF\u30F3\u304C\u9055\u3044\u307E\u3059\u3002","admin-otp-invalid":"6\u6841\u306E\u8A8D\u8A3C\u30B3\u30FC\u30C9\u304C\u9055\u3046\u304B\u3001\u6709\u52B9\u6642\u9593\u3092\u904E\u304E\u3066\u3044\u307E\u3059\u3002","admin-session-required":"\u7BA1\u7406\u8005\u8A8D\u8A3C\u3092\u884C\u3063\u3066\u304F\u3060\u3055\u3044\u3002","admin-session-expired":"\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u671F\u9650\u304C\u5207\u308C\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u8A8D\u8A3C\u3057\u3066\u304F\u3060\u3055\u3044\u3002","admin-2fa-not-configured":"\u672C\u756A\u306E\u7BA1\u7406\u8005\u4E8C\u8981\u7D20\u8A8D\u8A3C\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002","question-invalid":"\u554F\u984C\u6587\u30685\u3064\u306E\u9078\u629E\u80A2\u3092\u3059\u3079\u3066\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002","question-personal-information-detected":"\u672C\u540D\u30FB\u5B66\u6821\u540D\u30FBSNS ID\u30FB\u96FB\u8A71\u756A\u53F7\u30FB\u4F4F\u6240\u3089\u3057\u3044\u5185\u5BB9\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002","submission-already-reviewed":"\u3053\u306E\u304A\u984C\u306F\u3059\u3067\u306B\u5BE9\u67FB\u6E08\u307F\u3067\u3059\u3002"}[t==null?void 0:t.message]||"\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u5165\u529B\u3068\u901A\u4FE1\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}function ut(t,e){let a=new Error(t);return a.status=e,a}function q(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").trim()}function pt(t){return t?new Date(Number(t)).toLocaleString("ja-JP"):"\u672A\u8A2D\u5B9A"}function p(t){return String(t!=null?t:"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e])}function d(t){return p(t)}})();
