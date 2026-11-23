import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Offline support + installable PWA (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is best-effort */
    });
  });
}

// Ask the browser to keep IndexedDB data even under storage pressure.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((p) => {
    if (!p) navigator.storage.persist().catch(() => {});
  });
}
