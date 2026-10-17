/* =========================================================
   MobaFinance AI — Aplicación: estado, rutas y estructura
   ========================================================= */
(function (root) {
  'use strict';
  const MF = root.MF;
  const { D, util, store, fmt } = MF;
  const { icon, $, $$, esc, toast, modal, SEV_ICON } = MF.ui;

  const SETTINGS_KEY = 'mobafinance:settings:v1';
  const CHAT_KEY = 'mobafinance:chat:v1';
  const TITLES = { panel: 'Panel', analisis: 'Análisis', estados: 'Estados financieros', asistente: 'Asistente IA', simulador: 'Simulador', valoracion: 'Valoración', datos: 'Datos', personal: 'Finanzas personales', ajustes: 'Ajustes' };
  /** Subsección por defecto de cada grupo del menú */
  const DEFAULT_SUB = { analisis: 'resultados', personal: 'resumen' };

  const state = {
    ds: null,
    model: null,
    insights: [],
    settings: Object.assign({ provider: 'local', apiKey: '', collapsed: false, effort: 'high' }, store.get(SETTINGS_KEY, {}) || {}),
    chat: store.get(CHAT_KEY, []) || [],
    route: { name: 'panel', sub: null, params: {} },
    ui: { dashSeries: 'ventasCaja', datos: { page: 0, q: '', tipo: '', cat: '', mes: '', estado: '', ctx: '' }, val: null, estados: null },
    sim: null,
    importPreview: null,
    pendingQuestion: null,
    busy: false,
    streaming: null,
  };

  const saveSettings = () => store.set(SETTINGS_KEY, state.settings);
  const saveChat = () => store.set(CHAT_KEY, state.chat.slice(-40));

  /* ---------- Datos → motor → IA ---------- */
  function recompute() {
    try {
      state.model = MF.engine.compute(state.ds);
    } catch (e) {
      console.error(e);
      state.model = { empty: true, profile: state.ds.profile, saldos: state.ds.saldos, meta: { nTx: 0 }, error: e.message };
      toast('No pudimos calcular tus indicadores: ' + e.message, 'error');
    }
    state.insights = state.model.empty ? [] : MF.ai.diagnose(state.model);
    state.sim = null;
    updateChrome();
  }
  function setData(ds, msg) {
    state.ds = ds;
    if (!MF.data.save(ds)) toast('No se pudo guardar en este navegador; tus cambios durarán solo esta sesión.', 'error');
    recompute();
    render();
    if (msg) toast(msg);
  }
  /** Guarda cambios hechos sobre state.ds (contexto, supuestos) y recalcula */
  function saveData({ rerender = true, msg } = {}) {
    if (!MF.data.save(state.ds)) toast('No se pudo guardar en este navegador; tus cambios durarán solo esta sesión.', 'error');
    recompute();
    if (rerender) render();
    if (msg) toast(msg);
  }

  /* ---------- Rutas ---------- */
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = {};
    new URLSearchParams(qs || '').forEach((v, k) => (params[k] = v));
    return { name: TITLES[parts[0]] ? parts[0] : 'panel', sub: parts[1] || null, params };
  }
  function go(hash) {
    if (location.hash === hash) {
      state.route = parseRoute();
      render();
    } else location.hash = hash;
  }
  /** Lleva una pregunta al asistente (desde cualquier vista). scope: 'empresa' | 'personal' (por defecto, según la sección) */
  function ask(q, ctx, scope) {
    if (!q) return;
    if ((scope || (state.route.name === 'personal' ? 'personal' : 'empresa')) === 'personal') return MF.views.personal.ask(q);
    if (state.route.name === 'asistente' && $('#chatLog')) MF.views.asistente.send(q, ctx);
    else {
      state.pendingQuestion = { q, ctx };
      go('#/asistente');
    }
  }

  function render() {
    MF.charts.cleanup();
    const r = state.route;
    const view = $('#view');
    const v = MF.views[r.name] || MF.views.panel;
    view.innerHTML = '';
    try {
      if (v.render) v.render(view, r);
      else v(view, r);
    } catch (e) {
      console.error(e);
      view.innerHTML = '<div class="empty"><h2>Algo salió mal en esta vista</h2><p>' + esc(e.message) + '</p><a class="btn" href="#/panel">Volver al panel</a></div>';
    }
    updateNav();
    closeMenu();
    document.title = (TITLES[r.name] || 'Panel') + ' · MobaFinance AI';
  }

  /* ---------- Estructura ---------- */
  const initials = (s) => (String(s || 'MF').replace(/s\.?a\.?s\.?$/i, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || 'MF').toUpperCase();

  function updateChrome() {
    const m = state.model;
    const p = (state.ds && state.ds.profile) || {};
    $('#companyName').textContent = p.empresa || 'Mi empresa';
    $('#companyAvatar').textContent = initials(p.empresa);
    $('#companyPlan').textContent = state.ds.source === 'demo' ? 'Datos de ejemplo' : 'Plan Pyme · Prueba';
    $('#userAvatar').textContent = ((p.usuario || p.empresa || 'U').trim()[0] || 'U').toUpperCase();
    $('#periodText').textContent = m.empty ? 'Sin datos' : D.label(m.meta.months[0]) + ' – ' + D.label(m.meta.months[m.meta.months.length - 1]);
    const claude = state.settings.provider === 'claude' && state.settings.apiKey;
    const st = $('#aiStatus');
    st.classList.toggle('is-claude', !!claude);
    st.querySelector('span').textContent = claude ? 'Claude' : 'Motor local';
    st.title = claude ? 'El asistente usa Claude (' + MF.ai.MODEL + ')' : 'El asistente usa el intérprete local';
    const alerts = state.insights.filter((i) => i.severity === 'critical' || i.severity === 'warning');
    const bc = $('#bellCount');
    bc.hidden = !alerts.length;
    bc.textContent = alerts.length;
    $('#bellBtn').setAttribute('aria-label', alerts.length ? alerts.length + ' alertas' : 'Alertas');
  }

  function updateNav() {
    const r = state.route;
    $$('.nav__item[data-route]').forEach((a) => {
      const on = a.dataset.route === r.name;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $$('.nav__group').forEach((g) => g.classList.toggle('is-open', g.dataset.group === r.name));
    $$('.nav__sub a').forEach((a) => {
      const g = a.closest('.nav__group').dataset.group;
      const on = r.name === g && a.dataset.sub === (r.sub || DEFAULT_SUB[g]);
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function openMenu() {
    $('#app').classList.add('is-menu-open');
    $('#scrim').hidden = false;
    $('#menuBtn').setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    $('#app').classList.remove('is-menu-open');
    $('#scrim').hidden = true;
    $('#menuBtn').setAttribute('aria-expanded', 'false');
  }

  /* ---------- Alertas ---------- */
  function toggleBell(force) {
    const pop = $('#bellPop');
    const open = force != null ? force : pop.hidden;
    if (!open) {
      pop.hidden = true;
      $('#bellBtn').setAttribute('aria-expanded', 'false');
      return;
    }
    const list = state.insights.slice(0, 6);
    pop.innerHTML =
      '<div class="popover__head"><strong>Alertas de la IA</strong><a class="link-btn" href="#/asistente">Ver todo</a></div>' +
      (list.length
        ? '<div class="insights">' + list.map((i) => '<article class="insight insight--' + i.severity + '"><span class="insight__icon">' + icon(SEV_ICON[i.severity]) + '</span><div><div class="insight__title" style="font-size:13px">' + i.title + '</div><div class="insight__foot"><button class="link-btn" type="button" data-ask="' + esc(i.ask) + '">Preguntar ' + icon('arrowRight') + '</button></div></div></article>').join('') + '</div>'
        : '<p class="muted" style="padding:10px">Sin alertas por ahora.</p>');
    pop.hidden = false;
    $('#bellBtn').setAttribute('aria-expanded', 'true');
    $$('[data-ask]', pop).forEach((b) => b.addEventListener('click', () => {
      toggleBell(false);
      ask(b.getAttribute('data-ask'), null, 'empresa');
    }));
  }

  /* ---------- Búsqueda / preguntar ---------- */
  const NAV_ITEMS = [
    ['Panel', '#/panel', 'grid'], ['Estados financieros', '#/estados/resultados', 'book'], ['Situación financiera (balance)', '#/estados/balance', 'book'], ['Flujo de efectivo', '#/estados/flujo', 'book'],
    ['Supuestos del modelo financiero', '#/estados/supuestos', 'sliders'], ['Contexto para la IA', '#/datos/contexto', 'sparkles'], ['Metas y bitácora', '#/datos/contexto', 'target'],
    ['Estado de resultados (análisis)', '#/analisis/resultados', 'receipt'], ['Flujo de caja', '#/analisis/flujo', 'wallet'],
    ['Cartera por cobrar', '#/analisis/cartera', 'users'], ['Gastos', '#/analisis/gastos', 'briefcase'], ['Indicadores', '#/analisis/indicadores', 'chart'],
    ['Asistente IA', '#/asistente', 'sparkles'], ['Simulador de escenarios', '#/simulador', 'sliders'], ['Valoración (DCF)', '#/valoracion/dcf', 'calculator'],
    ['WACC y CAPM', '#/valoracion/wacc', 'calculator'], ['Simulador de crédito', '#/valoracion/credito', 'bank'], ['Inversión (VPN y TIR)', '#/valoracion/inversion', 'target'],
    ['Múltiplos', '#/valoracion/multiplos', 'calculator'], ['Movimientos', '#/datos/movimientos', 'table'], ['Importar Excel', '#/datos/importar', 'upload'],
    ['Saldos iniciales', '#/datos/saldos', 'wallet'], ['Validaciones', '#/datos/validaciones', 'shield'], ['Ajustes', '#/ajustes', 'settings'],
    ['Finanzas personales', '#/personal/resumen', 'user'], ['Mis datos personales (ingresos, gastos, deudas, metas)', '#/personal/datos', 'edit'], ['Plan de deudas personales', '#/personal/deudas', 'card'],
    ['Metas, fondo de emergencia y futuro', '#/personal/metas', 'target'], ['Asistente de finanzas personales', '#/personal/asistente', 'sparkles'],
  ];
  let searchSel = 0;
  function searchResults(q) {
    const n = util.norm(q);
    const res = [];
    const enPersonal = state.route.name === 'personal';
    if (q.trim()) res.push({ group: 'Inteligencia artificial', label: (enPersonal ? 'Preguntar sobre tus finanzas personales: «' : 'Preguntar: «') + q.trim() + '»', icon: 'sparkles', run: () => ask(q.trim()) });
    NAV_ITEMS.filter(([l]) => !n || util.norm(l).includes(n)).slice(0, n ? 5 : 6).forEach(([l, h, ic]) => res.push({ group: 'Ir a', label: l, icon: ic, run: () => go(h) }));
    const m = state.model;
    if (n && m && !m.empty) {
      Object.entries(MF.engine.IND).filter(([, I]) => util.norm(I.label).includes(n)).slice(0, 4).forEach(([key, I]) => res.push({ group: 'Indicadores', label: I.label, hint: MF.ui.fmtInd(key, m.kpis[key]), icon: 'chart', run: () => go('#/analisis/indicadores') }));
      m.clients.filter((c) => util.norm(c.tercero).includes(n)).slice(0, 4).forEach((c) => res.push({ group: 'Clientes', label: c.tercero, hint: c.saldo ? 'Debe ' + fmt.cop(c.saldo) : 'Al día', icon: 'users', run: () => go('#/analisis/cartera') }));
    }
    if (!q.trim()) (enPersonal ? MF.personal.SUGGESTED : MF.ai.SUGGESTED).slice(0, 3).forEach((s) => res.push({ group: 'Preguntas frecuentes', label: s, icon: 'message', run: () => ask(s) }));
    return res;
  }
  function renderSearch() {
    const input = $('#searchInput');
    const box = $('#searchResults');
    const items = searchResults(input.value);
    searchSel = Math.min(searchSel, items.length - 1);
    let lastGroup = '';
    box.innerHTML = items.map((it, i) => {
      const g = it.group !== lastGroup ? '<div class="search__group">' + esc(it.group) + '</div>' : '';
      lastGroup = it.group;
      return g + '<button class="search__item' + (i === searchSel ? ' is-active' : '') + '" type="button" role="option" data-i="' + i + '" aria-selected="' + (i === searchSel) + '">' + icon(it.icon) + '<span>' + esc(it.label) + '</span>' + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '') + '</button>';
    }).join('');
    box.hidden = !items.length;
    input.setAttribute('aria-expanded', String(!box.hidden));
    $$('.search__item', box).forEach((b) => b.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const it = items[Number(b.dataset.i)];
      closeSearch();
      it.run();
    }));
    return items;
  }
  function closeSearch() {
    const input = $('#searchInput');
    $('#searchResults').hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.value = '';
    input.blur();
  }

  /* ---------- Cómo funciona ---------- */
  function howItWorks() {
    const I = MF.engine.IND;
    const keys = ['margenBruto', 'margenNeto', 'dso', 'coberturaCaja', 'puntoEquilibrio', 'ccc', 'endeudamiento', 'liquidezCorriente'];
    modal(
      '<div class="modal__head"><div><span class="eyebrow">MobaFinance AI</span><h2>Cómo funciona</h2></div><button class="icon-btn" type="button" data-close aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<p class="muted">La IA no inventa tus números. Cada respuesta pasa por tres capas:</p>' +
      '<div class="steps3" style="margin:16px 0">' +
      '<div class="step3"><div class="step3__icon">' + icon('database') + '</div><strong>1. Datos financieros</strong><p>Excel, registros, ingresos, gastos y transacciones.</p></div>' +
      '<div class="step3"><div class="step3__icon">' + icon('cpu') + '</div><strong>2. Motor financiero</strong><p>Fórmulas, indicadores, validaciones y proyecciones.</p></div>' +
      '<div class="step3 is-ai"><div class="step3__icon">' + icon('sparkles') + '</div><strong>3. Inteligencia artificial</strong><p>Interpretación de resultados, explicación de riesgos y recomendaciones fundamentadas.</p></div></div>' +
      '<h3 class="section-title" style="margin-top:8px">Glosario en palabras simples</h3><div class="glossary">' +
      keys.map((k) => '<div><b>' + esc(I[k].label) + '</b><span>' + esc(I[k].explain) + '</span></div>').join('') + '</div>' +
      '<div class="modal__foot"><a class="btn" href="#/analisis/indicadores" data-close>Ver todos los indicadores</a><button class="btn btn--light" type="button" data-close>Entendido</button></div>'
    );
  }

  /* ---------- Eventos globales ---------- */
  function bindChrome() {
    window.addEventListener('hashchange', () => {
      state.route = parseRoute();
      render();
      const view = $('#view');
      view.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
    $('#menuBtn').addEventListener('click', () => ($('#app').classList.contains('is-menu-open') ? closeMenu() : openMenu()));
    $('#scrim').addEventListener('click', closeMenu);
    $('#collapseBtn').addEventListener('click', () => {
      state.settings.collapsed = !state.settings.collapsed;
      $('#app').classList.toggle('is-collapsed', state.settings.collapsed);
      $('#collapseBtn').setAttribute('aria-label', state.settings.collapsed ? 'Expandir menú' : 'Contraer menú');
      saveSettings();
      MF.charts.cleanup();
      setTimeout(render, 220);
    });
    $('#howBtn').addEventListener('click', howItWorks);
    $('#bellBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBell();
    });
    document.addEventListener('click', (e) => {
      if (!$('#bellPop').hidden && !e.target.closest('.bell')) toggleBell(false);
    });
    const input = $('#searchInput');
    input.addEventListener('focus', () => {
      searchSel = 0;
      renderSearch();
    });
    input.addEventListener('input', () => {
      searchSel = 0;
      renderSearch();
    });
    input.addEventListener('blur', () => setTimeout(() => {
      $('#searchResults').hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }, 120));
    input.addEventListener('keydown', (e) => {
      const items = searchResults(input.value);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        searchSel = (searchSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        renderSearch();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const it = items[searchSel];
        closeSearch();
        if (it) it.run();
      } else if (e.key === 'Escape') closeSearch();
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
      } else if (e.key === 'Escape') {
        closeMenu();
        if (!$('#bellPop').hidden) toggleBell(false);
      }
    });
  }

  function boot() {
    $$('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
    state.ds = MF.data.load();
    if (state.settings.collapsed) $('#app').classList.add('is-collapsed');
    recompute();
    if (!location.hash) history.replaceState(null, '', '#/panel');
    state.route = parseRoute();
    bindChrome();
    render();
  }

  MF.app = { state, setData, saveData, recompute, render, go, ask, saveSettings, saveChat, updateChrome };
  boot();
})(typeof window !== 'undefined' ? window : globalThis);
