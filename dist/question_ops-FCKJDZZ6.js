(()=>{var bt=Object.freeze({"real-name":"\u672C\u540D\u30FB\u6C0F\u540D","school-name":"\u5B66\u6821\u540D","sns-id":"SNS ID","phone-number":"\u96FB\u8A71\u756A\u53F7",address:"\u4F4F\u6240"}),yt=Object.freeze({"sexual-content":"\u6027\u7684\u5185\u5BB9",bullying:"\u3044\u3058\u3081","appearance-attack":"\u5BB9\u59FF\u653B\u6483",discrimination:"\u5DEE\u5225\u8868\u73FE"});function D(t){return[...new Set(t||[])].map(e=>bt[e]||yt[e]||e)}var N=new Intl.Collator("ja",{sensitivity:"base",numeric:!0,ignorePunctuation:!0});function z(t){return[...t||[]].sort((e,n)=>{let a=U(e==null?void 0:e.status)-U(n==null?void 0:n.status);if(a)return a;let o=S(e),s=S(n);if(o==null&&s!=null)return 1;if(o!=null&&s==null)return-1;if(o!=null&&s!=null&&o!==s)return o-s;let r=N.compare(String((e==null?void 0:e.title)||""),String((n==null?void 0:n.title)||""));return r||N.compare(String((e==null?void 0:e.id)||""),String((n==null?void 0:n.id)||""))})}function S(t){let e=Math.max(0,Number(t==null?void 0:t.selectionShownCount)||0);if(!e)return null;let n=Math.max(0,Number(t==null?void 0:t.selectionSkipCount)||0);return Math.min(n/e,1)}function P(t,e=.58){let n=(t||[]).filter(kt),a=n.filter(xt),o=new Map(n.map(s=>[String(s.id),[]]));for(let s of n)for(let r of a){if(String(s.id)===String(r.id))continue;let i=$t(s,r);i<e||o.get(String(s.id)).push(Et(r,i))}for(let s of o.values())s.sort((r,i)=>i.score-r.score||N.compare(r.title,i.title));return o}function $t(t,e){let n=B(t==null?void 0:t.title),a=B(e==null?void 0:e.title);if(!n||!a)return 0;let o=n===a?1:wt(n,a)?.9:H(n,a),s=Ct(t==null?void 0:t.choices,e==null?void 0:e.choices);return v(t==null?void 0:t.choices).join("|")===v(e==null?void 0:e.choices).join("|")&&o>=.35?Math.max(.82,o):V(o*.72+s*.28)}function Ct(t,e){let n=v(t),a=v(e);if(n.length!==5||a.length!==5)return 0;let o=n.map(s=>Math.max(...a.map(r=>s===r?1:H(s,r))));return o.reduce((s,r)=>s+r,0)/o.length}function v(t){return Array.isArray(t)?t.map(B).filter(Boolean):[]}function H(t,e){if(t===e)return 1;if(t.length<2||e.length<2)return 0;let n=K(t),a=K(e),o=0;for(let[s,r]of n)o+=Math.min(r,a.get(s)||0);return 2*o/(t.length-1+(e.length-1))}function K(t){let e=new Map;for(let n=0;n<t.length-1;n+=1){let a=t.slice(n,n+2);e.set(a,(e.get(a)||0)+1)}return e}function B(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").replace(/[、。・！？!?「」『』（）()【】［］\[\]\s"'’‘“”ー〜～….,/\\:：;；]/g,"")}function wt(t,e){return Math.min(t.length,e.length)>=6&&(t.includes(e)||e.includes(t))}function Et(t,e){return{id:String(t.id),title:String(t.title||""),choices:Array.isArray(t.choices)?t.choices.slice(0,5):[],score:V(e)}}function V(t){return Math.round(t*1e3)/1e3}function U(t){return t==="held"?1:t==="disabled"?2:0}function kt(t){return t&&t.id&&t.title&&Array.isArray(t.choices)&&t.choices.length===5}function xt(t){return(t==null?void 0:t.status)==="approved"||!(t!=null&&t.status)}var At=["\u72B6\u614B","\u554F\u984CID","\u554F\u984C\u6587","\u9078\u629E\u80A21","\u9078\u629E\u80A22","\u9078\u629E\u80A23","\u9078\u629E\u80A24","\u9078\u629E\u80A25","\u30AB\u30C6\u30B4\u30EA","\u8A00\u8A9E","\u4F5C\u6210\u5143","\u5143\u30C7\u30FC\u30BFID","\u901A\u5E38\u7248","LIVE\u7248","\u901A\u5831\u4EF6\u6570","\u6700\u7D42\u901A\u5831\u65E5\u6642","\u4F5C\u6210\u65E5\u6642","\u66F4\u65B0\u65E5\u6642"];function It(t){let e=(t||[]).map(Nt);return`\uFEFF${[At,...e].map(Bt).join(`\r
`)}\r
`}function Lt(t=new Date){let e=[t.getFullYear(),b(t.getMonth()+1),b(t.getDate())],n=`${b(t.getHours())}${b(t.getMinutes())}`;return`streetboardgame-questions-${e.join("-")}_${n}.csv`}function J(t,e={}){let n=e.documentRef||globalThis.document,a=e.urlRef||globalThis.URL;if(!n||!(a!=null&&a.createObjectURL))throw new Error("question-backup-download-unavailable");let o=It(t),s=new Blob([o],{type:"text/csv;charset=utf-8"}),r=a.createObjectURL(s),i=n.createElement("a");return i.href=r,i.download=Lt(e.date||new Date),i.hidden=!0,n.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>a.revokeObjectURL(r),0),{count:(t||[]).length,filename:i.download}}function Nt(t){let e=Array.from({length:5},(o,s)=>{var r;return((r=t==null?void 0:t.choices)==null?void 0:r[s])||""}),n=(t==null?void 0:t.status)==="held"?"held":(t==null?void 0:t.status)==="disabled"?"disabled":"approved",a=n==="approved";return[n==="held"?"\u4FDD\u7559":a?"\u63A1\u7528":"\u7121\u52B9\u5316",(t==null?void 0:t.id)||"",(t==null?void 0:t.title)||"",...e,(t==null?void 0:t.category)||"\u307F\u3093\u306A\u306E\u304A\u984C",(t==null?void 0:t.language)==="en"||String((t==null?void 0:t.id)||"").startsWith("CUSEN")?"\u82F1\u8A9E":"\u65E5\u672C\u8A9E",(t==null?void 0:t.sourceKind)==="custom"?"\u63A1\u7528\u3057\u305F\u81EA\u4F5C":(t==null?void 0:t.sourceKind)==="candidate"?"\u65B0\u898F\u5019\u88DC":"\u6A19\u6E96\u306E\u304A\u984C",(t==null?void 0:t.sourceRef)||"",a?"\u4F7F\u7528":"\u505C\u6B62",a?"\u4F7F\u7528":"\u505C\u6B62",Number((t==null?void 0:t.reportCount)||0),R(t==null?void 0:t.lastReportedAt),R(t==null?void 0:t.createdAt),R(t==null?void 0:t.updatedAt)]}function Bt(t){return t.map(Rt).join(",")}function Rt(t){let e=String(t!=null?t:""),n=/^\s*[=+\-@]/.test(e)?`'${e}`:e;return/[",\r\n]/.test(n)?`"${n.replaceAll('"','""')}"`:n}function R(t){if(t==null||t==="")return"";let e=new Date(Number(t));return Number.isNaN(e.getTime())?"":e.toISOString()}function b(t){return String(t).padStart(2,"0")}var y="live:admin-session",$="live:trusted-admin-session";function C(){return T(sessionStorage,y)||T(localStorage,$)}function Z(t,e){w();let n=e?localStorage:sessionStorage;Tt(n,e?$:y,t)}function w(){Y(sessionStorage,y),Y(localStorage,$)}function G(){return!!T(localStorage,$)}function T(t,e){try{return t.getItem(e)||""}catch(n){return""}}function Tt(t,e,n){try{t.setItem(e,String(n||""))}catch(a){sessionStorage.setItem(y,String(n||""))}}function Y(t,e){try{t.removeItem(e)}catch(n){}}var E=document.getElementById("adminToken"),k=document.getElementById("adminOtp"),Mt=document.getElementById("rememberDevice"),Ot=document.getElementById("authPanel"),nt=document.getElementById("forgetTrustedDevice"),O=document.getElementById("dashboard"),M=document.getElementById("authStatus"),Qt=Ht(),m=new Set,f={catalog:[],submissions:[],selectionStats:[]},d=[],x=new Map;sessionStorage.removeItem("live:admin-token");E.value="";document.getElementById("loadQuestions").addEventListener("click",h);document.getElementById("forgetSession").addEventListener("click",at);nt.addEventListener("click",at);document.getElementById("questionSearch").addEventListener("input",j);document.getElementById("questionFilter").addEventListener("change",j);document.getElementById("saveAllQuestions").addEventListener("click",zt);document.getElementById("exportQuestionsCsv").addEventListener("click",Pt);C()&&h();async function h(){try{(!C()||k.value.trim())&&await jt(),f=await I("/api/questions/admin/overview"),d=z(Jt(Vt(Qt,f.catalog),f.selectionStats)),x=P([...d,...(f.submissions||[]).filter(t=>t.status==="pending")]),m.clear(),O.hidden=!1,Q(!0),_t(),j()}catch(t){t.status===401&&w(),O.hidden=!0,Q(!1),u(L(t),!0)}}async function jt(){let t=await fetch("/api/live/admin/session",{method:"POST",headers:{"content-type":"application/json","x-live-admin-token":E.value.trim(),"x-live-admin-otp":k.value.trim(),"x-live-admin-remember":Mt.checked?"1":"0"},body:"{}"}),e=await t.json().catch(()=>({}));if(!t.ok)throw ht(e.error||"request-failed",t.status);Z(e.sessionToken,!!e.trusted),E.value="",k.value="",u(`\u4E8C\u8981\u7D20\u8A8D\u8A3C\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u3002\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u6709\u52B9\u671F\u9650\uFF1A${ft(e.expiresAt)}`)}function Q(t){Ot.hidden=t,nt.hidden=!t||!G()}function at(){w(),E.value="",k.value="",O.hidden=!0,Q(!1),u("\u3053\u306E\u7AEF\u672B\u306B\u4FDD\u5B58\u3057\u305F\u7BA1\u7406\u8A8D\u8A3C\u3092\u89E3\u9664\u3057\u307E\u3057\u305F\u3002")}function _t(){let t=(f.submissions||[]).filter(n=>n.status==="pending"),e=document.getElementById("pendingSubmissions");e.innerHTML=t.length?`
    <div class="table-wrap pending-table">
      <table class="question-table">
        <thead><tr>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${st()}
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u5BE9\u67FB</th>
        </tr></thead>
        <tbody>${t.map(Ft).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',e.querySelectorAll("[data-approve]").forEach(n=>n.addEventListener("click",()=>X(n.dataset.approve,"approved"))),e.querySelectorAll("[data-reject]").forEach(n=>n.addEventListener("click",()=>X(n.dataset.reject,"rejected"))),it(e),lt(e)}function Ft(t){let e=dt(t.id);return`
    <tr data-submission="${l(t.id)}">
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${p(t.title)}</textarea>
        <div class="meta">
          <span class="pill warning">\u5BE9\u67FB\u5F85\u3061</span>
          <span class="pill">${t.sourceMode==="live-challenge"?"LIVE\u7248\u304B\u3089":"\u901A\u5E38\u7248\u304B\u3089"}</span>
          ${(t.safetyFlags||[]).length?`<span class="pill critical">\u91CD\u70B9\u5BE9\u67FB\uFF1A${p(D(t.safetyFlags).join("\u30FB"))}</span>`:""}
          <br>\u9001\u4FE1\uFF1A${ft(t.submittedAt)}
        </div>
        <input data-field="reviewNote" maxlength="300" placeholder="\u5BE9\u67FB\u30E1\u30E2\uFF08\u975E\u516C\u958B\uFF09">
      </td>
      ${ot(t)}
      <td>${rt(t.id,e)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact good" data-approve="${l(t.id)}">\u63A1\u7528</button>
          <button class="button compact danger" data-reject="${l(t.id)}">\u5374\u4E0B</button>
        </div>
      </td>
    </tr>
    ${ct(t.id,t,e)}
  `}function j(){let t=et(document.getElementById("questionSearch").value),e=document.getElementById("questionFilter").value,n=d.filter(c=>{let g=et(`${c.id} ${c.title} ${(c.choices||[]).join(" ")}`),gt=!t||g.includes(t),St=x.get(String(c.id))||[],vt=e==="all"||e===c.status||e==="similar"&&St.length||e==="custom"&&c.sourceKind==="custom"&&c.status==="approved";return gt&&vt}),a=d.filter(c=>c.status==="approved").length,o=d.filter(c=>c.status==="held").length,s=d.filter(c=>c.status==="disabled").length,r=d.filter(c=>(x.get(String(c.id))||[]).length).length;document.getElementById("questionCount").textContent=`${n.length}\u554F\u3092\u8868\u793A\uFF08\u63A1\u7528${a}\u554F\uFF0F\u4FDD\u7559${o}\u554F\uFF0F\u7121\u52B9\u5316${s}\u554F\uFF0F\u5168${d.length}\u554F\uFF09`,document.getElementById("similaritySummary").textContent=`\u985E\u4F3C\u5019\u88DC\uFF1A${r}\u554F`;let i=document.getElementById("allQuestions");i.innerHTML=n.length?`
    <div class="table-wrap">
      <table class="question-table">
        <thead><tr>
          <th class="status-col">\u63A1\u7528</th>
          <th class="status-col">\u4FDD\u7559</th>
          <th class="status-col">\u7121\u52B9\u5316</th>
          <th class="question-col">\u554F\u984C\u6587</th>
          ${st()}
          <th class="skip-col">\u30B9\u30AD\u30C3\u30D7\u7387<br>\uFF08\u4F4E\u3044\u9806\uFF09</th>
          <th class="similar-col">\u985E\u4F3C\u5019\u88DC</th>
          <th class="action-col">\u4FDD\u5B58</th>
        </tr></thead>
        <tbody>${n.map(Dt).join("")}</tbody>
      </table>
    </div>
  `:'<div class="empty">\u6761\u4EF6\u306B\u4E00\u81F4\u3059\u308B\u304A\u984C\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>',i.querySelectorAll("[data-save]").forEach(c=>c.addEventListener("click",()=>ut(c.dataset.save))),i.querySelectorAll("input,textarea").forEach(c=>c.addEventListener("input",()=>q(c.closest("[data-catalog]")))),i.querySelectorAll("[data-status]").forEach(c=>c.addEventListener("change",()=>{let g=c.closest("[data-catalog]");g.dataset.statusRow=c.value,q(g)})),it(i),lt(i),F()}function Dt(t){let e=String(t.id),n=A(t.status),a=dt(e);return`
    <tr data-catalog="${l(e)}" data-status-row="${n}">
      <td class="status-col"><label class="status-choice"><input type="radio" name="status-${l(e)}" data-status value="approved" ${n==="approved"?"checked":""}><span>\u63A1\u7528</span></label></td>
      <td class="status-col"><label class="status-choice held"><input type="radio" name="status-${l(e)}" data-status value="held" ${n==="held"?"checked":""}><span>\u4FDD\u7559</span></label></td>
      <td class="status-col"><label class="status-choice disabled"><input type="radio" name="status-${l(e)}" data-status value="disabled" ${n==="disabled"?"checked":""}><span>\u7121\u52B9</span></label></td>
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${p(t.title)}</textarea>
        <div class="meta">
          <span class="pill ${t.sourceKind==="custom"?"info":t.sourceKind==="candidate"?"warning":""}">${Zt(t.sourceKind)}</span>
          <span class="pill">${p(e)}</span>
          ${t.reportCount?`<span class="pill critical">\u901A\u5831${t.reportCount}\u4EF6\u30FB\u5373\u6642\u975E\u516C\u958B</span>`:""}
        </div>
      </td>
      ${ot(t)}
      <td class="skip-col">${Yt(t)}</td>
      <td>${rt(e,a)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact" data-save="${l(e)}">\u3053\u306E\u884C\u3092\u4FDD\u5B58</button>
          <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
        </div>
      </td>
    </tr>
    ${ct(e,t,a)}
  `}function st(){return[1,2,3,4,5].map(t=>`<th class="choice-col">\u9078\u629E\u80A2${t}</th>`).join("")}function ot(t){return(t.choices||[]).slice(0,5).map((e,n)=>`
    <td><input class="sheet-input" data-choice="${n}" maxlength="60" value="${l(e)}"></td>
  `).join("")}function rt(t,e){if(!e.length)return'<span class="meta">\u306A\u3057</span>';let n=e[0];return`
    <span class="pill similar">\u985E\u4F3C\u5019\u88DC ${Math.round(n.score*100)}%</span>
    <div class="meta">${p(n.title)}</div>
    <button class="button compact secondary" data-compare="${l(t)}">\u4E26\u3079\u3066\u6BD4\u8F03</button>
  `}function ct(t,e,n){return n.length?`
    <tr class="compare-row" data-comparison="${l(t)}" hidden>
      <td colspan="12">
        <div class="comparison-grid">
          ${W("\u3053\u306E\u554F\u984C",e,t)}
          ${n.map((a,o)=>W(`\u985E\u4F3C\u5019\u88DC${o+1}\uFF08${Math.round(a.score*100)}%\uFF09`,a,t)).join("")}
        </div>
      </td>
    </tr>
  `:""}function W(t,e,n){let a=d.find(r=>String(r.id)===String(e.id));if(!a)return Kt(t,e);let o=A(a.status),s=`compare-status-${n}-${a.id}`;return`
    <div class="comparison-card" data-compare-catalog="${l(a.id)}" data-status-row="${o}">
      <div class="comparison-card-head">
        <span class="pill similar">${t}</span>
        <span class="pill">${p(a.id)}</span>
      </div>
      <div class="comparison-status" role="group" aria-label="${l(a.title)}\u306E\u63B2\u8F09\u72B6\u614B">
        <label class="status-choice"><input type="radio" name="${l(s)}" data-compare-status value="approved" ${o==="approved"?"checked":""}><span>\u63A1\u7528</span></label>
        <label class="status-choice held"><input type="radio" name="${l(s)}" data-compare-status value="held" ${o==="held"?"checked":""}><span>\u4FDD\u7559</span></label>
        <label class="status-choice disabled"><input type="radio" name="${l(s)}" data-compare-status value="disabled" ${o==="disabled"?"checked":""}><span>\u7121\u52B9</span></label>
      </div>
      <label class="comparison-field">
        <span>\u554F\u984C\u6587</span>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${p(a.title)}</textarea>
      </label>
      <div class="comparison-choices">
        ${(a.choices||[]).slice(0,5).map((r,i)=>`
          <label class="comparison-field">
            <span>\u9078\u629E\u80A2${i+1}</span>
            <input class="sheet-input" data-choice="${i}" maxlength="60" value="${l(r)}">
          </label>
        `).join("")}
      </div>
      <div class="comparison-actions">
        <button class="button compact" data-compare-save="${l(a.id)}">\u3053\u306E\u554F\u984C\u3092\u4FDD\u5B58</button>
        <span class="dirty-mark">\u672A\u4FDD\u5B58</span>
      </div>
    </div>
  `}function Kt(t,e){return`
    <div class="comparison-card comparison-card-readonly">
      <span class="pill similar">${t}</span>
      <strong>${p(e.title)}</strong>
      <ol>${(e.choices||[]).map(n=>`<li>${p(n)}</li>`).join("")}</ol>
      <span class="meta">\u5BE9\u67FB\u5F85\u3061\u306E\u304A\u984C\u306F\u4E0A\u306E\u5BE9\u67FB\u6B04\u3067\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002</span>
    </div>
  `}function it(t){t.querySelectorAll("[data-compare]").forEach(e=>e.addEventListener("click",()=>{let n=t.querySelector(`[data-comparison="${CSS.escape(e.dataset.compare)}"]`);n&&(n.hidden=!n.hidden,e.textContent=n.hidden?"\u4E26\u3079\u3066\u6BD4\u8F03":"\u6BD4\u8F03\u3092\u9589\u3058\u308B")}))}function lt(t){t.querySelectorAll("[data-compare-catalog]").forEach(e=>{e.querySelectorAll("input,textarea").forEach(n=>n.addEventListener("input",()=>{e.classList.add("dirty")})),e.querySelectorAll("[data-compare-status]").forEach(n=>n.addEventListener("change",()=>{e.dataset.statusRow=n.value,e.classList.add("dirty")}))}),t.querySelectorAll("[data-compare-save]").forEach(e=>e.addEventListener("click",()=>{Ut(e.closest("[data-compare-catalog]"))}))}function dt(t){return(x.get(String(t))||[]).slice(0,3)}async function X(t,e){let n=document.querySelector(`[data-submission="${CSS.escape(t)}"]`);if(n&&!(e==="rejected"&&!confirm("\u3053\u306E\u63B2\u8F09\u5019\u88DC\u3092\u5374\u4E0B\u3057\u307E\u3059\u304B\uFF1F"))&&!(e==="approved"&&!confirm("\u7DE8\u96C6\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3001\u901A\u5E38\u7248\u30FBLIVE\u7248\u306E\u5171\u901A\u304A\u984C\u3068\u3057\u3066\u63A1\u7528\u3057\u307E\u3059\u304B\uFF1F")))try{let a=e==="approved"?_(n):{decision:e,reviewNote:n.querySelector('[data-field="reviewNote"]').value.trim()};a.decision=e,await I(`/api/questions/admin/submissions/${t}/review`,{method:"POST",body:JSON.stringify(a)}),await h()}catch(a){alert(L(a))}}async function ut(t,{reload:e=!0}={}){var s;let n=document.querySelector(`[data-catalog="${CSS.escape(t)}"]`),a=d.find(r=>String(r.id)===String(t));if(!n||!a)return;let o={..._(n),sourceKind:a.sourceKind,sourceRef:a.sourceRef||a.id,status:A((s=n.querySelector("[data-status]:checked"))==null?void 0:s.value)};await I(`/api/questions/admin/catalog/${encodeURIComponent(t)}`,{method:"PUT",body:JSON.stringify(o)}),m.delete(String(t)),e&&(u(`\u300C${o.title}\u300D\u3092${mt(o.status)}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h())}async function Ut(t){var s;if(!t)return;let e=String(t.dataset.compareCatalog||""),n=d.find(r=>String(r.id)===e);if(!n)return;let a=t.querySelector("[data-compare-save]"),o={..._(t),sourceKind:n.sourceKind,sourceRef:n.sourceRef||n.id,status:A((s=t.querySelector("[data-compare-status]:checked"))==null?void 0:s.value)};a.disabled=!0,a.textContent="\u4FDD\u5B58\u4E2D";try{await I(`/api/questions/admin/catalog/${encodeURIComponent(e)}`,{method:"PUT",body:JSON.stringify(o)}),u(`\u6BD4\u8F03\u6B04\u306E\u300C${o.title}\u300D\u3092${mt(o.status)}\u3068\u3057\u3066\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h()}catch(r){a.disabled=!1,a.textContent="\u3053\u306E\u554F\u984C\u3092\u4FDD\u5B58",u(L(r),!0)}}async function zt(){let t=[...m];if(!t.length)return;let e=document.getElementById("saveAllQuestions");e.disabled=!0,e.textContent=`\u4FDD\u5B58\u4E2D 0/${t.length}`;try{for(let n=0;n<t.length;n+=1)await ut(t[n],{reload:!1}),e.textContent=`\u4FDD\u5B58\u4E2D ${n+1}/${t.length}`;u(`${t.length}\u554F\u306E\u5909\u66F4\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`),await h()}catch(n){u(L(n),!0),F()}}function Pt(){if(d.length&&!(m.size&&!confirm("\u672A\u4FDD\u5B58\u306E\u5909\u66F4\u306F\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306B\u542B\u307E\u308C\u307E\u305B\u3093\u3002\u4FDD\u5B58\u6E08\u307F\u306E\u5185\u5BB9\u3067\u7D9A\u3051\u307E\u3059\u304B\uFF1F")))try{let t=J(d);u(`\u63A1\u7528\u30FB\u4FDD\u7559\u30FB\u7121\u52B9\u5316\u3092\u542B\u3080\u5168${t.count}\u554F\u3092\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u7528CSV\u306B\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002`)}catch(t){u("CSV\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30D6\u30E9\u30A6\u30B6\u306E\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",!0)}}function _(t){var e;return{title:t.querySelector('[data-field="title"]').value.trim(),choices:Array.from(t.querySelectorAll("[data-choice]")).map(n=>n.value.trim()),category:"\u307F\u3093\u306A\u306E\u304A\u984C",reviewNote:((e=t.querySelector('[data-field="reviewNote"]'))==null?void 0:e.value.trim())||""}}function q(t){t&&(m.add(String(t.dataset.catalog)),t.classList.add("dirty"),F())}function F(){let t=document.getElementById("saveAllQuestions");t.disabled=m.size===0,t.textContent=m.size?`\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58\uFF08${m.size}\u554F\uFF09`:"\u5909\u66F4\u3092\u307E\u3068\u3081\u3066\u4FDD\u5B58"}function Ht(){let t=[...window.COMMON_QUESTION_CARDS||[]],e=new Set;return t.flatMap(n=>{let a=String(n.id);return!a||e.has(a)?[]:(e.add(a),[{...n,id:a,category:"\u307F\u3093\u306A\u306E\u304A\u984C",sourceKind:"static",sourceRef:a,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C",status:"approved"}])})}function Vt(t,e){let n=new Map((e||[]).map(s=>[String(s.id),s])),a=t.map(s=>{let r=n.get(String(s.id));return r?{...s,...r,sourceLabel:"\u6A19\u6E96\u306E\u304A\u984C"}:s}),o=new Set(t.map(s=>String(s.id)));for(let s of e||[])o.has(String(s.id))||a.push({...s,sourceLabel:s.sourceKind==="candidate"?"\u65B0\u898F\u5019\u88DC":"\u63A1\u7528\u3057\u305F\u81EA\u4F5C"});return a}function Jt(t,e){let n=new Map;for(let a of Array.isArray(e)?e:[]){let o=String((a==null?void 0:a.questionId)||""),s=(a==null?void 0:a.mode)==="live"?"live":(a==null?void 0:a.mode)==="challenge"?"challenge":"";if(!o||!s)continue;let r=n.get(o)||{challengeShownCount:0,challengeSkipCount:0,liveShownCount:0,liveSkipCount:0};r[`${s}ShownCount`]+=Math.max(0,Number(a.shownCount)||0),r[`${s}SkipCount`]+=Math.max(0,Number(a.skipCount)||0),n.set(o,r)}return(t||[]).map(a=>{let o=n.get(String(a.id))||{challengeShownCount:0,challengeSkipCount:0,liveShownCount:0,liveSkipCount:0};return{...a,...o,selectionShownCount:o.challengeShownCount+o.liveShownCount,selectionSkipCount:o.challengeSkipCount+o.liveSkipCount}})}function Yt(t){let e=S(t);if(e==null)return`
      <strong class="skip-rate no-data">\u30C7\u30FC\u30BF\u306A\u3057</strong>
      <span class="meta">\u8868\u793A\u5F8C\u306B\u96C6\u8A08</span>
    `;let n=Math.max(0,Number(t.selectionShownCount)||0),a=Math.max(0,Number(t.selectionSkipCount)||0);return`
    <strong class="skip-rate">${pt(e)}</strong>
    <span class="meta">\u30B9\u30AD\u30C3\u30D7 ${a}\u56DE / \u8868\u793A ${n}\u56DE</span>
    <span class="meta">\u901A\u5E38 ${tt(t.challengeSkipCount,t.challengeShownCount)}<br>LIVE ${tt(t.liveSkipCount,t.liveShownCount)}</span>
  `}function tt(t,e){let n=Math.max(0,Number(e)||0);return n?`${pt(Math.min(Math.max(0,Number(t)||0)/n,1))}\uFF08${Math.max(0,Number(t)||0)}/${n}\uFF09`:"\u30C7\u30FC\u30BF\u306A\u3057"}function pt(t){return`${(Math.max(0,Number(t)||0)*100).toFixed(1)}%`}function A(t){return t==="held"?"held":t==="disabled"?"disabled":"approved"}function mt(t){return t==="held"?"\u4FDD\u7559":t==="disabled"?"\u7121\u52B9\u5316":"\u63A1\u7528"}function Zt(t){return t==="custom"?"\u63A1\u7528\u3057\u305F\u81EA\u4F5C":t==="candidate"?"\u65B0\u898F\u5019\u88DC":"\u6A19\u6E96\u306E\u304A\u984C"}async function I(t,e={}){let n=C(),a=new Headers(e.headers||{});a.set("x-live-admin-session",n),e.body&&a.set("content-type","application/json");let o=await fetch(t,{...e,headers:a,cache:"no-store"}),s=await o.json().catch(()=>({}));if(!o.ok)throw ht(s.error||"request-failed",o.status);return s}function u(t,e=!1){M.hidden=!1,M.textContent=t,M.classList.toggle("error",e)}function L(t){return{"admin-forbidden":"\u7BA1\u7406\u30C8\u30FC\u30AF\u30F3\u304C\u9055\u3044\u307E\u3059\u3002","admin-otp-invalid":"6\u6841\u306E\u8A8D\u8A3C\u30B3\u30FC\u30C9\u304C\u9055\u3046\u304B\u3001\u6709\u52B9\u6642\u9593\u3092\u904E\u304E\u3066\u3044\u307E\u3059\u3002","admin-session-required":"\u7BA1\u7406\u8005\u8A8D\u8A3C\u3092\u884C\u3063\u3066\u304F\u3060\u3055\u3044\u3002","admin-session-expired":"\u7BA1\u7406\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u671F\u9650\u304C\u5207\u308C\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u8A8D\u8A3C\u3057\u3066\u304F\u3060\u3055\u3044\u3002","admin-2fa-not-configured":"\u672C\u756A\u306E\u7BA1\u7406\u8005\u4E8C\u8981\u7D20\u8A8D\u8A3C\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002","question-invalid":"\u554F\u984C\u6587\u30685\u3064\u306E\u9078\u629E\u80A2\u3092\u3059\u3079\u3066\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002","question-personal-information-detected":"\u672C\u540D\u30FB\u5B66\u6821\u540D\u30FBSNS ID\u30FB\u96FB\u8A71\u756A\u53F7\u30FB\u4F4F\u6240\u3089\u3057\u3044\u5185\u5BB9\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002","submission-already-reviewed":"\u3053\u306E\u304A\u984C\u306F\u3059\u3067\u306B\u5BE9\u67FB\u6E08\u307F\u3067\u3059\u3002"}[t==null?void 0:t.message]||"\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u5165\u529B\u3068\u901A\u4FE1\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}function ht(t,e){let n=new Error(t);return n.status=e,n}function et(t){return String(t||"").normalize("NFKC").toLocaleLowerCase("ja").trim()}function ft(t){return t?new Date(Number(t)).toLocaleString("ja-JP"):"\u672A\u8A2D\u5B9A"}function p(t){return String(t!=null?t:"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e])}function l(t){return p(t)}})();
