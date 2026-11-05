(function optionalCloudflareViews(w,d){
 'use strict';
 if(w.__WATA_CF_PV_CHOICE__)return;w.__WATA_CF_PV_CHOICE__=true;
 var data=d.getElementById('wata-pv-config'),config;
 try{config=JSON.parse(data.textContent);}catch(_){return;}
 if(config.v!==1||!Array.isArray(config.copy)||config.copy.length!==10||!Array.isArray(config.publicPaths)||!Array.isArray(config.locales)||!/^\w{32}$/.test(config.token))return;
 if(config.mode!==undefined&&config.mode!=='consent'&&config.mode!=='notice'&&config.mode!=='pending-notice')return;
 var noticeMode=config.mode==='notice',pendingNotice=config.mode==='pending-notice';
 function permitted(){var selected=choice();return selected==='allow'||(noticeMode&&selected==='unknown');}
 var copy=config.copy,key='watachan:cf-pv-consent:v1',exclude='watachan:analytics-excluded:v1',ttl=180*86400000,loaded=false,loading=false,storageUnavailable=false,storageReady=null,dialog,opener,returnFocus,status,grant,deny;
 // The same existing all-analytics opt-out also works on policy pages, which
 // do not otherwise load legacy analytics.js. Never clear it on CF consent.
 try{if(new URL(w.location.href).searchParams.get('cf_pv')==='off')w.localStorage.setItem(key,JSON.stringify({v:1,choice:'deny',at:Date.now()}));}catch(_){}
 try{if(new URL(w.location.href).searchParams.get('analytics')==='exclude')w.localStorage.setItem(exclude,'1');}catch(_){}
 function route(){try{var u=new URL(w.location.href),parts=u.pathname.split('/').filter(Boolean);if(config.locales.indexOf(parts[0])!==-1)parts.shift();var p=parts.length?'/'+parts.join('/'):'/';return config.publicPaths.indexOf(p)!==-1?p:null;}catch(_){return null;}}
 function choice(){try{var raw=w.localStorage.getItem(key);if(raw===null)return 'unknown';var x=JSON.parse(raw);if(!x||x.v!==1)return 'invalid';if(x.choice==='deny')return 'deny';if(x.choice==='allow'&&Number.isFinite(x.at)&&x.at<=Date.now()+300000)return Date.now()-x.at<ttl?'allow':'expired';return 'invalid';}catch(_){return 'invalid';}}
 function excluded(){
  storageUnavailable=false;try{if(new URL(w.location.href).searchParams.get('cf_pv')==='off'||new URL(w.location.href).searchParams.get('analytics')==='exclude'||w.localStorage.getItem(exclude)==='1')return true;}catch(_){storageUnavailable=true;return true;}
  if(w.navigator.webdriver||w.navigator.globalPrivacyControl===true||w.navigator.doNotTrack==='1')return true;
  // Automatic collection requires a working preference store, including writes.
  // The constant, immediately removed probe is not a visitor identifier.
  if(noticeMode&&choice()!=='deny'){
   if(storageReady===null){try{var probe=key+':availability';w.localStorage.setItem(probe,'1');if(w.localStorage.getItem(probe)!=='1')throw Error();w.localStorage.removeItem(probe);storageReady=true;}catch(_){storageReady=false;}}
   if(!storageReady){storageUnavailable=true;return true;}
  }
  return false;
 }
 function publicHost(){return w.location.protocol==='https:'&&['www.streetboardgame.com','streetboardgame.com'].indexOf(w.location.hostname)!==-1;}
 function safe(){if(!publicHost()||excluded()||!route())return false;
  var secret=/(?:[?&#]|%3[fF]|%26)(?:manage|manage_token|token|secret|password)(?:=|%3[dD])|(?:^|[^a-f0-9])[a-f0-9]{48}(?:$|[^a-f0-9])/i;
  if(secret.test(String(w.location.href))||secret.test(String(d.referrer||'')))return false;
  // For automatic notice-mode collection, never forward a detailed third-party
  // or non-public same-site referrer path. Do not mutate the browser referrer.
  if(noticeMode&&d.referrer){try{var ref=new URL(d.referrer);if(ref.username||ref.password)return false;
   if(ref.origin!==w.location.origin){if(ref.pathname!=='/'||ref.search||ref.hash)return false;}
   else {var parts=ref.pathname.split('/').filter(Boolean);if(config.locales.indexOf(parts[0])!==-1)parts.shift();if(config.publicPaths.indexOf(parts.length?'/'+parts.join('/'):'/')===-1)return false;}
  }catch(_){return false;}}
  return true;
 }
 function existingBeacon(){return !!d.querySelector('script[src*="static.cloudflareinsights.com/beacon.min.js"]');}
 function schedule(){
  if(loaded||loading||!permitted()||!safe())return;
  // A rollout with automatic injection still present must not add a second tag.
  if(existingBeacon())return;
  loading=true;
  var start=function(){loading=false;if(loaded||!permitted()||!safe()||existingBeacon())return;
   var s=d.createElement('script');s.async=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';
   // Canonical document views only. Answer/query/history changes are not PV.
   s.setAttribute('data-cf-beacon',JSON.stringify({token:config.token,spa:false}));
   s.dataset.wataCfPv=noticeMode?'regional-notice':'consented';s.referrerPolicy='no-referrer';loaded=true;d.head.appendChild(s);
  };
  if(typeof w.requestIdleCallback==='function')w.requestIdleCallback(start,{timeout:1500});else w.setTimeout(start,0);
 }
 function save(value){try{w.localStorage.setItem(key,JSON.stringify({v:1,choice:value,at:Date.now()}));if(choice()!==value)throw Error();return true;}catch(_){status.textContent=copy[8];return false;}}
 function close(){if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');if(returnFocus)returnFocus.focus();}
 function select(value){if(!save(value)){if(value==='deny'){var stopped=new URL(w.location.href);stopped.searchParams.set('cf_pv','off');w.location.replace(stopped.href);}return;}close();if(value==='deny'&&(loaded||loading)){w.location.reload();return;}if(value==='allow')schedule();}
 function el(tag,text,parent){var node=d.createElement(tag);if(text)node.textContent=text;if(parent)parent.appendChild(node);return node;}
 function open(event){if(!dialog)return;returnFocus=event&&event.currentTarget?event.currentTarget:null;grant.disabled=excluded();status.textContent=storageUnavailable?copy[8]:(choice()==='expired'?config.renewalNotice||copy[7]:'');if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');dialog.scrollTop=0;dialog.querySelector('.wata-pv-close').focus({preventScroll:true});}
 function setup(){
  if(!publicHost()||!route()||w.navigator.webdriver)return;
  var css=el('style','',d.head);css.textContent='#wata-pv-choice{box-sizing:border-box;max-width:min(38rem,calc(100vw - 24px));width:38rem;max-height:85dvh;overflow:auto;border:2px solid #222;border-radius:18px;padding:22px;background:#fff;color:#222;font:inherit;line-height:1.65}#wata-pv-choice::backdrop{background:#0006}#wata-pv-choice h2{font-size:1.25rem;margin:0 0 .75rem}#wata-pv-choice p{overflow-wrap:anywhere;margin:.75rem 0}#wata-pv-choice button,[data-wata-pv-settings],[data-wata-pv-stop]{font:inherit;white-space:normal;overflow-wrap:anywhere;min-height:44px;padding:10px 14px;border:2px solid #222;border-radius:10px;background:#fff;color:#222;cursor:pointer}#wata-pv-choice button:focus-visible,[data-wata-pv-settings]:focus-visible,[data-wata-pv-stop]:focus-visible{outline:3px solid #3454d1;outline-offset:3px}.wata-pv-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.wata-pv-actions button{background:#fff7b2!important;font-weight:700}#wata-pv-choice .wata-pv-close{display:block;margin-inline-start:auto}#wata-pv-settings-wrap{margin:16px auto;padding:0 12px;max-width:70rem;text-align:center}';
  dialog=el('dialog','',d.body);dialog.id='wata-pv-choice';dialog.setAttribute('aria-labelledby','wata-pv-title');dialog.setAttribute('aria-describedby','wata-pv-description');dialog.dir=['ar','he'].indexOf(config.locale)!==-1?'rtl':'ltr';
  var closer=el('button',copy[6],dialog);closer.className='wata-pv-close';closer.type='button';closer.addEventListener('click',close);
  var title=el('h2',copy[0],dialog);title.id='wata-pv-title';var body=el('p',copy[1],dialog);body.id='wata-pv-description';el('p',copy[7],dialog);el('p',copy[9],dialog);
  var link=el('a',copy[5],dialog);link.href=config.privacy+'#cloudflare-pv-policy';link.target='_blank';link.rel='noopener noreferrer';
  status=el('p','',dialog);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  var actions=el('div','',dialog);actions.className='wata-pv-actions';deny=el('button',copy[3],actions);grant=el('button',copy[2],actions);deny.type=grant.type='button';deny.addEventListener('click',function(){select('deny');});grant.addEventListener('click',function(){select('allow');});
  var wrap=el('div','',d.body);wrap.id='wata-pv-settings-wrap';opener=el('button',copy[4],wrap);opener.type='button';opener.setAttribute('data-wata-pv-settings','');
  d.querySelectorAll('[data-wata-pv-settings]').forEach(function(button){button.addEventListener('click',open);});
  if(noticeMode||pendingNotice){
   wrap.setAttribute('role','region');wrap.setAttribute('aria-label',copy[0]);wrap.setAttribute('data-wata-pv-notice','');
   wrap.style.cssText='box-sizing:border-box;margin:0;padding:10px 12px;border-bottom:1px solid #555;background:#fff;color:#222;text-align:center;max-width:none;font:inherit;line-height:1.5';
   var summary=el('p',pendingNotice?config.changeNotice:(config.notice||copy[1]));summary.style.cssText='margin:0 auto 8px;max-width:70rem;overflow-wrap:anywhere';wrap.insertBefore(summary,opener);
   var stop=el('button',config.stopText||copy[3],wrap);stop.type='button';stop.setAttribute('data-wata-pv-stop','');stop.style.marginInlineStart='8px';
   stop.addEventListener('click',function(){select('deny');});
   d.body.insertBefore(wrap,d.body.firstChild);
   // Render the notice and controls before the deferred measurement starts.
   if(!excluded()&&(choice()==='expired'||choice()==='invalid'||(pendingNotice&&choice()==='unknown')))open();else schedule();
  }else if(!excluded()&&choice()!=='allow'&&choice()!=='deny')open();else schedule();
 }
 w.addEventListener('storage',function(event){if(event.key!==key&&event.key!==exclude)return;if((!permitted()||excluded())&&(loaded||loading))w.location.reload();else if(permitted())schedule();});
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})(window,document);
