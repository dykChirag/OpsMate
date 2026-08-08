import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, loadConfig, setAuthPat, setAuthProject, clearAuth, getAuthPat, getAuthProject } from './api.js';
import profilePic from '../assests/Profile.jpg';

const CREATOR = {
  name: 'Chirag Patil',
  handle: 'dykChirag',
  forLabel: 'Zerops',
  forUrl: 'https://zerops.io',
  socials: [
    { id: 'x', label: 'X', href: 'https://x.com/dykChirag' },
    { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/dykchirag/' },
    { id: 'github', label: 'GitHub', href: 'https://github.com/dykChirag' },
    { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/chiragggg_fit/' },
  ],
};

function SocialIcon({ id }) {
  switch (id) {
    case 'x':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            fill="currentColor"
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"
          />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            fill="currentColor"
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
          />
        </svg>
      );
    case 'github':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            fill="currentColor"
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
          />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
          />
        </svg>
      );
    default:
      return null;
  }
}

/** Compact “created by / for” credit rail */
function CreatorPanel({ compact = false }) {
  return (
    <aside
      className={`creator-panel${compact ? ' is-compact' : ''}`}
      aria-label="Creator credits"
    >
      <div className="creator-panel-id">
        <a
          className="creator-panel-avwrap"
          href={CREATOR.socials.find((s) => s.id === 'github')?.href || '#'}
          target="_blank"
          rel="noreferrer noopener"
          title={`${CREATOR.name} on GitHub`}
          aria-label={`${CREATOR.name} on GitHub`}
        >
          <img
            className="creator-panel-avatar"
            src={profilePic}
            alt=""
            width={36}
            height={36}
            decoding="async"
          />
        </a>
        <div className="creator-panel-meta">
          <div className="creator-panel-row">
            <span className="creator-panel-kicker">Created by</span>
            <a
              className="creator-panel-name"
              href={CREATOR.socials.find((s) => s.id === 'github')?.href || '#'}
              target="_blank"
              rel="noreferrer noopener"
            >
              {CREATOR.handle}
            </a>
          </div>
          <div className="creator-panel-row">
            <span className="creator-panel-kicker">Created for</span>
            <a
              className="creator-panel-for"
              href={CREATOR.forUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {CREATOR.forLabel}
            </a>
          </div>
        </div>
      </div>
      <span className="creator-panel-seam" aria-hidden />
      <nav className="creator-panel-socials" aria-label="Social profiles">
        {CREATOR.socials.map((s) => (
          <a
            key={s.id}
            className="creator-panel-social"
            href={s.href}
            target="_blank"
            rel="noreferrer noopener"
            title={s.label}
            aria-label={`${CREATOR.name} on ${s.label}`}
          >
            <SocialIcon id={s.id} />
          </a>
        ))}
      </nav>
    </aside>
  );
}

const VIEWS = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'services', label: 'Services', icon: 'services' },
  { id: 'incidents', label: 'Incidents', icon: 'incidents' },
  { id: 'health', label: 'Health', icon: 'health' },
  { id: 'architecture', label: 'Architecture', icon: 'architecture' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'connect', label: 'Connect', icon: 'connect', special: true },
];

/** All navigable surfaces (console + product story). */
const VIEW_IDS = new Set(['story', ...VIEWS.map((v) => v.id)]);
const VIEW_STORAGE_KEY = 'opsmate.view';

function normalizeViewId(raw) {
  if (raw == null) return null;
  let id = String(raw).trim().toLowerCase();
  // Accept "#incidents", "/incidents", "view=incidents"
  id = id.replace(/^#/, '').replace(/^\//, '');
  if (id.startsWith('view=')) id = id.slice(5);
  // Map friendly aliases
  if (id === 'home' || id === 'dashboard' || id === 'console') id = 'overview';
  return VIEW_IDS.has(id) ? id : null;
}

function readViewFromLocation() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeViewId(params.get('view') || params.get('v'));
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }
  const hashRaw = String(window.location.hash || '').replace(/^#/, '');
  // "#incidents" or "#/incidents"
  const fromHash = normalizeViewId(hashRaw.replace(/^\//, '').split(/[/?&]/)[0]);
  if (fromHash) return fromHash;
  return null;
}

function readViewFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const local = normalizeViewId(localStorage.getItem(VIEW_STORAGE_KEY));
    if (local) return local;
  } catch {
    /* private mode */
  }
  try {
    const session = normalizeViewId(sessionStorage.getItem(VIEW_STORAGE_KEY));
    if (session) return session;
  } catch {
    /* ignore */
  }
  return null;
}

/** Query → hash → storage. Default story only on first-ever visit. */
function readInitialView() {
  return readViewFromLocation() || readViewFromStorage() || 'story';
}

/** Keep URL + storage in sync so refresh restores the same section. */
function persistView(id) {
  const viewId = normalizeViewId(id);
  if (!viewId || typeof window === 'undefined') return;

  try {
    localStorage.setItem(VIEW_STORAGE_KEY, viewId);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(VIEW_STORAGE_KEY, viewId);
  } catch {
    /* ignore */
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('view', viewId);
    // Keep hash in sync for deep links / older code paths
    url.hash = viewId;
    const next = `${url.pathname}${url.search}${url.hash}`;
    const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== cur) {
      window.history.replaceState({ view: viewId }, '', next);
    }
  } catch {
    /* ignore */
  }
}

