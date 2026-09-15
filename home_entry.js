import { startCreatorGame } from './src/home/start.js';

if ((window.__INITIAL_SCREEN || 'top') === 'top') {
  const input = document.getElementById('top-creator-name');
  const form = input.closest('form');
  function showError(message) {
    let error = document.getElementById('top-name-error');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (!message) {
      error?.remove();
      input.removeAttribute('aria-describedby');
      return;
    }
    if (!error) {
      error = document.createElement('p');
      error.id = 'top-name-error';
      error.setAttribute('role', 'alert');
      error.style.cssText = 'margin:0;color:#B81745;font-size:12px;font-weight:900';
      input.after(error);
    }
    error.textContent = message;
    input.setAttribute('aria-describedby', error.id);
  }
  input.addEventListener('input', () => showError(''));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showError(startCreatorGame('challenge', input.value));
  });
  form.querySelector('[data-home-mode="live"]').addEventListener('click', () => {
    showError(startCreatorGame('live', input.value));
  });
} else {
  // Only secondary information pages need the existing React application.
  for (const source of document.querySelectorAll('script[type="application/x-page-script"]')) {
    const script = document.createElement('script');
    script.async = false;
    script.src = source.src;
    document.head.appendChild(script);
  }
}
