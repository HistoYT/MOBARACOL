/* =========================================================
   MobaFinance AI — utilidades base (formato, fechas, almacenamiento)
   Se carga primero; expone window.MF
   ========================================================= */
(function (root) {
  'use strict';
  const MF = (root.MF = root.MF || {});

  const NBSP = ' ';
  const MINUS = '−';
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const nf = (d) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
  const NF = [nf(0), nf(1), nf(2)];

  const ok = (n) => typeof n === 'number' && isFinite(n);

  /* ---------- Números ---------- */
  const fmt = {
    num(n, d = 0) {
      if (!ok(n)) return '—';
      return (n < 0 ? MINUS : '') + NF[d].format(Math.abs(n));
    },
    /** Pesos colombianos. compacto: $128,4 M · $850 mil · $1.234 M */
    cop(n, opts = {}) {
      if (!ok(n)) return '—';
      const sign = n < 0 ? MINUS : opts.signed && n > 0 ? '+' : '';
      const a = Math.abs(n);
      if (opts.full) return sign + '$' + NBSP + NF[0].format(Math.round(a));
      if (a >= 1e6) {
        const v = a / 1e6;
        return sign + '$' + (v >= 1000 || opts.d === 0 ? NF[0].format(v) : NF[opts.d ?? 1].format(v)) + NBSP + 'M';
      }
      if (a >= 1e3) return sign + '$' + NF[0].format(a / 1e3) + NBSP + 'mil';
      return sign + '$' + NF[0].format(a);
    },
    /** Eje: valores redondos y cortos */
    axis(n) {
      if (!ok(n)) return '';
      const a = Math.abs(n);
      const s = n < 0 ? MINUS : '';
      if (a >= 1e6) return s + '$' + NF[a % 1e6 === 0 || a >= 1e8 ? 0 : 1].format(a / 1e6) + NBSP + 'M';
      if (a >= 1e3) return s + '$' + NF[0].format(a / 1e3) + NBSP + 'mil';
      return s + '$' + NF[0].format(a);
    },
    pct(x, d = 1) {
      if (!ok(x)) return '—';
      return (x < 0 ? MINUS : '') + NF[d].format(Math.abs(x * 100)) + NBSP + '%';
    },
    delta(x, d = 1) {
      if (!ok(x)) return '—';
      const s = x > 0.00049 ? '+' : x < -0.00049 ? MINUS : '';
      return s + NF[d].format(Math.abs(x * 100)) + NBSP + '%';
    },
    pts(x, d = 1) {
      if (!ok(x)) return '—';
      const s = x > 0 ? '+' : x < 0 ? MINUS : '';
      return s + NF[d].format(Math.abs(x * 100)) + NBSP + 'pts';
    },
    days(n) {
      if (!ok(n)) return '—';
      const r = Math.round(n);
      return NF[0].format(r) + NBSP + (r === 1 ? 'día' : 'días');
    },
    months(n) {
      if (!ok(n)) return '—';
      const v = n >= 10 ? NF[0].format(n) : NF[1].format(n);
      return v + NBSP + (Math.abs(n - 1) < 0.05 ? 'mes' : 'meses');
    },
    times(n, d = 1) {
      return ok(n) ? NF[d].format(n) + '×' : '—';
    },
  };

  /* ---------- Fechas (cadenas 'AAAA-MM-DD', siempre en UTC) ---------- */
  const DAY = 864e5;
  const pad = (n) => String(n).padStart(2, '0');
  const D = {
    toDays(s) {
      const [y, m, d] = s.split('-').map(Number);
      return Date.UTC(y, m - 1, d) / DAY;
    },
    fromDays(n) {
      const dt = new Date(Math.round(n) * DAY);
      return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
    },
    fromDate(dt) {
      return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
    },
    today() {
      return D.fromDate(new Date());
    },
    addDays(s, n) {
      return D.fromDays(D.toDays(s) + n);
    },
    diff(a, b) {
      return D.toDays(b) - D.toDays(a);
    },
    month(s) {
      return s.slice(0, 7);
    },
    addMonths(key, n) {
      let [y, m] = key.split('-').map(Number);
      m += n;
      y += Math.floor((m - 1) / 12);
      m = ((((m - 1) % 12) + 12) % 12) + 1;
      return y + '-' + pad(m);
    },
    monthsBetween(a, b) {
      const out = [];
      for (let k = a; k <= b; k = D.addMonths(k, 1)) out.push(k);
      return out;
    },
    endOfMonth(key) {
      const [y, m] = key.split('-').map(Number);
      return key + '-' + pad(new Date(Date.UTC(y, m, 0)).getUTCDate());
    },
    daysInMonth(key) {
      return Number(D.endOfMonth(key).slice(8));
    },
    /** 'sep 2026' · 'Sep' · 'septiembre de 2026' */
    label(key, style = 'short') {
      const [y, m] = key.split('-').map(Number);
      if (style === 'abbr') return cap(MONTHS[m - 1]);
      if (style === 'long') return MONTHS_LONG[m - 1] + ' de ' + y;
      if (style === 'month') return MONTHS_LONG[m - 1];
      if (style === 'tiny') return cap(MONTHS[m - 1]) + ' ' + String(y).slice(2);
      return cap(MONTHS[m - 1]) + ' ' + y;
    },
    /** '30 sep 2026' */
    fmt(s, withYear = true) {
      if (!s) return '—';
      const [y, m, d] = s.split('-').map(Number);
      return d + ' ' + MONTHS[m - 1] + (withYear ? ' ' + y : '');
    },
    fmtLong(s) {
      const [y, m, d] = s.split('-').map(Number);
      return d + ' de ' + MONTHS_LONG[m - 1] + ' de ' + y;
    },
    MONTHS,
    MONTHS_LONG,
  };

  function cap(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  /* ---------- Aleatorio con semilla (datos de ejemplo reproducibles) ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.normal = (mu = 0, sd = 1) => {
      const u = 1 - next();
      const v = next();
      return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return next;
  }

  /* ---------- Varios ---------- */
  const util = {
    clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
    sum: (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0),
    avg: (arr, f) => (arr.length ? util.sum(arr, f) / arr.length : 0),
    round: (x, step = 1) => Math.round(x / step) * step,
    lerp: (a, b, t) => a + (b - a) * t,
    safeDiv: (a, b) => (b ? a / b : null),
    /** minúsculas y sin tildes, para comparar textos */
    norm: (s) =>
      String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim(),
    esc: (s) =>
      String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    uid: (() => {
      let n = 0;
      return (p = 'id') => p + '_' + Date.now().toString(36) + '_' + (n++).toString(36) + Math.random().toString(36).slice(2, 6);
    })(),
    debounce(fn, ms = 150) {
      let t;
      return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
      };
    },
    cap,
  };

  /* ---------- Almacenamiento local (puede no estar disponible) ---------- */
  const store = {
    get(key, fallback = null) {
      try {
        const v = root.localStorage && root.localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        root.localStorage && root.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        root.localStorage && root.localStorage.removeItem(key);
      } catch (e) {
        /* sin almacenamiento */
      }
    },
  };

  /* ---------- Bus de eventos ---------- */
  const handlers = {};
  const bus = {
    on(evt, fn) {
      (handlers[evt] = handlers[evt] || []).push(fn);
    },
    emit(evt, payload) {
      (handlers[evt] || []).forEach((fn) => fn(payload));
    },
  };

  Object.assign(MF, { fmt, D, rng, util, store, bus, NBSP, MINUS });
})(typeof window !== 'undefined' ? window : globalThis);
