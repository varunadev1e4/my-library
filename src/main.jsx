import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './ui.css';
createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

// Self-heal: if the page loaded without its styles (for example a bad cached copy), clear caches and reload once.
window.addEventListener('load', async () => {
  const styled = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || /karla/i.test(getComputedStyle(document.body).fontFamily);
  if (styled || sessionStorage.getItem('lib-healed')) return;
  sessionStorage.setItem('lib-healed', '1');
  try {
    (await navigator.serviceWorker?.getRegistrations?.() || []).forEach((r) => r.unregister());
    (await caches.keys()).forEach((k) => caches.delete(k));
  } catch {}
  location.reload();
});
