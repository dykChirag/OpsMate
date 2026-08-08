import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/** Cursor sheen + magnetic press feedback on interactive surfaces */
function attachInteractionPolish() {
  const onMove = (e) => {
    const el = e.target.closest?.(
      '.btn, .nav-btn, .service-card, .project-pick, .bento-card, .story-step-card, .story-tl-card, .incident'
    );
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  };

  const onDown = (e) => {
    const el = e.target.closest?.('.btn, .nav-btn, .project-pick, .nav-home');
    if (el) el.classList.add('is-pressing');
  };
  const onUp = () => {
    document.querySelectorAll('.is-pressing').forEach((el) => el.classList.remove('is-pressing'));
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointercancel', onUp, { passive: true });
}

attachInteractionPolish();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
