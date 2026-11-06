import {JP_BASIC_DESCRIPTION} from './jp-ga4-policy.js';
import {pvCopy} from './pv-copy.js';
import {PV_NOTICE_COPY,PV_STOP_COPY,PV_NOTICE_DETAILS,PV_NOTICE_REUSE} from './pv-notice-copy.js';
import {PASSIVE_SCOPE,GOOGLE_OFF} from './passive-policy.js';
const PUBLIC_PATHS=new Set(['/','/challenge','/challenge/library','/challenge/ranking','/challenge-guide','/about','/product','/terms','/privacy','/legal','/content-guidelines','/minor-policy','/creator-terms']);
export function pvPublicPath(path,locales){const parts=path.split('/').filter(Boolean);if(locales.includes(parts[0]))parts.shift();const route=parts.length?'/'+parts.join('/'):'/';return PUBLIC_PATHS.has(route)?route:null;}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
export const CF_PV_TOKEN='d0480a717f184d468c77bfe7126340d0'; // public installation ID
export function injectPVChoice(html,url,locale,locales,mode='consent',googlePolicy='off'){
 const route=pvPublicPath(url.pathname,locales);if(!route||html.includes('id="wata-pv-config"'))return html;
 mode=mode==='notice'||mode==='pending-notice'?mode:'consent';
 const privacy=(locale==='ja'?'':'/'+locale)+'/privacy';
 const config={v:1,policy:'passive',mode,locale,privacy,token:CF_PV_TOKEN,publicPaths:[...PUBLIC_PATHS],locales};
 const script='<script type="application/json" id="wata-pv-config">'+json(config)+'</script><script defer src="/global-pv.js?v=20261106-passive-1"></script>';
 let out=html.replace(/<\/body>/i,script+'</body>');
 const parts=url.pathname.split('/').filter(Boolean);if(locales.includes(parts[0]))parts.shift();
 if(parts.join('/')==='privacy'){
  const notice=PV_NOTICE_COPY[locale]||PV_NOTICE_COPY.ja,copy=pvCopy(locale);
  const googleDetails=googlePolicy==='jp-basic'&&JP_BASIC_DESCRIPTION[locale]?'<p><a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">'+(locale==='ja'?'Googleによるデータの利用':'How Google uses data')+'</a></p>':'';
  const scope=(PASSIVE_SCOPE[locale]||PASSIVE_SCOPE.en).replace('{date}','2026-11-07 00:00 JST / 2026-11-06 15:00 UTC');
  const description=notice[1]+' '+(PV_NOTICE_DETAILS[locale]||PV_NOTICE_DETAILS.ja)+' '+(PV_NOTICE_REUSE[locale]||PV_NOTICE_REUSE.ja);
  const policy='<section id="cloudflare-pv-policy" data-testid="cloudflare-pv-policy"><h2>'+escape(copy[0])+'</h2><p>'+escape(scope)+'</p><p>'+escape(description)+'</p><p>'+escape(notice[2])+'</p><p>'+escape(googlePolicy==='jp-basic'&&JP_BASIC_DESCRIPTION[locale]?JP_BASIC_DESCRIPTION[locale]:GOOGLE_OFF[locale]||GOOGLE_OFF.en)+'</p>'+googleDetails+'<p><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare — '+escape(copy[5])+'</a></p><p><a href="?analytics=exclude">'+escape(locale==='ja'?'すべてのアクセス解析を停止':locale==='en'?'Stop all access analytics':PV_STOP_COPY[locale]||PV_STOP_COPY.en)+'</a></p></section>';
  out=out.replace(/<article\b[^>]*class="legal-card"[^>]*>/i,'$&'+policy);
 }
 return out;
}
