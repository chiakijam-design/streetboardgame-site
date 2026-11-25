(function () {
  var button = document.querySelector('[data-pack-copy]');
  var fallback = document.querySelector('[data-pack-copy-fallback]');
  if (!button || !fallback) return;
  button.hidden = false;
  var label = button.textContent;
  button.addEventListener('click', async function () {
    var copied = false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(fallback.value);
        copied = true;
      } catch {}
    }
    if (!copied) {
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      try { copied = document.execCommand('copy'); } catch {}
    }
    if (!copied) return;
    if (!fallback.hidden) {
      fallback.hidden = true;
      button.focus();
    }
    button.textContent = button.getAttribute('data-copied');
    setTimeout(function () { button.textContent = label; }, 2000);
  });
})();
