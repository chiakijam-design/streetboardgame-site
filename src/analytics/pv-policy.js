import {pvCopy} from './pv-copy.js';
const PUBLIC_PATHS=new Set(['/','/challenge','/challenge/library','/challenge/ranking','/challenge-guide','/about','/product','/terms','/privacy','/legal','/content-guidelines','/minor-policy','/creator-terms']);
export function pvPublicPath(path,locales){const parts=path.split('/').filter(Boolean);if(locales.includes(parts[0]))parts.shift();const route=parts.length?'/'+parts.join('/'):'/';return PUBLIC_PATHS.has(route)?route:null;}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
// The beacon ID is public installation metadata, never an account credential.
export const CF_PV_TOKEN='d0480a717f184d468c77bfe7126340d0';
export function injectPVChoice(html,url,locale,locales){
 const route=pvPublicPath(url.pathname,locales);if(!route||html.includes('id="wata-pv-config"'))return html;
 const copy=pvCopy(locale),privacy=(locale==='ja'?'':'/'+locale)+'/privacy';
 const config={v:1,locale,copy,privacy,token:CF_PV_TOKEN,publicPaths:[...PUBLIC_PATHS],locales};
 const script='<script type="application/json" id="wata-pv-config">'+json(config)+'</script><script defer src="/global-pv.js?v=20261105-1"></script>';
 let out=html.replace(/<\/body>/i,script+'</body>');
 if(route==='/privacy'){
  const policy='<section id="cloudflare-pv-policy" data-testid="cloudflare-pv-policy"><h2>'+escape(copy[0])+'</h2><p>'+escape(copy[1])+'</p><p>'+escape(copy[7])+'</p><p>'+escape(copy[9])+'</p><p><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare — '+escape(copy[5])+'</a></p><p><a href="?analytics=exclude">'+escape(locale==='ja'?'すべてのアクセス解析を停止':locale==='en'?'Stop all access analytics':'Google / Microsoft / Cloudflare — '+copy[3])+'</a></p><button type="button" data-wata-pv-settings>'+escape(copy[4])+'</button></section>';
  out=out.replace(/<article\b[^>]*class="legal-card"[^>]*>/i,'$&'+policy);
 }
 return out;
}
