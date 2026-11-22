// 2026-11-22（Gemini 見直し19）：10問パックのページの「リンクをコピー」。コピーできる端末だけボタンを出す
(function () {
  var button = document.querySelector('[data-pack-copy]');
  if (!button || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return;
  button.hidden = false;
  var label = button.textContent;
  button.addEventListener('click', function () {
    navigator.clipboard.writeText(button.getAttribute('data-pack-copy')).then(function () {
      button.textContent = button.getAttribute('data-copied');
      setTimeout(function () { button.textContent = label; }, 2000);
    }, function () {});
  });
})();
