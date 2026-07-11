(function () {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;

  const normalContent = viewport.getAttribute('content') || 'width=device-width, initial-scale=1, viewport-fit=cover';
  const resetContent = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  const visualViewport = window.visualViewport;
  let resetButton = null;
  let resetTimer = 0;
  let verifyTimer = 0;
  let positionFrame = 0;
  let resetting = false;

  function isViewportShifted() {
    const scale = visualViewport ? visualViewport.scale : 1;
    const offsetLeft = visualViewport ? visualViewport.offsetLeft : 0;
    return Math.abs(scale - 1) > 0.02 || offsetLeft > 0.5 || window.scrollX !== 0;
  }

  function positionResetButton() {
    if (!resetButton || resetButton.hidden) return;
    if (!visualViewport) {
      resetButton.style.position = 'fixed';
      resetButton.style.top = '12px';
      resetButton.style.right = '12px';
      resetButton.style.left = 'auto';
      return;
    }

    const pageLeft = Number.isFinite(visualViewport.pageLeft)
      ? visualViewport.pageLeft
      : window.scrollX + visualViewport.offsetLeft;
    const pageTop = Number.isFinite(visualViewport.pageTop)
      ? visualViewport.pageTop
      : window.scrollY + visualViewport.offsetTop;
    const visibleWidth = visualViewport.width || window.innerWidth;
    const left = Math.max(pageLeft + 8, pageLeft + visibleWidth - resetButton.offsetWidth - 10);

    resetButton.style.position = 'absolute';
    resetButton.style.top = `${Math.max(8, pageTop + 10)}px`;
    resetButton.style.left = `${left}px`;
    resetButton.style.right = 'auto';
  }

  function updateResetButton() {
    if (!resetButton) return;
    resetButton.hidden = !isViewportShifted();
    window.cancelAnimationFrame(positionFrame);
    if (!resetButton.hidden) {
      positionFrame = window.requestAnimationFrame(positionResetButton);
    }
  }

  function resetViewport() {
    if (resetting) return;
    resetting = true;
    resetButton.disabled = true;
    resetButton.textContent = '表示を復元中…';
    resetButton.setAttribute('aria-busy', 'true');
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const top = visualViewport && Number.isFinite(visualViewport.pageTop)
      ? visualViewport.pageTop
      : window.scrollY;
    window.clearTimeout(resetTimer);
    window.clearTimeout(verifyTimer);
    viewport.setAttribute('content', resetContent);
    window.requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top, behavior: 'auto' });
      resetTimer = window.setTimeout(() => {
        viewport.setAttribute('content', normalContent);
        window.scrollTo({ left: 0, top, behavior: 'auto' });
        verifyTimer = window.setTimeout(() => {
          if (isViewportShifted()) {
            document.dispatchEvent(new CustomEvent('watachan:save-before-viewport-reload'));
            resetButton.textContent = '再読み込みして復元中…';
            window.setTimeout(() => window.location.reload(), 80);
            return;
          }
          resetting = false;
          resetButton.disabled = false;
          resetButton.textContent = '表示を元に戻す';
          resetButton.removeAttribute('aria-busy');
          updateResetButton();
        }, 650);
      }, 220);
    });
  }

  function initViewportRecovery() {
    resetButton = document.createElement('button');
    resetButton.id = 'viewportResetControl';
    resetButton.type = 'button';
    resetButton.textContent = '表示を元に戻す';
    resetButton.setAttribute('aria-label', '拡大表示を元の大きさに戻す');
    Object.assign(resetButton.style, {
      zIndex: '10000',
      minHeight: '44px',
      padding: '8px 14px',
      border: '3px solid #1a1a1a',
      borderRadius: '999px',
      background: '#ffe26b',
      color: '#1a1a1a',
      boxShadow: '3px 3px 0 #1a1a1a',
      fontFamily: '"Zen Maru Gothic", "Noto Sans JP", sans-serif',
      fontSize: '14px',
      fontWeight: '900',
      lineHeight: '1.2',
      whiteSpace: 'nowrap',
    });
    resetButton.hidden = true;
    resetButton.addEventListener('click', resetViewport);
    document.body.appendChild(resetButton);

    if (visualViewport) {
      visualViewport.addEventListener('resize', updateResetButton);
      visualViewport.addEventListener('scroll', updateResetButton);
    }
    window.addEventListener('scroll', updateResetButton, { passive: true });
    window.addEventListener('orientationchange', updateResetButton);
    window.addEventListener('pageshow', updateResetButton);
    document.addEventListener('focusin', () => {
      window.setTimeout(updateResetButton, 350);
    });
    document.addEventListener('focusout', () => {
      window.setTimeout(updateResetButton, 120);
    });
    updateResetButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initViewportRecovery, { once: true });
  } else {
    initViewportRecovery();
  }
})();
