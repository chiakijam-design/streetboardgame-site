(function passiveCloudflareViews(w,d){
 'use strict';
 if(w.__WATA_CF_PV_CHOICE__)return;w.__WATA_CF_PV_CHOICE__=true;
 var config;try{config=JSON.parse(d.getElementById('wata-pv-config').textContent);}catch(_){return;}
 if(config.v!==1||config.policy!=='passive'||!Array.isArray(config.publicPaths)||!Array.isArray(config.locales)||!/^\w{32}$/.test(config.token))return;
 var key='watachan:cf-pv-consent:v1',exclude='watachan:analytics-excluded:v1',ttl=180*86400000,loaded=false,loading=false,storeReady=null;
 try{var query=new URL(w.location.href).searchParams;if(query.getAll('analytics').indexOf('exclude')!==-1)w.localStorage.setItem(exclude,'1');if(query.get('cf_pv')==='off')w.localStorage.setItem(key,JSON.stringify({v:1,choice:'deny',at:Date.now()}));}catch(_){}
 function choice(){try{var raw=w.localStorage.getItem(key);if(raw===null)return 'unknown';var x=JSON.parse(raw);if(!x||x.v!==1)return 'invalid';if(x.choice==='deny')return 'deny';if(x.choice==='allow'&&Number.isFinite(x.at)&&x.at<=Date.now()+300000)return Date.now()-x.at<ttl?'allow':'expired';return 'invalid';}catch(_){return 'invalid';}}
 function permitted(){var c=choice();return config.mode==='notice'&&(c==='unknown'||c==='allow');}
 function excluded(){
  try{var u=new URL(w.location.href);if(u.searchParams.getAll('analytics').indexOf('exclude')!==-1||u.searchParams.get('cf_pv')==='off'||w.localStorage.getItem(exclude)==='1')return true;}catch(_){return true;}
  if(w.navigator.webdriver||w.navigator.globalPrivacyControl===true||w.navigator.doNotTrack==='1')return true;
  if(storeReady===null){try{var probe=key+':availability';w.localStorage.setItem(probe,'1');if(w.localStorage.getItem(probe)!=='1')throw Error();w.localStorage.removeItem(probe);storeReady=true;}catch(_){storeReady=false;}}
  return !storeReady;
 }
 function route(){try{var parts=new URL(w.location.href).pathname.split('/').filter(Boolean);if(config.locales.indexOf(parts[0])!==-1)parts.shift();return config.publicPaths.indexOf(parts.length?'/'+parts.join('/'):'/')!==-1;}catch(_){return false;}}
 function safe(){
  if(w.location.protocol!=='https:'||['www.streetboardgame.com','streetboardgame.com'].indexOf(w.location.hostname)===-1||excluded()||!route())return false;
  var secret=/(?:[?&#]|%3[fF]|%26)(?:manage|manage_token|token|secret|password)(?:=|%3[dD])|(?:^|[^a-f0-9])[a-f0-9]{48}(?:$|[^a-f0-9])/i;
  if(secret.test(String(w.location.href))||secret.test(String(d.referrer||'')))return false;
  if(d.referrer){try{var ref=new URL(d.referrer);if(ref.username||ref.password)return false;if(ref.origin!==w.location.origin){if(ref.pathname!=='/'||ref.search||ref.hash)return false;}else{var parts=ref.pathname.split('/').filter(Boolean);if(config.locales.indexOf(parts[0])!==-1)parts.shift();if(config.publicPaths.indexOf(parts.length?'/'+parts.join('/'):'/')===-1)return false;}}catch(_){return false;}}
  return true;
 }
 function existing(){return !!d.querySelector('script[src*="static.cloudflareinsights.com/beacon.min.js"]');}
 function schedule(){
  if(loaded||loading||!permitted()||!safe()||existing())return;loading=true;
  var start=function(){loading=false;if(loaded||!permitted()||!safe()||existing())return;var s=d.createElement('script');s.async=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon',JSON.stringify({token:config.token,spa:false}));s.dataset.wataCfPv='passive-reviewed-region';s.referrerPolicy='no-referrer';loaded=true;d.head.appendChild(s);};
  if(typeof w.requestIdleCallback==='function')w.requestIdleCallback(start,{timeout:1500});else w.setTimeout(start,0);
 }
 w.addEventListener('storage',function(e){if(e.key!==null&&e.key!==key&&e.key!==exclude)return;if((!permitted()||excluded())&&(loaded||loading))w.location.reload();else schedule();});
 // No consent UI, banners, advance notices, buttons, dialogs or positive grants.
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})(window,document);
