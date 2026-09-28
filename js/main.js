(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const root = document.documentElement;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  $('#year').textContent = new Date().getFullYear();

  /* =========================================================
     Text splitting
     ========================================================= */
  const heroTitle = $('#hero-title');
  heroTitle.setAttribute('aria-label', heroTitle.textContent.replace(/\s+/g, ' ').trim());
  $$('.hl', heroTitle).forEach((l) => l.setAttribute('aria-hidden', 'true'));
  $$('.section__head h2, .why__head h2').forEach((h) => { h.dataset.split = 'words'; });
  $$('.section__head h2, .why__head h2, #sol-title, #cta-title').forEach((h) => h.classList.add('mask'));

  function split(el, mode) {
    const walk = (node) => {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            if (mode === 'chars') {
              [...part].forEach((ch) => {
                const c = document.createElement('span');
                c.className = 'c';
                c.textContent = ch;
                w.appendChild(c);
              });
            } else {
              const wi = document.createElement('span');
              wi.className = 'wi';
              wi.textContent = part;
              w.appendChild(wi);
            }
            frag.appendChild(w);
          });
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const clone = child.cloneNode(false);
          if (clone.classList.contains('grad-text')) clone.classList.add('is-split');
          clone.appendChild(walk(child));
          frag.appendChild(clone);
        }
      });
      return frag;
    };
    const out = walk(el);
    el.textContent = '';
    el.appendChild(out);
  }
  $$('[data-split]').forEach((el) => split(el, el.dataset.split));

  // Continuous gradient across split glyphs
  function fixGradients() {
    $$('.grad-text.is-split').forEach((g) => {
      const parts = $$('.c, .wi', g);
      let min = Infinity;
      let max = -Infinity;
      parts.forEach((p) => { min = Math.min(min, p.offsetLeft); max = Math.max(max, p.offsetLeft + p.offsetWidth); });
      const w = Math.max(1, max - min);
      parts.forEach((p) => {
        p.style.backgroundSize = `${w}px 100%`;
        p.style.backgroundPosition = `${-(p.offsetLeft - min)}px 0`;
      });
    });
  }
  fixGradients();
  document.fonts?.ready.then(fixGradients);
  addEventListener('resize', fixGradients);

  // Tilt cards get a wrapper so scroll transforms and hover tilt don't fight
  $$('[data-tilt]').forEach((el) => {
    const slot = document.createElement('div');
    slot.className = 'tilt-slot';
    el.parentNode.insertBefore(slot, el);
    slot.appendChild(el);
  });

  /* =========================================================
     Smooth scroll
     ========================================================= */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new window.Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9 });
    if (hasGSAP) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add((t) => lenis.raf(t * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollToTarget = (target) => {
    if (lenis) lenis.scrollTo(target, { offset: target.id === 'cta-card' ? -110 : 0, duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  /* =========================================================
     Nav & menu
     ========================================================= */
  const nav = $('#nav');
  const toggle = $('#nav-toggle');
  const overlay = $('#menu-overlay');
  let menuOpen = false;
  const setMenu = (open) => {
    menuOpen = open;
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    overlay.setAttribute('aria-hidden', String(!open));
    if (lenis) (open ? lenis.stop() : lenis.start());
  };
  toggle.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    let target = $(id);
    if (!target) return;
    e.preventDefault();
    if (id === '#contacto') target = $('#cta-card');
    if (menuOpen) setMenu(false);
    scrollToTarget(target);
  }));

  const navLinks = $$('.nav__link');
  const spy = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    navLinks.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === `#${en.target.id}`));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['inicio', 'nosotros', 'soluciones', 'web-premium', 'casos', 'contacto'].forEach((id) => spy.observe(document.getElementById(id)));

  /* =========================================================
     Cursor, magnetic, spotlight, tilt
     ========================================================= */
  const pointer = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / innerWidth - 0.5;
    pointer.y = e.clientY / innerHeight - 0.5;
  }, { passive: true });

  if (fine && !reduce) {
    root.classList.add('has-cursor');
    const cur = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const label = $('.cursor__label');
    let mx = innerWidth / 2;
    let my = innerHeight / 2;
    let rx = mx;
    let ry = my;
    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      cur.classList.remove('is-hidden');
    }, { passive: true });
    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    $$('.sol-card').forEach((c) => { c.dataset.cursor = 'Explorar'; });
    $('#browser').dataset.cursor = 'Premium';
    document.addEventListener('pointerover', (e) => {
      const withLabel = e.target.closest('[data-cursor]');
      const interactive = e.target.closest('a, button, select, input, label, [data-tilt]');
      cur.classList.toggle('has-label', !!withLabel && !e.target.closest('a, button'));
      cur.classList.toggle('is-hover', !!interactive);
      label.textContent = withLabel ? withLabel.dataset.cursor : '';
    });
    root.addEventListener('mouseleave', () => cur.classList.add('is-hidden'));

    const spots = $$('.spot');
    root.classList.add('spot-on');
    let spotRaf = 0;
    addEventListener('pointermove', (e) => {
      cancelAnimationFrame(spotRaf);
      spotRaf = requestAnimationFrame(() => spots.forEach((s) => {
        const r = s.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) return;
        s.style.setProperty('--x', `${e.clientX - r.left}px`);
        s.style.setProperty('--y', `${e.clientY - r.top}px`);
      }));
    }, { passive: true });
  }

  if (hasGSAP && fine && !reduce) {
    const { gsap } = window;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, .4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, .4)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
    $$('[data-tilt]').forEach((el) => {
      gsap.set(el, { transformPerspective: 1200 });
      const rX = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
      const rY = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        rY(((e.clientX - r.left) / r.width - 0.5) * 7);
        rX((0.5 - (e.clientY - r.top) / r.height) * 5);
      });
      el.addEventListener('pointerleave', () => { rX(0); rY(0); });
    });
  }

  /* =========================================================
     Counters & form
     ========================================================= */
  const fmtCounter = (el, v) => {
    const dec = Number(el.dataset.decimals || 0);
    el.textContent = (el.dataset.prefix || '') + v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const counters = $$('[data-count]');
  counters.forEach((el) => fmtCounter(el, 0));
  let countersDone = false;
  const runCounters = () => {
    if (countersDone) return;
    countersDone = true;
    counters.forEach((el, i) => {
      const end = parseFloat(el.dataset.count);
      if (reduce) return fmtCounter(el, end);
      const t0 = performance.now() + i * 120;
      const step = (now) => {
        const p = clamp((now - t0) / 2000);
        fmtCounter(el, p === 1 ? end : end * (1 - Math.pow(2, -10 * p)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };
  if (!hasGSAP || reduce) {
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { runCounters(); io.disconnect(); } }, { threshold: 0.4 });
    io.observe($('.impact__grid'));
  }

  const form = $('#contact-form');
  const note = $('#form-note');
  form.addEventListener('input', (e) => e.target.classList.remove('is-invalid'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const required = $$('input[required]', form);
    const invalid = required.filter((i) => !i.value.trim() || !i.checkValidity());
    required.forEach((i) => i.classList.toggle('is-invalid', invalid.includes(i)));
    if (invalid.length) {
      note.classList.remove('is-success');
      note.textContent = 'Por favor completa correctamente los campos resaltados.';
      invalid[0].focus();
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    const body = `Hola equipo MobaraCol,\n\nQuiero agendar una consultoría gratuita.\n\nNombre: ${d.nombre}\nEmpresa: ${d.empresa}\nCorreo: ${d.correo}\nSolución de interés: ${d.solucion}\n`;
    location.href = `mailto:contacto@mobaracol.com?subject=${encodeURIComponent(`Consultoría gratuita — ${d.empresa}`)}&body=${encodeURIComponent(body)}`;
    note.classList.add('is-success');
    note.textContent = '¡Gracias! Abrimos tu correo para enviar la solicitud. Te contactaremos en menos de 24 horas.';
    form.reset();
  });

  /* =========================================================
     WebGL — isologo protagonist + the operation puzzle
     ========================================================= */
  const isoSrc = () => {
    if (location.protocol !== 'file:') return Promise.resolve('assets/mobaracol-isologo.png');
    // file:// images taint WebGL textures, so use the embedded copy
    return new Promise((resolve, reject) => {
      if (window.MOBARA_ISOLOGO) return resolve(window.MOBARA_ISOLOGO);
      const s = document.createElement('script');
      s.src = 'assets/isologo-data.js';
      s.onload = () => resolve(window.MOBARA_ISOLOGO);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  };

  const radialTexture = (THREE, stops) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => grd.addColorStop(o, col));
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const PI = Math.PI;
  // Logo keys: x y z rx ry rz s ex a r — Board keys: bx by bz brx bry bs ba
  const KEYFRAMES = [
    { sel: '#inicio', at: 'top',
      d: { x: 2.5, y: -0.05, rx: 0.06, ry: -0.45, s: 0.95 },
      m: { x: 0, y: -2.2, s: 0.46, a: 0.95 } },
    { sel: '#nosotros',
      d: { z: -1.5, rx: 0.25, ry: PI + 0.35, rz: 0.1, s: 1.75, ex: 1, a: 0.28, r: 0.15 },
      m: { s: 1.1, a: 0.2 } },
    { sel: '#soluciones',
      d: { y: 1, z: -6, ry: 2 * PI, s: 0.8, a: 0, r: 0, bx: 0, by: 0.15, bz: -6.5, brx: -0.28, bry: 0, bs: 1.25, ba: 0.9 },
      m: { bx: 0, by: 2.2, bz: -8, bs: 0.8, ba: 0.6 } },
    { sel: '#web-premium',
      d: { y: 1.6, z: -2, rx: 0.5, ry: 2 * PI + 0.4, s: 1.3, ex: 0.3, a: 0.22, r: 0.3, bx: -6.2, by: 1.2, bz: -6, brx: -0.2, bry: 0.5, bs: 1.05, ba: 0.9 },
      m: { a: 0.12, bx: 0, by: 2.8, bz: -9, bs: 0.7, ba: 0.45 } },
    { sel: '#por-que',
      d: { z: -1, ry: 4 * PI, s: 1.05, a: 0.25, r: 0.7, bx: 5.8, by: 2.2, bz: -6, brx: -0.15, bry: -0.5, bs: 1, ba: 0.9 },
      m: { a: 0.14, bx: 0, by: 2.9, bz: -9, bs: 0.7, ba: 0.45 } },
    { sel: '#proceso',
      d: { x: 3.7, y: 0.45, rx: 0.1, ry: 6 * PI - 0.5, s: 0.66, ex: 0.15, a: 0.95, r: 0.5, bx: 4.3, by: -0.4, bz: -6.5, brx: -0.15, bry: -0.35, bs: 1.3, ba: 0.85 },
      m: { x: 0, y: 1.9, s: 0.45, a: 0.2, bx: 0, by: 1.4, bz: -9, bs: 0.7, ba: 0.35 } },
    { sel: '#impacto',
      d: { x: 0, y: 2.6, z: -4, rx: 0.1, ry: 8 * PI - 0.3, s: 0.4, ex: 0.8, a: 0, r: 0, bx: 0, by: -1.35, bz: -2.6, brx: -1.02, bry: 0, bs: 1.2, ba: 1 },
      m: { by: -2.6, bz: -4.5, bs: 0.6 } },
    { sel: '#casos',
      d: { x: 5.4, y: 2.3, z: -5, ry: 8 * PI + 0.5, s: 0.45, a: 0.45, r: 0.3, bx: -5.9, by: -2.3, bz: -7, brx: -0.5, bry: 0.4, bs: 1, ba: 0.55 },
      m: { x: 0, y: 3, a: 0.12, bx: 0, by: -3, bz: -10, bs: 0.7, ba: 0.25 } },
    { sel: '#cta-stage',
      d: { x: 0, y: 1.65, z: 0, ry: 10 * PI, s: 0.6, a: 1, r: 1, bx: 0, by: -0.1, bz: -1.4, brx: -1.08, bry: 0, bs: 1.18, ba: 1 },
      m: { y: 1.9, s: 0.42, by: 0.2, bz: -4, bs: 0.72 } },
    { sel: '.footer', at: 'bottom',
      d: { y: 3, z: -3, rx: 0.6, ry: 10.5 * PI, s: 0.6, ex: 0.6, a: 0.25, r: 0.2, by: -4.5, bz: -9, brx: -1.2, bs: 0.9, ba: 0.15 } },
  ];
  const DEFAULTS = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, ex: 0, a: 1, r: 1, bx: 0, by: -3, bz: -9, brx: -0.2, bry: 0, bs: 1, ba: 0 };
  const KEYS = Object.keys(DEFAULTS);

  // Puzzle: 3×3 board, the center piece is MobaraCol itself
  const ICONS = {
    hotel: ['M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M16 9h2a2 2 0 0 1 2 2v10', 'M3 21h18', 'M8 7h4M8 11h4M8 15h4'],
    food: ['M4 3v7a3 3 0 0 0 6 0V3M7 3v18', 'M18 21V3c-2 1.5-3 4-3 7s1 4 3 4'],
    box: ['M3 7l9-4 9 4-9 4-9-4z', 'M3 7v10l9 4 9-4V7', 'M12 11v10'],
    web: ['M3 5h18v14H3z', 'M3 9h18', 'M6 7h.01M8.5 7h.01M11 7h.01'],
    support: ['M3 14v-2a9 9 0 0 1 18 0v2', 'M21 14a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z', 'M3 14a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z', 'M18 16v1a3 3 0 0 1-3 3h-3'],
    chart: ['M3 3v18h18', 'm7 15 4-4 3 3 5-6'],
    link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
    zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  };
  const PIECES = [
    { c: 0, r: 2, label: 'Reservas', icon: 'hotel', sel: '#soluciones', f: [0.2, 0.36], sc: [-7, 3.9, -7] },
    { c: 1, r: 2, label: 'Pedidos', icon: 'food', sel: '#soluciones', f: [0.42, 0.58], sc: [7.2, 3.6, -6] },
    { c: 2, r: 2, label: 'Activos', icon: 'box', sel: '#soluciones', f: [0.64, 0.8], sc: [-7.6, -0.8, -8] },
    { c: 0, r: 1, label: 'Web Premium', icon: 'web', sel: '#web-premium', f: [0.05, 0.3], sc: [7.8, -0.6, -7] },
    { c: 2, r: 1, label: 'Soporte 24/7', icon: 'support', sel: '#por-que', f: [0.1, 0.38], sc: [-5.8, -4.3, -6] },
    { c: 0, r: 0, label: 'Analítica', icon: 'chart', sel: '#por-que', f: [0.42, 0.7], sc: [6, -4.2, -5] },
    { c: 1, r: 0, label: 'Integraciones', icon: 'link', sel: '#proceso', f: [0.12, 0.38], sc: [-1.2, 4.6, -8] },
    { c: 2, r: 0, label: 'Automatización', icon: 'zap', sel: '#proceso', f: [0.45, 0.72], sc: [1.8, -4.8, -7] },
    { c: 1, r: 1, label: 'MobaraCol', logo: true, sel: '#cta-stage', f: [-0.05, 0.4], sc: [0.4, 5.2, -10] },
  ];
  const HUD_ORDER = PIECES.map((p) => (2 - p.r) * 3 + p.c);

  const TAB = [
    ['L', 0.36, 0],
    ['C', 0.44, 0, 0.44, 0.08, 0.4, 0.14],
    ['C', 0.33, 0.24, 0.4, 0.32, 0.5, 0.32],
    ['C', 0.6, 0.32, 0.67, 0.24, 0.6, 0.14],
    ['C', 0.56, 0.08, 0.56, 0, 0.64, 0],
    ['L', 1, 0],
  ];
  function addEdge(shape, x0, y0, x1, y1, type) {
    if (!type) { shape.lineTo(x1, y1); return; }
    const dx = x1 - x0;
    const dy = y1 - y0;
    const nx = dy * type;
    const ny = -dx * type;
    const P = (t, n) => [x0 + dx * t + nx * n, y0 + dy * t + ny * n];
    TAB.forEach(([k, ...v]) => {
      if (k === 'L') shape.lineTo(...P(v[0], v[1]));
      else shape.bezierCurveTo(...P(v[0], v[1]), ...P(v[2], v[3]), ...P(v[4], v[5]));
    });
  }
  const V_EDGES = [[1, -1], [-1, 1], [1, 1]];
  const H_EDGES = [[-1, 1, -1], [1, -1, 1]];
  function pieceShape(THREE, c, r, size) {
    const h = size / 2;
    const right = c < 2 ? V_EDGES[r][c] : 0;
    const left = c > 0 ? -V_EDGES[r][c - 1] : 0;
    const top = r < 2 ? H_EDGES[r][c] : 0;
    const bottom = r > 0 ? -H_EDGES[r - 1][c] : 0;
    const s = new THREE.Shape();
    s.moveTo(-h, -h);
    addEdge(s, -h, -h, h, -h, bottom);
    addEdge(s, h, -h, h, h, right);
    addEdge(s, h, h, -h, h, top);
    addEdge(s, -h, h, -h, -h, left);
    return s;
  }

  function faceTexture(THREE, piece, logoImg) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    // Content stays inside the central safe zone; neighbours' tabs cover the notch areas
    if (piece.logo) {
      const w = 104;
      const h = w * (logoImg.height / logoImg.width);
      g.drawImage(logoImg, 128 - w / 2, 100 - h / 2, w, h);
    } else {
      g.save();
      g.translate(128, 102);
      g.scale(2.5, 2.5);
      g.translate(-12, -12);
      g.strokeStyle = '#7BE3FA';
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      ICONS[piece.icon].forEach((d) => g.stroke(new Path2D(d)));
      g.restore();
    }
    g.fillStyle = '#EEF3FA';
    const fs = piece.label.length > 11 ? 15 : piece.label.length > 8 ? 18 : 21;
    g.font = `700 ${fs}px Manrope, Inter, sans-serif`;
    g.textAlign = 'center';
    g.fillText(piece.label, 128, 160);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  async function initWebGL() {
    const canvas = $('#webgl');
    const THREE = await import('three');
    const mobile = innerWidth < 760;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x020304, 1);
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
    const tex = await new THREE.TextureLoader().loadAsync(await isoSrc());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    await Promise.race([document.fonts ? document.fonts.load('700 26px Manrope') : null, new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    // Lighting for the puzzle pieces
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0x9fe9ff, 2.2);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x1e7fe0, 2);
    rim.position.set(-6, -2, 4);
    scene.add(rim);
    try {
      const { RoomEnvironment } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js');
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    } catch (err) { /* lights alone are enough */ }

    /* ---------- Logo (stacked alpha-tested planes → solid extrusion that can explode) ---------- */
    const rig = new THREE.Group();
    scene.add(rig);
    const W = 4.2;
    const H = W / (tex.image.width / tex.image.height);
    const plane = new THREE.PlaneGeometry(W, H);
    const N = mobile ? 30 : 46;
    const DEPTH = 0.5;
    const layers = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const k = 0.4 + 0.55 * Math.pow(t, 1.4);
      const color = i === N - 1 ? new THREE.Color(1.15, 1.15, 1.15) : new THREE.Color(k * 0.75, k * 0.95, k * 1.2);
      const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, color, alphaTest: 0.5, transparent: true, side: THREE.DoubleSide }));
      mesh.userData.t = t;
      rig.add(mesh);
      layers.push(mesh);
    }
    const shine = new THREE.Mesh(plane, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { map: { value: tex }, time: { value: 0 }, alpha: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D map; uniform float time; uniform float alpha; varying vec2 vUv;
        void main(){
          vec4 c = texture2D(map, vUv);
          if (c.a < 0.5) discard;
          float pos = mod(time * 0.32, 2.8) - 0.6;
          float band = 1.0 - smoothstep(0.0, 0.12, abs(vUv.x + vUv.y * 0.6 - pos));
          gl_FragColor = vec4(vec3(0.75, 0.95, 1.0) * band * 0.6 * alpha, 1.0);
        }`,
    }));
    rig.add(shine);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture(THREE, [[0, 'rgba(34,199,240,.55)'], [0.35, 'rgba(21,96,189,.22)'], [1, 'rgba(0,0,0,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    glow.scale.set(7.5, 7.5, 1);
    glow.position.z = -1.2;
    rig.add(glow);

    const rings = new THREE.Group();
    rig.add(rings);
    const ringDefs = [[3.1, 0x22c7f0, 0.8, 1.2, 0.25], [3.6, 0x1e7fe0, 0.45, 1.35, -0.4], [2.6, 0x7be3fa, 0.5, 1.0, 0.9]];
    const ringMeshes = ringDefs.map(([r, color, op, rx, ry]) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.01, 8, 260), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.set(rx, ry, 0);
      m.userData.base = op;
      rings.add(m);
      return m;
    });
    const nodeGeo = new THREE.SphereGeometry(0.07, 16, 16);
    const nodes = [[0, 0x7be3fa, 0, 0.5], [0, 0x22c7f0, PI, 0.5], [1, 0x1e7fe0, 1, -0.32], [2, 0x7be3fa, 2, 0.8], [2, 0xffffff, 5, 0.8]].map(([ri, color, a, s]) => {
      const n = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      ringMeshes[ri].add(n);
      return { n, r: ringDefs[ri][0], a, s };
    });

    /* ---------- Puzzle ---------- */
    const SIZE = 1.3;
    const board = new THREE.Group();
    scene.add(board);
    const tray = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const g = c.getContext('2d');
      const r = 48;
      g.beginPath();
      if (g.roundRect) g.roundRect(8, 8, 496, 496, r); else g.rect(8, 8, 496, 496);
      const grd = g.createLinearGradient(0, 0, 512, 512);
      grd.addColorStop(0, 'rgba(18,34,58,.9)');
      grd.addColorStop(1, 'rgba(4,8,14,.9)');
      g.fillStyle = grd;
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(123,227,250,.35)';
      g.stroke();
      g.fillStyle = 'rgba(123,227,250,.18)';
      for (let x = 40; x < 480; x += 28) for (let y = 40; y < 480; y += 28) g.fillRect(x, y, 2, 2);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 3 + 0.9, SIZE * 3 + 0.9), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.position.z = -0.16;
      board.add(m);
      return m;
    })();

    const pieces = PIECES.map((def) => {
      const shape = pieceShape(THREE, def.c, def.r, SIZE);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.028, bevelSegments: 3, curveSegments: 18 });
      geo.translate(0, 0, -0.08);
      geo.scale(0.965, 0.965, 1);
      const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: def.logo ? 0x0f2748 : 0x0a1830, metalness: 0.55, roughness: 0.38, transparent: true, envMapIntensity: 0.25,
      }));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 0.9, SIZE * 0.9), new THREE.MeshBasicMaterial({ map: faceTexture(THREE, def, tex.image), transparent: true, depthWrite: false }));
      face.position.z = 0.118;
      const outlinePts = shape.getPoints(28).map((p) => new THREE.Vector3(p.x * 0.965, p.y * 0.965, 0.12));
      const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outlinePts), new THREE.LineBasicMaterial({ color: 0x7be3fa, transparent: true }));
      const group = new THREE.Group();
      group.add(body, face, outline);
      scene.add(group);

      const ghost = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outlinePts.map((v) => v.clone().setZ(-0.1))), new THREE.LineBasicMaterial({ color: 0x22c7f0, transparent: true }));
      const slot = new THREE.Vector3((def.c - 1) * SIZE, (def.r - 1) * SIZE, 0);
      ghost.position.copy(slot);
      board.add(ghost);

      const rnd = (n) => (Math.sin((def.c + 1) * 12.9898 + (def.r + 1) * 78.233 + n) * 43758.5453) % 1;
      return {
        def, group, body, face, outline, ghost, slot,
        rot: new THREE.Euler(rnd(1) * 1.4, rnd(2) * 1.6, rnd(3) * 0.8),
        spin: new THREE.Vector3(rnd(4) * 0.25, rnd(5) * 0.3, rnd(6) * 0.15),
        phase: rnd(7) * 6,
        prog: 0,
        target: 0,
        flash: 0,
        range: [0, 1],
      };
    });

    /* ---------- Star field ---------- */
    const COUNT = mobile ? 900 : 2200;
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const cA = new THREE.Color('#1E7FE0');
    const cB = new THREE.Color('#7BE3FA');
    const tmpC = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      let x;
      let yv;
      let z;
      // Keep stars away from the camera, where they would balloon into haze
      do {
        const r = 4 + Math.pow(Math.random(), 0.7) * 12;
        const th = Math.random() * PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        x = r * Math.sin(ph) * Math.cos(th);
        yv = r * Math.sin(ph) * Math.sin(th);
        z = r * Math.cos(ph) - 3;
      } while (z > 3);
      pos[i * 3] = x;
      pos[i * 3 + 1] = yv;
      pos[i * 3 + 2] = z;
      tmpC.copy(cA).lerp(cB, Math.random()).multiplyScalar(0.5 + Math.random() * 0.8).toArray(col, i * 3);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 0.06, map: radialTexture(THREE, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]),
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(stars);

    /* ---------- Bloom (desktop only) ---------- */
    let composer = null;
    if (!mobile && !reduce) {
      try {
        const base = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/';
        const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all(
          ['EffectComposer.js', 'RenderPass.js', 'UnrealBloomPass.js', 'OutputPass.js'].map((f) => import(base + f)),
        );
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.4, 0.22));
        composer.addPass(new OutputPass());
        // The composer path gamma-encodes the clear color twice; pure black is unaffected
        renderer.setClearColor(0x000000, 1);
      } catch (err) {
        composer = null;
      }
    }

    /* ---------- Sizing ---------- */
    let aspect = 1;
    const resize = () => {
      const w = canvas.clientWidth || innerWidth;
      const h = canvas.clientHeight || innerHeight;
      renderer.setSize(w, h, false);
      if (composer) composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      aspect = camera.aspect;
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    /* ---------- Scroll mapping ---------- */
    let frames = [];
    const refOf = (el) => (el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el);
    const scrollAt = (sel, f) => {
      const ref = refOf($(sel));
      const r = ref.getBoundingClientRect();
      return r.top + scrollY + r.height * f - innerHeight / 2;
    };
    const measure = () => {
      const isMobile = innerWidth < 960;
      const maxScroll = root.scrollHeight - innerHeight;
      frames = KEYFRAMES.map((k) => {
        let p;
        if (k.at === 'top') p = 0;
        else if (k.at === 'bottom') p = maxScroll;
        else p = clamp(scrollAt(k.sel, 0.5), 0, maxScroll);
        return { p, v: { ...DEFAULTS, ...k.d, ...(isMobile && k.m ? k.m : {}) } };
      }).sort((a, b) => a.p - b.p);
      pieces.forEach((pc) => { pc.range = pc.def.f.map((f) => scrollAt(pc.def.sel, f)); });
    };
    measure();
    addEventListener('resize', measure);
    if (hasGSAP) window.ScrollTrigger.addEventListener('refresh', measure);

    const target = { ...DEFAULTS };
    const sample = (y) => {
      if (reduce) {
        Object.assign(target, frames[0].v);
        target.a = y > innerHeight * 0.6 ? 0.2 : 1;
        return;
      }
      let a = frames[0];
      let b = frames[0];
      let t = 0;
      if (y >= frames[frames.length - 1].p) { a = b = frames[frames.length - 1]; } else {
        for (let i = 0; i < frames.length - 1; i++) {
          if (y >= frames[i].p && y < frames[i + 1].p) {
            a = frames[i]; b = frames[i + 1];
            t = easeInOut((y - a.p) / Math.max(1, b.p - a.p));
            break;
          }
        }
      }
      KEYS.forEach((key) => { target[key] = lerp(a.v[key], b.v[key], t); });
    };

    /* ---------- HUD ---------- */
    const hud = $('#puzzle-hud');
    const hudCells = $$('.puzzle-hud__grid i', hud);
    const hudCount = $('#ph-count');
    const hudLast = $('#ph-last');
    let placedCount = -1;
    const updateHud = () => {
      const placed = pieces.filter((pc) => pc.prog > 0.97);
      if (placed.length === placedCount) return;
      placedCount = placed.length;
      hudCount.textContent = placedCount;
      hudCells.forEach((cell) => cell.classList.remove('on'));
      placed.forEach((pc) => hudCells[HUD_ORDER[pieces.indexOf(pc)]].classList.add('on'));
      hudLast.textContent = placedCount === 9 ? 'Operación completa ✓' : placedCount ? `${placed[placed.length - 1].def.label} ✓` : 'Desliza para sumar piezas';
    };

    /* ---------- Render loop ---------- */
    const cur = { ...DEFAULTS };
    sample(0);
    Object.assign(cur, target);
    const intro = { p: reduce ? 1 : 0 };
    const look = { x: 0, y: 0 };
    let lastY = scrollY;
    let spin = 0;
    const clock = new THREE.Clock();
    const m = reduce ? 0 : 1;
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const qA = new THREE.Quaternion();
    const eul = new THREE.Euler();
    let nFrames = 0;
    let slowAcc = 0;

    const render = () => {
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      // Adaptive quality: drop bloom, then resolution, on slow GPUs
      nFrames++;
      if (nFrames > 5) slowAcc += rawDt;
      if (nFrames === 45) {
        const avg = slowAcc / 40;
        if (avg > 0.03 && composer) { composer = null; slowAcc = 0; nFrames = 5; renderer.setClearColor(0x020304, 1); }
        else if (avg > 0.03) renderer.setPixelRatio(1);
      }

      const t = clock.elapsedTime;
      const y = scrollY;
      sample(y);
      const k = 1 - Math.exp(-dt * 5);
      KEYS.forEach((key) => { cur[key] += (target[key] - cur[key]) * k; });

      const vel = (y - lastY) / Math.max(dt, 0.001);
      lastY = y;
      spin += (clamp(vel * 0.0003, -0.5, 0.5) * m - spin) * 0.08;
      look.x += (pointer.x - look.x) * 0.05;
      look.y += (pointer.y - look.y) * 0.05;

      const ip = intro.p;
      const xs = clamp(aspect / 1.6, 0.5, 1.15);
      const ss = innerWidth < 960 ? 1 : clamp(aspect / 1.6, 0.7, 1.05);
      const docP = y / Math.max(1, root.scrollHeight - innerHeight);

      /* Logo */
      const ex = cur.ex + (1 - ip) * 3.2;
      const alpha = cur.a * clamp(ip * 1.6);
      rig.visible = alpha > 0.01;
      rig.position.set(cur.x * xs + look.x * 0.3 * m, cur.y + Math.sin(t * 1.1) * 0.08 * m, cur.z);
      rig.rotation.set(
        cur.rx + look.y * 0.3 * m,
        cur.ry + Math.sin(t * 0.45) * 0.18 * m + look.x * 0.45 * m + spin - (1 - ip) * 2.6,
        cur.rz + (1 - ip) * 0.4,
      );
      rig.scale.setScalar(cur.s * ss * (0.45 + 0.55 * ip));
      layers.forEach((mesh, i) => {
        const lt = mesh.userData.t;
        const off = lt - 0.5;
        mesh.position.set(off * ex * 1.8, -off * ex * 0.9, -DEPTH / 2 + lt * DEPTH + off * ex * 3.2);
        mesh.rotation.z = off * ex * 0.3;
        mesh.material.opacity = alpha * (i === N - 1 ? 1 : lerp(1, 0.12 + 0.88 * lt * lt, clamp(ex)));
      });
      const front = layers[N - 1];
      shine.position.set(front.position.x, front.position.y, front.position.z + 0.003);
      shine.rotation.z = front.rotation.z;
      shine.material.uniforms.time.value = t * m + 1.2;
      shine.material.uniforms.alpha.value = alpha;
      glow.material.opacity = 0.7 * alpha;
      rings.rotation.y = t * 0.12 * m;
      rings.rotation.z = Math.sin(t * 0.2) * 0.1 * m;
      const ringAlpha = cur.r * alpha * ip;
      ringMeshes.forEach((rm) => { rm.material.opacity = rm.userData.base * ringAlpha; });
      nodes.forEach((o) => {
        const a = o.a + t * o.s * m;
        o.n.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0);
        o.n.material.opacity = ringAlpha;
      });

      /* Board */
      board.position.set(cur.bx * xs, cur.by + Math.sin(t * 0.8) * 0.05 * m, cur.bz);
      board.rotation.set(cur.brx + look.y * 0.12 * m, cur.bry + look.x * 0.18 * m, 0);
      board.scale.setScalar(cur.bs * ss);
      board.updateMatrixWorld();
      const ba = cur.ba;
      tray.material.opacity = 0.75 * ba;
      tray.visible = ba > 0.01;

      /* Pieces: scattered around the viewport → snapped into the board by scroll */
      const xsP = clamp(aspect / 1.6, 0.25, 1.15);
      pieces.forEach((pc) => {
        const [r0, r1] = pc.range;
        pc.target = reduce ? 0 : clamp((y - r0) / Math.max(1, r1 - r0));
        const before = pc.prog;
        pc.prog += (pc.target - pc.prog) * (1 - Math.exp(-dt * 6));
        if (before < 0.97 && pc.prog >= 0.97) pc.flash = 1;
        pc.flash *= Math.exp(-dt * 2.5);
        const e = easeInOut(pc.prog);
        const [sx, sy, sz] = pc.def.sc;
        vA.set(sx * xsP, sy + Math.sin(docP * PI * 2 + pc.phase) * 0.6 + Math.sin(t * 0.6 + pc.phase) * 0.12 * m, sz);
        vB.copy(pc.slot).applyMatrix4(board.matrixWorld);
        pc.group.position.lerpVectors(vA, vB, e);
        pc.group.position.z += Math.sin(e * PI) * 2.2;
        const idle = (1 - e) * m;
        eul.set(pc.rot.x + t * pc.spin.x * idle + docP * 1.5 * (1 - e), pc.rot.y + t * pc.spin.y * idle, pc.rot.z + t * pc.spin.z * idle);
        qA.setFromEuler(eul);
        pc.group.quaternion.slerpQuaternions(qA, board.quaternion, e);
        pc.group.scale.setScalar(lerp(0.7 * ss, board.scale.x, e));

        // Loose pieces stay discreet in the hero and gain presence as the story advances
        const loose = lerp(0.4, 0.85, clamp(y / innerHeight)) * clamp(ip * 1.4);
        const op = lerp(loose, Math.max(ba, 0.08), e);
        pc.body.material.opacity = op;
        pc.face.material.opacity = op;
        pc.face.material.color.setScalar(1 + pc.flash * 0.8);
        pc.outline.material.opacity = op * (0.35 + pc.flash * 0.65);
        pc.ghost.material.opacity = ba * 0.22 * (1 - e);
      });
      updateHud();
      hud.classList.toggle('is-visible', ba > 0.35 && ip === 1);

      /* Stars & camera */
      stars.rotation.y = t * 0.012 * m + docP * 2.2;
      stars.rotation.x = docP * 0.6;
      stars.material.opacity = 0.35 + 0.65 * clamp(ip * 1.2);
      camera.position.x = look.x * 0.8 * m;
      camera.position.y = -look.y * 0.5 * m;
      camera.lookAt(0, 0, 0);

      if (composer) composer.render(); else renderer.render(scene, camera);
      requestAnimationFrame(render);
    };

    let running = false;
    return {
      intro(duration = 2.6) {
        if (!running) {
          running = true;
          clock.getDelta();
          requestAnimationFrame(render);
        }
        if (reduce) return;
        if (hasGSAP) window.gsap.to(intro, { p: 1, duration, ease: 'expo.out' });
        else intro.p = 1;
      },
    };
  }

  const webglReady = initWebGL().catch(() => {
    const img = document.createElement('img');
    img.src = 'assets/mobaracol-isologo.png';
    img.alt = '';
    img.className = 'hero__fallback';
    $('.hero').appendChild(img);
    return null;
  });

  /* =========================================================
     Scroll choreography (GSAP)
     ========================================================= */
  function initScroll() {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    const progressBar = $('#progress');
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        progressBar.style.transform = `scaleX(${self.progress})`;
        const y = self.scroll();
        nav.classList.toggle('is-scrolled', y > 20);
        nav.classList.toggle('is-hidden', self.direction === 1 && y > 500 && !menuOpen);
      },
    });

    if (reduce) {
      ScrollTrigger.create({ trigger: '.impact__grid', start: 'top 85%', once: true, onEnter: runCounters });
      return;
    }

    const TOGGLE = 'play none none reverse';

    /* Section heads: masked line reveal in, soft fade out */
    const revealHead = (head, trigger = head) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger, start: 'top 82%', toggleActions: TOGGLE } });
      const eyebrow = $('.eyebrow', head);
      const words = $$('h2 .wi', head);
      const text = $$(':scope > p:not(.eyebrow), .solutions__hint', head);
      if (eyebrow) tl.from(eyebrow, { opacity: 0, y: 14, duration: 0.8, ease: 'power3.out' }, 0);
      if (words.length) tl.from(words, { yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: 0.035 }, 0.05);
      if (text.length) tl.from(text, { opacity: 0, y: 18, duration: 1, ease: 'power3.out', stagger: 0.08 }, 0.3);
    };
    const fadeOut = (el, start = 'top 15%') => {
      gsap.to(el, { opacity: 0, y: -40, ease: 'none', scrollTrigger: { trigger: el, start, end: 'bottom top', scrub: true } });
    };
    $$('.section__head, .why__head').forEach((h) => { revealHead(h); fadeOut(h); });

    /* Hero: gentle exit */
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } })
      .to('.hero__title', { y: -70, opacity: 0, ease: 'none' }, 0)
      .to('.hero__bottom', { y: -40, opacity: 0, ease: 'none' }, 0)
      .to('.hud', { opacity: 0, ease: 'none' }, 0)
      .to('.hero__meta', { opacity: 0, ease: 'none' }, 0);

    /* Ticker: scroll offset + light velocity skew */
    $$('.ticker__row').forEach((row) => {
      const dir = Number(row.dataset.ticker);
      gsap.fromTo(row, { xPercent: dir * 4 }, { xPercent: dir * -8, ease: 'none', scrollTrigger: { trigger: '.ticker', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    const skewTo = gsap.quickTo('.ticker__row', 'skewX', { duration: 0.8, ease: 'power3' });
    ScrollTrigger.create({ onUpdate: (self) => skewTo(clamp(self.getVelocity() / -400, -6, 6)) });

    /* Manifesto: pinned, words light up in reading order */
    const words = $$('.manifesto__text .wi');
    gsap.timeline({ scrollTrigger: { trigger: '.manifesto', start: 'top top', end: '+=140%', pin: true, scrub: 1 } })
      .from('.manifesto .eyebrow', { opacity: 0, y: 16, duration: 0.3 }, 0)
      .fromTo(words, { opacity: 0.14 }, { opacity: 1, stagger: 0.08, duration: 0.4, ease: 'none' }, 0.1)
      .from('.manifesto__foot > *', { opacity: 0, y: 12, stagger: 0.06, duration: 0.3 }, '>-0.1')
      .to('.manifesto__inner', { opacity: 0, y: -40, duration: 0.6, ease: 'power1.in' }, '+=0.45');

    /* Solutions */
    const mm = gsap.matchMedia();
    mm.add('(min-width: 960px)', () => {
      const section = $('.solutions');
      const track = $('.solutions__track');
      const bar = $('.solutions__progress i');
      const dist = () => track.scrollWidth - innerWidth;
      const horizontal = gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true,
          onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; },
        },
      });
      revealHead($('.solutions__intro'), section);
      gsap.to('.solutions__intro', {
        opacity: 0, x: -60, ease: 'none',
        scrollTrigger: { trigger: '.solutions__intro', containerAnimation: horizontal, start: 'left left', end: 'right left', scrub: true },
      });
      $$('.solutions__track > .tilt-slot').forEach((slot) => {
        gsap.timeline({ scrollTrigger: { trigger: slot, containerAnimation: horizontal, start: 'left right', end: 'right left', scrub: true } })
          .fromTo(slot, { rotateY: -14, z: -120, opacity: 0.35, transformPerspective: 1600 }, { rotateY: 0, z: 0, opacity: 1, duration: 0.4, ease: 'power2.out' })
          .to(slot, { duration: 0.2 })
          .to(slot, { rotateY: 10, z: -100, opacity: 0.35, duration: 0.4, ease: 'power2.in' });
      });
    });
    mm.add('(max-width: 959px)', () => {
      revealHead($('.solutions__intro'));
      $$('.solutions__track > .tilt-slot').forEach((slot) => rise(slot));
    });

    /* Generic subtle scrubbed entrance */
    function rise(el, { y = 70, rx = -8, trigger, start = 'top 94%', end = 'top 62%' } = {}) {
      return gsap.fromTo(el, { y, opacity: 0, rotateX: rx, transformPerspective: 1200, transformOrigin: '50% 100%' }, {
        y: 0, opacity: 1, rotateX: 0, ease: 'power2.out', scrollTrigger: { trigger: trigger || el, start, end, scrub: 1 },
      });
    }

    /* Premium: browser rises from a tilted plane */
    gsap.fromTo('#browser', { rotateX: 24, scale: 0.9, y: 40, transformPerspective: 1600, transformOrigin: '50% 100%' }, {
      rotateX: 0, scale: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: '.browser-stage', start: 'top 95%', end: 'center 58%', scrub: 1 },
    });
    gsap.to('.browser-stage', { opacity: 0.25, scale: 0.97, ease: 'none', scrollTrigger: { trigger: '.browser-stage', start: 'bottom 40%', end: 'bottom top', scrub: true } });
    gsap.fromTo('.stat-a', { y: 80 }, { y: -100, ease: 'none', scrollTrigger: { trigger: '.browser-stage', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.stat-b', { y: -40 }, { y: 90, ease: 'none', scrollTrigger: { trigger: '.browser-stage', start: 'top bottom', end: 'bottom top', scrub: true } });
    $$('.premium__grid .feature').forEach((f, i) => rise(f, { y: 60 + (i % 3) * 30 }));
    fadeOut('.premium__grid', 'top 5%');
    rise('.premium__foot', { y: 40, rx: 0 });

    /* Why */
    const whyIn = gsap.timeline({ scrollTrigger: { trigger: '.why__grid', start: 'top 94%', end: 'top 50%', scrub: 1 } });
    $$('.why-card').forEach((c, i) => whyIn.fromTo(c, { y: 80, opacity: 0, rotateX: -10, transformPerspective: 1200, transformOrigin: '50% 100%' }, { y: 0, opacity: 1, rotateX: 0, ease: 'power2.out', duration: 1 }, i * 0.14));
    fadeOut('.why__grid');

    /* Process: stacking cards recede */
    const cards = $$('.stack__card');
    const navH = () => nav.offsetHeight;
    cards.forEach((card, i) => {
      gsap.from(card.querySelectorAll('.stack__num, h3, p, .chips, .stack__icon'), {
        y: 36, opacity: 0, stagger: 0.07, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: card, start: 'top 78%', toggleActions: TOGGLE },
      });
      if (i === cards.length - 1) return;
      gsap.to(card, {
        scale: 0.93 - (cards.length - 2 - i) * 0.015, rotateX: -3, '--shade': 0.5, transformPerspective: 1200, transformOrigin: '50% 0%', ease: 'none',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: () => `top ${navH() + 20 + (i + 1) * 18}px`, scrub: true, invalidateOnRefresh: true },
      });
    });

    /* Impact */
    gsap.from('.impact .eyebrow', { opacity: 0, y: 14, duration: 0.8, scrollTrigger: { trigger: '.impact', start: 'top 75%', toggleActions: TOGGLE } });
    gsap.from('.stat', {
      y: 40, opacity: 0, stagger: 0.1, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: '.impact__grid', start: 'top 82%', toggleActions: TOGGLE },
    });
    ScrollTrigger.create({ trigger: '.impact__grid', start: 'top 82%', once: true, onEnter: runCounters });
    fadeOut('.impact__grid', 'top 10%');

    /* Cases */
    const casesIn = gsap.timeline({ scrollTrigger: { trigger: '.cases__grid', start: 'top 94%', end: 'top 45%', scrub: 1 } });
    $$('.cases__grid > .tilt-slot').forEach((slot, i) => {
      const dir = [-1, 0, 1][i % 3];
      casesIn.fromTo(slot, { y: 90, opacity: 0, rotateY: dir * 8, rotateX: -6, transformPerspective: 1400 }, { y: 0, opacity: 1, rotateY: 0, rotateX: 0, ease: 'power2.out', duration: 1 }, i * 0.14);
    });
    fadeOut('.cases__grid');

    /* CTA */
    gsap.timeline({ scrollTrigger: { trigger: '.cta__stage', start: 'top 35%', toggleActions: TOGGLE } })
      .from('.cta__stage .eyebrow', { opacity: 0, y: 14, duration: 0.8, ease: 'power3.out' }, 0)
      .from('#cta-title .wi', { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: 0.05 }, 0.05);
    gsap.fromTo('#cta-card', { clipPath: 'inset(10% 8% 10% 8% round 60px)', scale: 0.95, y: 40 }, {
      clipPath: 'inset(0% 0% 0% 0% round 32px)', scale: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: '#cta-card', start: 'top 100%', end: 'top 45%', scrub: 1 },
    });
    gsap.from('.cta__copy > *, .cta__form > .field, .cta__form > .cta__note', {
      y: 30, opacity: 0, stagger: 0.05, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: '#cta-card', start: 'top 60%', toggleActions: TOGGLE },
    });

    /* Footer */
    gsap.from('.footer__word .c', {
      yPercent: 100, stagger: 0.035, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: '.footer__word', start: 'top 98%', toggleActions: TOGGLE },
    });
    gsap.from('.footer__grid > *', {
      y: 40, opacity: 0, stagger: 0.07, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: '.footer', start: 'top 85%', toggleActions: TOGGLE },
    });
  }

  /* =========================================================
     Loader → intro
     ========================================================= */
  const loader = $('#loader');
  const loaderMark = $('.loader__mark');
  const countEl = $('#loader-count');
  const barEl = $('#loader-bar');

  if (hasGSAP && !reduce) {
    window.gsap.set('.hero__title .c', { yPercent: 110 });
    window.gsap.set('[data-hero-fade]', { opacity: 0, y: 24 });
  }
  if (hasGSAP) initScroll();

  root.classList.add('is-loading');
  if (lenis) lenis.stop();

  const tasks = { fonts: false, page: false, webgl: false };
  let goal = 0;
  const done = (key) => {
    tasks[key] = true;
    goal = Object.values(tasks).filter(Boolean).length / Object.keys(tasks).length;
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => done('fonts'));
  if (document.readyState === 'complete') done('page'); else addEventListener('load', () => done('page'));
  let webgl = null;
  webglReady.then((api) => { webgl = api; done('webgl'); });
  setTimeout(() => { goal = 1; }, 8000);

  const MIN = reduce ? 300 : 1700;
  const t0 = performance.now();
  let shown = 0;
  const loaderTick = (now) => {
    const timeCap = clamp((now - t0) / MIN);
    shown += (Math.min(goal, timeCap) - shown) * 0.1;
    if (goal === 1 && timeCap === 1 && shown > 0.995) shown = 1;
    const pct = Math.round(shown * 100);
    countEl.textContent = String(pct).padStart(3, '0');
    loaderMark.style.setProperty('--p', `${shown * 100}%`);
    barEl.style.transform = `scaleX(${shown})`;
    if (shown < 1) requestAnimationFrame(loaderTick); else finishLoading();
  };
  requestAnimationFrame(loaderTick);

  function finishLoading() {
    const end = () => {
      loader.classList.add('is-done');
      root.classList.remove('is-loading');
      if (lenis) lenis.start();
      fixGradients();
      if (hasGSAP) window.ScrollTrigger.refresh();
    };
    if (!hasGSAP || reduce) {
      loader.style.transition = 'opacity .5s';
      loader.style.opacity = '0';
      setTimeout(end, 500);
      if (webgl) webgl.intro();
      return;
    }
    const { gsap } = window;
    gsap.timeline({ onComplete: end })
      .to('.loader__meta, .loader__bar', { opacity: 0, y: 10, duration: 0.45, ease: 'power2.in' })
      .to(loaderMark, { scale: 1.08, filter: 'brightness(1.7)', duration: 0.45, ease: 'power2.out' }, '<')
      .to(loaderMark, { scale: 0.5, opacity: 0, filter: 'blur(10px) brightness(2)', duration: 0.6, ease: 'expo.in' })
      .add(() => { if (webgl) webgl.intro(2.6); }, '-=0.15')
      .to('.loader__panel--top', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.3')
      .to('.loader__panel--bottom', { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, '<')
      .to('.hero__title .c', { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.02 }, '-=0.65')
      .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.06 }, '-=1');
  }
})();