/** Map Zerops / demo stack status → visual tone */
function serviceTone(status) {
  const s = String(status || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (/fail|error|crash|unhealthy|dead/.test(s)) return 'fail';
  if (/ready to deploy|ready_to_deploy|deploying|pending|building|starting/.test(s)) return 'deploy';
  if (/\bstop|stopped|inactive|off|disabled/.test(s)) return 'stopped';
  if (/active|running|healthy|\bready\b/.test(s)) return 'ok';
  return 'muted';
}

function statusDotClass(st) {
  const t = serviceTone(st);
  if (t === 'ok') return 'dot-ok';
  if (t === 'deploy' || t === 'fail') return t === 'fail' ? 'dot-bad' : 'dot-warn';
  if (t === 'stopped') return 'dot-stop';
  return 'dot-muted';
}

const TONE_HEX = {
  ok: '#22C55E',
  deploy: '#F59E0B',
  stopped: '#6B7C7C',
  fail: '#E85D52',
  muted: '#b0bbb8',
};

function NavIcon({ name }) {
  const props = {
    className: 'nav-svg',
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  switch (name) {
    case 'overview':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'services':
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="6" rx="1.5" />
          <rect x="2" y="11" width="20" height="6" rx="1.5" />
          <path d="M6 6h.01M6 14h.01M10 6h4M10 14h4" />
        </svg>
      );
    case 'incidents':
      return (
        <svg {...props}>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case 'health':
      return (
        <svg {...props}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case 'architecture':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <path d="M8 7.5 10.5 15M16 7.5 13.5 15M8.5 6h7" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...props}>
          <path d="M21 12a8 8 0 0 1-11.4 7.2L3 21l1.8-5.4A8 8 0 1 1 21 12Z" />
        </svg>
      );
    case 'connect':
      return (
        <svg {...props}>
          <path d="M15 7h3a4 4 0 0 1 0 8h-3M9 17H6a4 4 0 0 1 0-8h3" />
          <path d="M8 12h8" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...props}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case 'panel':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      );
    case 'project':
      return (
        <svg {...props} width={16} height={16}>
          <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
        </svg>
      );
    case 'sandbox':
      // Flask / chaos lab
      return (
        <svg {...props}>
          <path d="M9 3h6" />
          <path d="M10 3v6.2L5.2 17a3 3 0 0 0 2.5 4.5h8.6A3 3 0 0 0 18.8 17L14 9.2V3" />
          <path d="M8.2 14h7.6" />
        </svg>
      );
    case 'key':
      // PAT / token
      return (
        <svg {...props}>
          <circle cx="8" cy="15" r="4" />
          <path d="M11.5 12.5 20 4" />
          <path d="M16 5.5 18.5 8" />
          <path d="M18 6.5 20.5 9" />
        </svg>
      );
    case 'story':
      // Book / narrative home
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
          <path d="M8 7h8M8 11h6" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function HeroRadar({ onEnter, onConnect, healthScore, healthMode }) {
  const health =
    typeof healthScore === 'number' && Number.isFinite(healthScore)
      ? Math.max(0, Math.min(100, Math.round(healthScore)))
      : null;
  const display = health != null ? health : '—';
  const barPct = health != null ? health : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const healthOff = health != null ? circ * (1 - health / 100) : circ;
  const scoreHint =
    healthMode === 'live-project'
      ? 'live weighted fleet score'
      : health != null
        ? 'sandbox weighted score'
        : 'loading live score…';

  return (
    <div className="hero-radar" role="img" aria-label="OpsMate live ops radar preview">
      <div className="hero-radar-frame">
        {/* ambient field */}
        <div className="hr-field" aria-hidden>
          <div className="hr-noise" />
          <div className="hr-grid" />
          <div className="hr-glow hr-glow-a" />
          <div className="hr-glow hr-glow-b" />
          <div className="hr-sweep" />
          <div className="hr-ring hr-ring-1" />
          <div className="hr-ring hr-ring-2" />
          <div className="hr-ring hr-ring-3" />
          {[...Array(12)].map((_, i) => (
            <span
              key={i}
              className="hr-particle"
              style={{
                '--a': `${(i * 30 + 8) % 360}deg`,
                '--d': `${28 + (i % 4) * 14}%`,
                '--delay': `${i * 0.35}s`,
              }}
            />
          ))}
        </div>

        {/* link beams */}
        <svg className="hr-beams" viewBox="0 0 400 400" aria-hidden>
          <defs>
            <linearGradient id="hrBeam" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(14,178,154,0)" />
              <stop offset="50%" stopColor="rgba(14,178,154,0.55)" />
              <stop offset="100%" stopColor="rgba(14,178,154,0)" />
            </linearGradient>
          </defs>
          <path className="hr-beam b1" d="M200 200 L78 92" stroke="url(#hrBeam)" />
          <path className="hr-beam b2" d="M200 200 L318 110" stroke="url(#hrBeam)" />
          <path className="hr-beam b3" d="M200 200 L90 300" stroke="url(#hrBeam)" />
          <path className="hr-beam b4" d="M200 200 L310 298" stroke="url(#hrBeam)" />
          <circle className="hr-pulse-dot" cx="200" cy="200" r="3" fill="#0EB29A" />
        </svg>

        {/* center core */}
        <div className="hr-core">
          <div className="hr-core-aura" />
          <div className="hr-core-shell">
            <svg className="hr-core-arc" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle
                className={health == null ? 'hr-core-arc-pending' : undefined}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="#0EB29A"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={healthOff}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="hr-core-inner">
              <ZeropsLogo className="hr-core-logo" />
              <strong>OpsMate</strong>
              <span>AI SRE</span>
            </div>
          </div>
        </div>

        {/* floating signal cards */}
        <button type="button" className="hr-card hr-c1" onClick={onEnter}>
          <div className="hr-card-icon tone-ok" aria-hidden>
            <NavIcon name="health" />
          </div>
          <div className="hr-card-body">
            <div className="hr-card-top">
              <span className="hr-card-label">Health</span>
              <span className="hr-card-value tone-ok">
                {health != null ? `${display}%` : '…'}
              </span>
            </div>
            <div className="hr-card-bar">
              <i style={{ width: `${barPct}%` }} />
            </div>
            <small>{scoreHint}</small>
          </div>
        </button>

        <button type="button" className="hr-card hr-c2 alert" onClick={onEnter}>
          <div className="hr-card-icon tone-warn" aria-hidden>
            <NavIcon name="incidents" />
            <span className="hr-badge">1</span>
          </div>
          <div className="hr-card-body">
            <div className="hr-card-top">
              <span className="hr-card-label">Incident</span>
              <span className="hr-live">LIVE</span>
            </div>
            <strong className="hr-card-title">slow endpoint</strong>
            <small>diagnosed · remediable</small>
          </div>
        </button>

        <button type="button" className="hr-card hr-c3" onClick={onEnter}>
          <div className="hr-card-icon tone-info" aria-hidden>
            <NavIcon name="chat" />
          </div>
          <div className="hr-card-body">
            <div className="hr-card-top">
              <span className="hr-card-label">Chat</span>
            </div>
            <strong className="hr-card-title">Project-scoped</strong>
            <small>ask fleet · get answers</small>
          </div>
        </button>

        <button type="button" className="hr-card hr-c4" onClick={onConnect}>
          <div className="hr-card-icon tone-brand" aria-hidden>
            <NavIcon name="services" />
          </div>
          <div className="hr-card-body">
            <div className="hr-card-top">
              <span className="hr-card-label">Action</span>
            </div>
            <strong className="hr-card-title">Restart service</strong>
            <small>Zerops API one-click</small>
          </div>
        </button>

        {/* bottom status rail */}
        <div className="hr-rail" aria-hidden>
          <span className="hr-rail-dot" />
          <div className="hr-rail-track">
            <div className="hr-rail-text">
              signal · diagnose · act · review · signal · diagnose · act · review ·
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STORY_CTA = {
  primary: 'Enter the console',
  secondary: 'Use my Zerops project',
};

function StoryLanding({ onEnter, onConnect, healthScore, healthMode }) {
  return (
    <div className="story-page">
      <nav className="story-nav">
        <div className="topbar-left">
          <CreatorPanel />
          <div className="topbar-brand">
            <strong>OpsMate</strong>
            <span>AI SRE · Zerops</span>
          </div>
        </div>
        <div className="story-nav-links">
          <a href="#purpose">Why</a>
          <a href="#timeline">The loop</a>
          <a href="#how">How</a>
          <a href="#demo">Demo vs live</a>
        </div>
        <div className="btn-row story-nav-cta">
          <button type="button" className="btn btn-ghost" onClick={onEnter}>
            {STORY_CTA.primary}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConnect}>
            {STORY_CTA.secondary}
          </button>
        </div>
      </nav>

      <section className="story-hero">
        <div>
          <p className="story-eyebrow">Built for Zerops.io</p>
          <h1>
            <span className="mark">OpsMate</span>
            <br />
            Your fleet,
            <br />
            <em>diagnosed & guided</em>
          </h1>
          <p className="lede">
            The AI site reliability engineer for Zerops — health, incidents, architecture,
            and chat scoped to one project so answers never invent someone else’s stack.
          </p>
          <div className="story-cta-row">
            <button type="button" className="btn btn-primary" onClick={onEnter}>
              {STORY_CTA.primary}
            </button>
            <button type="button" className="story-cta-link" onClick={onConnect}>
              {STORY_CTA.secondary}
            </button>
          </div>
          <ul className="story-hero-badges" aria-label="Product capabilities">
            <li>Sandbox chaos</li>
            <li>Live PAT</li>
            <li>Project-scoped AI</li>
          </ul>
        </div>
        <HeroRadar
          onEnter={onEnter}
          onConnect={onConnect}
          healthScore={healthScore}
          healthMode={healthMode}
        />
      </section>

      <section className="story-section" id="purpose">
        <h2>Why this exists</h2>
        <p className="lede">
          Coding agents ship code. OpsMate sits on the platform side — so when a stack is READY_TO_DEPLOY,
          slow, or chatty with errors, you get diagnosis instead of a blank dashboard.
        </p>
        <div className="story-bento">
          <article className="story-step-card">
            <div className="n">01</div>
            <h3>See the truth</h3>
            <p>Live inventory + weighted health score so Chat and Health never argue about “which project.”</p>
          </article>
          <article className="story-step-card accent">
            <div className="n">02</div>
            <h3>Catch the failure</h3>
            <p>Chaos lab or real Zerops status → incidents with evidence, fixes, and recurrence grouping.</p>
          </article>
          <article className="story-step-card">
            <div className="n">03</div>
            <h3>Ship the action</h3>
            <p>Chat in plain English, architecture review on yaml, one-click service restart when a stack is stuck.</p>
          </article>
        </div>
      </section>

      <section className="story-section" id="timeline">
        <h2>One incident. One narrative.</h2>
        <p className="lede">
          Think of OpsMate less as a grid of widgets and more as a patient chart for your fleet —
          signals pin on a timeline until the agent has a story worth acting on.
        </p>
        <div className="story-timeline" role="list">
          <article className="story-tl-card" role="listitem">
            <div className="story-tl-time">T+0s</div>
            <h3>Signal</h3>
            <p>
              Logs spike or Zerops status flips. Sandbox chaos or live inventory hits the same pipeline.
            </p>
            <div className="story-tl-metric">
              <strong>ERR</strong>
              <span>+420 lines</span>
            </div>
          </article>
          <article className="story-tl-card accent" role="listitem">
            <div className="story-tl-time">T+few</div>
            <h3>Diagnosis</h3>
            <p>
              Rules + LLM pack evidence into title, cause, and safe fix — never inventing other projects’
              services.
            </p>
            <div className="story-tl-metric lime">
              <strong>AI</strong>
              <span>scoped context</span>
            </div>
          </article>
          <article className="story-tl-card dark" role="listitem">
            <div className="story-tl-time">Act</div>
            <h3>Remediate</h3>
            <p>Chat asks, “what’s wrong?”, Health agrees on the score, restart when READY_TO_DEPLOY sticks.</p>
            <div className="story-tl-metric">
              <strong>↻</strong>
              <span>restart ready</span>
            </div>
          </article>
          <article className="story-tl-card" role="listitem">
            <div className="story-tl-time">Review</div>
            <h3>Architecture</h3>
            <p>Paste or load yaml. Findings call out managed gaps without hallucinating npm deps on NATS.</p>
            <div className="story-tl-metric">
              <strong>YAML</strong>
              <span>honest model</span>
            </div>
          </article>
        </div>
      </section>

      <section className="story-section" id="how">
        <h2>How it works</h2>
        <p className="lede">One loop from signal → story → action.</p>
        <div className="story-flow">
          <span>Connect PAT</span>
          <span className="arrow">→</span>
          <span>Select project</span>
          <span className="arrow">→</span>
          <span>Score fleet health</span>
          <span className="arrow">→</span>
          <span>Diagnose incidents</span>
          <span className="arrow">→</span>
          <span>Chat · restart</span>
        </div>
        <div className="story-bento">
          <article className="story-step-card">
            <div className="n">IN</div>
            <h3>Signals in</h3>
            <p>Zerops status sync, log ingest / chaos, metrics on the demo patient, open incidents in Postgres.</p>
          </article>
          <article className="story-step-card">
            <div className="n">AI</div>
            <h3>Brain in the middle</h3>
            <p>
              LLM-powered diagnosis with rule-based fallback, project-scoped chat context so answers
              stay on your fleet.
            </p>
          </article>
          <article className="story-step-card">
            <div className="n">OUT</div>
            <h3>Actions out</h3>
            <p>Remediation steps, restart calls, architecture findings, deep-links into Zerops logging.</p>
          </article>
        </div>
      </section>

      {/* Recap ticker — after terms are introduced in How it works */}
      <div className="story-marquee" aria-hidden>
        <div className="story-marquee-track">
          {[
            'project-scoped only',
            'syslog → incidents',
            'fleet health score',
            'READY_TO_DEPLOY → restart',
            'yaml architecture review',
            'chaos lab demo',
          ]
            .concat([
              'project-scoped only',
              'syslog → incidents',
              'fleet health score',
              'READY_TO_DEPLOY → restart',
              'yaml architecture review',
              'chaos lab demo',
            ])
            .map((t, i) => (
              <span key={`${t}-${i}`}>{t}</span>
            ))}
        </div>
      </div>

      <section className="story-section" id="demo">
        <h2>Demo first. Your project when ready.</h2>
        <p className="lede">
          Open the story landing once; after you enter the console, refresh keeps you on the same section.
        </p>
        <div className="story-bento">
          <article className="story-step-card accent">
            <div className="n n-icon" aria-hidden>
              <NavIcon name="sandbox" />
            </div>
            <h3>Sandbox</h3>
            <p>Chaos lab + local demo stack. No token required. Perfect for a live walkthrough.</p>
          </article>
          <article className="story-step-card">
            <div className="n n-icon" aria-hidden>
              <NavIcon name="key" />
            </div>
            <h3>Live PAT</h3>
            <p>Paste a Zerops personal access token, pick a project, and OpsMate scopes everything to that fleet only.</p>
          </article>
          <article className="story-step-card">
            <div className="n n-icon" aria-hidden>
              <NavIcon name="story" />
            </div>
            <h3>Sticky section</h3>
            <p>Refresh on Health, Incidents, or Chat and stay there — the URL hash remembers the screen.</p>
          </article>
        </div>
      </section>

      <div className="story-end">
        <div>
          <h2>Ready to operate?</h2>
          <p>Jump into the console or wire your PAT and watch real hostnames replace the sandbox.</p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={onEnter}>
            {STORY_CTA.primary}
          </button>
          <button type="button" className="btn story-end-secondary" onClick={onConnect}>
            {STORY_CTA.secondary}
          </button>
        </div>
      </div>
    </div>
  );
}

function scoreToneColor(score) {
  const n = typeof score === 'number' ? score : null;
  if (n == null) return '#6B7C7C';
  if (n >= 80) return '#0EB29A';
  if (n >= 55) return '#F59E0B';
  return '#E85D52';
}

function HealthGauge({ score, compact = false, size: sizeProp }) {
  const n = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0;
  const size = sizeProp || (compact ? 110 : 150);
  const r = size * 0.385;
  const c = 2 * Math.PI * r;
  const off = c - (n / 100) * c;
  const color = scoreToneColor(typeof score === 'number' ? score : null);
  const cx = size / 2;
  const stroke = compact ? 8 : 10;
  return (
    <div
      className={`health-gauge${compact ? ' compact' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="rgba(38,64,62,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.4s' }}
        />
      </svg>
      <div className="health-gauge-value" style={{ color }}>
        {typeof score === 'number' ? score : '—'}
        {typeof score === 'number' ? (
          <span style={{ fontSize: compact ? 13 : 16, opacity: 0.7 }}>%</span>
        ) : null}
      </div>
    </div>
  );
}

/** Yaml / fleet metric cards — score colour + fill track */
function ScoreMetricCard({ value, label, meta, hint, variant = 'default' }) {
  const n = typeof value === 'number' ? value : null;
  const color = scoreToneColor(n);
  const pct = n == null ? 0 : Math.max(0, Math.min(100, n));
  return (
    <article
      className={`score-metric-card score-metric-${variant}`}
      style={{ '--score-c': color, '--score-p': `${pct}%` }}
    >
      <div className="score-metric-glow" aria-hidden />
      <div className="score-metric-head">
        <div>
          <div className="score-metric-num" style={{ color }}>
            {value ?? '—'}
            {n != null && <span className="score-metric-unit">/100</span>}
          </div>
          <div className="score-metric-label">{label}</div>
        </div>
        <div className="score-metric-mini" aria-hidden>
          <svg viewBox="0 0 48 48" width="52" height="52">
            <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(38,64,62,0.08)" strokeWidth="4" />
            <circle
              cx="24"
              cy="24"
              r="18"
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={`${2 * Math.PI * 18 * (1 - pct / 100)}`}
              transform="rotate(-90 24 24)"
              style={{ transition: 'stroke-dashoffset 0.85s cubic-bezier(0.22,1,0.36,1)' }}
            />
          </svg>
        </div>
      </div>
      <div className="score-metric-track" aria-hidden>
        <i style={{ width: `${pct}%`, background: color }} />
      </div>
      {meta && <div className="score-metric-meta">{meta}</div>}
      {hint && <div className="score-metric-hint">{hint}</div>}
    </article>
  );
}

function FleetMesh({ services = [], projectLabel }) {
  const nodes = (services || []).filter((s) => !s.isSystem).slice(0, 10);
  const cx = 220;
  const cy = 118;
  const rad = nodes.length > 6 ? 78 : 70;
  const counts = { ok: 0, deploy: 0, stopped: 0, fail: 0, muted: 0 };
  for (const s of nodes) counts[serviceTone(s.status)] = (counts[serviceTone(s.status)] || 0) + 1;

  return (
    <div className="fleet-mesh" aria-label="Project fleet topology">
      <svg viewBox="0 0 440 240" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="meshGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(14,178,154,0.2)" />
            <stop offset="100%" stopColor="rgba(14,178,154,0)" />
          </radialGradient>
          <filter id="nodeSoft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r="96" fill="url(#meshGlow)" />
        <circle
          cx={cx}
          cy={cy}
          r="88"
          fill="none"
          stroke="rgba(14,178,154,0.12)"
          strokeWidth="1"
          strokeDasharray="4 6"
          className="fleet-orbit-dash"
        />
        {nodes.map((s, i) => {
          const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad;
          const tone = serviceTone(s.status);
          const fill = TONE_HEX[tone] || TONE_HEX.muted;
          return (
            <g key={s.id || s.name || i} className="fleet-node-g">
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={fill}
                strokeOpacity="0.28"
                strokeWidth="1.5"
              />
              <circle cx={x} cy={y} r="12" fill={fill} opacity="0.12" />
              <circle
                cx={x}
                cy={y}
                r="7"
                fill={fill}
                filter="url(#nodeSoft)"
                stroke="#fff"
                strokeWidth="1.5"
              />
              <text className="fleet-node-label" x={x} y={y + 22} textAnchor="middle">
                {String(s.name || '').slice(0, 11)}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="28" fill="#ffffff" stroke="rgba(14,178,154,0.4)" strokeWidth="2" />
        <circle cx={cx} cy={cy} r="22" fill="rgba(14,178,154,0.08)" />
        <text className="fleet-core-label" x={cx} y={cy + 4} textAnchor="middle">
          {(projectLabel || 'project').slice(0, 12)}
        </text>
        {!nodes.length && (
          <text className="fleet-node-label" x={cx} y={cy + 52} textAnchor="middle">
            No services loaded
          </text>
        )}
      </svg>
      <div className="fleet-legend">
        {[
          { t: 'ok', l: 'Active' },
          { t: 'deploy', l: 'Ready / deploy' },
          { t: 'stopped', l: 'Stopped' },
          { t: 'fail', l: 'Failed' },
        ].map((item) => (
          <span key={item.t} className={`fleet-legend-item tone-${item.t}`}>
            <i style={{ background: TONE_HEX[item.t] }} />
            {item.l}
            {counts[item.t] ? ` · ${counts[item.t]}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function SeverityBars({ incidents = [] }) {
  const buckets = { high: 0, medium: 0, low: 0 };
  for (const i of incidents) {
    const s = String(i.severity || 'low').toLowerCase();
    if (s === 'critical' || s === 'high') buckets.high += 1;
    else if (s === 'medium') buckets.medium += 1;
    else buckets.low += 1;
  }
  const max = Math.max(1, buckets.high, buckets.medium, buckets.low);
  const rows = [
    { key: 'high', label: 'High', n: buckets.high, cls: 'high' },
    { key: 'medium', label: 'Medium', n: buckets.medium, cls: 'medium' },
    { key: 'low', label: 'Low', n: buckets.low, cls: 'low' },
  ];
  return (
    <div className="sev-bars">
      {rows.map((r) => (
        <div key={r.key} className="sev-bar-row">
          <span>{r.label}</span>
          <div className="sev-bar-track">
            <div
              className={`sev-bar-fill ${r.cls}`}
              style={{ width: `${(r.n / max) * 100}%` }}
            />
          </div>
          <span className="sev-bar-n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

function FlabbyMascot({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 72"
      width="56"
      height="56"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* body */}
      <ellipse cx="36" cy="40" rx="24" ry="22" fill="#5FD4D0" stroke="#1a2e2c" strokeWidth="2.2" />
      {/* legs */}
      <ellipse cx="26" cy="60" rx="6" ry="5" fill="#5FD4D0" stroke="#1a2e2c" strokeWidth="2" />
      <ellipse cx="46" cy="60" rx="6" ry="5" fill="#5FD4D0" stroke="#1a2e2c" strokeWidth="2" />
      {/* arms */}
      <ellipse
        className="flabby-arm"
        cx="14"
        cy="36"
        rx="6"
        ry="4.5"
        fill="#5FD4D0"
        stroke="#1a2e2c"
        strokeWidth="2"
        transform="rotate(-25 14 36)"
      />
      <ellipse
        className="flabby-arm-wave"
        cx="58"
        cy="28"
        rx="6"
        ry="4.5"
        fill="#5FD4D0"
        stroke="#1a2e2c"
        strokeWidth="2"
        transform="rotate(35 58 28)"
      />
      {/* eye */}
      <circle cx="36" cy="34" r="11" fill="#fff" stroke="#1a2e2c" strokeWidth="2" />
      <circle cx="38" cy="35" r="5.5" fill="#1a2e2c" />
      <circle cx="40" cy="33" r="1.8" fill="#fff" />
      {/* smile */}
      <path
        d="M24 46c3 7 21 7 24 0"
        fill="#1a2e2c"
        stroke="#1a2e2c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M30 48.5h3M39 48.5h3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Floating coach (console): always offers chat FAB.
 * In demo (no PAT / not live) shows two tip pills above the mascot.
 */
function FloatingCoach({ isDemo, onChat, onConnect }) {
  const [tipsOpen, setTipsOpen] = useState(true);
  const [hello, setHello] = useState(true);

  useEffect(() => {
    if (!isDemo) {
      setTipsOpen(false);
      return undefined;
    }
    setTipsOpen(true);
    setHello(true);
    const t = window.setTimeout(() => setHello(false), 2800);
    return () => clearTimeout(t);
  }, [isDemo]);

  return (
    <div className={`floating-coach${isDemo ? ' is-demo' : ''}`}>
      {isDemo && tipsOpen && (
        <div className="coach-tips" role="region" aria-label="Demo tips">
          {hello && (
            <div className="coach-hello" aria-hidden>
              Hello
            </div>
          )}
          <button type="button" className="coach-tip" onClick={onChat}>
            <span className="coach-tip-ic" aria-hidden>
              <NavIcon name="chat" />
            </span>
            Try using our Chat
          </button>
          <button type="button" className="coach-tip secondary" onClick={onConnect}>
            <span className="coach-tip-ic" aria-hidden>
              <NavIcon name="connect" />
            </span>
            Try connecting your PAT token
          </button>
          <button
            type="button"
            className="coach-dismiss"
            onClick={() => setTipsOpen(false)}
            title="Dismiss tips"
          >
            Dismiss
          </button>
        </div>
      )}
      <button
        type="button"
        className="coach-fab"
        onClick={() => {
          if (isDemo && !tipsOpen) setTipsOpen(true);
          else onChat();
        }}
        title={isDemo ? 'Demo tips & chat' : 'Open chat'}
        aria-label={isDemo ? 'Open demo tips or chat' : 'Open chat'}
      >
        <FlabbyMascot className="coach-flabby" />
        <span className="coach-fab-label">Chat</span>
      </button>
    </div>
  );
}

function ModeBanner({ liveProject, me, projectLabel, onConnect, onProjects }) {
  if (liveProject) {
    return (
      <div className="mode-banner live">
        <div className="mode-banner-text">
          <span className="mode-banner-icon" aria-hidden>
            <NavIcon name="connect" />
          </span>
          <div>
            <strong>Live on Zerops</strong> — project “{projectLabel || 'selected'}”.
            Health, incidents, and chat are scoped to this project’s real stacks.
          </div>
        </div>
      </div>
    );
  }
  if (me.connected) {
    return (
      <div className="mode-banner demo">
        <div className="mode-banner-text">
          <span className="mode-banner-icon">!</span>
          <div>
            <strong>Account connected — pick a project.</strong> Until you select one, OpsMate
            stays in sandbox mode and won’t diagnose your production fleets.
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={onProjects}>
          Choose project
        </button>
      </div>
    );
  }
  return (
    <div className="mode-banner demo">
      <div className="mode-banner-text">
        <span className="mode-banner-icon" aria-hidden>
          <NavIcon name="services" />
        </span>
        <div>
          <strong>You’re on the local demo.</strong> Chaos lab + sample yaml work offline.
          Connect a <em>Personal Access Token</em> to run OpsMate on <strong>your</strong> Zerops
          projects — same health, incidents, chat, and architecture tools.
        </div>
      </div>
      <button type="button" className="btn btn-primary" onClick={onConnect}>
        Connect PAT
      </button>
    </div>
  );
}

function ServiceCard({ s }) {
  const tone = serviceTone(s.status);
  return (
    <div className={`service-card tone-${tone}`}>
      <h4>
        <span className={`dot ${statusDotClass(s.status)}`} />
        {s.name}
      </h4>
      <div className="meta">{s.type || 'runtime'}</div>
      <span className={`status-pill tone-${tone}`}>{s.status || 'unknown'}</span>
      {s.id && <div className="meta">id {s.id}</div>}
      <Sparkline status={s.status} />
    </div>
  );
}

const SAMPLE_YAML = `zerops:
  - setup: demo
    build:
      base: nodejs@22
      buildCommands: [npm ci]
    run:
      base: nodejs@22
      envVariables:
        ZEROPS_PROMETHEUS_PORT: "9090"
      ports:
        - port: 3001
          httpSupport: true
      start: node index.js
  - setup: api
    build:
      base: nodejs@22
      buildCommands: [npm ci]
    run:
      base: nodejs@22
      ports:
        - port: 8080
          httpSupport: true
        - port: 5514
          httpSupport: false
      start: node server.js
  - setup: dashboard
    build:
      base: nodejs@22
      buildCommands: [npm ci, npm run build]
    run:
      base: nodejs@22
      ports:
        - port: 3000
          httpSupport: true
      start: node serve.js
`;

const CHAOS = [
  { id: 'slow', label: 'Latency spike', path: '/simulate/slow', cls: 'btn-warn' },
  { id: 'crash', label: 'Crash / 500', path: '/simulate/crash', cls: 'btn-danger' },
  { id: 'bad-query', label: 'DB failure', path: '/simulate/bad-query', cls: 'btn-danger' },
  { id: 'error-storm', label: 'Error storm', path: '/simulate/error-storm', cls: 'btn-danger' },
  { id: 'dep-timeout', label: 'Dependency timeout', path: '/simulate/dep-timeout', cls: 'btn-warn' },
  { id: 'memory', label: 'Memory pressure', path: '/simulate/memory', cls: 'btn-warn' },
];

const INCIDENT_SORT_OPTIONS = [
  { id: 'smart', label: 'Smart (actionable first)' },
  { id: 'severity-desc', label: 'Severity · high → low' },
  { id: 'severity-asc', label: 'Severity · low → high' },
  { id: 'latest', label: 'Latest first' },
  { id: 'earliest', label: 'Earliest first' },
];

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function sortIncidentGroups(groups, sortMode) {
  const list = [...(groups || [])];
  if (sortMode === 'smart' || !sortMode) {
    return list; // already ranked by action score in groupIncidentsForDisplay
  }
  if (sortMode === 'severity-desc') {
    return list.sort((a, b) => {
      const da = SEV_RANK[String(a.primary?.severity || 'low').toLowerCase()] || 0;
      const db = SEV_RANK[String(b.primary?.severity || 'low').toLowerCase()] || 0;
      if (db !== da) return db - da;
      return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0);
    });
  }
  if (sortMode === 'severity-asc') {
    return list.sort((a, b) => {
      const da = SEV_RANK[String(a.primary?.severity || 'low').toLowerCase()] || 0;
      const db = SEV_RANK[String(b.primary?.severity || 'low').toLowerCase()] || 0;
      if (da !== db) return da - db;
      return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0);
    });
  }
  if (sortMode === 'latest') {
    return list.sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));
  }
  if (sortMode === 'earliest') {
    return list.sort((a, b) => new Date(a.lastSeen || 0) - new Date(b.lastSeen || 0));
  }
  return list;
}

function sevBadge(sev) {
  const s = String(sev || 'low').toLowerCase();
  const cls =
    s === 'critical' || s === 'high'
      ? 'badge-high'
      : s === 'medium'
        ? 'badge-medium'
        : 'badge-low';
  return <span className={`badge ${cls}`}>{s}</span>;
}

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return d.toLocaleString();
}

/**
 * Display grouping + feed ranking:
 * - Filter out LLM-provider-failure ghosts (legacy rows)
 * - Collapse “no action needed” chaos tests into one summary card
 * - Rank actionable / non-chaos incidents first
 */
function isProviderFailureIncident(inc) {
  const blob = `${inc?.title || ''} ${inc?.explanation || ''} ${inc?.suggested_fix || ''}`;
  return /diagnosis temporarily unavailable|both LLM providers|LLM providers failed/i.test(blob);
}

function isNoActionFix(text) {
  return /no action needed|no immediate action|nothing to do|deliberate chaos|monitor for recurrence/i.test(
    String(text || '')
  );
}

function parseIncidentContext(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: String(raw) };
  }
}

function isChaosIncident(inc) {
  const ctx = parseIncidentContext(inc.raw_context);
  const ec = String(ctx?.eventClass || '');
  if (ec.startsWith('chaos:')) return true;
  const t = ctx?.triggerEvent || ctx?.triggerLog || {};
  if (t.chaos) return true;
  if (/simulat|intentional chaos|chaos test|deliberate/i.test(`${inc.title} ${inc.explanation}`)) {
    return true;
  }
  return false;
}

function fixActionScore(inc) {
  const fix = String(inc?.suggested_fix || '');
  if (isNoActionFix(fix) && isChaosIncident(inc)) return 0;
  if (isNoActionFix(fix)) return 1;
  const steps = (fix.match(/\d+\./g) || []).length;
  const sev =
    { critical: 40, high: 30, medium: 15, low: 5 }[String(inc.severity || '').toLowerCase()] || 0;
  const chaosPenalty = isChaosIncident(inc) ? -20 : 25;
  const metricBonus = String(inc.source || '') === 'metric' ? 10 : 0;
  const organicBonus =
    /app_latency|dep_timeout|resource|latency budget|dependency timeout|resource pressure|error rate/i.test(
      `${inc.title} ${inc.explanation || ''}`
    )
      ? 20
      : 0;
  return 10 + steps * 8 + sev + chaosPenalty + metricBonus + organicBonus;
}

function groupIncidentsForDisplay(incidents) {
  const cleaned = (incidents || []).filter((inc) => !isProviderFailureIncident(inc));

  const byStatus = { open: [], resolved: [] };
  for (const inc of cleaned) {
    const st = (inc.status || 'open') === 'open' ? 'open' : 'resolved';
    byStatus[st].push(inc);
  }

  function buildGroups(list, status) {
    const map = new Map();
    const noActionChaosBucket = [];

    for (const inc of list) {
      if (isChaosIncident(inc) && isNoActionFix(inc.suggested_fix)) {
        noActionChaosBucket.push(inc);
        continue;
      }
      const key = `${String(inc.service_name || '').toLowerCase()}|${String(inc.title || '').toLowerCase()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(inc);
    }

    const groups = [...map.entries()].map(([key, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
      const primary = sorted[0];
      const oldest = sorted[sorted.length - 1];
      return {
        groupKey: `${status}|${key}`,
        status,
        ids: sorted.map((i) => i.id),
        count: sorted.length,
        firstSeen: oldest?.created_at,
        lastSeen: primary?.created_at,
        primary,
        occurrences: sorted,
        kind: 'normal',
        actionScore: fixActionScore(primary),
      };
    });

    if (noActionChaosBucket.length) {
      const sorted = [...noActionChaosBucket].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
      const primary = {
        ...sorted[0],
        title:
          sorted.length === 1
            ? sorted[0].title || 'Chaos-test event (no action needed)'
            : `${sorted.length} chaos-test events, no action needed`,
        explanation:
          sorted.length === 1
            ? sorted[0].explanation
            : `${sorted.length} deliberate sandbox chaos/test signals resolved to “no action needed.” Expand for individual events — demos use these less often than real app signals.`,
        suggested_fix:
          'No action needed for deliberate chaos-lab tests. Prefer actionable cards above for real diagnostic depth.',
        severity: 'low',
      };
      groups.push({
        groupKey: `${status}|__chaos_no_action__`,
        status,
        ids: sorted.map((i) => i.id),
        count: sorted.length,
        firstSeen: sorted[sorted.length - 1]?.created_at,
        lastSeen: sorted[0]?.created_at,
        primary,
        occurrences: sorted,
        kind: 'chaos-summary',
        actionScore: -100,
      });
    }

    return groups.sort((a, b) => {
      if (b.actionScore !== a.actionScore) return b.actionScore - a.actionScore;
      return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0);
    });
  }

  return [...buildGroups(byStatus.open, 'open'), ...buildGroups(byStatus.resolved, 'resolved')];
}

function recurrenceLine(group) {
  if (group.kind === 'chaos-summary') {
    if (group.count <= 1) return `Seen ${relativeTime(group.lastSeen)} · collapsed chaos test`;
    return `${group.count} chaos-test events · first ${relativeTime(group.firstSeen)} · last ${relativeTime(group.lastSeen)}`;
  }
  if (group.count <= 1) {
    return `Seen ${relativeTime(group.lastSeen)}`;
  }
  return `First seen ${relativeTime(group.firstSeen)} · recurred ${group.count} times · last seen ${relativeTime(group.lastSeen)}`;
}

function extractLogLines(ctx) {
  if (!ctx) return [];
  const lines = [];
  if (ctx.triggerEvent || ctx.triggerLog) {
    const t = ctx.triggerEvent || ctx.triggerLog;
    lines.push({
      kind: 'trigger',
      level: t.level || 'error',
      message: t.message || JSON.stringify(t).slice(0, 240),
      ts: t.timestamp || t.ts,
      service: t.service,
    });
  }
  const recent = ctx.recentLogs || ctx.logs || [];
  if (Array.isArray(recent)) {
    for (const l of recent.slice(-12)) {
      lines.push({
        kind: 'context',
        level: l.level || 'info',
        message: l.message || String(l).slice(0, 240),
        ts: l.timestamp || l.ts,
        service: l.service,
      });
    }
  }
  if (ctx.statusInsight) {
    lines.push({
      kind: 'status',
      level: ctx.severity || 'warn',
      message:
        ctx.explanation ||
        ctx.title ||
        `Zerops status insight for project ${ctx.projectName || ctx.projectId || ''}`.trim(),
      service: ctx.service_name,
      ts: null,
    });
    if (ctx.suggested_fix) {
      lines.push({
        kind: 'status',
        level: 'info',
        message: `Platform fix: ${ctx.suggested_fix}`,
        service: ctx.service_name,
        ts: null,
      });
    }
  }
  if (ctx._raw && !lines.length) {
    lines.push({ kind: 'raw', level: 'info', message: String(ctx._raw).slice(0, 500) });
  }
  return lines;
}

function fixSteps(text) {
  if (!text) return [];
  const parts = String(text)
    .split(/\n|(?<=\.) (?=[A-Z])|(?:;\s+)|(?:\s*→\s*)|(?:\s*->\s*)/)
    .map((s) => s.trim().replace(/^[-*•]\s*/, ''))
    .filter((s) => s.length > 3);
  return parts.length ? parts : [String(text).trim()];
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Lightweight markdown → HTML (bold, italic, code, lists, headers, links). */
function mdToHtml(md) {
  let s = escapeHtml(String(md || ''));

  // fenced code
  s = s.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre class="md-pre"><code>${code.replace(/^\n|\n$/g, '')}</code></pre>`;
  });
  // inline code
  s = s.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');
  // bold / italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // links [text](url)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>'
  );
  // headers
  s = s.replace(/^######\s+(.+)$/gm, '<h6 class="md-h">$1</h6>');
  s = s.replace(/^#####\s+(.+)$/gm, '<h5 class="md-h">$1</h5>');
  s = s.replace(/^####\s+(.+)$/gm, '<h5 class="md-h">$1</h5>');
  s = s.replace(/^###\s+(.+)$/gm, '<h4 class="md-h">$1</h4>');
  s = s.replace(/^##\s+(.+)$/gm, '<h3 class="md-h">$1</h3>');
  s = s.replace(/^#\s+(.+)$/gm, '<h3 class="md-h">$1</h3>');
  // unordered lists
  s = s.replace(/^(?:[-*•])\s+(.+)$/gm, '<li class="md-li">$1</li>');
  s = s.replace(/(?:<li class="md-li">[\s\S]*?<\/li>\n?)+/g, (block) => `<ul class="md-ul">${block}</ul>`);
  // ordered lists
  s = s.replace(/^\d+\.\s+(.+)$/gm, '<li class="md-li">$1</li>');
  // paragraphs / breaks
  s = s
    .split(/\n{2,}/)
    .map((block) => {
      if (/^<(?:h[3-6]|ul|pre|p)/.test(block.trim())) return block;
      if (block.includes('<li ')) return block;
      return `<p class="md-p">${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return s;
}

function ChatMarkdown({ text, className = '' }) {
  const html = useMemo(() => mdToHtml(text), [text]);
  return (
    <div
      className={`md-body ${className}`}
      // Content is escaped then tagged — not raw user HTML
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Word-by-word typing reveal with markdown (ChatGPT-style). */
function TypewriterMarkdown({ text, msPerWord = 28, onDone }) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const full = String(text || '');

  useEffect(() => {
    setShown('');
    setDone(false);
    if (!full) {
      setDone(true);
      onDone?.();
      return undefined;
    }

    // Prefer word chunks; keep newlines as tokens
    const tokens = full.match(/\S+\s*|\n+/g) || [full];
    let i = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      i += 1;
      setShown(tokens.slice(0, i).join(''));
      // Keep log scrolled while tokens stream in
      requestAnimationFrame(() => {
        const el = document.querySelector('.chat-gpt .chat-log');
        if (el) el.scrollTop = el.scrollHeight;
      });
      if (i >= tokens.length) {
        setDone(true);
        onDone?.();
        return;
      }
      const delay = tokens.length > 80 ? Math.max(12, msPerWord - 8) : msPerWord;
      timer = window.setTimeout(tick, delay);
    };
    let timer = window.setTimeout(tick, 40);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  return (
    <div className={`typewriter ${done ? 'done' : 'typing'}`}>
      <ChatMarkdown text={shown} />
      {!done && <span className="caret" aria-hidden />}
    </div>
  );
}

function ChatBubble({ msg, onStreamDone }) {
  const isUser = msg.role === 'user';
  if (msg.pending && !msg.text) {
    return (
      <div className="chat-msg is-bot">
        <div className="chat-avatar" aria-hidden>
          <ZeropsLogo className="chat-avatar-logo" />
        </div>
        <div className="bubble bot thinking">
          <span className="think-dot" />
          <span className="think-dot" />
          <span className="think-dot" />
          <span className="think-label">Thinking…</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`chat-msg ${isUser ? 'is-user' : 'is-bot'}`}>
      {!isUser && (
        <div className="chat-avatar" aria-hidden>
          <ZeropsLogo className="chat-avatar-logo" />
        </div>
      )}
      <div className={`bubble ${isUser ? 'user' : 'bot'}`}>
        {isUser ? (
          <div className="md-body user-plain">{msg.text}</div>
        ) : msg.stream ? (
          <TypewriterMarkdown
            text={msg.text}
            onDone={() => onStreamDone?.(msg.id)}
          />
        ) : (
          <ChatMarkdown text={msg.text} />
        )}
      </div>
    </div>
  );
}

/** Zerops isometric “Z” mark */
function ZeropsLogo({ className = 'topbar-logo' }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 42.27 50.48"
      aria-hidden
    >
      <path
        className="z-main"
        d="M20.19.7L3 7.27A4 4 0 0 0 .46 11v16.54L8.36 23v-9.3L21.6 8.62V.44a4 4 0 0 0-1.41.26z"
        transform="translate(-.46 -.44)"
      />
      <path
        className="z-main"
        d="M8.5 37.74l13.1-7.55v-9.12L1.36 32.74a1.82 1.82 0 0 0-.9 1.56v6.11A4 4 0 0 0 3 44.1l17.19 6.57a4 4 0 0 0 1.41.26v-8.18z"
        transform="translate(-.46 -.44)"
      />
      <path
        className="z-sec"
        d="M41.9 18.47a1.67 1.67 0 0 0 .84-1.47v-6a4 4 0 0 0-2.54-3.73L23 .7a4 4 0 0 0-1.4-.26v8.18l13 5-13 7.49v9.12z"
        transform="translate(-.46 -.44)"
      />
      <path
        className="z-sec"
        d="M23 50.67l17.2-6.57a4 4 0 0 0 2.54-3.69V23.7l-7.9 4.56v9.43L21.6 42.75v8.18a4 4 0 0 0 1.4-.26z"
        transform="translate(-.46 -.44)"
      />
    </svg>
  );
}

function Sparkline({ status }) {
  const tone = serviceTone(status);
  const heights = useMemo(() => {
    const seed = String(status || 'x')
      .split('')
      .reduce((a, ch) => a + ch.charCodeAt(0), 0);
    return Array.from({ length: 10 }, (_, i) => {
      const base = 35 + ((seed * (i + 3)) % 55);
      if (tone === 'ok') return Math.min(95, base + 10);
      if (tone === 'stopped') return Math.max(18, base * 0.45);
      if (tone === 'fail') return 20 + ((i * 17 + seed) % 70);
      if (tone === 'deploy') return 40 + ((i % 3) * 18) + (seed % 12);
      return base;
    });
  }, [status, tone]);

  return (
    <div className={`fleet-spark tone-${tone}`} aria-hidden>
      {heights.map((h, i) => (
        <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} />
      ))}
    </div>
  );
}

/** Zerops GUI logging deep-link (best-effort URL shape). */
function zeropsLogsUrl(projectId, serviceId) {
  if (!projectId) return null;
  const base = 'https://app.zerops.io';
  if (serviceId) {
    return `${base}/project/${projectId}/logging?serviceStackId=${encodeURIComponent(serviceId)}`;
  }
  return `${base}/project/${projectId}`;
}

export default function App() {
  const [view, setView] = useState(readInitialView);
  const [navOpen, setNavOpen] = useState(true);
  const [status, setStatus] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [incidentTotals, setIncidentTotals] = useState({ open: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [chaosState, setChaosState] = useState({});
  const [incidentSort, setIncidentSort] = useState('smart');
  const [incidentSortOpen, setIncidentSortOpen] = useState(false);
  const [sortMenuPos, setSortMenuPos] = useState(null);
  const [incidentRefreshing, setIncidentRefreshing] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState('open'); // open | resolved | all
  const [selectMode, setSelectMode] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState(() => new Set());
  const [actionBusy, setActionBusy] = useState({});
  const mainRef = useRef(null);
  const sortMenuRef = useRef(null);
  const sortListRef = useRef(null);
  const [chat, setChat] = useState([
    {
      role: 'bot',
      id: 'welcome',
      stream: false,
        text: 'Ask anything about live incidents, your Zerops project services, or what to do next.',
    },
  ]);
  const [chatIn, setChatIn] = useState('Why is the deployment unhealthy right now?');
  const [chatBusy, setChatBusy] = useState(false);
  const chatLogRef = useRef(null);
  const [yaml, setYaml] = useState(SAMPLE_YAML);
  const [yamlMeta, setYamlMeta] = useState(null); // { source, note, projectName }
  const [archLive, setArchLive] = useState(null); // inventory + liveScore from architecture/live
  const [expandedIncident, setExpandedIncident] = useState(null);
  const [expandedOccurrences, setExpandedOccurrences] = useState(null);

  const [review, setReview] = useState(null);
  const [token, setToken] = useState('');
  const [projects, setProjects] = useState([]);
  const [me, setMe] = useState({ connected: false });
  const [zeropsServices, setZeropsServices] = useState([]);
  const [connectBusy, setConnectBusy] = useState(false);
  /** Avoid slamming Zerops list-projects every 8s once we have a list this session */
  const projectsLoadedRef = useRef(false);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3800);
  }, []);

  const refresh = useCallback(async () => {
    try {
      await loadConfig();
      const [s, inc, meRes] = await Promise.all([
        apiFetch('/status'),
        apiFetch('/incidents?limit=100'),
        apiFetch('/zerops/me').catch(() => ({ connected: false })),
      ]);
      setStatus(s);
      setIncidents(inc.incidents || []);
      // Authoritative open/resolved totals (not client-filtered subset of a mixed window)
      if (typeof inc.openCount === 'number') {
        setIncidentTotals({
          open: inc.openCount,
          resolved: inc.resolvedCount ?? 0,
          total: inc.totalCount ?? (inc.openCount + (inc.resolvedCount || 0)),
        });
      }

      // Restore selected project from browser storage if /me was cookie-empty but Bearer is set
      const stored = getAuthProject();
      const meMerged = {
        ...meRes,
        connected: Boolean(meRes?.connected || getAuthPat()),
        selectedProjectId: meRes?.selectedProjectId || stored.projectId || null,
        selectedProjectName: meRes?.selectedProjectName || stored.projectName || null,
        user: meRes?.user,
      };
      setMe(meMerged);

      if (meMerged.connected && getAuthPat()) {
        // After hard reload, projects state is always [] — refill once (same as Refresh projects)
        if (!projectsLoadedRef.current) {
          try {
            const proj = await apiFetch('/zerops/projects');
            setProjects(Array.isArray(proj.projects) ? proj.projects : []);
            projectsLoadedRef.current = true;
          } catch {
            /* next poll retries until success */
          }
        }
        if (meMerged.selectedProjectId) {
          try {
            const sv = await apiFetch('/zerops/services');
            setZeropsServices(sv.services || []);
          } catch {
            setZeropsServices([]);
          }
        }
      } else if (!meMerged.connected) {
        setProjects([]);
        setZeropsServices([]);
        projectsLoadedRef.current = false;
      }
    } catch (err) {
      flash(err.message);
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const openIncidents = useMemo(
    () => incidents.filter((i) => String(i.status || 'open').trim().toLowerCase() === 'open'),
    [incidents]
  );

  const incidentGroups = useMemo(() => {
    const grouped = groupIncidentsForDisplay(incidents);
    const open = sortIncidentGroups(
      grouped.filter((g) => g.status === 'open'),
      incidentSort
    );
    const resolved = sortIncidentGroups(
      grouped.filter((g) => g.status !== 'open'),
      incidentSort
    );
    return [...open, ...resolved];
  }, [incidents, incidentSort]);

  const openIssueGroups = useMemo(
    () => incidentGroups.filter((g) => g.status === 'open'),
    [incidentGroups]
  );
  const resolvedIssueGroups = useMemo(
    () => incidentGroups.filter((g) => g.status !== 'open'),
    [incidentGroups]
  );

  const visibleIncidentGroups = useMemo(() => {
    if (incidentFilter === 'resolved') return resolvedIssueGroups;
    if (incidentFilter === 'all') return incidentGroups;
    return openIssueGroups;
  }, [incidentGroups, incidentFilter, openIssueGroups, resolvedIssueGroups]);

  const incidentSortLabel =
    INCIDENT_SORT_OPTIONS.find((o) => o.id === incidentSort)?.label || 'Sort';

  useEffect(() => {
    if (!incidentSortOpen) {
      setSortMenuPos(null);
      return undefined;
    }
    function place() {
      const trigger = sortMenuRef.current?.querySelector('.sort-menu-trigger');
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      setSortMenuPos({
        top: Math.round(r.bottom + 8),
        right: Math.round(window.innerWidth - r.right),
        minWidth: Math.max(240, Math.round(r.width)),
      });
    }
    function onScroll() {
      setIncidentSortOpen(false);
    }
    function onDoc(e) {
      const inTrigger = sortMenuRef.current?.contains(e.target);
      const inList = sortListRef.current?.contains(e.target);
      if (!inTrigger && !inList) setIncidentSortOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setIncidentSortOpen(false);
    }
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [incidentSortOpen]);

  function toggleSelectGroup(groupKey) {
    setSelectedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(groupKey)) n.delete(groupKey);
      else n.add(groupKey);
      return n;
    });
  }

  function selectAllVisible() {
    setSelectedGroups(new Set(visibleIncidentGroups.map((g) => g.groupKey)));
  }

  function clearSelection() {
    setSelectedGroups(new Set());
  }

  function goToView(next) {
    const id = normalizeViewId(next) || 'overview';
    setView(id);
    setSelectMode(false);
    setSelectedGroups(new Set());
    setIncidentSortOpen(false);
  }

  // Always mirror the active section into URL + storage (covers every path)
  useEffect(() => {
    persistView(view);
  }, [view]);

  // Browser back/forward or external URL edits restore the section
  useEffect(() => {
    function syncFromUrl() {
      const id = readViewFromLocation();
      if (!id) return;
      setView((cur) => (cur === id ? cur : id));
    }
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  useEffect(() => {
    // Reset scroll whenever the view changes (window + main scroller)
    const reset = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } catch {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      if (mainRef.current) mainRef.current.scrollTop = 0;
    };
    reset();
    // After layout paints (long lists can shift)
    const t = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(t);
  }, [view]);

  async function refreshIncidents() {
    setIncidentRefreshing(true);
    try {
      await refresh();
      flash('Incidents refreshed');
    } finally {
      setIncidentRefreshing(false);
    }
  }

  function setBusy(key, on) {
    setActionBusy((s) => {
      if (on) return { ...s, [key]: true };
      const n = { ...s };
      delete n[key];
      return n;
    });
  }

  const inventory = useMemo(() => {
    if (status?.inventory?.length && status?.mode === 'live-project') return status.inventory;
    if (zeropsServices.length) return zeropsServices;
    return status?.inventory || [];
  }, [status, zeropsServices]);

  const liveProject = status?.mode === 'live-project' || Boolean(me.selectedProjectId);
  /** Chaos only for sandbox — hide once a Zerops session is live */
  const showChaosLab = !me.connected && !liveProject;
  const projectLabel =
    status?.zerops?.projectName || me.selectedProjectName || null;
  const projectId = me.selectedProjectId || status?.zerops?.projectId || null;

  // Sync Architecture editor + review to the selected Zerops project
  useEffect(() => {
    if (!liveProject || !projectId) {
      setYaml(SAMPLE_YAML);
      setYamlMeta(null);
      setArchLive(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch('/status/architecture/live');
        if (cancelled) return;
        if (r.yaml) setYaml(r.yaml);
        if (r.review) setReview(r.review);
        setYamlMeta({
          source: r.yamlSource || r.review?.yamlSource || null,
          note: r.yamlNote || null,
          projectName: r.projectName || null,
          kind: r.yamlKind || r.review?.kind || null,
          exportHint: r.exportHint || null,
        });
        setArchLive({
          inventory: r.inventory || [],
          liveScore: r.review?.liveScore ?? null,
          topology: r.topology || null,
          projectName: r.projectName,
        });
      } catch {
        /* keep editor if live load fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveProject, projectId]);

  useEffect(() => {
    const el = chatLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  async function triggerChaos(c) {
    setChaosState((s) => ({ ...s, [c.id]: 'loading' }));
    setBusy(`chaos:${c.id}`, true);
    try {
      const res = await apiFetch('/sandbox/chaos', {
        method: 'POST',
        body: JSON.stringify({ type: c.id }),
      });
      const ok = Boolean(res.ok && (res.incidentId || res.local?.incidentId));
      setChaosState((s) => ({ ...s, [c.id]: ok ? 'ok' : 'err' }));
      if (ok) {
        flash(
          `${c.label} → incident #${res.incidentId || res.local?.incidentId}${
            res.title ? ` · ${res.title}` : ''
          }`
        );
        // Immediate refresh so card shows up (diagnosis already finished on the API)
        await refresh();
        setTimeout(refresh, 1500);
      } else {
        flash(res.error || `${c.label} fired but no incident was stored`);
      }
    } catch (err) {
      setChaosState((s) => ({ ...s, [c.id]: 'err' }));
      flash(err.message || 'Failed to trigger chaos');
    } finally {
      setBusy(`chaos:${c.id}`, false);
      setTimeout(() => setChaosState((s) => ({ ...s, [c.id]: 'idle' })), 1800);
    }
  }

  async function sendChat(e) {
    e?.preventDefault?.();
    if (!chatIn.trim() || chatBusy) return;
    const q = chatIn.trim();
    const botId = `bot-${Date.now()}`;
    setChat((c) => [...c, { role: 'user', text: q, id: `u-${Date.now()}` }]);
    setChatIn('');
    setChatBusy(true);
    // Placeholder while network runs
    setChat((c) => [
      ...c,
      { role: 'bot', text: '', id: botId, stream: true, pending: true },
    ]);
    try {
      const res = await apiFetch('/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: q,
          projectId: me.selectedProjectId || undefined,
          projectName: me.selectedProjectName || undefined,
        }),
      });
      const answer = res.answer || 'No answer';
      setChat((c) =>
        c.map((m) =>
          m.id === botId
            ? { ...m, text: answer, pending: false, stream: true }
            : m
        )
      );
      // Keep busy briefly until typewriter finishes for long answers; unlock input sooner
      setChatBusy(false);
    } catch (err) {
      setChat((c) =>
        c.map((m) =>
          m.id === botId
            ? {
                ...m,
                text: `Error: ${err.message}`,
                pending: false,
                stream: false,
              }
            : m
        )
      );
      setChatBusy(false);
    }
  }

  function markStreamDone(id) {
    setChat((c) => c.map((m) => (m.id === id ? { ...m, stream: false } : m)));
  }

  async function runArchitecture() {
    setBusy('architecture', true);
    try {
      const res = await apiFetch('/status/architecture/review', {
        method: 'POST',
        body: JSON.stringify({ yaml }),
      });
      setReview(res.review);
      flash(`Architecture score ${res.review?.score}/100`);
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy('architecture', false);
    }
  }

  async function connectZerops(e) {
    e.preventDefault();
    if (!token.trim()) return;
    setConnectBusy(true);
    setBusy('connect', true);
    try {
      const raw = token.trim();
      // Store before request so connect + follow-up /me use Authorization if cookies fail
      setAuthPat(raw);
      setAuthProject(null);
      const res = await apiFetch('/zerops/connect', {
        method: 'POST',
        body: JSON.stringify({ token: raw }),
      });
      setToken('');
      setProjects(res.projects || []);
      projectsLoadedRef.current = true;
      setMe({ connected: true, user: res.user });
      if (res.projects?.length) {
        flash(`Connected — ${res.projects.length} project(s) loaded`);
      } else {
        flash(res.projectsError || 'Connected, but no projects returned — click Refresh projects');
      }
      await refresh();
    } catch (err) {
      clearAuth();
      flash(err.message);
    } finally {
      setConnectBusy(false);
      setBusy('connect', false);
    }
  }

  async function loadProjects() {
    setBusy('loadProjects', true);
    try {
      const res = await apiFetch('/zerops/projects');
      setProjects(res.projects || []);
      projectsLoadedRef.current = true;
      if (!res.projects?.length) {
        flash(res.error || 'Still no projects — token may lack org/client access');
      } else {
        flash(`Loaded ${res.projects.length} project(s)`);
      }
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy('loadProjects', false);
    }
  }

  async function selectProject(p) {
    setBusy(`selectProject:${p.id}`, true);
    try {
      // Headers keep project on later polls even if cookies never stick
      setAuthProject(p.id, p.name);
      const res = await apiFetch('/zerops/select-project', {
        method: 'POST',
        body: JSON.stringify({ projectId: p.id, projectName: p.name }),
      });
      setZeropsServices(res.services || p.services || []);
      setMe((m) => ({
        ...m,
        connected: true,
        selectedProjectId: p.id,
        selectedProjectName: p.name,
      }));
      setReview(null);
      setChat([
        {
          role: 'bot',
          id: `welcome-${Date.now()}`,
          stream: false,
          text: `Project switched to “${p.name}”. Ask about live incidents, services, or health for this project.`,
        },
      ]);
      flash(`Project “${p.name}” selected — live ops enabled`);
      await refresh();
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy(`selectProject:${p.id}`, false);
    }
  }

  async function disconnect() {
    setBusy('disconnect', true);
    try {
      await apiFetch('/zerops/disconnect', { method: 'POST' }).catch(() => {});
      clearAuth();
      projectsLoadedRef.current = false;
      setMe({ connected: false });
      setProjects([]);
      setZeropsServices([]);
      setYaml(SAMPLE_YAML);
      setYamlMeta(null);
      setReview(null);
      setArchLive(null);
      setChat([
        {
          role: 'bot',
          id: `welcome-disc-${Date.now()}`,
          stream: false,
          text: 'Disconnected from Zerops. Ask about the local sandbox, or reconnect and select a project.',
        },
      ]);
      flash('Disconnected');
      await refresh();
    } finally {
      setBusy('disconnect', false);
    }
  }

  async function restartService(inc) {
    const key = `restart:${inc.id}`;
    setBusy(key, true);
    try {
      const res = await apiFetch(`/incidents/${inc.id}/fix`, { method: 'POST', body: '{}' });
      flash(
        res.ok
          ? `Service restart requested for ${inc.service_name}`
          : res.error || 'Restart failed'
      );
      await refresh();
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy(key, false);
    }
  }

  async function resolveIncident(inc) {
    const key = `resolve:${inc.id}`;
    setBusy(key, true);
    try {
      await apiFetch(`/incidents/${inc.id}/resolve`, { method: 'POST', body: '{}' });
      await refresh();
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy(key, false);
    }
  }

  /** Resolve every occurrence in a display group (same service + title). */
  async function resolveIncidentGroup(group) {
    const ids = group?.ids || [];
    if (!ids.length) return;
    const key = `resolveGroup:${group.groupKey}`;
    setBusy(key, true);
    try {
      await Promise.all(
        ids.map((id) => apiFetch(`/incidents/${id}/resolve`, { method: 'POST', body: '{}' }))
      );
      flash(
        ids.length > 1
          ? `Resolved ${ids.length} matching incidents`
          : `Resolved ${group.primary?.service_name || 'incident'}`
      );
      await refresh();
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy(key, false);
    }
  }

  async function resolveSelectedGroups() {
    const groups = visibleIncidentGroups.filter(
      (g) => selectedGroups.has(g.groupKey) && g.status === 'open'
    );
    if (!groups.length) {
      flash('Select open incidents to resolve');
      return;
    }
    setBusy('bulkResolve', true);
    try {
      const ids = groups.flatMap((g) => g.ids || []);
      await Promise.all(
        ids.map((id) => apiFetch(`/incidents/${id}/resolve`, { method: 'POST', body: '{}' }))
      );
      flash(`Resolved ${ids.length} incident(s)`);
      clearSelection();
      await refresh();
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy('bulkResolve', false);
    }
  }

  const score = status?.healthScore ?? status?.health?.score ?? '—';
  const demoStatus = status?.services?.demo?.status || 'unknown';
  const liveHealthScore =
    typeof status?.healthScore === 'number'
      ? status.healthScore
      : typeof status?.health?.score === 'number'
        ? status.health.score
        : null;

  if (view === 'story') {
    return (
      <div className="shell story-mode">
        <StoryLanding
          onEnter={() => goToView('overview')}
          onConnect={() => goToView('connect')}
          healthScore={liveHealthScore}
          healthMode={status?.health?.mode}
        />
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className={`shell${navOpen ? '' : ' nav-collapsed'}`}>
      <aside className={`nav${navOpen ? ' is-open' : ' is-closed'}`}>
        <div className="nav-rail">
          <button
            type="button"
            className="nav-home"
            title={navOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={navOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((o) => !o)}
          >
            <ZeropsLogo />
          </button>
          <div className="nav-section">
            {VIEWS.filter((v) => !v.special).map((v) => (
              <button
                key={v.id}
                type="button"
                className={`nav-btn ${view === v.id ? 'active' : ''}`}
                onClick={() => goToView(v.id)}
              >
                <span className="ic">
                  <NavIcon name={v.icon} />
                </span>
                <span className="nav-label-text">{v.label}</span>
                <span className="nav-tooltip">{v.label}</span>
                {v.id === 'incidents' && (incidentTotals.open || openIncidents.length) > 0 && (
                  <span className="nav-badge">{incidentTotals.open || openIncidents.length}</span>
                )}
              </button>
            ))}
            {VIEWS.filter((v) => v.special).map((v) => (
              <button
                key={v.id}
                type="button"
                className={`nav-btn nav-connect ${view === v.id ? 'active' : ''}`}
                onClick={() => goToView(v.id)}
              >
                <span className="ic">
                  <NavIcon name={v.icon} />
                </span>
                <span className="nav-label-text">{v.label}</span>
                <span className="nav-tooltip">{v.label}</span>
                {!me.connected && <span className="nav-badge">!</span>}
              </button>
            ))}
          </div>
          <div className="nav-footer">
            <button
              type="button"
              className="nav-story-btn"
              title="Product story"
              onClick={() => goToView('story')}
            >
              <span className="ic">
                <NavIcon name="chat" />
              </span>
              <span className="nav-label-text">Story</span>
            </button>
            {!me.connected ? (
              <button type="button" className="btn nav-cta" onClick={() => goToView('connect')} title="Connect Zerops" />
            ) : !liveProject ? (
              <button type="button" className="btn nav-cta" onClick={() => goToView('connect')} title="Select project" />
            ) : (
              <div className="nav-cta-wrap" />
            )}
          </div>
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar-left">
          <CreatorPanel />
          <div className="topbar-brand">
            <strong>OpsMate</strong>
            <span>{liveProject ? 'Live · project scope' : 'Sandbox · demo scope'}</span>
          </div>
        </div>
        <div className="topbar-right">
          <button type="button" className="btn btn-ghost" onClick={() => goToView('story')}>
            Story
          </button>
          <span className="topbar-status">
            <span className="pulse" />
            {liveProject ? 'Live' : me.connected ? 'Connected' : 'Demo'}
          </span>
          {!me.connected ? (
            <button type="button" className="btn btn-primary" onClick={() => goToView('connect')}>
              Connect PAT
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => goToView('connect')}>
              {liveProject ? 'Switch project' : 'Choose project'}
            </button>
          )}
        </div>
      </header>

      <main className="main" key={view} ref={mainRef}>
        <ModeBanner
          liveProject={liveProject}
          me={me}
          projectLabel={projectLabel || me.selectedProjectName}
          onConnect={() => goToView('connect')}
          onProjects={() => goToView('connect')}
        />

        {view === 'overview' && (
          <>
            <header className="page-head">
              <div>
                <h2>{liveProject ? projectLabel || 'Live project' : 'Command center'}</h2>
                <p className="lede">
                  {liveProject
                    ? 'Live ops desk for your selected Zerops fleet.'
                    : 'Explore the sandbox — then connect a PAT to go live on your projects.'}
                </p>
              </div>
              <div className="btn-row">
                <span className={`pill ${liveProject ? 'live' : ''}`}>
                  <span className={`dot ${liveProject ? 'dot-ok' : 'dot-muted'}`} />
                  {liveProject ? 'Live' : 'Sandbox'}
                </span>
                <button type="button" className="btn" onClick={refresh} disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  Refresh
                </button>
              </div>
            </header>

            <div className="bento bento-command">
              <div className="bento-card health-hero span-6">
                <div className="bento-kicker">Deployment health</div>
                <div className="health-hero-row">
                  <HealthGauge score={typeof score === 'number' ? score : 0} compact />
                  <div className="health-hero-copy">
                    <div className="health-hero-label">
                      {status?.health?.mode === 'live-project' ? 'Live fleet weight' : 'Sandbox agent weight'}
                    </div>
                    <div className="sub" style={{ marginTop: 6 }}>
                      {status?.health?.totalWeight != null
                        ? `${status.health.earnedWeight ?? '—'}/${status.health.totalWeight} pts earned`
                        : 'Same score as Health page'}
                    </div>
                    <div className="health-check-chips">
                      {(status?.health?.checks || []).slice(0, 4).map((c) => {
                        const st =
                          c.status ||
                          (c.informational || c.weight === 0
                            ? 'info'
                            : c.pass
                              ? 'pass'
                              : 'fail');
                        const mark =
                          st === 'partial' ? '~' : st === 'info' ? 'i' : st === 'pass' ? '✓' : '×';
                        return (
                          <span key={c.id} className={`health-check-chip ${st}`}>
                            {mark} {c.label || c.id}
                          </span>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ marginTop: 10, padding: '6px 10px' }}
                      onClick={() => goToView('health')}
                    >
                      Full health detail →
                    </button>
                  </div>
                </div>
              </div>
              <div className="bento-card dark span-3 incidents-bento">
                <div className="bento-kicker">Open incidents</div>
                <div
                  className="bento-num"
                  style={{
                    color:
                      (incidentTotals.open || openIncidents.length)
                        ? 'var(--brand)'
                        : 'rgba(255,255,255,0.9)',
                  }}
                >
                  {typeof status?.openIncidents === 'number'
                    ? status.openIncidents
                    : incidentTotals.open || openIncidents.length}
                </div>
                <div className="hint" style={{ marginTop: 10 }}>
                  Grouped on Incidents · project-scoped
                </div>
                <button
                  type="button"
                  className="btn btn-ghost bento-link"
                  onClick={() => goToView('incidents')}
                >
                  View incidents →
                </button>
              </div>
              <div className="bento-card span-3 services-bento">
                <div className="bento-kicker">Services</div>
                <div className="bento-num">{inventory.length}</div>
                <div className="hint" style={{ marginTop: 10 }}>
                  {liveProject
                    ? `${status?.zerops?.activeCount ?? '—'} ACTIVE`
                    : `Demo patient · ${demoStatus}`}
                </div>
                <Sparkline
                  status={
                    liveProject
                      ? status?.zerops?.activeCount === inventory.length
                        ? 'ACTIVE'
                        : 'READY_TO_DEPLOY'
                      : demoStatus
                  }
                />
                <button
                  type="button"
                  className="btn btn-ghost bento-link"
                  onClick={() => goToView('services')}
                >
                  Browse services →
                </button>
              </div>
              <div className="bento-card span-12 mesh-card">
                <div className="mesh-card-head">
                  <div>
                    <div className="bento-title">{liveProject ? 'Fleet mesh' : 'Sandbox mesh'}</div>
                    <div className="sub">
                      Live topology · node colours follow stack status
                    </div>
                  </div>
                </div>
                <div className="mesh-layout">
                  <FleetMesh
                    services={inventory}
                    projectLabel={liveProject ? projectLabel : 'sandbox'}
                  />
                  {openIncidents.length > 0 && (
                    <div className="mesh-sev">
                      <div className="fix-label">Incident severity</div>
                      <SeverityBars incidents={openIncidents} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!liveProject && !me.connected && (
              <div className="demo-callout">
                <p>
                  <strong>Still on demo.</strong> Fire chaos, then connect a Zerops PAT to run the same SRE loop on{' '}
                  <strong>your</strong> projects.
                </p>
                <button type="button" className="btn btn-primary" onClick={() => goToView('connect')}>
                  Connect PAT
                </button>
              </div>
            )}

            {liveProject && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-h">
                  <div>
                    <h3>Project fleet — {projectLabel}</h3>
                    <div className="sub">Pulled live from Zerops every refresh · cards tinted by status</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={async () => {
                      try {
                        const r = await apiFetch('/status/sync-project', {
                          method: 'POST',
                          body: '{}',
                        });
                        flash(`Synced ${r.created || 0} status incident(s)`);
                        refresh();
                      } catch (err) {
                        flash(err.message);
                      }
                    }}
                  >
                    Sync status → incidents
                  </button>
                </div>
                <div className="service-grid">
                  {inventory.map((s) => (
                    <ServiceCard key={s.id || s.name} s={s} />
                  ))}
                </div>
              </div>
            )}

            {showChaosLab && (
              <div className="panel chaos-lab" style={{ marginBottom: 16 }}>
                <div className="panel-h">
                  <div>
                    <h3>Chaos lab</h3>
                    <div className="sub">
                      Fire intentional failures on the local demo patient — watch diagnosis appear in
                      Incidents
                    </div>
                  </div>
                </div>
                <div className="chaos-demo-banner" role="note">
                  <strong>Demo only.</strong> Chaos lab runs against the local sandbox patient and is{' '}
                  <em>not available</em> when a Zerops project is connected. Live fleets are never
                  deliberately broken from here.
                </div>
                <div className="btn-row chaos-lab-actions">
                  {CHAOS.map((c) => {
                    const st = chaosState[c.id] || 'idle';
                    const busy = st === 'loading' || actionBusy[`chaos:${c.id}`];
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`btn ${c.cls} chaos-btn ${busy ? 'is-loading' : ''} ${st === 'ok' ? 'is-ok' : ''} ${st === 'err' ? 'is-err' : ''}`}
                        disabled={busy}
                        onClick={() => triggerChaos(c)}
                      >
                        {busy ? <span className="spinner" /> : null}
                        {busy ? 'Running…' : st === 'ok' ? `${c.label} · done` : st === 'err' ? `${c.label} · retry` : c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="two-col">
              <div className="panel">
                <div className="panel-h">
                  <div>
                    <h3>Recent incidents</h3>
                    <div className="sub">Log diagnosis + Zerops READY_TO_DEPLOY signals</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => goToView('incidents')}
                  >
                    View all
                  </button>
                </div>
                <div className="list">
                  {openIncidents.slice(0, 5).map((inc) => (
                    <article key={inc.id} className="incident">
                      <div className="incident-top">
                        {sevBadge(inc.severity)}
                        <span className="incident-title">{inc.title || inc.service_name}</span>
                        <span className="incident-meta">
                          {inc.source || 'log'} · {relativeTime(inc.created_at)}
                        </span>
                      </div>
                      <p>{inc.explanation}</p>
                    </article>
                  ))}
                  {!openIncidents.length && (
                    <div className="empty">
                      No open incidents.
                      {liveProject
                        ? ' Click “Sync status → incidents” if a service is READY_TO_DEPLOY.'
                        : ' Trigger chaos or connect a project.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-h">
                  <div>
                    <h3>Ask OpsMate</h3>
                    <div className="sub">
                      {liveProject
                        ? `Context includes ${inventory.length} live services`
                        : 'Connect a project for fleet-aware answers'}
                    </div>
                  </div>
                </div>
                <form className="chat-form" onSubmit={sendChat}>
                  <input
                    className="input"
                    value={chatIn}
                    onChange={(e) => setChatIn(e.target.value)}
                    placeholder={
                      liveProject
                        ? 'Which services are not ACTIVE and what should I deploy first?'
                        : 'Why is health below 80%?'
                    }
                  />
                  <button className="btn btn-primary" type="submit" disabled={chatBusy}>
                    Ask
                  </button>
                </form>
                <div style={{ marginTop: 14 }}>
                  {chat.slice(-2).map((m) => (
                    <ChatBubble
                      key={m.id || m.text?.slice?.(0, 20)}
                      msg={{ ...m, stream: false }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => goToView('chat')}
                >
                  Open full chat
                </button>
              </div>
            </div>
          </>
        )}

        {view === 'services' && (
          <>
            <header className="page-head">
              <div>
                <h2>{liveProject ? `Services · ${projectLabel}` : 'Infrastructure'}</h2>
                <p className="lede">
                  {liveProject
                    ? 'Live service stacks from your selected Zerops project (status, type, hostname).'
                    : 'Sandbox topology — connect Zerops and select a project for your real inventory.'}
                </p>
              </div>
            </header>
            <div className="topo">
              {(status?.topology?.edges || []).map((e, i) => (
                <span key={i}>
                  <strong>{e.from}</strong> <span className="arrow">→</span> {e.to}
                  <span style={{ opacity: 0.5 }}> ({e.label})</span>
                  {i < (status?.topology?.edges?.length || 1) - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
            <div className="service-grid">
              {inventory.map((s) => (
                <ServiceCard key={s.id || s.name} s={s} />
              ))}
            </div>
          </>
        )}

        {view === 'incidents' && (
          <>
            <header className="page-head">
              <div>
                <h2>Incidents</h2>
                <p className="lede">
                  Diagnosis, evidence logs, and step-by-step remediation — from log ingest, metrics, and Zerops fleet status.
                </p>
              </div>
              <div className="btn-row incident-toolbar">
                <span className="pill">
                  {openIssueGroups.length} open
                  {openIncidents.length !== openIssueGroups.length
                    ? ` (${incidentTotals.open || openIncidents.length} events)`
                    : incidentTotals.open && incidentTotals.open !== openIssueGroups.length
                      ? ` (${incidentTotals.open} events)`
                      : ''}
                  {' · '}
                  {resolvedIssueGroups.length} resolved
                  {incidentTotals.resolved
                    ? ` (${incidentTotals.resolved} events)`
                    : ''}
                </span>
                <div
                  className={`sort-menu ${incidentSortOpen ? 'is-open' : ''}`}
                  ref={sortMenuRef}
                >
                  <button
                    type="button"
                    className="sort-menu-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={incidentSortOpen}
                    onClick={() => setIncidentSortOpen((o) => !o)}
                  >
                    <span className="sort-menu-kicker">Sort</span>
                    <span className="sort-menu-value">{incidentSortLabel}</span>
                    <span className="sort-menu-chevron" aria-hidden>
                      ▾
                    </span>
                  </button>
                  {incidentSortOpen &&
                    sortMenuPos &&
                    createPortal(
                      <ul
                        className="sort-menu-list sort-menu-list--portal"
                        role="listbox"
                        aria-label="Sort incidents"
                        ref={sortListRef}
                        style={{
                          top: sortMenuPos.top,
                          right: sortMenuPos.right,
                          minWidth: sortMenuPos.minWidth,
                        }}
                      >
                        {INCIDENT_SORT_OPTIONS.map((opt) => (
                          <li key={opt.id} role="option" aria-selected={incidentSort === opt.id}>
                            <button
                              type="button"
                              className={`sort-menu-option ${incidentSort === opt.id ? 'active' : ''}`}
                              onClick={() => {
                                setIncidentSort(opt.id);
                                setIncidentSortOpen(false);
                              }}
                            >
                              {opt.label}
                            </button>
                          </li>
                        ))}
                      </ul>,
                      document.body
                    )}
                </div>
                <button
                  type="button"
                  className={`btn ${selectMode ? 'btn-primary' : ''}`}
                  onClick={() => {
                    setSelectMode((m) => !m);
                    clearSelection();
                  }}
                >
                  {selectMode ? 'Cancel select' : 'Select'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={refreshIncidents}
                  disabled={incidentRefreshing || loading}
                >
                  {(incidentRefreshing || loading) ? <span className="spinner" /> : null}
                  Refresh
                </button>
              </div>
            </header>

            <div className="incident-tabs" role="tablist" aria-label="Incident status">
              {[
                { id: 'open', label: `Open (${openIssueGroups.length})` },
                { id: 'resolved', label: `Resolved (${resolvedIssueGroups.length})` },
                { id: 'all', label: `All (${incidentGroups.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={incidentFilter === tab.id}
                  className={`incident-tab ${incidentFilter === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setIncidentFilter(tab.id);
                    clearSelection();
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {selectMode && (
              <div className="incident-bulk-bar">
                <button type="button" className="btn btn-ghost" onClick={selectAllVisible}>
                  Select all shown
                </button>
                <button type="button" className="btn btn-ghost" onClick={clearSelection}>
                  Clear
                </button>
                <span className="incident-bulk-count">{selectedGroups.size} selected</span>
                <span className="incident-actions-spacer" />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selectedGroups.size || actionBusy.bulkResolve}
                  onClick={resolveSelectedGroups}
                  title="Mark selected open incidents as resolved"
                >
                  {actionBusy.bulkResolve ? <span className="spinner" /> : null}
                  Mark resolved
                </button>
              </div>
            )}

            <div className="list">
              {visibleIncidentGroups.map((group) => {
                const inc = group.primary;
                const open = expandedIncident === group.groupKey;
                const showOcc = expandedOccurrences === group.groupKey;
                const ctx = parseIncidentContext(inc.raw_context);
                const logs = extractLogLines(ctx);
                const steps = fixSteps(inc.suggested_fix);
                const metrics = ctx?.metricsSnapshot || ctx?.metrics;
                const stackId =
                  ctx?.service_id ||
                  inventory.find(
                    (s) => String(s.name).toLowerCase() === String(inc.service_name || '').toLowerCase()
                  )?.id;
                const logsUrl = zeropsLogsUrl(inc.project_id || projectId, stackId);
                const resolveBusy = actionBusy[`resolveGroup:${group.groupKey}`];
                const restartBusy = actionBusy[`restart:${inc.id}`];
                const selected = selectedGroups.has(group.groupKey);
                const isResolved = group.status !== 'open';
                return (
                  <article
                    key={group.groupKey}
                    className={`incident panel incident-detail ${open ? 'open' : ''} ${isResolved ? 'is-resolved' : ''} ${selected ? 'is-selected' : ''}`}
                  >
                    <div className="incident-top">
                      {selectMode && (
                        <label className="incident-check">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelectGroup(group.groupKey)}
                            aria-label={`Select ${inc.title || 'incident'}`}
                          />
                        </label>
                      )}
                      {sevBadge(inc.severity)}
                      <span className="incident-title">
                        {group.kind === 'chaos-summary'
                          ? group.count > 1
                            ? `${group.count} chaos-test events, no action needed`
                            : inc.title || 'Chaos-test event · no action needed'
                          : inc.title || `${inc.service_name} issue`}
                      </span>
                      {group.count > 1 && (
                        <span className="badge badge-count">{group.count}×</span>
                      )}
                      {group.kind === 'chaos-summary' && (
                        <span className="badge badge-low">lab noise</span>
                      )}
                      {isResolved && <span className="badge badge-resolved">resolved</span>}
                      <span className="incident-meta">
                        {inc.service_name} · {inc.source || 'log'} · {group.status}
                        {inc.project_name ? ` · ${inc.project_name}` : ''}
                      </span>
                    </div>
                    <p className="incident-recurrence mono-sm">{recurrenceLine(group)}</p>
                    <p className="incident-expl">
                      {group.kind === 'chaos-summary' && group.count > 1
                        ? `${group.count} deliberate sandbox chaos/test signals collapsed here because diagnosis said no action is needed. Expand occurrences for raw events — prefer the actionable cards above.`
                        : inc.explanation || 'No diagnosis text stored.'}
                    </p>

                    {steps.length > 0 && (
                      <div className="fix-block">
                        <div className="fix-label">Suggested remediation</div>
                        <ol className="fix-steps">
                          {steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="incident-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setExpandedIncident(open ? null : group.groupKey)}
                      >
                        {open ? 'Hide evidence' : 'Evidence & logs'}
                      </button>
                      {logsUrl && (
                        <a
                          className="btn btn-ghost"
                          href={logsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View logs in Zerops
                        </a>
                      )}
                      {group.count > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() =>
                            setExpandedOccurrences(showOcc ? null : group.groupKey)
                          }
                        >
                          {showOcc
                            ? 'Hide occurrences'
                            : `Show ${group.count} occurrences`}
                        </button>
                      )}
                      {group.status === 'open' && (
                        <>
                          <span className="incident-actions-spacer" />
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={resolveBusy}
                            onClick={() => resolveIncidentGroup(group)}
                          >
                            {resolveBusy ? <span className="spinner" /> : null}
                            {group.count > 1
                              ? `Mark resolved (${group.count})`
                              : 'Mark resolved'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-restart"
                            disabled={restartBusy}
                            onClick={() => restartService(inc)}
                            title="Restarts this service on Zerops. Suggested remediation steps above are separate — this does not apply them automatically."
                          >
                            {restartBusy ? (
                              <span className="spinner" />
                            ) : (
                              <span className="btn-ic" aria-hidden>
                                ↻
                              </span>
                            )}
                            Restart service
                            <span className="btn-hint">Zerops API</span>
                          </button>
                        </>
                      )}
                    </div>

                    {showOcc && (
                      <ul className="occurrence-list">
                        {group.occurrences.map((occ) => (
                          <li key={occ.id}>
                            <span className="mono-sm">#{occ.id}</span>
                            <span>{relativeTime(occ.created_at)}</span>
                            <span className="incident-meta">{occ.status || 'open'}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {open && (
                      <div className="evidence">
                        <div className="evidence-grid">
                          <div>
                            <div className="fix-label">Related logs</div>
                            {logs.length ? (
                              <div className="log-stream">
                                {logs.map((line, i) => (
                                  <div
                                    key={i}
                                    className={`log-line log-${String(line.level || 'info').toLowerCase()}`}
                                  >
                                    <span className="log-meta">
                                      [{line.kind}] {line.level}
                                      {line.service ? ` · ${line.service}` : ''}
                                      {line.ts ? ` · ${relativeTime(line.ts)}` : ''}
                                    </span>
                                    <span className="log-msg">{line.message}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="empty" style={{ padding: 12 }}>
                                No structured log context stored for this incident.
                                {inc.source === 'zerops-status'
                                  ? ' This signal came from Zerops fleet status, not push/syslog logs.'
                                  : ''}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="fix-label">Diagnosis snapshot</div>
                            <dl className="meta-dl">
                              <div>
                                <dt>Service</dt>
                                <dd>{inc.service_name || '—'}</dd>
                              </div>
                              <div>
                                <dt>Source</dt>
                                <dd>{inc.source || 'log'}</dd>
                              </div>
                              <div>
                                <dt>Severity</dt>
                                <dd>{inc.severity || '—'}</dd>
                              </div>
                              <div>
                                <dt>Project</dt>
                                <dd>{inc.project_name || inc.project_id || 'sandbox'}</dd>
                              </div>
                              {group.count > 1 && (
                                <div>
                                  <dt>Occurrences</dt>
                                  <dd>{group.count} (ids {group.ids.join(', ')})</dd>
                                </div>
                              )}
                              {metrics && (
                                <div>
                                  <dt>Metrics @ trigger</dt>
                                  <dd className="mono-sm">
                                    {typeof metrics === 'object'
                                      ? JSON.stringify(metrics).slice(0, 180)
                                      : String(metrics).slice(0, 180)}
                                  </dd>
                                </div>
                              )}
                            </dl>
                            {ctx && !logs.length && (
                              <pre className="raw-ctx">{JSON.stringify(ctx, null, 2).slice(0, 1200)}</pre>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {!visibleIncidentGroups.length && (
                <div className="empty panel">
                  {incidentFilter === 'resolved'
                    ? 'No resolved incidents yet — mark open items as resolved.'
                    : incidentFilter === 'open'
                      ? 'No open incidents. Check Resolved or All, or fire Chaos lab.'
                      : 'No incidents yet.'}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'health' && (
          <>
            <header className="page-head">
              <div>
                <h2>Deployment health</h2>
                <p className="lede">
                  Weighted probes that build the score — connect a project to switch from sandbox checks
                  to live fleet health.
                </p>
              </div>
            </header>
            <div className="health-layout">
              <div className="panel health-score-panel">
                <div className="bento-kicker">Overall score</div>
                <HealthGauge score={typeof score === 'number' ? score : 0} size={168} />
                <div className="health-score-meta">
                  <div className="health-hero-label">
                    {status?.health?.mode === 'live-project' ? 'Live fleet weight' : 'Sandbox agent weight'}
                  </div>
                  <div className="sub" style={{ marginTop: 4 }}>
                    {status?.health?.totalWeight != null
                      ? `${status.health.earnedWeight ?? '—'}/${status.health.totalWeight} pts earned`
                      : 'weighted % of all checks'}
                  </div>
                  <div className="health-tone-legend">
                    <span><i style={{ background: '#0EB29A' }} /> 80+ good</span>
                    <span><i style={{ background: '#F59E0B' }} /> 55–79 watch</span>
                    <span><i style={{ background: '#E85D52' }} /> &lt;55 risk</span>
                  </div>
                </div>
              </div>
              <div className="panel health-checks-panel">
                <div className="panel-h">
                  <div>
                    <h3>Checks</h3>
                    <div className="sub">
                      Each row is a weighted probe · earned pts credit toward the score
                    </div>
                  </div>
                </div>
                {(status?.health?.checks || []).map((c) => {
                  const st =
                    c.status ||
                    (c.informational || c.weight === 0
                      ? 'info'
                      : c.pass
                        ? 'pass'
                        : 'fail');
                  const badge =
                    st === 'info'
                      ? 'INFO'
                      : st === 'partial'
                        ? 'PARTIAL'
                        : st === 'pass'
                          ? 'PASS'
                          : 'FAIL';
                  return (
                    <div key={c.id} className={`check-row check-${st}`}>
                      <span
                        className={
                          st === 'partial'
                            ? 'partial'
                            : st === 'info'
                              ? 'info'
                              : st === 'pass'
                                ? 'pass'
                                : 'fail'
                        }
                      >
                        {badge}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label || c.id}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{c.message}</div>
                      </div>
                      <span className="incident-meta" style={{ marginLeft: 'auto' }}>
                        {c.informational || c.weight === 0
                          ? 'n/a'
                          : c.earned != null
                            ? `${c.earned}/${c.weight}`
                            : `w${c.weight}`}
                      </span>
                    </div>
                  );
                })}
                {!status?.health?.checks?.length && (
                  <div className="empty">Health checks appear after /status loads.</div>
                )}
              </div>
            </div>
          </>
        )}

        {view === 'architecture' && (
          <>
            <header className="page-head">
              <div>
                <h2>Architecture review</h2>
                <p className="lede">
                  {liveProject
                    ? `Inventory sketch loads first — paste Zerops GUI export for full fidelity on “${projectLabel}”.`
                    : 'Paste import YAML or repo zerops.yaml. Connect a project for live fleet chips.'}
                </p>
              </div>
              <div className="btn-row">
                {liveProject && (
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      try {
                        const r = await apiFetch('/status/architecture/live');
                        if (r.yaml) setYaml(r.yaml);
                        setReview(r.review);
                        setYamlMeta({
                          source: r.yamlSource,
                          note: r.yamlNote,
                          projectName: r.projectName,
                          kind: r.yamlKind,
                          exportHint: r.exportHint,
                        });
                        setArchLive({
                          inventory: r.inventory || [],
                          liveScore: r.review?.liveScore ?? null,
                          topology: r.topology || null,
                          projectName: r.projectName,
                        });
                        flash(
                          `Inventory sketch · ${r.review?.score ?? '—'}/100 · fleet ${r.review?.liveScore ?? '—'}`
                        );
                      } catch (err) {
                        flash(err.message);
                      }
                    }}
                  >
                    Load inventory sketch
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runArchitecture}
                  disabled={actionBusy.architecture}
                >
                  {actionBusy.architecture ? <span className="spinner" /> : null}
                  Re-score pasted yaml
                </button>
              </div>
            </header>

            {(yamlMeta?.source === 'live-inventory' || yamlMeta?.exportHint || liveProject) && (
              <div className="arch-paste-banner">
                <div>
                  <strong>Best accuracy: paste GUI export</strong>
                  <p>
                    Zerops public API cannot return project export YAML. In Zerops → open this project →{' '}
                    <em>⋮ → Export project as yaml</em>, paste it below, then Re-score.
                    {yamlMeta?.source === 'live-inventory'
                      ? ' What you see now is an honest, incomplete inventory reconstruction.'
                      : ''}
                  </p>
                </div>
                {(yamlMeta?.kind || review?.kind) && (
                  <span className="pill">
                    format · {(yamlMeta?.kind || review?.kind) === 'pipeline' ? 'zerops.yaml' : (yamlMeta?.kind || review?.kind)}
                  </span>
                )}
              </div>
            )}

            {review && (
              <div className="arch-score-bar">
                <ScoreMetricCard
                  value={typeof review.score === 'number' ? review.score : Number(review.score) || null}
                  label="Yaml score"
                  meta={[
                    review.kind === 'import'
                      ? 'import format'
                      : review.kind === 'pipeline'
                        ? 'pipeline'
                        : 'yaml',
                    review.counts
                      ? `${review.counts.critical || 0}c · ${review.counts.warn || 0}w · ${review.counts.info || 0}i`
                      : `${(review.findings || []).length} finding(s)`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  hint="Structure & platform findings from your paste"
                />
                <ScoreMetricCard
                  value={
                    liveProject
                      ? Number(archLive?.liveScore ?? review.liveScore ?? score) || null
                      : typeof score === 'number'
                        ? score
                        : null
                  }
                  label={liveProject ? 'Live fleet' : 'Sandbox fleet'}
                  meta={
                    liveProject
                      ? `${(archLive?.inventory || inventory).filter((s) => !s.isSystem).length || 0} stacks · ${yamlMeta?.source || 'live'}`
                      : 'Local OpsMate agent health'
                  }
                  hint={liveProject ? 'Weighted ACTIVE / ready state of stacks' : 'Sandbox probe weight'}
                  variant="fleet"
                />
                <div className="score-metric-card score-metric-summary">
                  <div className="score-metric-label">Summary</div>
                  <p className="arch-summary">
                    {(review.summary || '')
                      .replace(/import\/export YAML score\s+\d+\/100\s*·\s*/i, '')
                      .replace(/^yaml score\s+\d+\/100\s*·\s*/i, '') || review.summary}
                  </p>
                </div>
              </div>
            )}

            {(review?.setups?.length > 0 || (archLive?.inventory || inventory).length > 0) && (
              <div className="arch-setup-row">
                {(review?.setups || []).map((s) => {
                  const live = (archLive?.inventory || inventory).find(
                    (x) => String(x.name).toLowerCase() === String(s.name).toLowerCase()
                  );
                  const st = live?.status || s.status || '';
                  const tone = serviceTone(st);
                  return (
                    <div
                      key={s.name}
                      className={`arch-setup-chip tone-${tone}${s.managed ? ' managed' : ''}`}
                    >
                      <span className={`dot ${statusDotClass(st)}`} />
                      <strong>{s.name}</strong>
                      <span className={`status-pill tone-${tone}`}>
                        {st || 'yaml'}
                      </span>
                      <span className="meta">
                        {s.type ? String(s.type).slice(0, 28) : ''}
                        {s.managed ? ' · managed' : ''}
                        {s.hasHttp ? ' · public' : ''}
                      </span>
                    </div>
                  );
                })}
                {(archLive?.inventory || [])
                  .filter(
                    (s) =>
                      !s.isSystem &&
                      String(s.name).toLowerCase() !== 'core' &&
                      !(review?.setups || []).some(
                        (y) => String(y.name).toLowerCase() === String(s.name).toLowerCase()
                      )
                  )
                  .map((s) => {
                    const tone = serviceTone(s.status);
                    return (
                      <div key={s.id || s.name} className={`arch-setup-chip muted tone-${tone}`}>
                        <span className={`dot ${statusDotClass(s.status)}`} />
                        <strong>{s.name}</strong>
                        <span className={`status-pill tone-${tone}`}>{s.status}</span>
                        <span className="meta">live only</span>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="arch-layout">
              <div className="panel">
                <div className="field">
                  <label>
                    YAML
                    {liveProject
                      ? ` · ${projectLabel || 'project'}${
                          yamlMeta?.source ? ` · ${yamlMeta.source}` : ''
                        }`
                      : ' · paste import or zerops.yaml'}
                    {yamlMeta?.kind ? ` · ${yamlMeta.kind}` : review?.kind ? ` · ${review.kind}` : ''}
                  </label>
                  {yamlMeta?.note && (
                    <div className="sub" style={{ marginBottom: 8 }}>
                      {yamlMeta.note}
                    </div>
                  )}
                  <textarea
                    className="textarea textarea-arch"
                    value={yaml}
                    onChange={(e) => {
                      setYaml(e.target.value);
                      setYamlMeta((m) =>
                        m
                          ? {
                              ...m,
                              source: m.source === 'live-inventory' ? 'pasted' : m.source,
                              note: 'Edited in browser — re-score to refresh findings',
                            }
                          : { source: 'pasted', note: 'Pasted / edited locally' }
                      );
                    }}
                    spellCheck={false}
                    placeholder={`# Prefer GUI export (project ⋮ → Export project as yaml)\nproject:\n  name: my-project\nservices:\n  - hostname: app\n    type: alpine/bun@1.2.2\n    enableSubdomainAccess: true`}
                  />
                </div>
              </div>
              <div className="panel arch-findings-panel">
                {review ? (
                  <>
                    <div className="panel-h">
                      <h3>Findings</h3>
                      <span className="incident-meta">sorted: critical → warn → info</span>
                    </div>
                    {[...(review.findings || [])]
                      .sort((a, b) => {
                        const o = { critical: 0, warn: 1, info: 2 };
                        return (o[a.level] ?? 3) - (o[b.level] ?? 3);
                      })
                      .map((f, i) => (
                        <div
                          key={i}
                          className={`finding ${
                            f.level === 'critical' ? 'critical' : f.level === 'warn' ? 'warn' : 'info'
                          }`}
                        >
                          <div className="finding-head">
                            <span className={`finding-lvl ${f.level || 'info'}`}>
                              {String(f.level || 'info').toUpperCase()}
                            </span>
                            <h5>{f.title}</h5>
                          </div>
                          <p>{f.detail}</p>
                          {f.fix && (
                            <div className="finding-fix">
                              <strong>Remediation · </strong>
                              {f.fix}
                            </div>
                          )}
                        </div>
                      ))}
                    {!(review.findings || []).length && (
                      <div className="empty">No findings — structure looks solid.</div>
                    )}
                  </>
                ) : (
                  <div className="empty">
                    {liveProject
                      ? 'Select a project or click Load inventory sketch.'
                      : 'Paste YAML and click Re-score.'}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {view === 'chat' && (
          <>
            <header className="page-head">
              <div>
                <h2>DevOps chat</h2>
                <p className="lede">
                  Answers use live health, incidents, and your selected Zerops project — formatted
                  like a modern assistant.
                </p>
              </div>
              <span className={`pill ${liveProject ? 'live' : ''}`}>
                <span className={`dot ${liveProject ? 'dot-ok' : 'dot-muted'}`} />
                {liveProject ? projectLabel || 'Live' : 'Sandbox'}
              </span>
            </header>
            <div className="panel chat-box chat-gpt">
              <div className="chat-log" ref={chatLogRef}>
                {chat.map((m) => (
                  <ChatBubble
                    key={m.id || `${m.role}-${m.text?.slice?.(0, 24)}`}
                    msg={m}
                    onStreamDone={markStreamDone}
                  />
                ))}
              </div>
              <form className="chat-form chat-composer" onSubmit={sendChat}>
                <input
                  className="input"
                  value={chatIn}
                  onChange={(e) => setChatIn(e.target.value)}
                  placeholder="Ask about health, incidents, services…"
                  disabled={chatBusy}
                />
                <button className="btn btn-primary" type="submit" disabled={chatBusy || !chatIn.trim()}>
                  {chatBusy ? <span className="spinner" /> : 'Send'}
                </button>
              </form>
            </div>
          </>
        )}

        {view === 'connect' && (
          <>
            <div className="connect-hero">
              <div className="connect-panel-hero">
                <h2>
                  {me.connected
                    ? 'You’re signed into Zerops'
                    : 'Bring your own project. Keep the same SRE.'}
                </h2>
                <p className="lede">
                  {me.connected
                    ? 'Select a project below. OpsMate scopes health, incidents, chat, and architecture to that fleet only.'
                    : 'Right now you’re in demo mode. Paste a Personal Access Token from app.zerops.io and operate on your real stacks — not sandbox mocks.'}
                </p>
                <ol className="connect-steps">
                  <li>
                    <span className="n">1</span>
                    <span>
                      Create a PAT in{' '}
                      <a
                        href="https://app.zerops.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--z)' }}
                      >
                        app.zerops.io
                      </a>{' '}
                      → Access Token management
                    </span>
                  </li>
                  <li>
                    <span className="n">2</span>
                    <span>Connect here — token is held in this browser tab (sessionStorage) and sent as Bearer to the API (never Postgres)</span>
                  </li>
                  <li>
                    <span className="n">3</span>
                    <span>Pick a project → live inventory, health score, one-click restart, scoped chat</span>
                  </li>
                </ol>

                {!me.connected ? (
                  <form onSubmit={connectZerops}>
                    <div className="field">
                      <label>Personal Access Token</label>
                      <input
                        className="input"
                        type="password"
                        autoComplete="off"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="zerops_pat_…"
                      />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={connectBusy}>
                      {connectBusy ? <span className="spinner" /> : 'Connect account'}
                    </button>
                  </form>
                ) : (
                  <div className="btn-row">
                    <span className="pill live">
                      <span className="dot dot-ok" /> Connected
                      {me.user?.email ? ` · ${me.user.email}` : ''}
                    </span>
                    <button type="button" className="btn" onClick={loadProjects}>
                      Refresh projects
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={disconnect}>
                      Disconnect
                    </button>
                  </div>
                )}
              </div>

              <div className="connect-value-card">
                <h3>Why connect?</h3>
                <ul className="connect-value-list">
                  <li>Diagnose real READY_TO_DEPLOY / STOPPED stacks on your private network</li>
                  <li>Health score that matches fleet state for the selected project only</li>
                  <li>Chat grounded in your inventory — no wrong-project answers</li>
                  <li>Architecture review with inventory reconstruction + paste GUI export</li>
                  <li>One-click restart against the stack that actually broke</li>
                </ul>
                {!me.connected && (
                  <p style={{ marginTop: 18, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    Still exploring? Stay in demo — chaos lab and sample yaml need no token.
                    Connect when you’re ready to prove it on production-like infra.
                  </p>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-h">
                <div>
                  <h3>Your projects</h3>
                  <div className="sub">Click one to scope OpsMate — switches clear chat history</div>
                </div>
              </div>
              <div className="list">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`project-pick ${
                      String(me.selectedProjectId) === String(p.id) ? 'selected' : ''
                    }`}
                    onClick={() => selectProject(p)}
                  >
                    <div className="name">{p.name}</div>
                    <div className="meta">
                      {(p.services || []).length} services · {p.id}
                      {String(me.selectedProjectId) === String(p.id) ? ' · active' : ''}
                    </div>
                  </button>
                ))}
                {!projects.length && (
                  <div className="empty">
                    {me.connected
                      ? 'No projects loaded — click Refresh projects.'
                      : 'Connect a PAT first to list projects from your account.'}
                  </div>
                )}
              </div>
            </div>

            {zeropsServices.length > 0 && (
              <div className="panel" style={{ marginTop: 16 }}>
                <div className="panel-h">
                  <h3>Selected project services</h3>
                </div>
                <div className="service-grid">
                  {zeropsServices.map((s) => (
                    <ServiceCard key={s.id || s.name} s={s} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}

      <FloatingCoach
        isDemo={!liveProject}
        onChat={() => goToView('chat')}
        onConnect={() => goToView('connect')}
      />
    </div>
  );
}
