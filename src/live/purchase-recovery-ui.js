// Historical purchases only. No checkout, game creation or analytics calls.
export function purchaseDownloadHref(value, origin) {
  try {
    const url = new URL(String(value), origin);
    return url.origin === origin && !url.username && !url.password && /^\/api\/live\/downloads\/[A-Za-z0-9_-]{8,80}$/.test(url.pathname) ? url.href : '';
  } catch { return ''; }
}

export function purchaseRecoveryScript(copy) {
  const labels = JSON.stringify(copy).replace(/</g, '\\u003c');
  return `(() => {
    const copy = ${labels};
    const downloadHref = ${purchaseDownloadHref.toString()};
    const form = document.getElementById('purchase-recovery');
    if (!form) return;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button');
      const status = document.getElementById('purchase-recovery-status');
      const link = document.getElementById('purchase-recovery-download');
      button.disabled = true; status.textContent = ''; link.hidden = true;
      try {
        const response = await fetch('/api/live/purchases/recover', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: form.elements.orderId.value.trim(), email: form.elements.email.value.trim() })
        });
        if (!response.ok) throw new Error('recovery-unavailable');
        const data = await response.json();
        const href = downloadHref(data.downloadUrl, location.origin);
        if (!href) throw new Error('invalid-download');
        link.href = href; link.hidden = false;
      } catch { status.textContent = '⚠ ' + copy.contact; }
      finally { button.disabled = false; }
    });
  })();`;
}
