export const QUESTION_CARD_FONT_URL = '/assets/fonts/HuiFontP29.woff2?v=20260727-font-1';

// Warm the unchanged font on quiz intent after initial rendering. Do not hold
// back text or download a full Japanese font for a passive page view.
export function injectQuestionFontWarmup(html, url) {
  if (url.pathname !== '/challenge' || !html.includes('HuiFontP29')
    || html.includes('data-wata-question-font-warmup')) return html;
  const script = `<script data-wata-question-font-warmup>(function(w,d){
    var painted=false,pending=false,started=false;
    function intent(target){return target&&typeof target.closest==='function'&&target.closest('#creator-name,#participant-name,[data-action="start-create"],[data-action="join"]');}
    function warm(){
      if(!painted){pending=true;return;}
      if(started||w.location.pathname!=='/challenge'||!d.fonts)return;
      var active=Array.from(d.fonts).some(function(f){return f.family.replace(/["']/g,'')==='HuiFontP29'&&f.status!=='unloaded';});
      if(active)return;
      started=true;d.fonts.load('400 24px "HuiFontP29"','あ').catch(function(){});
    }
    function ready(){painted=true;if(pending||intent(d.activeElement))warm();}
    function afterPaint(){if(typeof w.requestAnimationFrame==='function')w.requestAnimationFrame(function(){w.requestAnimationFrame(ready);});else w.setTimeout(ready,0);}
    d.addEventListener('focusin',function(event){if(intent(event.target))warm();},true);
    d.addEventListener('pointerdown',function(event){if(intent(event.target))warm();},true);
    if(d.readyState==='complete')afterPaint();else w.addEventListener('load',afterPaint,{once:true});
  })(window,document);</script>`;
  return html.replace(/<\/head>/i, script + '</head>');
}
