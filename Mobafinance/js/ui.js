/* =========================================================
   MobaFinance AI — Componentes de interfaz compartidos
   ========================================================= */
(function (root) {
  'use strict';
  const MF = root.MF;
  const { fmt, util } = MF;
  const esc = util.esc;

  /* ---------- Íconos (trazo 24×24) ---------- */
  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-8"/>',
    sparkles: '<path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8z"/><path d="M19 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/><path d="M5 16l.5 1.3 1.3.5-1.3.5L5 19.6l-.5-1.3-1.3-.5 1.3-.5z"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    arrowUp: '<path d="M7 17 17 7M8 7h9v9"/>',
    arrowDown: '<path d="M7 7l10 10M17 8v9H8"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    octagon: '<path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z"/><path d="M12 8v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/>',
    trendUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13l5 5M14 13l-5 5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    bank: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-7 10 7z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    book: '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
    flag: '<path d="M4 22V4"/><path d="M4 4h13l-2.5 4.5L17 13H4"/>',
    piggy: '<path d="M5 11a6 5 0 0 1 6-5h2.5a6 5 0 0 1 5.6 3.5H21v4h-1.6a6 5 0 0 1-2.4 2.6V19h-3v-1.6h-4V19H7v-2.4A5.5 5 0 0 1 5 12"/><path d="M15.5 10h.01"/><path d="M3 9.5c0 1.2.9 2 2 2"/>',
  };
  const icon = (name, cls) => '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  /* ---------- Estados (siempre ícono + texto) ---------- */
  const STATUS = {
    good: { label: 'Sano', icon: 'checkCircle' },
    warning: { label: 'Atención', icon: 'alert' },
    critical: { label: 'Riesgo', icon: 'octagon' },
    info: { label: 'Dato', icon: 'info' },
  };
  function status(st, label) {
    const s = STATUS[st] || STATUS.info;
    return '<span class="status status--' + st + '">' + icon(s.icon) + esc(label || s.label) + '</span>';
  }
  const SEV_ICON = { critical: 'octagon', warning: 'alert', info: 'info', good: 'checkCircle' };

  /** Píldora de variación. goodWhenUp define el color según la dirección. */
  function delta(x, goodWhenUp = true, kind = 'pct') {
    if (x == null || !isFinite(x)) return '';
    const flat = kind === 'days' ? Math.abs(x) < 0.5 : Math.abs(x) < 0.0005;
    const up = x > 0;
    const cls = flat ? 'is-flat' : up === goodWhenUp ? 'is-good' : 'is-bad';
    let txt;
    if (kind === 'days') txt = (up ? '+' : x < 0 ? MF.MINUS : '') + fmt.num(Math.abs(Math.round(x))) + ' días';
    else if (kind === 'pts') txt = fmt.pts(x);
    else txt = fmt.delta(x);
    return '<span class="delta ' + cls + '">' + (flat ? '' : icon(up ? 'arrowUp' : 'arrowDown')) + txt + '</span>';
  }

  /** Valor de un indicador con su formato */
  function fmtInd(key, v) {
    const f = (MF.engine.IND[key] || {}).fmt;
    if (v == null || !isFinite(v)) return '—';
    switch (f) {
      case 'cop': return fmt.cop(v);
      case 'pct': return fmt.pct(v);
      case 'delta': return fmt.delta(v);
      case 'days': return fmt.days(v);
      case 'months': return fmt.months(v);
      case 'times': return fmt.times(v);
      default: return fmt.num(v, 1);
    }
  }

  /** Semáforo por indicador (umbrales de referencia para pymes) */
  const TH = {
    coberturaCaja: (v) => (v >= 2 ? 'good' : v >= 1 ? 'warning' : 'critical'),
    runway: (v) => (v >= 6 ? 'good' : v >= 3 ? 'warning' : 'critical'),
    liquidezCorriente: (v) => (v >= 1.5 ? 'good' : v >= 1 ? 'warning' : 'critical'),
    pruebaAcida: (v) => (v >= 1 ? 'good' : v >= 0.7 ? 'warning' : 'critical'),
    razonEfectivo: (v) => (v >= 0.5 ? 'good' : v >= 0.3 ? 'warning' : 'critical'),
    margenBruto: (v, k) => (k.margenBrutoInicio != null && k.margenBrutoInicio - v > 0.03 ? 'warning' : 'good'),
    margenEbitda: (v) => (v >= 0.12 ? 'good' : v >= 0.05 ? 'warning' : 'critical'),
    margenOperativo: (v) => (v >= 0.1 ? 'good' : v >= 0.03 ? 'warning' : 'critical'),
    margenNeto: (v) => (v >= 0.08 ? 'good' : v >= 0 ? 'warning' : 'critical'),
    roe: (v) => (v >= 0.15 ? 'good' : v >= 0.05 ? 'warning' : 'critical'),
    roa: (v) => (v >= 0.08 ? 'good' : v >= 0.02 ? 'warning' : 'critical'),
    margenContribucion: (v) => (v >= 0.35 ? 'good' : v >= 0.2 ? 'warning' : 'critical'),
    puntoEquilibrio: (v, k) => (k.ventasMes >= v * 1.2 ? 'good' : k.ventasMes >= v ? 'warning' : 'critical'),
    dso: (v) => (v <= 30 ? 'good' : v <= 45 ? 'warning' : 'critical'),
    dpo: (v, k) => (k.dso == null || v >= k.dso * 0.7 ? 'good' : 'warning'),
    ccc: (v) => (v <= 30 ? 'good' : v <= 60 ? 'warning' : 'critical'),
    endeudamiento: (v) => (v <= 0.5 ? 'good' : v <= 0.7 ? 'warning' : 'critical'),
    coberturaIntereses: (v) => (v >= 3 ? 'good' : v >= 1.5 ? 'warning' : 'critical'),
    crecimiento3m: (v) => (v >= 0.02 ? 'good' : v >= -0.02 ? 'warning' : 'critical'),
    crecimientoPeriodo: (v) => (v >= 0.02 ? 'good' : v >= -0.02 ? 'warning' : 'critical'),
    concentracion: (v) => (v <= 0.2 ? 'good' : v <= 0.35 ? 'warning' : 'critical'),
  };
  function indStatus(key, v, k) {
    if (v == null || !isFinite(v) || !TH[key]) return null;
    return TH[key](v, k || {});
  }

  function legend(items) {
    return '<div class="legend">' + items.map((i) => '<span><i class="' + (i.box ? 'is-box ' : '') + (i.dash ? 'is-dash' : '') + '" style="--c:' + i.color + '"></i>' + esc(i.label) + '</span>').join('') + '</div>';
  }

  /* ---------- Avisos ---------- */
  function toast(msg, type) {
    const box = $('#toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' is-error' : '');
    t.innerHTML = icon(type === 'error' ? 'alert' : 'checkCircle') + '<span></span>';
    t.querySelector('span').textContent = msg;
    box.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 320);
    }, 3600);
  }

  /* ---------- Modal ---------- */
  let lastFocus = null;
  function modal(html, onMount) {
    const rootEl = $('#modalRoot');
    lastFocus = document.activeElement;
    rootEl.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    rootEl.hidden = false;
    const close = () => {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    rootEl.onclick = (e) => {
      if (e.target === rootEl) close();
    };
    $$('[data-close]', rootEl).forEach((b) => b.addEventListener('click', close));
    const first = rootEl.querySelector('input, select, textarea, button:not([data-close])');
    if (first) first.focus();
    if (onMount) onMount(rootEl.firstChild, close);
    return close;
  }

  function confirmDialog(title, body, okLabel, danger) {
    return new Promise((resolve) => {
      let done = false;
      const close = modal(
        '<div class="modal__head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-close aria-label="Cerrar">' + icon('x') + '</button></div><p class="muted">' + esc(body) + '</p><div class="modal__foot"><button class="btn" data-close>Cancelar</button><button class="btn ' + (danger ? 'btn--danger' : 'btn--light') + '" id="dlgOk">' + esc(okLabel || 'Aceptar') + '</button></div>',
        (el) => {
          el.querySelector('#dlgOk').addEventListener('click', () => {
            done = true;
            close();
            resolve(true);
          });
        }
      );
      const obs = new MutationObserver(() => {
        if ($('#modalRoot').hidden) {
          obs.disconnect();
          if (!done) resolve(false);
        }
      });
      obs.observe($('#modalRoot'), { attributes: true, attributeFilter: ['hidden'] });
      void close;
    });
  }

  /** Lee un número escrito en pesos o porcentaje («2.500.000», «$2,5 M», «21,5») */
  function readNumber(v) {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return NaN;
    const m = s.match(/^\$?\s*([\d.,]+)\s*(m|mm|millones?)$/);
    if (m) return parseFloat(m[1].replace(/\./g, '').replace(',', '.')) * 1e6;
    return MF.data.parseAmount(s);
  }
  const moneyInput = (n) => (isFinite(n) ? fmt.num(Math.round(n)) : '');

  MF.ui = { ICONS, icon, $, $$, esc, status, STATUS, SEV_ICON, delta, fmtInd, indStatus, legend, toast, modal, confirmDialog, readNumber, moneyInput };
})(typeof window !== 'undefined' ? window : globalThis);
