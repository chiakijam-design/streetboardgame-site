let qrCodeReady;

function loadQrCode() {
  if (window.WatachanLiveQrCode) return Promise.resolve(window.WatachanLiveQrCode);
  if (qrCodeReady) return qrCodeReady;
  const source = document.querySelector('script[data-build-lazy="qr-code"]');
  if (!source?.src) return Promise.reject(new Error('qr-code-source-missing'));
  qrCodeReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source.src;
    script.async = true;
    if (source.nonce) script.nonce = source.nonce;
    script.onload = () => {
      if (window.WatachanLiveQrCode) resolve(window.WatachanLiveQrCode);
      else reject(new Error('qr-code-unavailable'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('qr-code-load-failed'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    qrCodeReady = undefined;
    throw error;
  });
  return qrCodeReady;
}

export async function renderLiveInviteQr(canvas, url) {
  const qrCode = await loadQrCode();
  // A live update may replace the canvas while its library is loading.
  if (!canvas.isConnected) return;
  await qrCode.toCanvas(canvas, url, { width: 188, margin: 1, errorCorrectionLevel: 'M' });
}
