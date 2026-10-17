/* =========================================================
   MobaFinance AI — Vistas
   Panel · Análisis · Asistente · Simulador · Valoración · Datos · Ajustes
   ========================================================= */
(function (root) {
  'use strict';
  const MF = root.MF;
  const { fmt, D, util } = MF;
  const C = MF.charts;
  const E = MF.engine;
  const AI = MF.ai;
  const DATA = MF.data;
  const { icon, $, $$, esc, status, SEV_ICON, delta, fmtInd, indStatus, legend, toast, modal, confirmDialog, readNumber, moneyInput } = MF.ui;
  const app = () => MF.app;
  const S = () => MF.app.state;
  const M = () => MF.app.state.model;
  const cop = (n, o) => fmt.cop(n, o);
  const STATUS_COLOR = { good: 'var(--good)', warning: 'var(--warn)', critical: 'var(--crit)', info: 'var(--brand-2)' };
  const SEV_LABEL = { critical: 'Riesgo', warning: 'Atención', info: 'Dato', good: 'Fortaleza' };

  /* ---------- Piezas comunes ---------- */
  function pageHead(eyebrow, title, desc, actions) {
    return '<header class="page-head"><div>' + (eyebrow ? '<span class="eyebrow">' + esc(eyebrow) + '</span>' : '') + '<h1>' + esc(title) + '</h1>' + (desc ? '<p>' + desc + '</p>' : '') + '</div>' + (actions ? '<div class="page-head__actions">' + actions + '</div>' : '') + '</header>';
  }
  function cardHead(ic, title, sub, actions, idTitle) {
    return '<div class="card__head">' + (ic ? '<span class="card__icon">' + icon(ic) + '</span>' : '') + '<div><div class="card__title"' + (idTitle ? ' id="' + idTitle + '"' : '') + '>' + esc(title) + '</div>' + (sub ? '<div class="card__sub">' + sub + '</div>' : '') + '</div>' + (actions ? '<div class="card__actions">' + actions + '</div>' : '') + '</div>';
  }
  function mini(label, value, meta) {
    return '<div class="mini"><div class="mini__label">' + esc(label) + '</div><div class="mini__value">' + value + '</div>' + (meta ? '<div class="mini__meta">' + meta + '</div>' : '') + '</div>';
  }
  const tableBtn = (id) => '<button class="btn btn--xs toggle-table" type="button" id="' + id + '" aria-pressed="false">' + icon('table') + 'Tabla</button>';
  function bindAsk(rootEl) {
    $$('[data-ask]', rootEl).forEach((b) => b.addEventListener('click', () => app().ask(b.getAttribute('data-ask'))));
  }
  const providerLabel = () => (S().settings.provider === 'claude' && S().settings.apiKey ? 'Claude' : 'Motor local');

  function emptyState(view) {
    view.innerHTML =
      '<section class="empty"><span class="eyebrow">Bienvenido a MobaFinance AI</span>' +
      '<h2>Entiende qué pasa con el dinero de tu empresa, sin ser experto en finanzas</h2>' +
      '<p>Tú cargas tus datos, nuestro motor financiero calcula todo con fórmulas verificables y la IA te explica qué significa y qué hacer.</p>' +
      '<div class="steps3">' +
      '<div class="step3"><div class="step3__icon">' + icon('database') + '</div><strong>1. Datos financieros</strong><p>Excel, registros, ingresos, gastos y transacciones.</p></div>' +
      '<div class="step3"><div class="step3__icon">' + icon('cpu') + '</div><strong>2. Motor financiero</strong><p>Fórmulas, indicadores, validaciones y proyecciones.</p></div>' +
      '<div class="step3 is-ai"><div class="step3__icon">' + icon('sparkles') + '</div><strong>3. Inteligencia artificial</strong><p>Interpretación de resultados, explicación de riesgos y recomendaciones fundamentadas.</p></div>' +
      '</div><div class="page-head__actions">' +
      '<a class="btn btn--primary" href="#/datos/importar">' + icon('upload') + 'Cargar mi Excel</a>' +
      '<a class="btn" href="#/datos/movimientos?nuevo=1">' + icon('plus') + 'Registrar movimientos</a>' +
      '<button class="btn btn--ghost" type="button" id="useDemo">' + icon('refresh') + 'Usar datos de ejemplo</button></div></section>';
    $('#useDemo', view).addEventListener('click', () => app().setData(DATA.demo(), 'Cargamos los datos de ejemplo de Café Alto Andino.'));
  }

  function insightItem(i, compact) {
    return (
      '<article class="insight insight--' + i.severity + '"><span class="insight__icon">' + icon(SEV_ICON[i.severity]) + '</span><div>' +
      '<div class="insight__title">' + i.title + ' <span class="tag tag--' + ({ critical: 'crit', warning: 'warn', info: 'info', good: 'good' })[i.severity] + '">' + SEV_LABEL[i.severity] + '</span></div>' +
      (compact ? '' : '<p class="insight__body">' + i.body + '</p>') +
      '<div class="insight__foot"><button class="link-btn" type="button" data-ask="' + esc(i.ask) + '">Preguntar a la IA ' + icon('arrowRight') + '</button></div></div></article>'
    );
  }

  const AGING_COLORS = ['var(--o1)', 'var(--o2)', 'var(--o3)', 'var(--o4)'];
  function agingHtml(m) {
    const total = util.sum(m.aging, (a) => a.value) || 1;
    const segs = m.aging
      .map((a, i) => (a.value > 0 ? '<span class="stack__seg" tabindex="0" style="flex:' + a.value / total + ';--c:' + AGING_COLORS[i] + '" data-tip-title="' + esc(a.label) + '" data-tip-rows="' + esc(JSON.stringify([{ color: AGING_COLORS[i], box: true, value: cop(a.value), label: fmt.pct(a.value / total, 0) + ' · ' + a.count + ' facturas' }])) + '"></span>' : ''))
      .join('');
    const leg = m.aging.map((a, i) => '<div><span><i style="--c:' + AGING_COLORS[i] + '"></i>' + esc(a.label) + '</span><strong>' + cop(a.value) + '</strong></div>').join('');
    return '<div class="stack" role="img" aria-label="Cartera por edades">' + segs + '</div><div class="stack-legend">' + leg + '</div>';
  }

  function hbarsHtml(items, color) {
    const max = Math.max(...items.map((i) => i.value), 1);
    return (
      '<div class="hbars">' +
      items
        .map(
          (i) =>
            '<div class="hbar" tabindex="0" data-tip-title="' + esc(i.label) + '" data-tip-rows="' + esc(JSON.stringify(i.tip || [{ color: color, box: true, value: cop(i.value) }])) + '"><span class="hbar__label">' + esc(i.label) + '</span><span class="hbar__track"><span class="hbar__fill" style="width:' + (i.value / max) * 100 + '%;--c:' + color + '"></span></span><span class="hbar__val">' + cop(i.value) + (i.sub ? '<small>' + i.sub + '</small>' : '') + '</span></div>'
        )
        .join('') +
      '</div>'
    );
  }

  const SHORT = { inicial: 'Caja inicial', utilidad: 'Utilidad', cartera: 'Cartera', proveedores: 'Proveedores', impuestos: 'Impuestos', inversion: 'Inversiones', prestamos: 'Préstamos', abonos: 'Abonos', otros: 'Otros', final: 'Caja final' };
  const bridgeSteps = (m) => m.bridge.map((b) => ({ label: b.label, short: SHORT[b.key] || b.label, value: b.value, total: b.total }));

  /** Caja real (últimos meses) + proyecciones (base y/o escenario) */
  function cashProjection(el, m, scenarios, opts = {}) {
    const hist = m.monthly.slice(-(opts.hist || 6));
    const H = scenarios[0].proj.rows.length;
    const labels = hist.map((x) => x.key).concat(scenarios[0].proj.rows.map((r) => r.key));
    const series = [{ label: 'Caja real', color: 'var(--s2)', values: hist.map((x) => x.caja).concat(Array(H).fill(null)), area: true }];
    scenarios.forEach((s) =>
      series.push({ label: s.label, color: s.color, dashed: true, values: Array(hist.length - 1).fill(null).concat([hist[hist.length - 1].caja], s.proj.rows.map((r) => r.caja)) })
    );
    C.line(el, {
      labels, series, height: opts.height || 260, endLabels: true,
      threshold: { value: m.kpis.colchon, label: 'Colchón: ' + cop(m.kpis.colchon), color: 'var(--warn)' },
      shadeFrom: hist.length - 1, shadeLabel: 'Proyección',
      ariaLabel: 'Caja real y proyectada',
    });
    return series;
  }
  const cashLegend = (scenarios) => legend([{ label: 'Caja real', color: 'var(--s2)' }].concat(scenarios.map((s) => ({ label: s.label, color: s.color, dash: true }))).concat([{ label: 'Colchón mínimo', color: 'var(--warn)', dash: true }]));

  /* =========================================================
     PANEL
     ========================================================= */
  function panel(view) {
    const m = M();
    if (m.empty) return emptyState(view);
    const st = S();
    const k = m.kpis;
    const p = m.profile;
    const hour = new Date().getHours();
    const saludo = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const mes = D.label(k.mes, 'month');
    const mesPrev = k.mesPrev ? D.label(k.mesPrev, 'month') : '';
    const okVal = m.validations.filter((v) => v.status === 'ok').length;
    const badVal = m.validations.length - okVal;
    const ins = st.insights;
    const serie = (f) => m.monthly.map(f);
    const uPrev = k.utilidadNetaPrev;
    const uDelta = uPrev ? (k.utilidadNetaMes - uPrev) / Math.abs(uPrev) : null;
    const cov = indStatus('coberturaCaja', k.coberturaCaja, k);
    const dsoSt = indStatus('dso', k.dso, k);
    const dsoRefMonth = m.monthly[Math.min(2, m.monthly.length - 1)].key;
    const chips = AI.SUGGESTED.slice(0, 4).map((q) => '<button class="chip" type="button" data-ask="' + esc(q) + '">' + esc(q) + '</button>').join('');

    const kpi = (ic, label, value, meta, id) =>
      '<section class="card kpi span-3 lg-span-6 sm-span-6"><div class="kpi__label"><span class="card__icon">' + icon(ic) + '</span>' + esc(label) + '</div><div class="kpi__value">' + value + '</div><div class="kpi__meta">' + meta + '</div><div class="kpi__spark" data-spark="' + id + '"></div></section>';

    view.innerHTML =
      '<section class="greet"><div><h1>Hola, ' + esc(p.usuario || 'bienvenido') + '</h1><p>' + saludo + '. Así está ' + esc(p.empresa) + ' al ' + D.fmtLong(m.meta.corte) + (m.meta.parcial ? ' (mes en curso)' : '') + '.</p></div>' +
      '<div class="greet__actions"><a class="btn" href="#/datos/importar">' + icon('upload') + 'Cargar datos</a><a class="btn btn--light" href="#/simulador">' + icon('sliders') + 'Simular escenario</a></div></section>' +
      '<nav class="pipeline" aria-label="Cómo se generó este análisis">' +
      '<a class="pipeline__step" href="#/datos/contexto"><span class="pipeline__icon">' + icon('database') + '</span><span class="pipeline__text"><strong>1. Datos financieros</strong><small>' + fmt.num(m.meta.nTx) + ' movimientos · ' + m.meta.months.length + ' meses · contexto ' + Math.round((m.contextScore ? m.contextScore.score : 0) * 100) + ' %</small></span></a>' +
      '<span class="pipeline__arrow" aria-hidden="true">' + icon('arrowRight') + '</span>' +
      '<a class="pipeline__step" href="#/datos/validaciones"><span class="pipeline__icon">' + icon('cpu') + '</span><span class="pipeline__text"><strong>2. Motor financiero</strong><small>' + Object.keys(E.IND).length + ' indicadores · ' + okVal + '/' + m.validations.length + ' validaciones sin alertas</small></span><span class="pipeline__dot' + (badVal ? ' is-warn' : '') + '" title="' + (badVal ? badVal + ' validación(es) para revisar' : 'Todo en orden') + '"></span></a>' +
      '<span class="pipeline__arrow" aria-hidden="true">' + icon('arrowRight') + '</span>' +
      '<a class="pipeline__step is-ai" href="#/asistente"><span class="pipeline__icon">' + icon('sparkles') + '</span><span class="pipeline__text"><strong>3. Inteligencia artificial</strong><small>' + ins.length + ' hallazgos · ' + providerLabel() + '</small></span></a></nav>' +
      '<div class="grid dash-top">' +
      '<section class="ai-card span-4 lg-span-12" aria-label="Asistente IA">' + cardHead('sparkles', 'Asistente IA', null, '<a class="icon-btn" href="#/asistente" aria-label="Abrir asistente" title="Abrir asistente">' + icon('arrowUp') + '</a>') +
      '<div class="ai-card__body"><h2 class="ai-card__title">¿En qué te ayudo hoy?</h2><div class="chips">' + chips + '</div></div>' +
      '<form class="ask" id="dashAsk"><input name="q" autocomplete="off" placeholder="Pregunta lo que quieras…" aria-label="Pregunta al asistente"><button class="send-btn" type="submit" aria-label="Enviar pregunta">' + icon('send') + '</button></form>' +
      '<div class="ai-card__foot">' + icon('lock') + 'Responde con los números de tu motor financiero</div></section>' +
      '<div class="span-8 lg-span-12 dash-right"><div class="grid kpis">' +
      kpi('dollar', 'Ventas de ' + D.label(k.mes, 'abbr').toLowerCase(), cop(k.ventasMes), delta(k.ventasMoM, true) + (mesPrev ? ' vs. ' + mesPrev : ''), 'ventas') +
      kpi('trendUp', 'Utilidad neta', cop(k.utilidadNetaMes), delta(uDelta, true) + ' margen ' + fmt.pct(k.margenNetoMes), 'utilidad') +
      kpi('wallet', 'Caja disponible', cop(k.caja), (cov ? status(cov, 'Cubre ' + fmt.months(k.coberturaCaja)) : '') + ' de gastos fijos', 'caja') +
      kpi('clock', 'Días de cobro', fmt.days(k.dso), (dsoSt ? status(dsoSt, dsoSt === 'good' ? 'Sano' : dsoSt === 'warning' ? 'Lento' : 'Muy lento') : '') + (k.dsoInicio != null ? ' ' + delta(k.dso - k.dsoInicio, false, 'days') + ' desde ' + D.label(dsoRefMonth, 'month') : ''), 'dso') +
      '</div><section class="card chart-card">' +
      cardHead('chart', 'Ventas y caja', 'Últimos ' + m.monthly.length + ' meses', '<div class="seg" role="group" aria-label="Serie del gráfico"><button type="button" data-series="ventasCaja">Ventas y caja</button><button type="button" data-series="ingresosGastos">Ingresos y gastos</button><button type="button" data-series="utilidad">Utilidad</button></div>' + tableBtn('mainTbl'), 'mainTitle') +
      '<div id="mainLegend"></div><div class="chart-box" id="mainChart"></div></section></div></div>' +
      '<div class="grid" style="margin-top:16px">' +
      '<section class="card span-4 lg-span-6 md-span-12">' + cardHead('pulse', 'Salud financiera', 'Puntaje del motor de 0 a 100') +
      '<div class="health"><div class="health__ring">' + C.ring(m.health.score, m.health.status) + '<div class="health__score"><strong>' + m.health.score + '</strong><small>de 100</small></div></div><div class="health__dims">' +
      m.health.dims.map((d) => '<div class="dim"><div class="dim__top"><span>' + esc(d.label) + '</span>' + status(d.status, d.score + '/100') + '</div><div class="meter" style="--c:' + STATUS_COLOR[d.status] + '"><i style="width:' + d.score + '%"></i></div></div>').join('') +
      '</div></div><div class="card__foot">' + status(m.health.status, m.health.label) + '<button class="link-btn" type="button" data-ask="¿Cómo está mi empresa en general?" style="margin-left:auto">Ver diagnóstico ' + icon('arrowRight') + '</button></div></section>' +
      '<section class="card span-8 lg-span-6 md-span-12">' + cardHead('sparkles', 'Hallazgos de la IA', 'Interpretación automática de tus indicadores', '<a class="btn btn--xs" href="#/asistente">Abrir asistente</a>') +
      '<div class="insights">' + ins.slice(0, 4).map((i) => insightItem(i)).join('') + '</div></section>' +
      '<section class="card span-7 lg-span-12">' + cardHead('layers', '¿Dónde quedó tu dinero?', 'Puente de caja · ' + D.label(m.meta.months[0]) + ' a ' + D.label(k.mes), legend([{ label: 'Suma', color: 'var(--good)', box: true }, { label: 'Resta', color: 'var(--crit)', box: true }, { label: 'Saldo', color: 'var(--total)', box: true }]) + tableBtn('bridgeTbl')) +
      '<div class="chart-box" id="bridgeChart"></div><div class="card__foot">La utilidad no es lo mismo que la caja: así se movió tu efectivo en el período. <button class="link-btn" type="button" data-ask="' + esc(AI.SUGGESTED[0]) + '">Explícamelo ' + icon('arrowRight') + '</button></div></section>' +
      goalsCard(m) +
      '<section class="card span-5 lg-span-12">' + cardHead('receipt', 'Cartera por cobrar', 'Al ' + D.fmt(m.meta.corte), '<a class="btn btn--xs" href="#/analisis/cartera">Ver detalle</a>') +
      '<div class="kpi__value" style="margin:0 0 4px">' + cop(k.cxc) + '</div><div class="kpi__meta" style="margin-bottom:16px">' + cop(k.vencido) + ' vencida · cobras en ' + fmt.days(k.dso) + '</div>' + agingHtml(m) +
      '<div class="table-wrap" style="margin-top:14px"><table class="tbl tbl--compact"><thead><tr><th>Cliente</th><th class="num">Te debe</th><th class="num">Mora</th></tr></thead><tbody>' +
      m.clients.filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo).slice(0, 4).map((c) => '<tr><td>' + esc(c.tercero) + '</td><td class="num">' + cop(c.saldo) + '</td><td class="num">' + (c.maxMora > 0 ? '<span class="tag ' + (c.maxMora > 30 ? 'tag--crit' : 'tag--warn') + '">' + fmt.days(c.maxMora) + '</span>' : '<span class="tag tag--muted">Al día</span>') + '</td></tr>').join('') +
      '</tbody></table></div></section>' +
      '<section class="card span-7 lg-span-12">' + cardHead('briefcase', 'En qué se va tu dinero', 'Promedio mensual · últimos 3 meses', '<a class="btn btn--xs" href="#/analisis/gastos">Ver gastos</a>') +
      hbarsHtml(m.expenses.slice(0, 7).map((e) => ({ label: e.categoria, value: e.mes3, sub: e.pctVentas != null ? fmt.pct(e.pctVentas, 1) + ' de las ventas' : '' })), 'var(--s3)') + '</section>' +
      '<section class="card span-12">' + cardHead('table', 'Movimientos recientes', 'Últimos registros', '<a class="btn btn--xs" href="#/datos/movimientos">Ver todos</a>') + recentTx(st.ds.transactions, m) + '</section>' +
      '</div>';

    // Gráfico principal
    const mainKey = st.ui.dashSeries || 'ventasCaja';
    const drawMain = (key) => {
      st.ui.dashSeries = key;
      $$('[data-series]', view).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.series === key)));
      const labels = m.monthly.map((x) => x.key);
      const el = $('#mainChart', view);
      el.hidden = false;
      const tb = el.nextElementSibling;
      if (tb && tb.classList.contains('chart-table')) tb.remove();
      $('#mainTbl', view).setAttribute('aria-pressed', 'false');
      let series;
      if (key === 'ventasCaja') {
        $('#mainTitle', view).textContent = 'Ventas y caja';
        series = [
          { label: 'Ventas del mes', color: 'var(--s1)', values: serie((x) => x.ventas), area: true },
          { label: 'Caja al cierre', color: 'var(--s2)', values: serie((x) => x.caja), area: true },
        ];
        $('#mainLegend', view).innerHTML = legend(series);
        C.line(el, { labels, series, height: 262, endLabels: true, ariaLabel: 'Ventas mensuales y caja al cierre de cada mes' });
      } else if (key === 'ingresosGastos') {
        $('#mainTitle', view).textContent = 'Ingresos y gastos';
        series = [
          { label: 'Ingresos', color: 'var(--s1)', values: serie((x) => x.ventas + x.otrosIngresos) },
          { label: 'Gastos', color: 'var(--s3)', values: serie((x) => x.gastosTotales) },
        ];
        $('#mainLegend', view).innerHTML = legend(series.map((s) => ({ label: s.label, color: s.color, box: true })));
        C.bars(el, { labels, series, height: 262, ariaLabel: 'Ingresos y gastos por mes' });
      } else {
        $('#mainTitle', view).textContent = 'Utilidad neta mensual';
        series = [{ label: 'Utilidad neta', color: 'var(--s4)', values: serie((x) => x.utilidadNeta) }];
        $('#mainLegend', view).innerHTML = '';
        C.bars(el, { labels, series, height: 262, ariaLabel: 'Utilidad neta por mes' });
      }
      mainSeries = series;
    };
    let mainSeries = null;
    $$('[data-series]', view).forEach((b) => b.addEventListener('click', () => drawMain(b.dataset.series)));
    drawMain(mainKey);
    C.bindTableToggle($('#mainTbl', view), $('#mainChart', view), () => C.table({ labels: m.monthly.map((x) => x.key), series: mainSeries }));

    // Chispas
    const sparks = { ventas: [serie((x) => x.ventas), 'var(--s1)'], utilidad: [serie((x) => x.utilidadNeta), 'var(--s4)'], caja: [serie((x) => x.caja), 'var(--s2)'], dso: [serie((x) => x.dso), 'var(--o3)'] };
    $$('[data-spark]', view).forEach((el) => {
      const [v, c] = sparks[el.dataset.spark];
      C.spark(el, v, { color: c });
    });

    C.waterfall($('#bridgeChart', view), { steps: bridgeSteps(m), height: 270 });
    C.bindTableToggle($('#bridgeTbl', view), $('#bridgeChart', view), () => C.table({ firstHeader: 'Concepto', labels: m.bridge.map((b) => b.label), labelFormat: (x) => x, series: [{ label: 'Valor', values: m.bridge.map((b) => b.value) }], valueFormat: (v) => cop(v, { signed: true }) }));
    C.bindHtmlTips(view);
    bindAsk(view);
    $('#dashAsk', view).addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      if (q) app().ask(q);
    });
  }

  const goalFmt = (g, x) => (g.fmt === 'cop' ? cop(x) : g.fmt === 'pct' ? fmt.pct(x) : g.fmt === 'days' ? fmt.days(x) : g.fmt === 'months' ? fmt.months(x) : fmt.num(x, 1));
  function goalsCard(m) {
    const goals = m.goals || [];
    if (!goals.length) {
      return '<section class="card span-5 lg-span-12">' + cardHead('target', 'Tus metas', 'Defínelas para que la IA mida tu avance') +
        '<p class="muted">Aún no tienes metas. Escribe cuánto quieres vender al mes, el margen que buscas o en cuántos días quieres cobrar, y te diré qué tan lejos estás.</p><div class="answer__actions"><a class="btn btn--sm btn--light" href="#/datos/contexto">' + icon('target') + 'Definir metas</a></div></section>';
    }
    return (
      '<section class="card span-5 lg-span-12">' + cardHead('target', 'Tus metas', 'Lo que escribiste frente a tus números', '<a class="btn btn--xs" href="#/datos/contexto">Editar</a>') +
      '<div class="goals">' +
      goals.map((g) => {
        const ratio = Math.max(0, Math.min(1, g.avance || 0));
        const st = g.cumple ? 'good' : ratio >= 0.75 ? 'warning' : 'critical';
        return '<div class="goal"><div class="dim__top"><span>' + esc(g.label) + '</span>' + status(st, g.cumple ? 'Cumple' : fmt.pct(ratio, 0) + ' de la meta') + '</div><div class="meter" style="--c:' + STATUS_COLOR[st] + '"><i style="width:' + ratio * 100 + '%"></i></div><div class="goal__foot"><span>Hoy: <b>' + goalFmt(g, g.actual) + '</b></span><span>Meta: ' + goalFmt(g, g.meta) + '</span></div></div>';
      }).join('') +
      '</div><div class="card__foot"><span>' + goals.filter((g) => g.cumple).length + ' de ' + goals.length + ' metas cumplidas</span><button class="link-btn" type="button" data-ask="¿Voy a cumplir mis metas?" style="margin-left:auto">¿Cómo las cumplo? ' + icon('arrowRight') + '</button></div></section>'
    );
  }

  function recentTx(all, m) {
    const rows = all.filter((t) => t.fecha <= m.meta.corte).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)).slice(0, 7);
    return (
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Movimiento</th><th>Fecha</th><th>Estado</th><th class="num">Monto</th></tr></thead><tbody>' +
      rows.map((t) => {
        const sign = DATA.signOf(t);
        return '<tr><td><div class="tx-cell"><span class="tx-icon">' + icon(TIPO_ICON[t.tipo]) + '</span><span class="cell-main"><span>' + esc(t.descripcion || t.categoria) + '</span><small>' + esc(t.tercero || t.categoria) + '</small></span></div></td><td class="muted">' + D.fmt(t.fecha) + '</td><td>' + txState(t, m.meta.corte) + '</td><td class="num"><span class="tx-amount' + (sign > 0 ? ' is-in' : '') + '">' + (sign > 0 ? '+' : MF.MINUS) + cop(t.monto, { full: true }) + '</span></td></tr>';
      }).join('') +
      '</tbody></table></div>'
    );
  }
  const TIPO_ICON = { Ingreso: 'arrowDown', Gasto: 'arrowUp', 'Inversión': 'briefcase', Financiamiento: 'bank' };
  function txState(t, corte) {
    if (t.fechaPago && t.fechaPago <= corte) return '<span class="tag tag--muted">' + (t.tipo === 'Ingreso' ? 'Cobrado' : 'Pagado') + '</span>';
    const vence = t.vence || E.venceDe(t);
    if (vence < corte) return '<span class="tag tag--crit">Vencido</span>';
    return '<span class="tag tag--warn">' + (t.tipo === 'Ingreso' ? 'Por cobrar' : 'Por pagar') + '</span>';
  }

  /* =========================================================
     ANÁLISIS
     ========================================================= */
  const ANA_TABS = [
    ['resultados', 'Estado de resultados'],
    ['flujo', 'Flujo de caja'],
    ['cartera', 'Cartera'],
    ['gastos', 'Gastos'],
    ['indicadores', 'Indicadores'],
  ];
  const ANA_INFO = {
    resultados: ['Estado de resultados', '¿Cuánto vendes, cuánto te cuesta y cuánto ganas cada mes? Valores por fecha de factura, antes de impuesto de renta.', '¿Por qué está bajando mi margen?'],
    flujo: ['Flujo de caja', 'Cuánto dinero entró y salió realmente cada mes, y por qué la utilidad no es igual a la caja.', AI.SUGGESTED[0]],
    cartera: ['Cartera', 'Quién te debe, cuánto y desde cuándo. La cartera es dinero que ya ganaste pero todavía no puedes usar.', '¿Qué clientes me deben más?'],
    gastos: ['Gastos', 'En qué se va tu dinero, qué gastos son fijos y cuánto necesitas vender para no perder.', '¿Qué gastos puedo recortar?'],
    indicadores: ['Indicadores', 'Todos los indicadores que calcula el motor, con su fórmula, una explicación en palabras simples y un semáforo.', '¿Cómo está mi empresa en general?'],
  };

  function analisis(view, r) {
    const m = M();
    if (m.empty) return emptyState(view);
    const sub = ANA_INFO[r.sub] ? r.sub : 'resultados';
    const [title, desc, q] = ANA_INFO[sub];
    view.innerHTML =
      pageHead('Análisis financiero · ' + D.label(m.meta.months[0]) + ' – ' + D.label(m.kpis.mes), title, desc, '<button class="btn btn--light" type="button" data-ask="' + esc(q) + '">' + icon('sparkles') + 'Preguntar a la IA</button>') +
      '<nav class="tabs" aria-label="Secciones de análisis">' + ANA_TABS.map(([key, lab]) => '<a href="#/analisis/' + key + '" class="' + (key === sub ? 'is-active' : '') + '"' + (key === sub ? ' aria-current="page"' : '') + '>' + lab + '</a>').join('') + '</nav><div id="anaBody"></div>';
    const body = $('#anaBody', view);
    ({ resultados: anaResultados, flujo: anaFlujo, cartera: anaCartera, gastos: anaGastos, indicadores: anaIndicadores })[sub](body, m);
    C.bindHtmlTips(view);
    bindAsk(view);
  }

  function sumMonths(m, f) {
    return util.sum(m.monthly, f);
  }
  /** Cifras en millones de pesos para las tablas mensuales */
  const mm = (v, signed) => (v == null || !isFinite(v) ? '—' : (signed && v > 0.05e6 ? '+' : '') + fmt.num(v / 1e6, 1));

  function anaResultados(body, m) {
    const L = m.LTM;
    const months = m.monthly;
    const T = { opex: {} };
    ['ventas', 'cogs', 'utilidadBruta', 'opexTotal', 'ebitda', 'depreciacion', 'utilidadOperativa', 'financieros', 'otrosIngresos', 'uai', 'impuesto', 'utilidadNeta'].forEach((f) => (T[f] = sumMonths(m, (x) => x[f])));
    months.forEach((x) => Object.entries(x.opex).forEach(([c, v]) => (T.opex[c] = (T.opex[c] || 0) + v)));
    const cats = Object.keys(T.opex).sort((a, b) => T.opex[b] - T.opex[a]);
    const cell = (v, f) => '<td class="num">' + (f ? f(v) : mm(v)) + '</td>';
    const row = (label, f, cls, fmtFn) => '<tr class="' + (cls || '') + '"><td>' + label + '</td>' + months.map((x) => cell(f(x), fmtFn)).join('') + cell(f(T), fmtFn) + '</tr>';
    const pct = (label, f) => row(label, f, 'pct', (v) => fmt.pct(v));
    const head = '<tr><th>Concepto</th>' + months.map((x) => '<th class="num">' + D.label(x.key, 'tiny') + '</th>').join('') + '<th class="num">Total</th></tr>';
    const opexRows = cats.map((c) => row(esc(c), (x) => (x.opex ? x.opex[c] || 0 : 0), 'sub', null).replace('<tr class="sub">', '<tr class="sub" data-opex hidden>')).join('');

    body.innerHTML =
      '<div class="sim__kpis">' +
      mini('Ventas (' + L.meses + ' meses)', cop(L.ventas), m.kpis.crecimientoPeriodo != null ? delta(m.kpis.crecimientoPeriodo, true) + ' crecimiento' : '') +
      mini('EBITDA', cop(L.ebitda), 'Margen ' + fmt.pct(L.ebitda / L.ventas)) +
      mini('Utilidad operativa', cop(L.utilidadOperativa), 'Margen ' + fmt.pct(L.utilidadOperativa / L.ventas)) +
      mini('Utilidad neta', cop(L.utilidadNeta), 'Margen ' + fmt.pct(L.utilidadNeta / L.ventas)) +
      '</div>' +
      '<section class="card" style="margin-bottom:16px">' + cardHead('chart', 'Ingresos, gastos y utilidad', 'Por mes, en un solo eje', legend([{ label: 'Ingresos', color: 'var(--s1)', box: true }, { label: 'Gastos', color: 'var(--s3)', box: true }, { label: 'Utilidad neta', color: 'var(--s4)' }]) + tableBtn('plTbl')) + '<div class="chart-box" id="plChart"></div></section>' +
      '<section class="card card--flush"><div style="padding:20px 20px 0">' + cardHead('receipt', 'Estado de resultados mensual', 'Cifras en millones de pesos · gastos operacionales por categoría', '<a class="btn btn--xs" href="#/estados/resultados">' + icon('download') + 'Estados formales y exportar</a>') + '</div>' +
      '<div class="table-wrap"><table class="tbl tbl--sticky tbl--compact"><thead>' + head + '</thead><tbody>' +
      row('Ventas', (x) => x.ventas, 'strong') +
      row('(−) Costo de ventas', (x) => x.cogs) +
      row('Utilidad bruta', (x) => x.utilidadBruta, 'strong') +
      pct('Margen bruto', (x) => (x.ventas ? x.utilidadBruta / x.ventas : null)) +
      '<tr><td><button class="row-btn" type="button" id="opexToggle" aria-expanded="false">' + icon('chevronRight') + '(−) Gastos operacionales</button></td>' + months.map((x) => cell(x.opexTotal)).join('') + cell(T.opexTotal) + '</tr>' +
      opexRows +
      row('EBITDA', (x) => x.ebitda, 'strong') +
      pct('Margen EBITDA', (x) => (x.ventas ? x.ebitda / x.ventas : null)) +
      row('(−) Depreciación', (x) => x.depreciacion) +
      row('Utilidad operativa', (x) => x.utilidadOperativa, 'strong') +
      row('(−) Gastos financieros', (x) => x.financieros) +
      row('(+) Otros ingresos', (x) => x.otrosIngresos) +
      row('Utilidad antes de impuestos', (x) => x.uai, 'strong') +
      row('(−) Impuesto de renta (estimado)', (x) => x.impuesto) +
      row('Utilidad neta', (x) => x.utilidadNeta, 'total') +
      pct('Margen neto', (x) => (x.ventas ? x.utilidadNeta / x.ventas : null)) +
      '</tbody></table></div></section>';

    const labels = months.map((x) => x.key);
    const series = [
      { label: 'Ingresos', color: 'var(--s1)', values: months.map((x) => x.ventas + x.otrosIngresos) },
      { label: 'Gastos', color: 'var(--s3)', values: months.map((x) => x.gastosTotales) },
    ];
    const line = { label: 'Utilidad neta', color: 'var(--s4)', values: months.map((x) => x.utilidadNeta) };
    C.bars($('#plChart', body), { labels, series, line, height: 280, ariaLabel: 'Ingresos, gastos y utilidad neta por mes' });
    C.bindTableToggle($('#plTbl', body), $('#plChart', body), () => C.table({ labels, series: series.concat([line]) }));
    $('#opexToggle', body).addEventListener('click', (e) => {
      const b = e.currentTarget;
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      $$('[data-opex]', body).forEach((tr) => (tr.hidden = !open));
    });
  }

  function anaFlujo(body, m) {
    const k = m.kpis;
    const P = m.P;
    const months = m.monthly;
    const labels = months.map((x) => x.key);
    const row = (label, f, cls, signed) => '<tr class="' + (cls || '') + '"><td>' + label + '</td>' + months.map((x) => '<td class="num">' + mm(f(x), signed) + '</td>').join('') + '</tr>';
    body.innerHTML =
      '<div class="sim__kpis">' +
      mini('Caja inicial', cop(k.cajaInicial), D.fmt(m.meta.inicio)) +
      mini('Flujo de la operación', cop(P.flujoOperativo, { signed: true }), 'Cobros − pagos de gastos e impuestos') +
      mini('Inversiones', cop(-P.inversion, { signed: true }), P.prestamos ? 'Préstamos: ' + cop(P.prestamos) : '') +
      mini('Caja final', cop(k.caja), delta(k.cajaInicial ? k.caja / k.cajaInicial - 1 : null, true) + ' en el período') +
      '</div><div class="grid">' +
      '<section class="card span-7 lg-span-12">' + cardHead('layers', 'Puente de caja del período', 'De la caja inicial a la caja final', tableBtn('wfTbl')) + '<div class="chart-box" id="wfChart"></div></section>' +
      '<section class="card span-5 lg-span-12">' + cardHead('wallet', 'Caja al cierre de cada mes', 'Frente a un colchón de 1 mes de gastos fijos', tableBtn('cajaTbl')) + legend([{ label: 'Caja al cierre', color: 'var(--s2)' }, { label: 'Colchón mínimo', color: 'var(--warn)', dash: true }]) + '<div class="chart-box" id="cajaChart"></div></section>' +
      '<section class="card card--flush span-12"><div style="padding:20px 20px 0">' + cardHead('table', 'Flujo de caja mensual', 'Cifras en millones de pesos · por fecha real de cobro y de pago') + '</div><div class="table-wrap"><table class="tbl tbl--sticky tbl--compact"><thead><tr><th>Concepto</th>' + months.map((x) => '<th class="num">' + D.label(x.key, 'tiny') + '</th>').join('') + '</tr></thead><tbody>' +
      row('Cobros a clientes', (x) => x.cobros) + row('(−) Pagos de costos y gastos', (x) => x.pagos) + (m.P.pagosRenta ? row('(−) Impuesto de renta pagado', (x) => x.pagosRenta) : '') + row('Flujo de la operación', (x) => x.flujoOperativo, 'strong', true) +
      row('(−) Inversiones', (x) => x.inversion) + row('(+) Préstamos y aportes', (x) => x.prestamos + x.aportes) + row('(−) Abonos y retiros', (x) => x.abonos + x.retiros) +
      row('Flujo neto del mes', (x) => x.flujoNeto, 'strong', true) + row('Caja al cierre', (x) => x.caja, 'total') +
      '<tr class="pct"><td>Cuentas por cobrar</td>' + months.map((x) => '<td class="num">' + mm(x.cxc) + '</td>').join('') + '</tr>' +
      '<tr class="pct"><td>Días de cobro</td>' + months.map((x) => '<td class="num">' + fmt.num(x.dso) + '</td>').join('') + '</tr>' +
      '</tbody></table></div></section></div>';
    C.waterfall($('#wfChart', body), { steps: bridgeSteps(m), height: 300 });
    C.bindTableToggle($('#wfTbl', body), $('#wfChart', body), () => C.table({ firstHeader: 'Concepto', labels: m.bridge.map((b) => b.label), labelFormat: (x) => x, series: [{ label: 'Valor', values: m.bridge.map((b) => b.value) }], valueFormat: (v) => cop(v, { signed: true }) }));
    const cajaSeries = [{ label: 'Caja al cierre', color: 'var(--s2)', values: months.map((x) => x.caja), area: true }];
    C.line($('#cajaChart', body), { labels, series: cajaSeries, height: 270, threshold: { value: k.colchon, label: 'Colchón: ' + cop(k.colchon), color: 'var(--warn)' }, ariaLabel: 'Caja al cierre de cada mes' });
    C.bindTableToggle($('#cajaTbl', body), $('#cajaChart', body), () => C.table({ labels, series: cajaSeries }));
  }

  function anaCartera(body, m) {
    const k = m.kpis;
    const debtors = m.clients.filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo);
    const overdue = m.open.cxc.filter((t) => D.diff(E.venceDe(t), m.meta.corte) > 0).slice(0, 12);
    const top = debtors[0];
    const labels = m.monthly.map((x) => x.key);
    const dsoSeries = [{ label: 'Días de cobro', color: 'var(--o3)', values: m.monthly.map((x) => x.dso) }];
    body.innerHTML =
      '<div class="sim__kpis">' +
      mini('Cartera total', cop(k.cxc), delta(k.cxcInicial ? k.cxc / k.cxcInicial - 1 : null, false) + ' desde el inicio') +
      mini('Cartera vencida', cop(k.vencido), fmt.pct(k.cxc ? k.vencido / k.cxc : 0, 0) + ' del total') +
      mini('Días de cobro', fmt.days(k.dso), k.dsoInicio != null ? delta(k.dso - k.dsoInicio, false, 'days') + ' vs. ' + D.label(m.monthly[Math.min(2, m.monthly.length - 1)].key, 'month') : '') +
      mini('Mayor deudor', top ? esc(top.tercero) : '—', top ? cop(top.saldo) + ' · ' + fmt.pct(top.saldo / (k.cxc || 1), 0) + ' de la cartera' : '') +
      '</div><div class="grid">' +
      '<section class="card span-5 lg-span-12">' + cardHead('receipt', 'Cartera por edades', 'Según la fecha de vencimiento de cada factura') + agingHtml(m) + '<div class="card__foot">' + m.open.cxc.length + ' facturas abiertas · si una factura no tiene vencimiento, asumimos 30 días.</div></section>' +
      '<section class="card span-7 lg-span-12">' + cardHead('clock', 'Días de cobro', 'Promedio móvil de 90 días', tableBtn('dsoTbl')) + legend([{ label: 'Días de cobro', color: 'var(--o3)' }, { label: 'Referencia sana: 30 días', color: 'var(--good)', dash: true }]) + '<div class="chart-box" id="dsoChart"></div></section>' +
      '<section class="card card--flush span-12"><div style="padding:20px 20px 0">' + cardHead('users', 'Clientes con saldo', debtors.length + ' clientes te deben dinero · las notas que escribas aquí las usa la IA') + '</div><div class="table-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th class="num">Te debe</th><th class="num">Vencido</th><th class="num">Mora máx.</th><th class="num">Paga en promedio a</th><th class="num">Plazo pactado</th><th class="num">Ventas 3 meses</th><th>Estado</th><th>Nota para la IA</th></tr></thead><tbody>' +
      debtors.map((c) => {
        const nota = (m.context.terceros[c.tercero] || {}).nota;
        return '<tr><td>' + esc(c.tercero) + '</td><td class="num">' + cop(c.saldo) + '</td><td class="num">' + (c.vencido ? cop(c.vencido) : '—') + '</td><td class="num">' + (c.maxMora ? fmt.days(c.maxMora) : '—') + '</td><td class="num">' + (c.diasPago != null ? fmt.days(c.diasPago) : '—') + '</td><td class="num">' + (c.plazo != null ? fmt.days(c.plazo) : '—') + '</td><td class="num">' + cop(c.ventas3m) + ' <span class="muted">(' + fmt.pct(c.share3m, 0) + ')</span></td><td>' + (c.maxMora > 60 ? status('critical', 'Mora crítica') : c.maxMora > 0 ? status('warning', 'Vencida') : status('good', 'Al día')) + '</td>' +
          '<td class="note-cell">' + (nota ? '<span class="note-text" title="' + esc(nota) + '">' + esc(nota) + '</span>' : '') + '<button class="link-btn" type="button" data-tnote="' + esc(c.tercero) + '">' + icon(nota ? 'edit' : 'plus') + (nota ? 'Editar' : 'Agregar') + '</button></td></tr>';
      }).join('') +
      '</tbody></table></div></section>' +
      (overdue.length ? '<section class="card card--flush span-12"><div style="padding:20px 20px 0">' + cardHead('alert', 'Facturas vencidas', 'Prioriza el cobro de las más antiguas') + '</div><div class="table-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Factura</th><th>Fecha</th><th>Vencía</th><th class="num">Días de mora</th><th class="num">Monto</th></tr></thead><tbody>' +
        overdue.map((t) => { const mora = D.diff(E.venceDe(t), m.meta.corte); return '<tr><td>' + esc(t.tercero) + '</td><td class="muted">' + esc(t.descripcion) + '</td><td>' + D.fmt(t.fecha) + '</td><td>' + D.fmt(E.venceDe(t)) + '</td><td class="num"><span class="tag ' + (mora > 30 ? 'tag--crit' : 'tag--warn') + '">' + fmt.days(mora) + '</span></td><td class="num">' + cop(t.monto, { full: true }) + '</td></tr>'; }).join('') +
        '</tbody></table></div></section>' : '') +
      '</div>';
    C.line($('#dsoChart', body), { labels, series: dsoSeries, height: 250, yFormat: (v) => fmt.num(v) + ' d', valueFormat: (v) => fmt.days(v), threshold: { value: 30, label: 'Referencia sana: 30 días', color: 'var(--good)' }, ariaLabel: 'Días de cobro por mes' });
    C.bindTableToggle($('#dsoTbl', body), $('#dsoChart', body), () => C.table({ labels, series: dsoSeries, valueFormat: (v) => fmt.days(v) }));
    $$('[data-tnote]', body).forEach((btn) => btn.addEventListener('click', () => terceroNoteModal(btn.dataset.tnote)));
  }

  /** Tarjeta: qué tanto contexto tiene la IA */
  function contextCard(m) {
    const cs = m.contextScore || { score: 0, missing: [] };
    const c = m.context || { negocio: {}, metas: {}, eventos: [], terceros: {} };
    const pct = Math.round(cs.score * 100);
    const nNeg = Object.values(c.negocio || {}).filter(Boolean).length;
    const nMetas = Object.values(c.metas || {}).filter((v) => v != null).length;
    const nEv = (c.eventos || []).filter((e) => e.tipo !== 'plan').length;
    const nPl = (c.eventos || []).filter((e) => e.tipo === 'plan').length;
    const nTer = Object.keys(c.terceros || {}).length;
    const nTx = (m.notasTx || []).length;
    return (
      '<section class="card">' + cardHead('sparkles', 'Contexto de tu negocio', 'La IA lo usa en cada respuesta') +
      '<div class="ctx-score"><div class="ctx-score__top"><span>La IA conoce tu negocio</span><b>' + pct + ' %</b></div><div class="meter" style="--c:var(--ai-accent)"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="ctx-list" style="margin-top:14px">' +
      [['Ficha del negocio', nNeg + ' de 8 campos'], ['Metas', nMetas ? nMetas + ' definidas' : 'Sin definir'], ['Bitácora', nEv + ' eventos · ' + nPl + ' planes'], ['Notas', nTer + ' de terceros · ' + nTx + ' en movimientos']].map(([a, b2]) => '<div class="ctx-row"><span>' + a + '</span><b>' + b2 + '</b></div>').join('') +
      '</div>' + (cs.missing.length ? '<p class="explain ctx-next">' + icon('info') + '<span><strong>Siguiente paso:</strong> ' + esc(cs.missing[0]) + '</span></p>' : '') +
      '<div class="answer__actions"><a class="btn btn--sm btn--light" href="#/datos/contexto">' + icon('edit') + 'Editar contexto</a></div></section>'
    );
  }

  /* ---------- Contexto: notas por cliente o proveedor ---------- */
  function ensureContext(ds) {
    ds.context = ds.context || {};
    ds.context.negocio = ds.context.negocio || {};
    ds.context.metas = ds.context.metas || {};
    ds.context.eventos = ds.context.eventos || [];
    ds.context.terceros = ds.context.terceros || {};
    return ds.context;
  }
  function terceroNoteModal(name, onSaved) {
    const st = S();
    const ctx = ensureContext(st.ds);
    const prev = (ctx.terceros[name] || {}).nota || '';
    modal(
      '<div class="modal__head"><div><span class="eyebrow">Contexto para la IA</span><h2>Nota sobre ' + esc(name) + '</h2></div><button class="icon-btn" type="button" data-close aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<p class="muted">Cuéntale a la IA lo que los números no dicen: condiciones reales de pago, acuerdos, la relación, riesgos.</p>' +
      '<label class="field" style="margin-top:12px"><span>Nota</span><textarea class="textarea" id="tnoteText" maxlength="400" placeholder="Ej.: Pactó 60 días pero paga a 75. Estamos negociando 2 % de descuento por pronto pago.">' + esc(prev) + '</textarea></label>' +
      '<div class="modal__foot">' + (prev ? '<button class="btn btn--danger" type="button" id="tnoteDel">Borrar nota</button>' : '') + '<button class="btn" type="button" data-close>Cancelar</button><button class="btn btn--light" type="button" id="tnoteSave">Guardar nota</button></div>',
      (el, close) => {
        const save = (text) => {
          if (text) ctx.terceros[name] = { nota: text };
          else delete ctx.terceros[name];
          close();
          app().saveData({ msg: text ? 'Nota guardada. La IA la tendrá en cuenta.' : 'Nota borrada.' });
          if (onSaved) onSaved();
        };
        $('#tnoteSave', el).addEventListener('click', () => save($('#tnoteText', el).value.trim().slice(0, 400)));
        const del = $('#tnoteDel', el);
        if (del) del.addEventListener('click', () => save(''));
      }
    );
  }

  /** Ventas del mes frente al punto de equilibrio (margen de seguridad) */
  function peBlock(k) {
    const pe = k.puntoEquilibrio;
    const vm = k.ventasMes;
    if (!pe || !vm) return '';
    const above = vm >= pe;
    const covered = above ? pe / vm : 1;
    return (
      '<div class="pe"><div class="pe__top"><span>Punto de equilibrio</span><b>' + cop(pe) + ' al mes</b></div>' +
      '<div class="pe__bar" role="img" aria-label="Ventas del mes frente al punto de equilibrio"><span style="flex:' + covered + ';background:var(--total)"></span>' + (above ? '<span style="flex:' + (1 - covered) + ';background:var(--good)"></span>' : '') + '</div>' +
      '<div class="pe__foot"><span>' + legend([{ label: 'Cubre costos y gastos', color: 'var(--total)', box: true }].concat(above ? [{ label: 'Margen de seguridad', color: 'var(--good)', box: true }] : [])) + '</span><span>Ventas de ' + D.label(k.mes, 'month') + ': ' + cop(vm) + '</span></div>' +
      '<p class="explain">' + (above ? 'Tus ventas están <strong>' + fmt.pct(1 - pe / vm, 0) + '</strong> por encima del punto de equilibrio: podrían caer hasta ese porcentaje antes de que entres en pérdida.' : 'Estás por debajo del punto de equilibrio: necesitas vender <strong>' + cop(pe - vm) + '</strong> más al mes para no perder.') + '</p></div>'
    );
  }

  function anaGastos(body, m) {
    const k = m.kpis;
    const last3 = m.monthly.slice(-3);
    const v3 = util.sum(last3, (x) => x.ventas) || 1;
    const parts = [
      { label: 'Costo de ventas', value: util.sum(last3, (x) => x.cogs) / v3, color: '#5D626D' },
      { label: 'Gastos variables', value: util.sum(last3, (x) => x.variables) / v3, color: '#4A4E58' },
      { label: 'Gastos fijos', value: util.sum(last3, (x) => x.fijos) / v3, color: '#7C828E' },
      { label: 'Gastos financieros', value: util.sum(last3, (x) => x.financieros) / v3, color: '#3B3F48' },
      { label: 'Depreciación e impuestos', value: Math.max(0, util.sum(last3, (x) => x.depreciacion + x.impuesto)) / v3, color: '#9AA0AB' },
    ];
    const util3 = util.sum(last3, (x) => x.utilidadNeta) / v3;
    parts.push({ label: util3 >= 0 ? 'Te queda (utilidad)' : 'Pérdida', value: Math.abs(util3), color: util3 >= 0 ? 'var(--s4)' : 'var(--crit)' });
    const totalP = util.sum(parts, (p) => p.value);
    body.innerHTML =
      '<div class="sim__kpis">' +
      mini('Gastos fijos al mes', cop(k.gastosFijosMes), 'No dependen de las ventas') +
      mini('Costos variables al mes', cop(util.sum(last3, (x) => x.cogs + x.variables) / last3.length), fmt.pct(util.sum(last3, (x) => x.cogs + x.variables) / v3, 0) + ' de las ventas') +
      mini('Margen de contribución', fmt.pct(k.margenContribucion), 'Lo que queda para cubrir fijos') +
      mini('Punto de equilibrio', cop(k.puntoEquilibrio), 'Vendes ' + cop(k.ventasMes) + ' (' + fmt.delta(k.puntoEquilibrio ? k.ventasMes / k.puntoEquilibrio - 1 : null, 0) + ')') +
      '</div><div class="grid">' +
      '<section class="card span-6 lg-span-12">' + cardHead('dollar', '¿A dónde va cada $100 que vendes?', 'Promedio de los últimos 3 meses') +
      '<div class="stack" style="height:22px" role="img" aria-label="Distribución de cada 100 pesos vendidos">' + parts.map((p) => '<span class="stack__seg" tabindex="0" style="flex:' + p.value / totalP + ';--c:' + p.color + '" data-tip-title="' + esc(p.label) + '" data-tip-rows="' + esc(JSON.stringify([{ color: p.color, box: true, value: '$' + fmt.num(p.value * 100, 1), label: 'de cada $100' }])) + '"></span>').join('') + '</div>' +
      '<div class="stack-legend">' + parts.map((p) => '<div><span><i style="--c:' + p.color + '"></i>' + esc(p.label) + '</span><strong>$' + fmt.num(p.value * 100, 1) + '</strong></div>').join('') + '</div>' +
      '<p class="explain">De cada <strong>$100</strong> que vendiste, <strong>$' + fmt.num(parts[0].value * 100, 1) + '</strong> se fueron en el producto y <strong>$' + fmt.num(parts[2].value * 100, 1) + '</strong> en gastos fijos. ' + (util3 >= 0 ? 'Te quedaron <strong>$' + fmt.num(util3 * 100, 1) + '</strong> de utilidad.' : 'Perdiste <strong>$' + fmt.num(-util3 * 100, 1) + '</strong>.') + '</p>' + peBlock(k) + '</section>' +
      '<section class="card span-6 lg-span-12">' + cardHead('briefcase', 'Gasto mensual por categoría', 'Promedio de los últimos 3 meses') + hbarsHtml(m.expenses.filter((e) => e.mes3 > 0).sort((a, b) => b.mes3 - a.mes3).map((e) => ({ label: e.categoria, value: e.mes3, sub: (e.pctVentas != null ? fmt.pct(e.pctVentas, 1) + ' de las ventas' : ''), tip: [{ color: 'var(--s3)', box: true, value: cop(e.mes3), label: 'al mes' }, { value: e.cambio != null ? fmt.delta(e.cambio, 0) : '—', label: 'vs. 3 meses anteriores' }] })), 'var(--s3)') + '</section>' +
      '<section class="card card--flush span-12"><div style="padding:20px 20px 0">' + cardHead('table', 'Detalle por categoría', 'Fijo: no depende de las ventas · Variable: sube y baja con ellas') + '</div><div class="table-wrap"><table class="tbl"><thead><tr><th>Categoría</th><th>Tipo</th><th class="num">Promedio mes (3 m)</th><th class="num">3 meses anteriores</th><th class="num">Cambio</th><th class="num">% de las ventas</th><th class="num">Últimos 12 meses</th></tr></thead><tbody>' +
      m.expenses.map((e) => '<tr><td>' + esc(e.categoria) + '</td><td><span class="tag tag--muted">' + (e.grupo === 'costo' ? 'Costo' : e.grupo === 'financiero' ? 'Financiero' : e.comportamiento === 'variable' ? 'Variable' : 'Fijo') + '</span></td><td class="num">' + cop(e.mes3) + '</td><td class="num">' + cop(e.prev3) + '</td><td class="num">' + (e.cambio == null ? '—' : '<span class="' + (e.cambio > 0.05 ? 'neg' : e.cambio < -0.05 ? 'pos' : '') + '">' + fmt.delta(e.cambio, 0) + '</span>') + '</td><td class="num">' + (e.pctVentas != null ? fmt.pct(e.pctVentas, 1) : '—') + '</td><td class="num">' + cop(e.ltm) + '</td></tr>').join('') +
      '</tbody></table></div></section></div>';
  }

  const IND_GROUPS = [
    ['Liquidez', ['caja', 'coberturaCaja', 'runway', 'liquidezCorriente', 'pruebaAcida', 'razonEfectivo']],
    ['Rentabilidad', ['margenBruto', 'margenEbitda', 'margenOperativo', 'margenNeto', 'roe', 'roa', 'margenContribucion', 'puntoEquilibrio', 'gastosFijosMes']],
    ['Eficiencia del capital de trabajo', ['cxc', 'dso', 'dpo', 'ccc']],
    ['Endeudamiento', ['endeudamiento', 'coberturaIntereses']],
    ['Crecimiento y riesgo', ['ventasMes', 'crecimiento3m', 'crecimientoPeriodo', 'concentracion']],
  ];
  const IND_SERIES = { caja: 'caja', cxc: 'cxc', dso: 'dso', margenBruto: 'margenBruto', ventasMes: 'ventas', margenNeto: 'margenNeto', margenOperativo: 'margenOperativo' };

  function anaIndicadores(body, m) {
    const k = m.kpis;
    let h = '';
    IND_GROUPS.forEach(([g, keys]) => {
      h += '<h2 class="section-title">' + esc(g) + '</h2><div class="ind-grid">';
      keys.forEach((key) => {
        const I = E.IND[key];
        const v = k[key];
        const st = indStatus(key, v, k);
        h += '<article class="card ind"><div class="ind__top"><span class="ind__name">' + esc(I.label) + '</span>' + (st ? status(st) : '') + '</div><div class="ind__value">' + (key === 'concentracion' && k.topCliente ? fmtInd(key, v) + ' <small class="muted" style="font-size:13px;font-weight:500">' + esc(k.topCliente) + '</small>' : fmtInd(key, v)) + '</div>' +
          (IND_SERIES[key] ? '<div class="kpi__spark" data-ind-spark="' + key + '"></div>' : '') +
          '<p class="ind__explain">' + esc(I.explain) + '</p>' + (I.ref ? '<p class="ind__ref">' + esc(I.ref) + '</p>' : '') + (I.formula ? '<div class="ind__formula">' + esc(I.formula) + '</div>' : '') + '</article>';
      });
      h += '</div>';
    });
    body.innerHTML = '<div class="note note--info" style="margin-bottom:8px">' + icon('info') + '<span>Los semáforos usan referencias generales para pymes. Lo más útil es comparar cada indicador contigo mismo en el tiempo.</span></div>' + h;
    $$('[data-ind-spark]', body).forEach((el) => C.spark(el, m.monthly.map((x) => x[IND_SERIES[el.dataset.indSpark]]), { color: 'var(--brand-2)' }));
  }

  /* =========================================================
     ASISTENTE
     ========================================================= */
  const asistente = {
    render(view) {
      const m = M();
      const st = S();
      const useClaude = st.settings.provider === 'claude' && st.settings.apiKey;
      const k = m.empty ? null : m.kpis;
      view.innerHTML =
        pageHead('Capa 3 · Inteligencia artificial', 'Asistente financiero', 'Pregúntale en tus palabras. Responde con los números que calculó el motor financiero, no con suposiciones' + (useClaude ? ', y puede correr simulaciones del motor para responderte.' : '.'), '<a class="ai-status' + (useClaude ? ' is-claude' : '') + '" href="#/ajustes"><i></i><span>' + (useClaude ? 'Claude · análisis ' + esc((AI.EFFORTS[st.settings.effort] || 'Profundo').toLowerCase()) : 'Motor local') + '</span></a><button class="btn btn--sm" type="button" id="clearChat">' + icon('refresh') + 'Nueva conversación</button>') +
        '<div class="chat-layout"><section class="chat" aria-label="Conversación"><div class="chat__log" id="chatLog"></div>' +
        '<form class="composer" id="composer"><label class="sr-only" for="chatInput">Tu pregunta</label><textarea id="chatInput" rows="1" placeholder="Ej.: ¿Por qué me estoy quedando sin efectivo si estoy vendiendo más?"></textarea><button class="send-btn" type="submit" id="sendBtn" aria-label="Enviar">' + icon('send') + '</button></form></section>' +
        '<aside class="context-panel">' +
        (k ? '<section class="card">' + cardHead('cpu', 'Lo que ve la IA', 'Resultados del motor al ' + D.fmt(m.meta.corte)) + '<div class="ctx-list">' +
          [['Ventas del mes', cop(k.ventasMes)], ['Utilidad neta (12 m)', cop(k.utilidadNetaLTM)], ['Caja disponible', cop(k.caja)], ['Por cobrar', cop(k.cxc)], ['Días de cobro', fmt.days(k.dso)], ['Salud financiera', m.health.score + '/100']].map(([a, b]) => '<div class="ctx-row"><span>' + a + '</span><b>' + b + '</b></div>').join('') +
          '</div><div class="card__foot">' + fmt.num(m.meta.nTx) + ' movimientos · ' + m.validations.filter((v) => v.status === 'ok').length + '/' + m.validations.length + ' validaciones sin alertas</div></section>' : '') +
        contextCard(m) +
        '<section class="card">' + cardHead('message', 'Preguntas sugeridas') + '<div class="chips" style="justify-content:flex-start">' + AI.SUGGESTED.slice(6).map((q) => '<button class="chip chip--dark" type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div></section>' +
        '</aside></div>';

      const log = $('#chatLog', view);
      if (!st.chat.length) log.innerHTML = chatEmpty();
      else st.chat.forEach((msg) => appendMessage(log, msg));
      $$('[data-q]', view).forEach((b) => b.addEventListener('click', () => asistente.send(b.dataset.q)));
      const input = $('#chatInput', view);
      const grow = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(160, input.scrollHeight) + 'px';
      };
      input.addEventListener('input', grow);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          $('#composer', view).requestSubmit();
        }
      });
      $('#composer', view).addEventListener('submit', (e) => {
        e.preventDefault();
        if (st.streaming) {
          st.streaming.abort();
          return;
        }
        const q = input.value.trim();
        if (!q) return;
        input.value = '';
        grow();
        asistente.send(q);
      });
      $('#clearChat', view).addEventListener('click', () => {
        if (st.streaming) st.streaming.abort();
        st.chat = [];
        app().saveChat();
        log.innerHTML = chatEmpty();
        bindEmpty(log);
        input.focus();
      });
      bindEmpty(log);
      if (st.pendingQuestion) {
        const pq = st.pendingQuestion;
        st.pendingQuestion = null;
        asistente.send(pq.q, pq.ctx);
      } else {
        scrollChat(log, true);
      }
    },

    async send(q, ctx) {
      const st = S();
      const log = $('#chatLog');
      if (!log || st.busy || !q) return;
      const m = M();
      const empty = log.querySelector('.chat-empty');
      if (empty) empty.remove();
      const userMsg = { role: 'user', text: q, at: Date.now() };
      st.chat.push(userMsg);
      appendMessage(log, userMsg);
      const useClaude = st.settings.provider === 'claude' && st.settings.apiKey && !m.empty;
      const pending = document.createElement('div');
      pending.className = 'msg';
      pending.innerHTML = '<span class="msg__avatar">' + icon('sparkles') + '</span><article class="answer"><div class="thinking">' +
        '<div class="thinking__step is-on"><i></i>Leyendo tus datos' + (m.empty ? '' : ' · ' + fmt.num(m.meta.nTx) + ' movimientos') + '</div>' +
        '<div class="thinking__step"><i></i>Motor financiero · indicadores' + (m.empty ? '' : ' al ' + D.fmt(m.meta.corte)) + '</div>' +
        '<div class="thinking__step"><i></i>' + (useClaude ? 'Claude está interpretando los resultados' : 'Interpretando resultados') + '</div></div></article>';
      log.appendChild(pending);
      scrollChat(log);
      st.busy = true;
      setComposer(true, useClaude);
      const steps = $$('.thinking__step', pending);
      const advance = (i) => steps.forEach((s, j) => {
        s.classList.toggle('is-done', j < i);
        s.classList.toggle('is-on', j === i);
      });
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      try {
        if (!useClaude) {
          await wait(260);
          advance(1);
          await wait(280);
          advance(2);
          await wait(260);
          const answer = AI.answerLocal(q, m, ctx);
          const msg = { role: 'assistant', kind: 'local', answer, at: Date.now(), corte: m.empty ? null : m.meta.corte };
          st.chat.push(msg);
          pending.replaceWith(renderMessage(msg));
        } else {
          advance(1);
          await wait(200);
          advance(2);
          const history = buildHistory(st.chat.slice(0, -1));
          const live = liveAnswer(pending, log);
          let res;
          try {
            const { stream, done } = await AI.askClaude({ apiKey: st.settings.apiKey, question: q, history, model: m, effort: st.settings.effort, onText: live.text, onThinking: live.thinking, onTool: live.tool });
            st.streaming = stream;
            res = await done;
          } catch (err) {
            st.streaming = null;
            live.stop();
            if (err.aborted) {
              const msg = { role: 'assistant', kind: 'claude', text: (err.partial || live.latest() || '') + '\n\n*Respuesta detenida.*', at: Date.now(), model: AI.MODEL };
              st.chat.push(msg);
              pending.replaceWith(renderMessage(msg));
            } else {
              const answer = AI.answerLocal(q, m, ctx);
              const msg = { role: 'assistant', kind: 'local', answer, at: Date.now(), corte: m.meta.corte, error: err.message };
              st.chat.push(msg);
              pending.replaceWith(renderMessage(msg));
            }
            return;
          }
          st.streaming = null;
          live.stop();
          const msg = agentMessage(res, st.settings.effort, m.meta.corte);
          if (res.stopReason === 'refusal' || !res.text.trim()) {
            msg.kind = 'local';
            msg.answer = AI.answerLocal(q, m, ctx);
            msg.error = 'El modelo no completó esta respuesta; te muestro la del motor local.';
          }
          st.chat.push(msg);
          pending.replaceWith(renderMessage(msg));
        }
      } finally {
        st.busy = false;
        st.streaming = null;
        setComposer(false);
        app().saveChat();
        scrollChat(log);
      }
    },
  };

  function chatEmpty() {
    return '<div class="chat-empty"><span class="chat-empty__icon">' + icon('sparkles') + '</span><h2>¿Qué quieres entender de tu negocio?</h2><p>Escribe como le preguntarías a tu contador o a un amigo que sabe de finanzas. Te respondo con tus cifras y te digo qué haría.</p><div class="suggest-grid">' +
      AI.SUGGESTED.slice(0, 6).map((q) => '<button class="suggest" type="button" data-sq="' + esc(q) + '">' + icon('sparkles') + '<span>' + esc(q) + '</span></button>').join('') + '</div></div>';
  }
  function bindEmpty(log) {
    $$('[data-sq]', log).forEach((b) => b.addEventListener('click', () => asistente.send(b.dataset.sq)));
  }
  function setComposer(busy, streaming) {
    const btn = $('#sendBtn');
    if (!btn) return;
    if (busy && streaming) {
      btn.classList.add('is-stop');
      btn.innerHTML = icon('stop');
      btn.setAttribute('aria-label', 'Detener respuesta');
    } else {
      btn.classList.remove('is-stop');
      btn.innerHTML = icon('send');
      btn.setAttribute('aria-label', 'Enviar');
    }
  }
  function scrollChat(log, instant) {
    const last = log.lastElementChild;
    if (last && last.getBoundingClientRect().bottom > window.innerHeight - 100) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
    }
  }
  function buildHistory(msgs) {
    const out = [];
    msgs.slice(-12).forEach((mm) => {
      if (mm.role === 'user') out.push({ role: 'user', content: mm.text });
      else if (mm.kind === 'claude' && mm.text) out.push({ role: 'assistant', content: mm.text });
      else if (mm.kind === 'local' && mm.answer) out.push({ role: 'assistant', content: AI.answerToText(mm.answer) });
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  function appendMessage(log, msg) {
    log.appendChild(renderMessage(msg));
  }

  function renderMessage(msg) {
    const wrap = document.createElement('div');
    if (msg.role === 'user') {
      wrap.className = 'msg msg--user';
      const b = document.createElement('div');
      b.className = 'msg__bubble';
      b.textContent = msg.text;
      wrap.appendChild(b);
      return wrap;
    }
    wrap.className = 'msg';
    const m = M();
    const meta = answerMeta(msg, msg.corte ? ' · datos al ' + D.fmt(msg.corte) : '');
    if (msg.kind === 'claude') {
      wrap.innerHTML = '<span class="msg__avatar">' + icon('sparkles') + '</span><article class="answer"><div class="answer__md">' + AI.md(msg.text || '') + '</div>' + agentDetails(msg) + meta + '</article>';
      if (!m.empty) mountCharts(wrap, msg, BIZ_CHARTS, mountViz);
      return wrap;
    }
    const a = msg.answer || {};
    const sources = (a.sources || []).filter((s) => E.IND[s] && !m.empty);
    let h = '<span class="msg__avatar">' + icon('sparkles') + '</span><article class="answer' + (msg.error ? ' is-error' : '') + '">';
    if (msg.error) h += '<div class="note" style="margin-bottom:12px">' + icon('alert') + '<span>' + esc(msg.error) + ' Esta es la respuesta del motor local.</span></div>';
    h += '<h3 class="answer__title">' + (a.title || '') + '</h3>' + (a.lead ? '<p class="answer__lead">' + a.lead + '</p>' : '');
    (a.sections || []).forEach((s) => {
      if (!s.items || !s.items.length) return;
      const tag = s.ordered ? 'ol' : 'ul';
      h += '<div class="answer__section"><h5>' + esc(s.heading) + '</h5><' + tag + '>' + s.items.map((i) => '<li>' + i + '</li>').join('') + '</' + tag + '></div>';
    });
    if (a.viz && !m.empty) h += '<div class="answer__viz" data-viz></div>';
    if (sources.length) h += '<div class="answer__sources"><span>Indicadores usados</span>' + sources.map((s) => '<span class="source">' + esc(E.IND[s].label) + ' <b>' + fmtInd(s, m.kpis[s]) + '</b></span>').join('') + '</div>';
    if (a.contextUsed && a.contextUsed.length) h += '<div class="answer__sources answer__ctx"><span>Tu contexto</span>' + a.contextUsed.map((c) => '<a class="source source--ctx" href="#/datos/contexto">' + icon('sparkles') + esc(c) + '</a>').join('') + '</div>';
    if ((a.followups && a.followups.length) || a.action) {
      h += '<div class="answer__actions">' + (a.action ? '<a class="btn btn--sm btn--light" href="' + esc(a.action.route) + '">' + esc(a.action.label) + icon('arrowRight') + '</a>' : '') + (a.followups || []).map((f) => '<button class="chip chip--dark" type="button" data-fq="' + esc(f) + '">' + esc(f) + '</button>').join('') + '</div>';
    }
    h += meta + '</article>';
    wrap.innerHTML = h;
    $$('[data-fq]', wrap).forEach((b) => b.addEventListener('click', () => asistente.send(b.dataset.fq)));
    const vizEl = $('[data-viz]', wrap);
    if (vizEl) requestAnimationFrame(() => mountViz(vizEl, a.viz));
    return wrap;
  }

  /* ---------- Claude en vivo: razonamiento resumido, cálculos del motor y texto ---------- */
  function liveAnswer(pending, log) {
    let ui = null;
    let raf = 0;
    let text = '';
    let thought = '';
    const chips = {};
    const mountUi = () => {
      if (ui) return ui;
      pending.innerHTML = '<span class="msg__avatar">' + icon('sparkles') + '</span><article class="answer"><div class="agent"><div class="agent__head"><span class="agent__dot"></span><span class="agent__label">Analizando con el motor financiero</span></div><p class="agent__think" hidden></p><div class="agent__tools" hidden></div></div><div class="answer__md"></div></article>';
      ui = { think: $('.agent__think', pending), tools: $('.agent__tools', pending), md: $('.answer__md', pending), label: $('.agent__label', pending) };
      return ui;
    };
    const paint = () => {
      raf = 0;
      const u = mountUi();
      if (text) {
        u.think.hidden = true;
        u.label.textContent = 'Escribiendo la respuesta';
        u.md.classList.add('cursor-blink');
        u.md.innerHTML = AI.md(text);
      } else if (thought) {
        u.think.hidden = false;
        u.think.textContent = thought.length > 360 ? '…' + thought.slice(-360).replace(/^\S*\s/, '') : thought;
      }
      scrollChat(log);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    return {
      text: (t) => {
        text = t;
        schedule();
      },
      thinking: (t) => {
        thought = t;
        schedule();
      },
      tool: (ev) => {
        const u = mountUi();
        u.tools.hidden = false;
        let c = chips[ev.id];
        if (!c) {
          c = chips[ev.id] = document.createElement('span');
          u.tools.appendChild(c);
        }
        c.className = 'tool-chip is-' + ev.status;
        c.innerHTML = icon(ev.status === 'done' ? 'check' : ev.status === 'error' ? 'alert' : 'calculator') + '<span>' + esc(ev.status === 'done' && ev.resumen ? ev.resumen : ev.label + (ev.status === 'error' ? ': no se pudo calcular' : '…')) + '</span>';
        scrollChat(log);
      },
      latest: () => text,
      stop: () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
    };
  }
  /** Mensaje guardado de una respuesta de Claude (sin datos pesados: los gráficos se recalculan al pintar) */
  function agentMessage(res, effort, corte) {
    return {
      role: 'assistant', kind: 'claude', text: res.text, at: Date.now(), model: res.model, stop: res.stopReason, corte, effort: effort || 'high',
      thinking: res.thinking ? res.thinking.slice(-6000) : '',
      calls: (res.calls || []).map((c) => ({ name: c.name, label: c.label, resumen: c.resumen, viz: c.viz })),
    };
  }
  function answerMeta(msg, extra) {
    const claude = msg.kind === 'claude';
    return '<div class="answer__meta"><i class="' + (claude ? 'is-claude' : '') + '"></i>' + (claude ? 'Claude · ' + esc(msg.model || AI.MODEL) + (AI.EFFORTS[msg.effort] ? ' · análisis ' + AI.EFFORTS[msg.effort].toLowerCase() : '') : 'Motor local') + (extra || '') + '</div>';
  }
  /** «Cómo lo analizó»: cálculos del motor que pidió Claude y su razonamiento resumido */
  function agentDetails(msg) {
    const calls = msg.calls || [];
    if (!calls.length && !msg.thinking) return '';
    return '<details class="reasoning"><summary>' + icon('cpu') + '<span>Cómo lo analizó' + (calls.length ? ' · ' + calls.length + (calls.length === 1 ? ' cálculo del motor' : ' cálculos del motor') : '') + '</span>' + icon('chevronDown') + '</summary>' +
      (calls.length ? '<ul class="reasoning__tools">' + calls.map((c) => '<li>' + icon('check') + '<span><b>' + esc(c.label) + '</b>' + (c.resumen ? ' · ' + esc(c.resumen) : '') + '</span></li>').join('') + '</ul>' : '') +
      (msg.thinking ? '<div class="reasoning__text">' + AI.md(msg.thinking) + '</div>' : '') + '</details>';
  }
  const BIZ_CHARTS = { puente: { type: 'bridge' }, proyeccion: { type: 'projection', horizonte: 6 }, cartera: { type: 'aging' }, margen: { type: 'margin' }, gastos: { type: 'expenses' }, salud: { type: 'health' } };
  /** Monta los gráficos que Claude pidió con [[grafico:ID]]; los de simulación salen del último cálculo de esa respuesta */
  function mountCharts(wrap, msg, map, mount) {
    $$('.answer__md [data-chart]', wrap).forEach((el) => {
      const id = el.dataset.chart;
      let viz = map[id];
      if (!viz) {
        const call = (msg.calls || []).filter((c) => c.viz && (c.viz.type === id || (id === 'escenario' && c.viz.type === 'compare'))).pop();
        viz = call && call.viz;
      }
      if (!viz) return el.remove();
      requestAnimationFrame(() => mount(el, viz));
    });
  }

  function mountViz(el, viz) {
    const m = M();
    if (!el.isConnected) return;
    if (viz.type === 'bridge') {
      el.innerHTML = '<div class="chart-box"></div>';
      C.waterfall(el.firstChild, { steps: bridgeSteps(m), height: 250, compact: true });
    } else if (viz.type === 'projection') {
      const scen = [{ label: 'Proyección', color: 'var(--s2)', proj: E.project(m, { horizonte: viz.horizonte || 3 }) }];
      el.innerHTML = cashLegend(scen) + '<div class="chart-box"></div>';
      cashProjection(el.lastChild, m, scen, { height: 240 });
    } else if (viz.type === 'compare') {
      const H = viz.horizonte || (viz.scenario && viz.scenario.horizonte) || 6;
      const scen = [
        { label: 'Base', color: 'var(--base)', proj: E.project(m, { horizonte: H }) },
        { label: viz.label || 'Escenario', color: 'var(--s2)', proj: E.project(m, Object.assign({}, viz.scenario, { horizonte: H })) },
      ];
      el.innerHTML = cashLegend(scen) + '<div class="chart-box"></div>';
      cashProjection(el.lastChild, m, scen, { height: 240 });
    } else if (viz.type === 'aging') {
      el.innerHTML = agingHtml(m);
      C.bindHtmlTips(el);
    } else if (viz.type === 'margin') {
      const s = [
        { label: 'Margen bruto', color: 'var(--s1)', values: m.monthly.map((x) => x.margenBruto) },
        { label: 'Margen neto', color: 'var(--s4)', values: m.monthly.map((x) => x.margenNeto) },
      ];
      el.innerHTML = legend(s) + '<div class="chart-box"></div>';
      C.line(el.lastChild, { labels: m.monthly.map((x) => x.key), series: s, height: 220, yFormat: (v) => fmt.pct(v, 0), valueFormat: (v) => fmt.pct(v), endLabels: false, ariaLabel: 'Margen bruto y neto por mes' });
    } else if (viz.type === 'expenses') {
      el.innerHTML = hbarsHtml(m.expenses.slice(0, 7).map((e) => ({ label: e.categoria, value: e.mes3, sub: e.pctVentas != null ? fmt.pct(e.pctVentas, 1) + ' de las ventas' : '' })), 'var(--s3)');
      C.bindHtmlTips(el);
    } else if (viz.type === 'health') {
      el.innerHTML = '<div class="health"><div class="health__ring">' + C.ring(m.health.score, m.health.status, 112) + '<div class="health__score"><strong style="font-size:28px">' + m.health.score + '</strong><small>de 100</small></div></div><div class="health__dims">' +
        m.health.dims.map((d) => '<div class="dim"><div class="dim__top"><span>' + esc(d.label) + '</span>' + status(d.status, d.score + '/100') + '</div><div class="meter" style="--c:' + STATUS_COLOR[d.status] + '"><i style="width:' + d.score + '%"></i></div></div>').join('') + '</div></div>';
    }
  }

  /* =========================================================
     SIMULADOR
     ========================================================= */
  const PRESETS = [
    ['ventas', 'Ventas −15 %'],
    ['contratar', 'Contratar 1 persona'],
    ['cobro30', 'Cobrar a 30 días'],
    ['precio', 'Subir precios 5 %'],
    ['credito', 'Crédito de $50 M'],
    ['planes', 'Mis planes (bitácora)'],
  ];

  function freshScenario(m) {
    const A = m.assumptions;
    // Valores exactos del motor: sin tocar nada, el escenario es idéntico a la proyección base
    return Object.assign({}, E.DEFAULT_SCENARIO, { dso: A.dso, dpo: A.dpo, _preset: null });
  }
  function applyPreset(sc, m, key, params = {}) {
    Object.assign(sc, freshScenario(m), { horizonte: sc.horizonte });
    sc._preset = key;
    if (key === 'ventas') sc.ventasPct = -(Number(params.pct) || 15) / 100;
    if (key === 'contratar') {
      sc.nuevosEmpleados = Number(params.n) || 1;
      sc.salario = Number(params.salario) || 2500000;
    }
    if (key === 'cobro30') sc.dso = Math.min(30, Math.round(m.assumptions.dso));
    if (key === 'precio') sc.precioPct = (Number(params.pct) || 5) / 100;
    if (key === 'credito') {
      sc.prestamoMonto = Number(params.monto) || 50e6;
      sc.prestamoTasa = 0.21;
      sc.prestamoPlazo = 36;
      sc.prestamoMes = 1;
    }
    if (key === 'planes') {
      sc.incluirPlanes = true;
      sc.horizonte = 12;
    }
    return sc;
  }

  function simulador(view, r) {
    const m = M();
    if (m.empty) return emptyState(view);
    const st = S();
    if (!st.sim) st.sim = freshScenario(m);
    const sc = st.sim;
    if (r.params.preset) {
      applyPreset(sc, m, r.params.preset, r.params);
      history.replaceState(null, '', '#/simulador');
    }
    const A = m.assumptions;
    const rng = (key, label, min, max, step, f, hint) =>
      '<label class="range"><span class="range__top"><span>' + label + '</span><output id="o-' + key + '"></output></span><input type="range" id="r-' + key + '" data-k="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '"><span class="range__scale"><span>' + f(min) + '</span>' + (hint ? '<span>' + hint + '</span>' : '') + '<span>' + f(max) + '</span></span></label>';
    const pctF = (v) => fmt.delta(v / 100, 0);
    const dayF = (v) => fmt.num(v) + ' d';
    const monthOpts = (sel) => Array.from({ length: 12 }, (_, i) => '<option value="' + (i + 1) + '"' + (sel === i + 1 ? ' selected' : '') + '>' + D.label(D.addMonths(A.lastKey, i + 1)) + '</option>').join('');

    view.innerHTML =
      pageHead('Proyecciones y escenarios', 'Simulador', '¿Qué pasa si las ventas caen? ¿Si contrato a alguien? ¿Cuánto efectivo necesitaré? Mueve los controles y mira el efecto en tu caja mes a mes.', '<button class="btn btn--sm" type="button" id="simReset">' + icon('refresh') + 'Restablecer</button>') +
      '<div class="sim"><aside class="card sim__controls" aria-label="Supuestos del escenario">' +
      '<div class="sim__group"><h4>Escenarios rápidos</h4><div class="presets">' + PRESETS.map(([key, lab]) => '<button class="chip chip--dark" type="button" data-preset="' + key + '" aria-pressed="false">' + lab + '</button>').join('') + '</div></div>' +
      '<div class="sim__group"><h4>Horizonte</h4><div class="seg" role="group" aria-label="Horizonte">' + [3, 6, 12].map((h) => '<button type="button" data-h="' + h + '">' + h + ' meses</button>').join('') + '</div></div>' +
      '<div class="sim__group"><h4>Ventas y precios</h4>' + rng('ventasPct', 'Volumen de ventas', -50, 50, 1, pctF) + rng('precioPct', 'Precios', -20, 20, 1, pctF) + '</div>' +
      '<div class="sim__group"><h4>Costos</h4>' + rng('costoPct', 'Costo de insumos', -20, 30, 1, pctF) + rng('fijosPct', 'Gastos fijos', -30, 30, 1, pctF) + '</div>' +
      '<div class="sim__group"><h4>Equipo</h4><div class="range__top"><span>Nuevas contrataciones</span><div class="stepper"><button type="button" data-step="-1" aria-label="Menos">−</button><output id="o-emp"></output><button type="button" data-step="1" aria-label="Más">+</button></div></div>' +
      '<div class="form-grid"><label class="field"><span>Salario mensual</span><span class="input-group"><i>$</i><input class="input" id="i-salario" inputmode="numeric"></span></label><label class="field"><span>Desde</span><select class="select" id="i-mesContratacion">' + monthOpts(sc.mesContratacion) + '</select></label></div>' +
      '<label class="check"><input type="checkbox" id="i-prestaciones"' + (sc.prestaciones ? ' checked' : '') + '>Incluir prima y cesantías en su calendario</label></div>' +
      '<div class="sim__group"><h4>Cobros y pagos</h4>' + rng('dso', 'Días de cobro a clientes', 0, 120, 1, dayF, 'hoy ' + Math.round(A.dso) + ' d') + rng('dpo', 'Días de pago a proveedores', 0, 90, 1, dayF, 'hoy ' + Math.round(A.dpo) + ' d') + '</div>' +
      '<div class="sim__group"><h4>Inversión y crédito</h4><div class="form-grid"><label class="field"><span>Inversión puntual</span><span class="input-group"><i>$</i><input class="input" id="i-inversionMonto" inputmode="numeric" placeholder="0"></span></label><label class="field"><span>En</span><select class="select" id="i-inversionMes">' + monthOpts(sc.inversionMes) + '</select></label></div>' +
      '<div class="form-grid"><label class="field"><span>Crédito nuevo</span><span class="input-group"><i>$</i><input class="input" id="i-prestamoMonto" inputmode="numeric" placeholder="0"></span></label><label class="field"><span>Recibido en</span><select class="select" id="i-prestamoMes">' + monthOpts(sc.prestamoMes) + '</select></label>' +
      '<label class="field"><span>Tasa E.A.</span><span class="input-group"><input class="input has-suffix" id="i-prestamoTasa" inputmode="decimal"><b>%</b></span></label><label class="field"><span>Plazo</span><span class="input-group"><input class="input has-suffix" id="i-prestamoPlazo" inputmode="numeric"><b>meses</b></span></label></div></div>' +
      '</aside><div id="simOut"></div></div>';

    const out = $('#simOut', view);
    const sync = () => {
      $$('input[type=range]', view).forEach((inp) => {
        const key = inp.dataset.k;
        const v = key === 'dso' || key === 'dpo' ? Math.round(sc[key]) : Math.round(sc[key] * 100);
        inp.value = v;
        // La barra se rellena desde el valor de referencia (0 % o el valor de hoy) hasta el elegido
        const baseV = key === 'dso' ? Math.round(A.dso) : key === 'dpo' ? Math.round(A.dpo) : 0;
        const pos = (x) => ((x - inp.min) / (inp.max - inp.min)) * 100;
        inp.style.setProperty('--a', Math.min(pos(baseV), pos(v)) + '%');
        inp.style.setProperty('--b', Math.max(pos(baseV), pos(v)) + '%');
        const o = $('#o-' + key, view);
        o.textContent = key === 'dso' || key === 'dpo' ? fmt.days(v) : pctF(v);
        o.classList.toggle('is-changed', v !== baseV);
      });
      $('#o-emp', view).textContent = sc.nuevosEmpleados;
      $('#i-salario', view).value = moneyInput(sc.salario);
      $('#i-inversionMonto', view).value = sc.inversionMonto ? moneyInput(sc.inversionMonto) : '';
      $('#i-prestamoMonto', view).value = sc.prestamoMonto ? moneyInput(sc.prestamoMonto) : '';
      $('#i-prestamoTasa', view).value = fmt.num(sc.prestamoTasa * 100, 1);
      $('#i-prestamoPlazo', view).value = sc.prestamoPlazo;
      $('#i-prestaciones', view).checked = sc.prestaciones;
      $('#i-mesContratacion', view).value = sc.mesContratacion;
      $('#i-inversionMes', view).value = sc.inversionMes;
      $('#i-prestamoMes', view).value = sc.prestamoMes;
      $$('[data-h]', view).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.h) === sc.horizonte)));
      $$('[data-preset]', view).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === sc._preset)));
    };
    let raf = 0;
    const update = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        simOutputs(out, m, sc);
      });
    };
    $$('input[type=range]', view).forEach((inp) =>
      inp.addEventListener('input', () => {
        const key = inp.dataset.k;
        sc[key] = key === 'dso' || key === 'dpo' ? Number(inp.value) : Number(inp.value) / 100;
        sc._preset = null;
        sync();
        update();
      })
    );
    $$('[data-step]', view).forEach((b) => b.addEventListener('click', () => {
      sc.nuevosEmpleados = util.clamp(sc.nuevosEmpleados + Number(b.dataset.step), 0, 20);
      sc._preset = null;
      sync();
      update();
    }));
    const money = (id, key) => $(id, view).addEventListener('change', (e) => {
      const v = readNumber(e.target.value);
      sc[key] = isFinite(v) && v > 0 ? v : key === 'salario' ? 2500000 : 0;
      sc._preset = null;
      sync();
      update();
    });
    money('#i-salario', 'salario');
    money('#i-inversionMonto', 'inversionMonto');
    money('#i-prestamoMonto', 'prestamoMonto');
    $('#i-prestamoTasa', view).addEventListener('change', (e) => {
      const v = parseFloat(String(e.target.value).replace(',', '.'));
      sc.prestamoTasa = isFinite(v) && v >= 0 ? v / 100 : 0.21;
      sync();
      update();
    });
    $('#i-prestamoPlazo', view).addEventListener('change', (e) => {
      sc.prestamoPlazo = util.clamp(Math.round(Number(e.target.value)) || 24, 1, 120);
      sync();
      update();
    });
    [['#i-mesContratacion', 'mesContratacion'], ['#i-inversionMes', 'inversionMes'], ['#i-prestamoMes', 'prestamoMes']].forEach(([id, key]) =>
      $(id, view).addEventListener('change', (e) => {
        sc[key] = Number(e.target.value);
        update();
      })
    );
    $('#i-prestaciones', view).addEventListener('change', (e) => {
      sc.prestaciones = e.target.checked;
      update();
    });
    $$('[data-h]', view).forEach((b) => b.addEventListener('click', () => {
      sc.horizonte = Number(b.dataset.h);
      sync();
      update();
    }));
    $$('[data-preset]', view).forEach((b) => b.addEventListener('click', () => {
      if (sc._preset === b.dataset.preset) Object.assign(sc, freshScenario(m), { horizonte: sc.horizonte });
      else applyPreset(sc, m, b.dataset.preset);
      sync();
      update();
    }));
    $('#simReset', view).addEventListener('click', () => {
      st.sim = Object.assign(freshScenario(m), { horizonte: 6 });
      simulador(view, { params: {} });
    });
    sync();
    simOutputs(out, m, sc);
  }

  function describeScenario(sc, A) {
    const out = [];
    if (sc.ventasPct) out.push('ventas ' + fmt.delta(sc.ventasPct, 0));
    if (sc.precioPct) out.push('precios ' + fmt.delta(sc.precioPct, 0));
    if (sc.costoPct) out.push('costo de insumos ' + fmt.delta(sc.costoPct, 0));
    if (sc.fijosPct) out.push('gastos fijos ' + fmt.delta(sc.fijosPct, 0));
    if (sc.nuevosEmpleados) out.push(sc.nuevosEmpleados + (sc.nuevosEmpleados === 1 ? ' contratación' : ' contrataciones') + ' con salario de ' + cop(sc.salario));
    if (Math.round(sc.dso) !== Math.round(A.dso)) out.push('cobro a ' + fmt.days(sc.dso));
    if (Math.round(sc.dpo) !== Math.round(A.dpo)) out.push('pago a proveedores a ' + fmt.days(sc.dpo));
    if (sc.inversionMonto) out.push('inversión de ' + cop(sc.inversionMonto));
    if (sc.prestamoMonto) out.push('crédito de ' + cop(sc.prestamoMonto));
    if (sc.incluirPlanes) out.push('tus planes de la bitácora');
    return out;
  }
  const joinList = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1]);

  function simOutputs(out, m, sc) {
    const A = m.assumptions;
    const H = sc.horizonte;
    const base = E.project(m, { horizonte: H, prestaciones: sc.prestaciones });
    const res = E.project(m, sc);
    const s = res.summary;
    const b = base.summary;
    const changes = describeScenario(sc, A);
    const endKey = res.rows[res.rows.length - 1].key;
    const scen = changes.length
      ? [{ label: 'Base', color: 'var(--base)', proj: base }, { label: 'Tu escenario', color: 'var(--s2)', proj: res }]
      : [{ label: 'Proyección base', color: 'var(--s2)', proj: base }];
    const diff = (a, c) => (Math.abs(a - c) < 5e4 ? '<span class="muted">igual a la base</span>' : '<span class="' + (a > c ? 'pos' : 'neg') + '">' + cop(a - c, { signed: true }) + ' vs. base</span>');
    // Palancas: efecto marginal desde el escenario actual
    const lever = (label, mod, field) => {
      const alt = E.project(m, Object.assign({}, sc, mod(sc))).summary;
      const d = alt[field] - s[field];
      return '<div class="lever">' + esc(label) + '<b class="' + (d >= 0 ? 'pos' : 'neg') + '">' + cop(d, { signed: true }) + '</b>' + (field === 'cajaFinal' ? 'en caja al final' : 'en utilidad') + '</div>';
    };
    const read = [];
    if (!changes.length) read.push('Esta es tu <strong>proyección base</strong>: si todo sigue como en los últimos 3 meses, tu caja llegaría a <strong>' + cop(s.cajaFinal) + '</strong> en ' + D.label(endKey, 'long') + '. El punto más bajo sería <strong>' + cop(s.cajaMin) + '</strong> en ' + D.label(s.mesMin, 'month') + '.');
    else read.push('Con ' + esc(joinList(changes)) + ', tu caja llegaría a <strong>' + cop(s.cajaFinal) + '</strong> en ' + D.label(endKey, 'long') + ' (' + cop(s.cajaFinal - b.cajaFinal, { signed: true }) + ' frente a la base).');
    if (s.primerNegativo) read.push('<span class="tag tag--crit">Riesgo</span> Tu caja quedaría en negativo desde <strong>' + D.label(s.primerNegativo, 'long') + '</strong>. Para mantener tu colchón de ' + cop(s.colchon) + ' necesitarías unos <strong>' + cop(s.financiacion) + '</strong> (cobro de cartera, crédito o aporte).');
    else if (s.cajaMin < s.colchon) read.push('<span class="tag tag--warn">Atención</span> Tu caja estaría por debajo del colchón de ' + cop(s.colchon) + ' durante <strong>' + s.mesesBajoColchon + (s.mesesBajoColchon === 1 ? ' mes' : ' meses') + '</strong>; te faltarían unos <strong>' + cop(s.financiacion) + '</strong>.');
    else read.push('<span class="tag tag--good">Sano</span> Tu caja se mantiene por encima del colchón de ' + cop(s.colchon) + ' en todo el horizonte.');
    read.push('Utilidad neta acumulada: <strong>' + cop(s.utilidadTotal) + '</strong>' + (changes.length ? ' (' + cop(s.utilidadTotal - b.utilidadTotal, { signed: true }) + ' frente a la base)' : '') + '. Punto de equilibrio: ' + cop(s.puntoEquilibrio) + ' en ventas al mes.');
    if (s.extras.length) read.push('Incluye ' + esc(joinList(s.extras.map((x) => x.label.toLowerCase() + ' en ' + D.label(x.key, 'month') + ' (' + cop(x.value) + ')'))) + '.');

    out.innerHTML =
      '<div class="sim__kpis">' +
      mini('Caja en ' + D.label(endKey), cop(s.cajaFinal), changes.length ? diff(s.cajaFinal, b.cajaFinal) : 'Proyección base') +
      mini('Punto más bajo', '<span class="' + (s.cajaMin < 0 ? 'neg' : '') + '">' + cop(s.cajaMin) + '</span>', D.label(s.mesMin, 'long')) +
      mini('Financiación necesaria', cop(s.financiacion), s.financiacion > 0 ? 'Para un colchón de ' + cop(s.colchon) : 'No la necesitas') +
      mini('Utilidad neta acumulada', cop(s.utilidadTotal), changes.length ? diff(s.utilidadTotal, b.utilidadTotal) : 'Margen ' + fmt.pct(s.margenNeto)) +
      '</div>' +
      '<section class="card" style="margin-bottom:16px">' + cardHead('wallet', 'Caja proyectada', 'Real de los últimos 6 meses y proyección a ' + H + ' meses', tableBtn('simTbl')) + cashLegend(scen) + '<div class="chart-box" id="simChart"></div></section>' +
      '<section class="reading" style="margin-bottom:16px"><div class="reading__head"><span class="card__icon" style="background:rgba(107,92,240,.25);color:#D7D2FF">' + icon('sparkles') + '</span><span class="card__title">Lectura de la IA</span><button class="btn btn--sm btn--light" type="button" id="simAsk" style="margin-left:auto">' + icon('message') + 'Profundizar con el asistente</button></div>' +
      read.map((p) => '<p>' + p + '</p>').join('') +
      '<div class="levers">' +
      lever('Cobrar 10 días antes', (x) => ({ dso: Math.max(0, x.dso - 10) }), 'cajaFinal') +
      lever('Subir precios 1 %', (x) => ({ precioPct: x.precioPct + 0.01 }), 'utilidadTotal') +
      lever('Bajar gastos fijos 5 %', (x) => ({ fijosPct: x.fijosPct - 0.05 }), 'cajaFinal') +
      lever('Una contratación más', (x) => ({ nuevosEmpleados: x.nuevosEmpleados + 1 }), 'cajaFinal') +
      '</div></section>' +
      '<section class="card card--flush"><div style="padding:20px 20px 0">' + cardHead('table', 'Detalle mes a mes', 'Tu escenario') + '</div><div class="table-wrap"><table class="tbl"><thead><tr><th>Mes</th><th class="num">Ventas</th><th class="num">Utilidad</th><th class="num">Cobros</th><th class="num">Pagos</th><th class="num">Flujo neto</th><th class="num">Caja final</th><th>Notas</th></tr></thead><tbody>' +
      res.rows.map((x) => {
        const notes = [];
        if (x.extraLabel) notes.push(x.extraLabel + ' ' + cop(x.extra));
        if (x.inversion) notes.push('Inversión ' + cop(x.inversion));
        if (x.prestamo) notes.push('Crédito +' + cop(x.prestamo));
        if (x.impuestoPagado) notes.push('Impuesto de renta ' + cop(x.impuestoPagado));
        return '<tr><td style="white-space:nowrap">' + D.label(x.key) + '</td><td class="num">' + cop(x.ventas) + '</td><td class="num">' + cop(x.utilidad) + '</td><td class="num">' + cop(x.cobros) + '</td><td class="num">' + cop(x.pagos + x.abonos) + '</td><td class="num"><span class="' + (x.flujo < 0 ? 'neg' : '') + '">' + cop(x.flujo, { signed: true }) + '</span></td><td class="num"><strong class="' + (x.caja < 0 ? 'neg' : '') + '">' + cop(x.caja) + '</strong></td><td class="muted">' + esc(notes.join(' · ')) + '</td></tr>';
      }).join('') +
      '</tbody></table></div></section>';

    const series = cashProjection($('#simChart', out), m, scen, { height: 300 });
    C.bindTableToggle($('#simTbl', out), $('#simChart', out), () => C.table({ labels: series.length ? m.monthly.slice(-6).map((x) => x.key).concat(res.rows.map((x) => x.key)) : [], series }));
    $('#simAsk', out).addEventListener('click', () => {
      const q = changes.length
        ? 'Analiza mi escenario: ' + joinList(changes) + '. Caja al final de ' + D.label(endKey, 'long') + ': ' + cop(s.cajaFinal) + '; punto más bajo ' + cop(s.cajaMin) + ' en ' + D.label(s.mesMin, 'long') + '. ¿Qué me recomiendas?'
        : '¿Cuánto efectivo voy a necesitar en los próximos ' + H + ' meses?';
      app().ask(q, changes.length ? { scenario: Object.assign({}, sc) } : null);
    });
  }

  /* =========================================================
     VALORACIÓN (herramientas avanzadas)
     ========================================================= */
  const VAL_TABS = [
    ['dcf', 'Flujo de caja descontado'],
    ['wacc', 'WACC y CAPM'],
    ['credito', 'Crédito'],
    ['inversion', 'Inversión (VPN y TIR)'],
    ['multiplos', 'Múltiplos'],
  ];

  function valDefaults(m) {
    const k = m.kpis;
    const q = AI.quickValuation(m);
    return {
      rf: 10.5, betaU: 0.65, erp: 6, crp: 0, size: 4, tax: 35, kd: Math.round((m.saldos.tasaDeudaEA || 0.21) * 1000) / 10,
      E: Math.max(0, Math.round(m.balance.patrimonio)), D: Math.round(k.deuda),
      ventas0: Math.round(m.LTM.ventas), g: [15, 12, 10, 8, 6], margen: Math.round(q.margen * 1000) / 10, capex: 2, ct: Math.round(Math.max(5, ((k.ccc || 30) / 365) * 100)), wacc: Math.round(q.wacc * 1000) / 10, gT: 4, deudaNeta: Math.round(q.deudaNeta),
      monto: 50e6, tasa: 21, plazo: 36,
      inv: 45e6, flujos: [12e6, 14e6, 16e6, 17e6, 18e6], tasaInv: Math.round(q.wacc * 1000) / 10,
      ebitda: Math.round(q.ebitda), mLow: 4, mMid: 5, mHigh: 6,
    };
  }

  function valoracion(view, r) {
    const m = M();
    if (m.empty) return emptyState(view);
    const st = S();
    if (!st.ui.val || st.ui.valCorte !== m.meta.corte + m.meta.nTx) {
      st.ui.val = valDefaults(m);
      st.ui.valCorte = m.meta.corte + m.meta.nTx;
    }
    const sub = VAL_TABS.some(([k]) => k === r.sub) ? r.sub : 'dcf';
    view.innerHTML =
      pageHead('Herramientas avanzadas · Pro', 'Valoración y decisiones', 'DCF, WACC, CAPM, crédito, inversión y múltiplos, conectados a tus datos. Ajusta los supuestos y mira el resultado al instante.', '<button class="btn btn--sm" type="button" id="valReset">' + icon('refresh') + 'Restablecer supuestos</button>') +
      '<nav class="tabs" aria-label="Herramientas">' + VAL_TABS.map(([key, lab]) => '<a href="#/valoracion/' + key + '" class="' + (key === sub ? 'is-active' : '') + '">' + lab + '</a>').join('') + '</nav>' +
      '<div class="note" style="margin-bottom:16px">' + icon('alert') + '<span>Los supuestos por defecto son ilustrativos. Antes de decidir, verifica tasas actuales (TES, riesgo país, inflación, tasa de tu crédito) y valida con un asesor.</span></div><div id="valBody"></div>';
    $('#valReset', view).addEventListener('click', () => {
      st.ui.val = valDefaults(m);
      valoracion(view, r);
    });
    ({ dcf: valDCF, wacc: valWACC, credito: valCredito, inversion: valInversion, multiplos: valMultiplos })[sub]($('#valBody', view), m, st.ui.val);
  }

  /** Campo numérico ligado a v[key]; kind: pct | cop | times | months */
  const DECIMALS = { pct: 1, times: 2, months: 0, cop: 0 };
  function numField(key, label, v, kind, idx) {
    const val = idx != null ? v[key][idx] : v[key];
    const shown = kind === 'cop' ? moneyInput(val) : fmt.num(val, DECIMALS[kind] || 0);
    const pre = kind === 'cop' ? '<i>$</i>' : '';
    const suf = kind === 'pct' ? '<b>%</b>' : kind === 'times' ? '<b>×</b>' : kind === 'months' ? '<b>meses</b>' : '';
    return '<label class="field"><span>' + label + '</span><span class="input-group">' + pre + '<input class="input' + (suf ? ' has-suffix' : '') + '" data-k="' + key + '"' + (idx != null ? ' data-i="' + idx + '"' : '') + ' data-kind="' + kind + '" value="' + esc(shown) + '" inputmode="decimal">' + suf + '</span></label>';
  }
  function bindFields(container, v, onChange) {
    $$('input[data-k]', container).forEach((inp) =>
      inp.addEventListener('change', () => {
        const kind = inp.dataset.kind;
        let n = kind === 'cop' ? readNumber(inp.value) : parseFloat(String(inp.value).replace(/\./g, '').replace(',', '.'));
        if (!isFinite(n)) n = 0;
        if (inp.dataset.i != null) v[inp.dataset.k][Number(inp.dataset.i)] = n;
        else v[inp.dataset.k] = n;
        inp.value = kind === 'cop' ? moneyInput(n) : fmt.num(n, DECIMALS[kind] || 0);
        onChange();
      })
    );
  }
  const toolLayout = (inputs, title) => '<div class="tool"><section class="card">' + cardHead('sliders', title || 'Supuestos') + '<div class="form-grid">' + inputs + '</div></section><div id="toolOut"></div></div>';

  function valDCF(body, m, v) {
    body.innerHTML = toolLayout(
      numField('ventas0', 'Ventas base (12 meses)', v, 'cop') + v.g.map((_, i) => numField('g', 'Crecimiento año ' + (i + 1), v, 'pct', i)).join('') +
      numField('margen', 'Margen EBITDA', v, 'pct') + numField('tax', 'Impuesto de renta', v, 'pct') + numField('capex', 'Inversión (capex) % ventas', v, 'pct') + numField('ct', 'Capital de trabajo % del aumento de ventas', v, 'pct') +
      numField('wacc', 'Tasa de descuento (WACC)', v, 'pct') + numField('gT', 'Crecimiento a perpetuidad', v, 'pct') + numField('deudaNeta', 'Deuda neta (deuda − caja)', v, 'cop'),
      'Supuestos del DCF'
    );
    const out = $('#toolOut', body);
    const run = () => {
      const p = { ventas0: v.ventas0, crecimientos: v.g.map((x) => x / 100), margenEbitda: v.margen / 100, tax: v.tax / 100, capexPct: v.capex / 100, ctPct: v.ct / 100, wacc: v.wacc / 100, g: v.gT / 100, deudaNeta: v.deudaNeta };
      const d = E.fin.dcf(p);
      const sensW = [-2, -1, 0, 1, 2].map((x) => v.wacc + x);
      const sensG = [-1, -0.5, 0, 0.5, 1].map((x) => v.gT + x);
      const grid = sensW.map((w) => sensG.map((g) => (w / 100 > g / 100 ? E.fin.dcf(Object.assign({}, p, { wacc: w / 100, g: g / 100 })).equity : null)));
      out.innerHTML =
        '<section class="card" style="margin-bottom:16px"><div class="result-hero"><small>Valor estimado del patrimonio (lo que valdría tu participación)</small><strong class="' + (d.equity <= 0 ? 'neg' : '') + '">' + cop(d.equity) + '</strong></div>' +
        '<div class="result-grid">' + mini('Valor de la empresa (EV)', cop(d.ev)) + mini('Valor terminal (VP)', cop(d.vpTv), d.pctTerminal == null ? '' : d.pctTerminal > 1 ? 'Mayor que el total: los primeros años restan' : fmt.pct(d.pctTerminal, 0) + ' del total') + mini('Deuda neta', cop(v.deudaNeta)) + '</div>' +
        (v.wacc <= v.gT ? '<div class="note" style="margin-top:14px">' + icon('alert') + '<span>La tasa de descuento debe ser mayor que el crecimiento a perpetuidad.</span></div>' : '') +
        '<p class="explain">' + (d.equity > 0
          ? 'Con estos supuestos, tu empresa valdría <strong>' + cop(d.equity) + '</strong> para sus dueños.' + (d.pctTerminal > 0.75 ? ' Ojo: el ' + fmt.pct(Math.min(1, d.pctTerminal), 0) + ' del valor viene del valor terminal, así que el resultado es muy sensible a la tasa y al crecimiento de largo plazo.' : '')
          : 'Con estos supuestos el flujo de caja libre de los primeros años es negativo: crecer al ' + fmt.pct(v.g[0] / 100, 0) + ' con un margen EBITDA de ' + fmt.pct(v.margen / 100) + ' consume más caja (capital de trabajo, inversión e impuestos) de la que genera. El margen es la palanca principal del valor.') + '</p>' +
        (d.equity <= 0 ? '<div class="answer__actions"><button class="btn btn--sm btn--light" type="button" id="dcfMargin">Probar con margen de ' + fmt.pct((v.margen + 3) / 100) + '</button></div>' : '') +
        '<div class="formula">FCL = EBITDA − impuestos − capex − Δ capital de trabajo<br>EV = Σ FCL / (1 + WACC)^t + VT / (1 + WACC)^5 · VT = FCL₅ × (1 + g) / (WACC − g)<br>Patrimonio = EV − deuda neta</div></section>' +
        '<section class="card card--flush" style="margin-bottom:16px"><div style="padding:20px 20px 0">' + cardHead('table', 'Proyección de flujo de caja libre') + '</div><div class="table-wrap"><table class="tbl"><thead><tr><th>Año</th><th class="num">Ventas</th><th class="num">EBITDA</th><th class="num">Impuestos</th><th class="num">Capex</th><th class="num">Δ Capital de trabajo</th><th class="num">Flujo libre</th><th class="num">Valor presente</th></tr></thead><tbody>' +
        d.years.map((y) => '<tr><td>Año ' + y.year + '</td><td class="num">' + cop(y.ventas) + '</td><td class="num">' + cop(y.ebitda) + '</td><td class="num">' + cop(-y.impuestos) + '</td><td class="num">' + cop(-y.capex) + '</td><td class="num">' + cop(-y.dCT) + '</td><td class="num"><strong>' + cop(y.fcf) + '</strong></td><td class="num">' + cop(y.vp) + '</td></tr>').join('') +
        '</tbody></table></div></section>' +
        '<section class="card">' + cardHead('target', 'Sensibilidad del valor del patrimonio', 'Filas: WACC · Columnas: crecimiento a perpetuidad') + '<div class="table-wrap"><table class="tbl tbl--compact sens"><thead><tr><th>WACC \\ g</th>' + sensG.map((g) => '<th class="num">' + fmt.pct(g / 100) + '</th>').join('') + '</tr></thead><tbody>' +
        grid.map((rowv, i) => '<tr><td>' + fmt.pct(sensW[i] / 100) + '</td>' + rowv.map((x, j) => '<td class="num' + (i === 2 && j === 2 ? ' is-base' : '') + '">' + (x == null ? '—' : cop(x)) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div></section>';
      const mb = $('#dcfMargin', out);
      if (mb) mb.addEventListener('click', () => {
        v.margen = Math.round((v.margen + 3) * 10) / 10;
        valDCF(body, m, v);
      });
    };
    bindFields(body, v, run);
    run();
  }

  function valWACC(body, m, v) {
    body.innerHTML = toolLayout(
      numField('rf', 'Tasa libre de riesgo (TES en pesos)', v, 'pct') + numField('betaU', 'Beta desapalancada del sector', v, 'times') + numField('erp', 'Prima de riesgo de mercado', v, 'pct') +
      numField('crp', 'Prima de riesgo país', v, 'pct') + numField('size', 'Prima por tamaño (pyme)', v, 'pct') + numField('tax', 'Impuesto de renta', v, 'pct') +
      numField('E', 'Patrimonio (E)', v, 'cop') + numField('D', 'Deuda financiera (D)', v, 'cop') + numField('kd', 'Costo de la deuda (E.A.)', v, 'pct'),
      'CAPM y estructura de capital'
    );
    const out = $('#toolOut', body);
    const run = () => {
      const de = v.E ? v.D / v.E : 0;
      const betaL = E.fin.relever(v.betaU, de, v.tax / 100);
      const ke = E.fin.capm({ rf: v.rf / 100, beta: betaL, erp: v.erp / 100, crp: v.crp / 100, size: v.size / 100 });
      const w = E.fin.wacc({ E: v.E, D: v.D, ke, kd: v.kd / 100, tax: v.tax / 100 });
      const V = v.E + v.D || 1;
      out.innerHTML =
        '<section class="card"><div class="result-hero"><small>Costo promedio ponderado de capital (WACC)</small><strong>' + fmt.pct(w) + '</strong></div>' +
        '<div class="result-grid">' + mini('Costo del patrimonio (Ke)', fmt.pct(ke), 'CAPM') + mini('Beta apalancada', fmt.num(betaL, 2), 'D/E ' + fmt.num(de, 2)) + mini('Deuda después de impuestos', fmt.pct((v.kd / 100) * (1 - v.tax / 100))) + mini('Peso patrimonio / deuda', fmt.pct(v.E / V, 0) + ' / ' + fmt.pct(v.D / V, 0)) + '</div>' +
        '<p class="explain">El WACC es la rentabilidad mínima que debe dar tu empresa para compensar a socios y bancos. Si una inversión rinde menos que <strong>' + fmt.pct(w) + '</strong>, destruye valor.</p>' +
        '<div class="formula">βL = βU × [1 + (1 − t) × D/E]<br>Ke = Rf + βL × prima de mercado + riesgo país + prima por tamaño<br>WACC = E/(D+E) × Ke + D/(D+E) × Kd × (1 − t)</div>' +
        '<div class="note note--info" style="margin-top:14px">' + icon('info') + '<span>Si usas una tasa libre de riesgo en pesos (TES), no sumes riesgo país: ya está incluido. Si usas bonos del Tesoro de EE. UU., súmalo y ajusta por la diferencia de inflación.</span></div>' +
        '<div class="answer__actions"><button class="btn btn--light btn--sm" type="button" id="useWacc">Usar ' + fmt.pct(w) + ' en el DCF y en inversiones</button></div></section>';
      $('#useWacc', out).addEventListener('click', () => {
        v.wacc = Math.round(w * 1000) / 10;
        v.tasaInv = v.wacc;
        toast('Listo: el DCF y la evaluación de inversiones usan un WACC de ' + fmt.pct(w) + '.');
      });
    };
    bindFields(body, v, run);
    run();
  }

  function valCredito(body, m, v) {
    body.innerHTML = toolLayout(numField('monto', 'Monto del crédito', v, 'cop') + numField('tasa', 'Tasa efectiva anual (E.A.)', v, 'pct') + numField('plazo', 'Plazo', v, 'months'), 'Condiciones del crédito');
    const out = $('#toolOut', body);
    const run = () => {
      const L = E.fin.loan({ monto: v.monto, tasaEA: v.tasa / 100, plazo: Math.max(1, Math.round(v.plazo)) });
      const k = m.kpis;
      const base = E.project(m, { horizonte: 6 }).summary;
      const sc = E.project(m, { horizonte: 6, prestamoMonto: v.monto, prestamoTasa: v.tasa / 100, prestamoPlazo: Math.max(1, Math.round(v.plazo)), prestamoMes: 1 }).summary;
      const utilMes = k.utilidadNetaLTM / Math.max(1, m.LTM.meses);
      out.innerHTML =
        '<section class="card" style="margin-bottom:16px"><div class="result-hero"><small>Cuota mensual fija</small><strong>' + cop(L.cuota) + '</strong></div>' +
        '<div class="result-grid">' + mini('Tasa mensual', fmt.pct(L.mr, 2)) + mini('Total intereses', cop(L.totalInteres)) + mini('Total a pagar', cop(L.totalPagado)) + mini('Cuota vs. utilidad mensual', utilMes > 0 ? fmt.pct(L.cuota / utilMes, 0) : '—', 'Utilidad promedio ' + cop(utilMes)) + '</div>' +
        '<p class="explain">Con este crédito, tu caja en 6 meses sería <strong>' + cop(sc.cajaFinal) + '</strong> (sin él: ' + cop(base.cajaFinal) + ') y el punto más bajo <strong>' + cop(sc.cajaMin) + '</strong>. ' + (utilMes > 0 && L.cuota / utilMes > 0.5 ? 'La cuota se come más de la mitad de tu utilidad mensual: evalúa un plazo mayor o un monto menor.' : 'La cuota es manejable frente a tu utilidad mensual.') + ' Recuerda sumar seguros y comisiones al comparar ofertas.</p>' +
        '<div class="formula">Tasa mensual = (1 + E.A.)^(1/12) − 1<br>Cuota = Monto × i / (1 − (1 + i)^−n)</div>' +
        '<div class="answer__actions"><a class="btn btn--sm btn--light" href="#/simulador?preset=credito&monto=' + Math.round(v.monto) + '">Ver en el simulador ' + icon('arrowRight') + '</a></div></section>' +
        '<section class="card card--flush"><div style="padding:20px 20px 0">' + cardHead('table', 'Tabla de amortización') + '</div><div class="table-wrap" style="max-height:420px;overflow-y:auto"><table class="tbl tbl--compact"><thead><tr><th>Cuota</th><th class="num">Valor cuota</th><th class="num">Intereses</th><th class="num">Abono a capital</th><th class="num">Saldo</th></tr></thead><tbody>' +
        L.tabla.map((x) => '<tr><td>' + x.n + '</td><td class="num">' + cop(x.cuota, { full: true }) + '</td><td class="num">' + cop(x.interes, { full: true }) + '</td><td class="num">' + cop(x.capital, { full: true }) + '</td><td class="num">' + cop(x.saldo, { full: true }) + '</td></tr>').join('') +
        '</tbody></table></div></section>';
    };
    bindFields(body, v, run);
    run();
  }

  function valInversion(body, m, v) {
    body.innerHTML = toolLayout(numField('inv', 'Inversión inicial', v, 'cop') + v.flujos.map((_, i) => numField('flujos', 'Flujo de caja año ' + (i + 1), v, 'cop', i)).join('') + numField('tasaInv', 'Tasa de descuento (WACC)', v, 'pct'), 'Flujos esperados');
    const out = $('#toolOut', body);
    const run = () => {
      const flows = [-v.inv].concat(v.flujos);
      const npv = E.fin.npv(v.tasaInv / 100, flows);
      const irr = E.fin.irr(flows);
      const pb = E.fin.payback(flows);
      const pv = E.fin.npv(v.tasaInv / 100, [0].concat(v.flujos));
      let acc = 0;
      out.innerHTML =
        '<section class="card" style="margin-bottom:16px"><div class="result-hero"><small>Valor presente neto (VPN)</small><strong class="' + (npv >= 0 ? 'pos' : 'neg') + '">' + cop(npv) + '</strong></div>' +
        '<div class="result-grid">' + mini('Tasa interna de retorno', irr == null ? '—' : fmt.pct(irr)) + mini('Recuperación', pb == null ? 'No se recupera' : fmt.num(pb, 1) + ' años') + mini('Índice de rentabilidad', fmt.num(v.inv ? pv / v.inv : 0, 2) + '×') + '</div>' +
        '<p class="explain">' + (npv >= 0 ? 'La inversión <strong>crea valor</strong>: rinde ' + (irr != null ? fmt.pct(irr) : 'más') + ' frente al ' + fmt.pct(v.tasaInv / 100) + ' que exiges.' : 'La inversión <strong>no alcanza</strong> la rentabilidad mínima del ' + fmt.pct(v.tasaInv / 100) + ': revisa los flujos esperados o el monto.') + ' Antes de decidir, mira en el simulador cómo afecta tu caja el desembolso.</p>' +
        '<div class="formula">VPN = −Inversión + Σ Flujo_t / (1 + tasa)^t · TIR: tasa que hace VPN = 0</div></section>' +
        '<section class="card card--flush"><div class="table-wrap"><table class="tbl"><thead><tr><th>Año</th><th class="num">Flujo</th><th class="num">Valor presente</th><th class="num">Acumulado</th></tr></thead><tbody>' +
        flows.map((f, t) => { acc += f; return '<tr><td>' + (t === 0 ? 'Inversión' : 'Año ' + t) + '</td><td class="num">' + cop(f) + '</td><td class="num">' + cop(f / Math.pow(1 + v.tasaInv / 100, t)) + '</td><td class="num"><span class="' + (acc < 0 ? 'neg' : 'pos') + '">' + cop(acc) + '</span></td></tr>'; }).join('') +
        '</tbody></table></div></section>';
    };
    bindFields(body, v, run);
    run();
  }

  function valMultiplos(body, m, v) {
    body.innerHTML = toolLayout(numField('ebitda', 'EBITDA últimos 12 meses', v, 'cop') + numField('mLow', 'Múltiplo bajo', v, 'times') + numField('mMid', 'Múltiplo medio', v, 'times') + numField('mHigh', 'Múltiplo alto', v, 'times') + numField('deudaNeta', 'Deuda neta', v, 'cop'), 'Supuestos');
    const out = $('#toolOut', body);
    const run = () => {
      const r3 = [v.mLow, v.mMid, v.mHigh].map((x) => ({ x, ev: x * v.ebitda, eq: x * v.ebitda - v.deudaNeta }));
      out.innerHTML =
        '<section class="card"><div class="result-hero"><small>Rango de valor del patrimonio</small><strong>' + cop(r3[0].eq) + ' – ' + cop(r3[2].eq) + '</strong></div>' +
        '<div class="result-grid">' + r3.map((x) => mini('EV/EBITDA ' + fmt.num(x.x, 1) + '×', cop(x.eq), 'EV ' + cop(x.ev))).join('') + '</div>' +
        '<p class="explain">Los múltiplos dicen cuánto pagaría un comprador por cada peso de EBITDA. Para pymes suelen ser más bajos que para empresas grandes porque dependen más del dueño y tienen menos historia. Ajusta el rango según tu sector y el tamaño de tu empresa.</p>' +
        '<div class="formula">Valor de la empresa = EBITDA × múltiplo · Patrimonio = valor de la empresa − deuda neta</div></section>';
    };
    bindFields(body, v, run);
    run();
  }

  /* =========================================================
     DATOS
     ========================================================= */
  const DATA_TABS = [
    ['movimientos', 'Movimientos'],
    ['importar', 'Importar Excel'],
    ['contexto', 'Contexto para la IA'],
    ['saldos', 'Saldos iniciales'],
    ['validaciones', 'Validaciones'],
  ];
  const PAGE = 25;

  function datos(view, r) {
    const st = S();
    const m = M();
    const sub = DATA_TABS.some(([k]) => k === r.sub) ? r.sub : 'movimientos';
    view.innerHTML =
      pageHead('Capa 1 · Datos financieros', 'Tus datos', 'Todo parte de aquí: tus ingresos, gastos, inversiones y créditos. Cárgalos desde Excel o regístralos a mano; el motor los valida antes de calcular.', '<button class="btn btn--sm" type="button" id="exportXlsx">' + icon('download') + 'Exportar Excel</button><button class="btn btn--sm btn--light" type="button" id="newTx">' + icon('plus') + 'Nuevo movimiento</button>') +
      (st.ds.source === 'demo' ? '<div class="note note--info" style="margin-bottom:16px">' + icon('info') + '<span>Estás viendo datos de ejemplo de una empresa ficticia (Café Alto Andino S.A.S.). Cuando cargues tus datos, reemplazarán a estos.</span></div>' : '') +
      '<nav class="tabs" aria-label="Secciones de datos">' + DATA_TABS.map(([key, lab]) => '<a href="#/datos/' + key + '" class="' + (key === sub ? 'is-active' : '') + '">' + lab +
        (key === 'validaciones' && !m.empty ? ' <span class="tag ' + (m.validations.some((x) => x.status !== 'ok') ? 'tag--warn' : 'tag--good') + '">' + m.validations.filter((x) => x.status === 'ok').length + '/' + m.validations.length + '</span>' : '') +
        (key === 'contexto' && m.contextScore ? ' <span class="tag tag--info">' + Math.round(m.contextScore.score * 100) + ' %</span>' : '') + '</a>').join('') + '</nav><div id="dataBody"></div>';
    $('#newTx', view).addEventListener('click', () => txModal());
    $('#exportXlsx', view).addEventListener('click', async () => {
      try {
        await DATA.exportXLSX(st.ds);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
    const body = $('#dataBody', view);
    ({ movimientos: dataMovs, importar: dataImport, contexto: dataContexto, saldos: dataSaldos, validaciones: dataValid })[sub](body);
    if (r.params.nuevo) {
      history.replaceState(null, '', '#/datos/movimientos');
      txModal();
    }
  }

  function dataMovs(body) {
    const st = S();
    const f = st.ui.datos;
    const all = st.ds.transactions;
    const months = Array.from(new Set(all.map((t) => D.month(t.fecha)))).sort().reverse();
    const cats = Array.from(new Set(all.map((t) => t.categoria))).sort();
    body.innerHTML =
      '<section class="card"><div class="filters"><input class="input grow" type="search" id="fQ" placeholder="Buscar por descripción, cliente o proveedor" value="' + esc(f.q) + '" aria-label="Buscar movimientos">' +
      '<select class="select" id="fTipo" aria-label="Tipo"><option value="">Todos los tipos</option>' + DATA.TIPOS.map((t) => '<option' + (f.tipo === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' +
      '<select class="select" id="fCat" aria-label="Categoría"><option value="">Todas las categorías</option>' + cats.map((c) => '<option' + (f.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      '<select class="select" id="fMes" aria-label="Mes"><option value="">Todos los meses</option>' + months.map((k) => '<option value="' + k + '"' + (f.mes === k ? ' selected' : '') + '>' + D.label(k) + '</option>').join('') + '</select>' +
      '<select class="select" id="fEstado" aria-label="Estado"><option value="">Pagado y pendiente</option><option value="pendiente"' + (f.estado === 'pendiente' ? ' selected' : '') + '>Pendientes</option><option value="pagado"' + (f.estado === 'pagado' ? ' selected' : '') + '>Pagados</option></select>' +
      '<select class="select" id="fCtx" aria-label="Contexto"><option value="">Con y sin contexto</option><option value="nota"' + (f.ctx === 'nota' ? ' selected' : '') + '>Con nota para la IA</option><option value="extraordinario"' + (f.ctx === 'extraordinario' ? ' selected' : '') + '>Extraordinarios</option></select></div>' +
      '<div id="txTable"></div></section>';
    const draw = () => {
      const q = util.norm(f.q);
      const rows = all
        .filter((t) => (!f.tipo || t.tipo === f.tipo) && (!f.cat || t.categoria === f.cat) && (!f.mes || D.month(t.fecha) === f.mes) && (!f.estado || (f.estado === 'pendiente' ? !t.fechaPago : !!t.fechaPago)) &&
          (!f.ctx || (f.ctx === 'nota' ? !!String(t.nota || '').trim() : t.naturaleza === 'extraordinario')) && (!q || util.norm(t.descripcion + ' ' + t.tercero + ' ' + t.categoria + ' ' + (t.nota || '')).includes(q)))
        .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
      const pages = Math.max(1, Math.ceil(rows.length / PAGE));
      f.page = Math.min(f.page, pages - 1);
      const slice = rows.slice(f.page * PAGE, f.page * PAGE + PAGE);
      const total = util.sum(rows, (t) => DATA.signOf(t) * t.monto);
      const corte = M().empty ? D.today() : M().meta.corte;
      $('#txTable', body).innerHTML =
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Categoría</th><th>Estado</th><th class="num">Monto</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
        (slice.length ? slice.map((t) => {
          const sign = DATA.signOf(t);
          return '<tr><td class="muted" style="white-space:nowrap">' + D.fmt(t.fecha) + '</td><td><div class="tx-cell"><span class="tx-icon">' + icon(TIPO_ICON[t.tipo]) + '</span><span class="cell-main"><span>' + esc(t.descripcion || t.categoria) + (t.naturaleza === 'extraordinario' ? ' <span class="tag tag--warn">Extraordinario</span>' : '') + '</span><small>' + esc(t.tercero || '—') + '</small>' + (t.nota ? '<small class="tx-note">' + icon('message') + esc(t.nota) + '</small>' : '') + '</span></div></td><td><span class="cell-main"><span>' + esc(t.categoria) + '</span><small>' + esc(t.tipo) + '</small></span></td><td>' + txState(t, corte) + '</td><td class="num"><span class="tx-amount' + (sign > 0 ? ' is-in' : '') + '">' + (sign > 0 ? '+' : MF.MINUS) + cop(t.monto, { full: true }) + '</span></td><td class="num" style="white-space:nowrap"><button class="icon-btn" style="width:30px;height:30px" type="button" data-edit="' + esc(t.id) + '" aria-label="Editar">' + icon('edit') + '</button> <button class="icon-btn" style="width:30px;height:30px" type="button" data-del="' + esc(t.id) + '" aria-label="Eliminar">' + icon('trash') + '</button></td></tr>';
        }).join('') : '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">No hay movimientos con esos filtros.</td></tr>') +
        '</tbody></table></div><div class="pager"><span>' + fmt.num(rows.length) + ' movimientos · neto ' + cop(total, { signed: true }) + '</span><span class="pager__btns"><button class="btn btn--xs" type="button" id="pPrev"' + (f.page === 0 ? ' disabled' : '') + '>' + icon('chevronLeft') + 'Anterior</button><span style="padding:4px 8px">' + (f.page + 1) + ' de ' + pages + '</span><button class="btn btn--xs" type="button" id="pNext"' + (f.page >= pages - 1 ? ' disabled' : '') + '>Siguiente' + icon('chevronRight') + '</button></span></div>';
      $('#pPrev', body).addEventListener('click', () => { f.page--; draw(); });
      $('#pNext', body).addEventListener('click', () => { f.page++; draw(); });
      $$('[data-edit]', body).forEach((b) => b.addEventListener('click', () => txModal(all.find((t) => t.id === b.dataset.edit))));
      $$('[data-del]', body).forEach((b) => b.addEventListener('click', async () => {
        const t = all.find((x) => x.id === b.dataset.del);
        if (!t) return;
        const ok = await confirmDialog('Eliminar movimiento', '«' + (t.descripcion || t.categoria) + '» por ' + cop(t.monto, { full: true }) + ' del ' + D.fmt(t.fecha) + '. Esta acción no se puede deshacer.', 'Eliminar', true);
        if (!ok) return;
        const ds = Object.assign({}, st.ds, { transactions: all.filter((x) => x.id !== t.id) });
        app().setData(ds, 'Movimiento eliminado.');
      }));
    };
    const onF = util.debounce(() => { f.page = 0; draw(); }, 160);
    $('#fQ', body).addEventListener('input', (e) => { f.q = e.target.value; onF(); });
    [['#fTipo', 'tipo'], ['#fCat', 'cat'], ['#fMes', 'mes'], ['#fEstado', 'estado'], ['#fCtx', 'ctx']].forEach(([id, key]) => $(id, body).addEventListener('change', (e) => { f[key] = e.target.value; f.page = 0; draw(); }));
    draw();
  }

  function txModal(tx) {
    const st = S();
    const t = tx ? Object.assign({}, tx) : { tipo: 'Ingreso', categoria: 'Ventas de productos', fecha: M().empty ? D.today() : M().meta.corte, monto: '', descripcion: '', tercero: '', fechaPago: '', vence: '', naturaleza: '', nota: '' };
    const paidNow = !tx || !!t.fechaPago;
    const catOpts = (tipo, sel) => DATA.categoriesFor(tipo).map((c) => '<option' + (c === sel ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    modal(
      '<div class="modal__head"><div><span class="eyebrow">Capa 1 · Datos</span><h2>' + (tx ? 'Editar movimiento' : 'Nuevo movimiento') + '</h2></div><button class="icon-btn" type="button" data-close aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<form id="txForm" class="form-grid" novalidate>' +
      '<label class="field"><span>Tipo</span><select class="select" name="tipo">' + DATA.TIPOS.map((x) => '<option' + (x === t.tipo ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Categoría</span><select class="select" name="categoria">' + catOpts(t.tipo, t.categoria) + '</select></label>' +
      '<label class="field"><span>Fecha del documento</span><input class="input" type="date" name="fecha" value="' + esc(t.fecha) + '" required></label>' +
      '<label class="field"><span>Monto</span><span class="input-group"><i>$</i><input class="input" name="monto" inputmode="numeric" value="' + esc(t.monto ? moneyInput(t.monto) : '') + '" required></span></label>' +
      '<label class="field" style="grid-column:1/-1"><span>Descripción</span><input class="input" name="descripcion" maxlength="140" value="' + esc(t.descripcion) + '" placeholder="Ej.: Factura 1045, arriendo de octubre"></label>' +
      '<label class="field" style="grid-column:1/-1"><span>Cliente o proveedor</span><input class="input" name="tercero" maxlength="80" value="' + esc(t.tercero) + '"></label>' +
      '<label class="check" style="grid-column:1/-1"><input type="checkbox" name="pagado"' + (paidNow ? ' checked' : '') + '>Ya se cobró o pagó</label>' +
      '<label class="field"><span>Fecha de cobro o pago</span><input class="input" type="date" name="fechaPago" value="' + esc(t.fechaPago || t.fecha) + '"' + (paidNow ? '' : ' disabled') + '></label>' +
      '<label class="field"><span>Vencimiento (opcional)</span><input class="input" type="date" name="vence" value="' + esc(t.vence || '') + '"></label>' +
      '<div class="ctx-box" style="grid-column:1/-1"><div class="ctx-box__head">' + icon('sparkles') + '<strong>Contexto para la IA</strong><small>Opcional · ayuda a interpretar este movimiento</small></div>' +
      '<div class="form-grid"><label class="field"><span>Naturaleza</span><select class="select" name="naturaleza">' +
      [['', 'Normal'], ['recurrente', 'Recurrente (se repite)'], ['extraordinario', 'Extraordinario (no se repite)']].map(([val, lab]) => '<option value="' + val + '"' + ((t.naturaleza || '') === val ? ' selected' : '') + '>' + lab + '</option>').join('') +
      '</select><small>Lo extraordinario se excluye al normalizar márgenes y proyecciones.</small></label>' +
      '<label class="field" style="grid-column:1/-1"><span>Nota para la IA</span><textarea class="textarea" name="nota" maxlength="400" rows="2" placeholder="Ej.: Falla puntual de la máquina; no debería repetirse. O: primer pedido de un cliente nuevo con 60 días de plazo.">' + esc(t.nota || '') + '</textarea></label></div></div>' +
      '<p class="muted" id="txErr" style="grid-column:1/-1;color:var(--crit-ink)" hidden></p></form>' +
      '<div class="modal__foot"><button class="btn" type="button" data-close>Cancelar</button><button class="btn btn--light" type="submit" form="txForm">' + (tx ? 'Guardar cambios' : 'Agregar') + '</button></div>',
      (el, close) => {
        const form = $('#txForm', el);
        form.tipo.addEventListener('change', () => (form.categoria.innerHTML = catOpts(form.tipo.value, '')));
        form.pagado.addEventListener('change', () => (form.fechaPago.disabled = !form.pagado.checked));
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const monto = readNumber(form.monto.value);
          const err = $('#txErr', el);
          if (!form.fecha.value || !isFinite(monto) || monto <= 0) {
            err.textContent = 'Revisa la fecha y el monto (debe ser mayor que cero).';
            err.hidden = false;
            return;
          }
          const rec = {
            id: tx ? tx.id : util.uid('m'), tipo: form.tipo.value, categoria: form.categoria.value, fecha: form.fecha.value, monto: Math.round(Math.abs(monto)),
            descripcion: form.descripcion.value.trim(), tercero: form.tercero.value.trim(), fechaPago: form.pagado.checked ? form.fechaPago.value || form.fecha.value : '', vence: form.vence.value || '',
            naturaleza: form.naturaleza.value, nota: form.nota.value.trim().slice(0, 400),
          };
          const list = tx ? st.ds.transactions.map((x) => (x.id === tx.id ? rec : x)) : st.ds.transactions.concat([rec]);
          list.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
          close();
          app().setData(Object.assign({}, st.ds, { transactions: list, source: st.ds.source === 'empty' ? 'manual' : st.ds.source }), tx ? 'Movimiento actualizado.' : 'Movimiento agregado. El motor ya recalculó tus indicadores.');
        });
      }
    );
  }

  function dataImport(body) {
    const st = S();
    const pv = st.importPreview;
    body.innerHTML =
      '<div class="grid"><section class="card span-7 lg-span-12"><label class="dropzone" id="drop" tabindex="0"><input type="file" id="fileIn" accept=".xlsx,.xls,.csv,.ods" hidden>' +
      '<span class="dropzone__icon">' + icon('upload') + '</span><strong>Arrastra tu Excel o CSV aquí</strong><span class="muted">o haz clic para elegir un archivo · .xlsx, .xls, .csv</span></label>' +
      '<div id="importOut" style="margin-top:16px"></div></section>' +
      '<section class="card span-5 lg-span-12">' + cardHead('file', 'Formato recomendado', 'Una fila por factura, gasto o movimiento') +
      '<div class="table-wrap"><table class="tbl tbl--compact"><tbody>' +
      [['Fecha', 'Fecha de la factura o del gasto'], ['Tipo', 'Ingreso, Gasto, Inversión o Financiamiento'], ['Categoría', 'Ventas, Nómina, Arriendo… (la reconocemos aunque no sea exacta)'], ['Monto', 'Valor en pesos, siempre positivo'], ['Cliente/Proveedor', 'Clave para analizar tu cartera'], ['Fecha de pago', 'Vacía = pendiente de cobro o pago'], ['Vencimiento', 'Opcional']].map(([a, b2]) => '<tr><td><strong>' + a + '</strong></td><td class="muted">' + b2 + '</td></tr>').join('') +
      '</tbody></table></div><p class="explain">También leemos extractos con columnas <strong>Ingreso/Egreso</strong> o <strong>Débito/Crédito</strong>, fechas en formato colombiano (dd/mm/aaaa) y montos como «$ 1.234.567».</p>' +
      '<div class="answer__actions"><button class="btn btn--light btn--sm" type="button" id="tplBtn">' + icon('download') + 'Descargar plantilla</button></div></section></div>';
    const drop = $('#drop', body);
    const input = $('#fileIn', body);
    const handle = async (file) => {
      if (!file) return;
      const out = $('#importOut', body);
      out.innerHTML = '<div class="thinking"><div class="thinking__step is-on"><i></i>Leyendo «' + esc(file.name) + '»…</div></div>';
      try {
        const res = await DATA.readFile(file);
        const parsed = DATA.parseRows(res.rows);
        st.importPreview = Object.assign({ file: file.name, sheet: res.sheet }, parsed);
        renderPreview(out);
      } catch (e) {
        out.innerHTML = '<div class="note">' + icon('alert') + '<span>' + esc(e.message || 'No pudimos leer el archivo.') + '</span></div>';
      }
    };
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', () => handle(input.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => handle(e.dataTransfer.files[0]));
    $('#tplBtn', body).addEventListener('click', async () => {
      try {
        await DATA.downloadTemplate();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
    if (pv) renderPreview($('#importOut', body));
  }

  function renderPreview(out) {
    const st = S();
    const pv = st.importPreview;
    const LABELS = { fecha: 'Fecha', tipo: 'Tipo', categoria: 'Categoría', descripcion: 'Descripción', tercero: 'Cliente/Proveedor', monto: 'Monto', ingreso: 'Ingreso', egreso: 'Egreso', fechaPago: 'Fecha de pago', vence: 'Vencimiento', estado: 'Estado', naturaleza: 'Naturaleza', nota: 'Nota para la IA' };
    const errors = pv.issues.filter((i) => i.level === 'error');
    const conNota = pv.rows.filter((t) => t.nota).length;
    const extra = pv.rows.filter((t) => t.naturaleza === 'extraordinario').length;
    out.innerHTML =
      '<div class="card" style="background:var(--card-2)">' + cardHead('shield', 'Validación del archivo', esc(pv.file) + ' · hoja «' + esc(pv.sheet) + '»') +
      '<div class="result-grid" style="margin-top:0">' + mini('Filas leídas', fmt.num(pv.stats.total)) + mini('Listas', '<span class="pos">' + fmt.num(pv.stats.ok) + '</span>') + mini('Con advertencias', fmt.num(pv.stats.warn)) + mini('Omitidas', '<span class="' + (pv.stats.skipped ? 'neg' : '') + '">' + fmt.num(pv.stats.skipped) + '</span>') + '</div>' +
      '<h5 class="mono" style="margin:16px 0 8px">Columnas reconocidas</h5><div class="chips" style="justify-content:flex-start">' + Object.entries(pv.mapping).map(([k, h]) => '<span class="source">' + esc(LABELS[k] || k) + ' ← <b>' + esc(h) + '</b></span>').join('') + '</div>' +
      (pv.issues.length ? '<h5 class="mono" style="margin:16px 0 8px">Observaciones</h5><div class="issues">' + pv.issues.slice(0, 60).map((i) => '<div class="issue">' + (i.level === 'error' ? '<span class="status status--critical">' + icon('octagon') + '</span>' : '<span class="status status--warning">' + icon('alert') + '</span>') + '<span>' + (i.row ? 'Fila ' + i.row + ': ' : '') + esc(i.msg) + '</span></div>').join('') + (pv.issues.length > 60 ? '<div class="muted">… y ' + (pv.issues.length - 60) + ' más</div>' : '') + '</div>' : '') +
      (pv.rows.length ? '<h5 class="mono" style="margin:16px 0 8px">Vista previa</h5><div class="table-wrap"><table class="tbl tbl--compact"><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Tercero</th><th class="num">Monto</th><th>Pago</th></tr></thead><tbody>' +
        pv.rows.slice(0, 8).map((t) => '<tr><td>' + D.fmt(t.fecha) + '</td><td>' + esc(t.tipo) + '</td><td>' + esc(t.categoria) + '</td><td>' + esc(t.tercero || '—') + '</td><td class="num">' + cop(t.monto, { full: true }) + '</td><td>' + (t.fechaPago ? D.fmt(t.fechaPago) : '<span class="tag tag--warn">Pendiente</span>') + '</td></tr>').join('') + '</tbody></table></div>' : '') +
      (pv.rows.length ? '<div class="ctx-box" style="margin-top:16px"><div class="ctx-box__head">' + icon('sparkles') + '<strong>Contexto de este archivo para la IA</strong><small>' + (conNota || extra ? conNota + ' filas con nota · ' + extra + ' extraordinarias' : 'Opcional') + '</small></div>' +
        '<textarea class="textarea" id="impNote" rows="2" maxlength="400" placeholder="Ej.: Incluye solo la sede norte. Marzo tiene un pedido único del gobierno que no se repetirá.">' + esc(pv.nota || '') + '</textarea><small class="muted">Lo guardamos en tu bitácora con la fecha de hoy.</small></div>' : '') +
      '<div class="answer__actions">' + (pv.rows.length ? '<button class="btn btn--light btn--sm" type="button" id="impReplace">Reemplazar mis datos (' + fmt.num(pv.rows.length) + ')</button>' + (st.ds.source !== 'demo' && st.ds.transactions.length ? '<button class="btn btn--sm" type="button" id="impAppend">Agregar a mis datos</button>' : '') : '') + '<button class="btn btn--sm btn--ghost" type="button" id="impCancel">Cancelar</button></div></div>';
    if (errors.length && !pv.rows.length) toast('No encontramos filas válidas en el archivo.', 'error');
    const noteEl = $('#impNote', out);
    if (noteEl) noteEl.addEventListener('input', () => (pv.nota = noteEl.value));
    const done = (ds, msg) => {
      const nota = String(pv.nota || '').trim();
      if (nota) ensureContext(ds).eventos.push({ id: util.uid('e'), fecha: D.today(), tipo: 'evento', titulo: 'Importación de «' + pv.file + '»', detalle: nota.slice(0, 400), impacto: null });
      st.importPreview = null;
      app().setData(ds, msg);
      app().go('#/datos/saldos');
    };
    const rep = $('#impReplace', out);
    if (rep) rep.addEventListener('click', () => {
      // Los datos de ejemplo traen su propio contexto; con datos reales se conserva el del usuario
      const fresh = DATA.empty(st.ds.source === 'demo' ? null : st.ds.profile, st.ds.source === 'demo' ? null : st.ds.context);
      fresh.source = 'import';
      fresh.transactions = pv.rows;
      done(fresh, 'Importamos ' + fmt.num(pv.rows.length) + ' movimientos. Completa tu caja inicial para que la caja calculada sea real.');
    });
    const ap = $('#impAppend', out);
    if (ap) ap.addEventListener('click', () => {
      const ds = Object.assign({}, st.ds, { transactions: st.ds.transactions.concat(pv.rows).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)) });
      done(ds, 'Agregamos ' + fmt.num(pv.rows.length) + ' movimientos.');
    });
    $('#impCancel', out).addEventListener('click', () => {
      st.importPreview = null;
      out.innerHTML = '';
    });
  }

  function dataSaldos(body) {
    const st = S();
    const s = st.ds.saldos;
    const m = M();
    body.innerHTML =
      '<div class="grid"><section class="card span-7 lg-span-12">' + cardHead('wallet', 'Saldos iniciales y supuestos', 'El motor parte de estos valores para calcular la caja y el balance') +
      '<form id="saldosForm" class="form-grid">' +
      '<label class="field"><span>Inicio del análisis</span><input class="input" type="date" name="fechaInicio" value="' + esc(s.fechaInicio || (m.empty ? '' : m.meta.inicio)) + '"><small>Vacío = el mes del primer movimiento</small></label>' +
      '<label class="field"><span>Caja y bancos al inicio</span><span class="input-group"><i>$</i><input class="input" name="cajaInicial" inputmode="numeric" value="' + moneyInput(s.cajaInicial || 0) + '"></span><small>Lo que tenías en caja y bancos ese día</small></label>' +
      '<label class="field"><span>Inventario actual</span><span class="input-group"><i>$</i><input class="input" name="inventario" inputmode="numeric" value="' + moneyInput(s.inventario || 0) + '"></span></label>' +
      '<label class="field"><span>Activos fijos al inicio</span><span class="input-group"><i>$</i><input class="input" name="activosFijos" inputmode="numeric" value="' + moneyInput(s.activosFijos || 0) + '"></span><small>Maquinaria, equipos, vehículos (valor neto)</small></label>' +
      '<label class="field"><span>Deuda financiera al inicio</span><span class="input-group"><i>$</i><input class="input" name="deudaInicial" inputmode="numeric" value="' + moneyInput(s.deudaInicial || 0) + '"></span></label>' +
      '<label class="field"><span>Tasa de tu deuda (E.A.)</span><span class="input-group"><input class="input has-suffix" name="tasaDeudaEA" inputmode="decimal" value="' + fmt.num((s.tasaDeudaEA || 0) * 100, 1) + '"><b>%</b></span></label>' +
      '<label class="field"><span>Colchón de caja deseado</span><span class="input-group"><input class="input has-suffix" name="colchonMeses" inputmode="decimal" value="' + fmt.num(s.colchonMeses || 1, 1) + '"><b>meses</b></span><small>Meses de gastos fijos que quieres tener siempre en caja</small></label>' +
      '<label class="field"><span>Vida útil de los activos fijos</span><span class="input-group"><input class="input has-suffix" name="vidaUtil" inputmode="numeric" value="' + fmt.num(s.vidaUtil || 10) + '"><b>años</b></span><small>Para calcular la depreciación</small></label>' +
      '<label class="field"><span>Capital social</span><span class="input-group"><i>$</i><input class="input" name="capitalSocial" inputmode="numeric" value="' + (s.capitalSocial != null && s.capitalSocial !== '' ? moneyInput(s.capitalSocial) : '') + '" placeholder="Opcional"></span><small>El resto del patrimonio inicial se muestra como utilidades retenidas</small></label>' +
      '<label class="field"><span>Régimen tributario</span><select class="select" name="regimen"><option value="ordinario"' + (s.regimen !== 'simple' ? ' selected' : '') + '>Ordinario (renta sobre utilidad)</option><option value="simple"' + (s.regimen === 'simple' ? ' selected' : '') + '>Simple (tarifa sobre ingresos)</option></select></label>' +
      '<label class="field"><span>Tarifa del impuesto</span><span class="input-group"><input class="input has-suffix" name="tasaImpuesto" inputmode="decimal" value="' + fmt.num((s.regimen === 'simple' ? s.tasaSimple || 0.04 : s.tasaRenta == null ? 0.35 : s.tasaRenta) * 100, 1) + '"><b>%</b></span><small>Ordinario: 35 % general · Simple: según tu actividad e ingresos</small></label>' +
      '<label class="field"><span>Impuesto de renta por pagar al inicio</span><span class="input-group"><i>$</i><input class="input" name="impuestoPorPagarInicial" inputmode="numeric" value="' + moneyInput(s.impuestoPorPagarInicial || 0) + '"></span><small>Lo causado y aún no pagado a la fecha de inicio</small></label>' +
      '</form><div class="answer__actions"><button class="btn btn--light btn--sm" type="submit" form="saldosForm">Guardar y recalcular</button></div></section>' +
      '<section class="card span-5 lg-span-12">' + cardHead('info', '¿Por qué importan?') + '<p class="explain">Tus movimientos dicen cuánto entró y salió, pero no con cuánto empezaste. Con la <strong>caja inicial</strong> el motor reconstruye tu saldo mes a mes; con la <strong>deuda</strong>, los <strong>activos</strong> y el <strong>impuesto por pagar</strong> arma tu estado de situación financiera completo, que siempre cuadra.</p>' +
      (m.empty ? '' : '<div class="ctx-list" style="margin-top:16px">' + [['Caja calculada hoy', cop(m.kpis.caja)], ['Cuentas por cobrar', cop(m.kpis.cxc)], ['Cuentas por pagar', cop(m.kpis.cxp)], ['Deuda financiera', cop(m.kpis.deuda)], ['Patrimonio estimado', cop(m.balance.patrimonio)]].map(([a, b2]) => '<div class="ctx-row"><span>' + a + '</span><b>' + b2 + '</b></div>').join('') + '</div>') + '</section></div>';
    $('#saldosForm', body).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const num = (x) => {
        const v = readNumber(x);
        return isFinite(v) ? v : 0;
      };
      const dec = (x) => {
        const v = parseFloat(String(x).replace(',', '.'));
        return isFinite(v) ? v : 0;
      };
      const regimen = f.regimen.value;
      const tasa = dec(f.tasaImpuesto.value) / 100;
      const capital = readNumber(f.capitalSocial.value);
      const saldos = Object.assign({}, s, {
        fechaInicio: f.fechaInicio.value || '', cajaInicial: num(f.cajaInicial.value), inventario: num(f.inventario.value), activosFijos: num(f.activosFijos.value),
        deudaInicial: num(f.deudaInicial.value), tasaDeudaEA: dec(f.tasaDeudaEA.value) / 100, colchonMeses: Math.max(0.5, dec(f.colchonMeses.value) || 1),
        vidaUtil: Math.max(1, Math.round(dec(f.vidaUtil.value)) || 10), regimen, impuestoPorPagarInicial: num(f.impuestoPorPagarInicial.value),
        capitalSocial: isFinite(capital) && capital > 0 ? capital : null,
      });
      if (regimen === 'simple') saldos.tasaSimple = tasa;
      else saldos.tasaRenta = tasa;
      app().setData(Object.assign({}, st.ds, { saldos }), 'Saldos guardados. Indicadores recalculados.');
    });
  }

  function dataValid(body) {
    const m = M();
    if (m.empty) {
      body.innerHTML = '<section class="card"><p class="muted">Aún no hay datos para validar.</p></section>';
      return;
    }
    const ICON_ST = { ok: ['good', 'checkCircle'], warn: ['warning', 'alert'], error: ['critical', 'octagon'] };
    body.innerHTML =
      '<section class="card">' + cardHead('shield', 'Validaciones del motor financiero', 'Antes de calcular, revisamos la calidad de tus datos') +
      '<div class="validations">' + m.validations.map((v) => {
        const [st, ic] = ICON_ST[v.status];
        return '<div class="validation"><span class="status status--' + st + '">' + icon(ic) + '</span><div><strong>' + esc(v.title) + '</strong> <span class="tag tag--' + (v.status === 'ok' ? 'good' : v.status === 'warn' ? 'warn' : 'crit') + '">' + (v.status === 'ok' ? 'OK' : v.status === 'warn' ? 'Revisar' : 'Error') + '</span><p>' + esc(v.detail) + '</p></div></div>';
      }).join('') + '</div></section>';
  }

  /* =========================================================
     AJUSTES
     ========================================================= */
  function ajustes(view) {
    const st = S();
    const p = st.ds.profile || {};
    const set = st.settings;
    view.innerHTML =
      pageHead('Configuración', 'Ajustes', 'Tu empresa, el proveedor de inteligencia artificial y tus datos.') +
      '<div class="grid">' +
      '<section class="card span-6 lg-span-12">' + cardHead('briefcase', 'Perfil de la empresa') + '<form id="profForm" class="form-grid">' +
      '<label class="field"><span>Empresa</span><input class="input" name="empresa" maxlength="80" value="' + esc(p.empresa) + '"></label>' +
      '<label class="field"><span>Tu nombre</span><input class="input" name="usuario" maxlength="40" value="' + esc(p.usuario) + '"></label>' +
      '<label class="field"><span>Sector</span><input class="input" name="sector" maxlength="80" value="' + esc(p.sector) + '"></label>' +
      '<label class="field"><span>Ciudad</span><input class="input" name="ciudad" maxlength="40" value="' + esc(p.ciudad) + '"></label>' +
      '</form><div class="answer__actions"><button class="btn btn--light btn--sm" type="submit" form="profForm">Guardar perfil</button></div></section>' +
      '<section class="card span-6 lg-span-12">' + cardHead('sparkles', 'Inteligencia artificial', 'Quién interpreta los resultados del motor') +
      '<div class="validations">' +
      '<label class="validation" style="cursor:pointer"><input type="radio" name="prov" value="local"' + (set.provider !== 'claude' ? ' checked' : '') + ' style="accent-color:var(--brand-2);margin-top:3px"><div><strong>Motor local</strong> <span class="tag tag--good">Gratis · sin conexión</span><p>Explica tus indicadores con reglas financieras sobre los resultados del motor. Funciona sin internet y sin enviar datos.</p></div></label>' +
      '<label class="validation" style="cursor:pointer"><input type="radio" name="prov" value="claude"' + (set.provider === 'claude' ? ' checked' : '') + ' style="accent-color:var(--brand-2);margin-top:3px"><div><strong>Claude (Anthropic)</strong> <span class="tag tag--info">' + esc(AI.MODEL) + '</span><p>Respuestas conversacionales a cualquier pregunta, siempre basadas en las cifras del motor. Puede correr simulaciones, consultar tus movimientos y valorar tu empresa para responderte. Requiere una clave de API de Anthropic.</p></div></label></div>' +
      '<div id="claudeBox" style="margin-top:14px"' + (set.provider === 'claude' ? '' : ' hidden') + '><label class="field"><span>Clave de API de Anthropic</span><span class="input-group"><input class="input" id="apiKey" type="password" autocomplete="off" placeholder="sk-ant-…" value="' + esc(set.apiKey || '') + '" style="padding-right:44px"><button class="icon-btn" type="button" id="showKey" aria-label="Mostrar clave" style="position:absolute;right:4px;width:32px;height:32px">' + icon('eye') + '</button></span></label>' +
      '<div class="answer__actions"><button class="btn btn--light btn--sm" type="button" id="saveKey">' + icon('key') + 'Guardar clave</button><button class="btn btn--sm" type="button" id="testKey">Probar conexión</button><span id="keyMsg" class="muted" style="align-self:center;font-size:12.5px"></span></div>' +
      '<div class="field" style="margin-top:16px"><span>Profundidad del análisis</span><div class="seg" role="group" aria-label="Profundidad del análisis">' +
      Object.entries(AI.EFFORTS).map(([v, l]) => '<button type="button" data-effort="' + v + '" aria-pressed="' + ((set.effort || 'high') === v) + '">' + l + '</button>').join('') +
      '</div><small>Profundo: Claude razona más, corre más simulaciones del motor y responde con más detalle; tarda más y consume más de tu API. Rápido: respuestas ágiles para preguntas simples.</small></div>' +
      '<div class="note" style="margin-top:12px">' + icon('lock') + '<span>La clave se guarda solo en este navegador y la usa el SDK oficial de Anthropic directamente desde aquí. Para ofrecer MobaFinance a clientes, mueve esta llamada a tu servidor para no exponer la clave.</span></div></div></section>' +
      '<section class="card span-12">' + cardHead('database', 'Tus datos', st.ds.source === 'demo' ? 'Estás usando datos de ejemplo' : fmt.num(st.ds.transactions.length) + ' movimientos guardados en este navegador') +
      '<div class="answer__actions" style="margin-top:0"><button class="btn btn--sm" type="button" id="bkExport">' + icon('download') + 'Exportar respaldo (.json)</button><label class="btn btn--sm" style="cursor:pointer">' + icon('upload') + 'Importar respaldo<input type="file" id="bkImport" accept=".json,application/json" hidden></label><button class="btn btn--sm" type="button" id="useDemo2">' + icon('refresh') + 'Restaurar datos de ejemplo</button><button class="btn btn--sm btn--danger" type="button" id="wipe">' + icon('trash') + 'Borrar todo y empezar de cero</button></div>' +
      '<p class="explain">MobaFinance guarda tus datos solo en este navegador (almacenamiento local). Exporta un respaldo con frecuencia.</p></section>' +
      '</div>';

    $('#profForm', view).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const profile = { empresa: f.empresa.value.trim() || 'Mi empresa', usuario: f.usuario.value.trim(), sector: f.sector.value.trim(), ciudad: f.ciudad.value.trim() };
      app().setData(Object.assign({}, st.ds, { profile }), 'Perfil guardado.');
    });
    $$('input[name=prov]', view).forEach((r) => r.addEventListener('change', () => {
      set.provider = r.value;
      app().saveSettings();
      $('#claudeBox', view).hidden = set.provider !== 'claude';
      app().updateChrome();
      if (set.provider === 'claude' && !set.apiKey) $('#apiKey', view).focus();
      else toast(set.provider === 'claude' ? 'El asistente usará Claude.' : 'El asistente usará el motor local.');
    }));
    $$('[data-effort]', view).forEach((b) => b.addEventListener('click', () => {
      set.effort = b.dataset.effort;
      app().saveSettings();
      $$('[data-effort]', view).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      toast('Profundidad del análisis: ' + AI.EFFORTS[set.effort].toLowerCase() + '.');
    }));
    $('#showKey', view).addEventListener('click', () => {
      const i = $('#apiKey', view);
      i.type = i.type === 'password' ? 'text' : 'password';
    });
    $('#saveKey', view).addEventListener('click', () => {
      set.apiKey = $('#apiKey', view).value.trim();
      app().saveSettings();
      app().updateChrome();
      toast(set.apiKey ? 'Clave guardada en este navegador.' : 'Clave eliminada.');
    });
    $('#testKey', view).addEventListener('click', async () => {
      const key = $('#apiKey', view).value.trim();
      const msg = $('#keyMsg', view);
      if (!key) {
        msg.textContent = 'Escribe tu clave primero.';
        return;
      }
      msg.textContent = 'Probando…';
      const r = await AI.testClaude(key);
      msg.textContent = r.msg;
      msg.style.color = r.ok ? 'var(--good)' : 'var(--crit-ink)';
    });
    $('#bkExport', view).addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(st.ds, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mobafinance-respaldo-' + D.today() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $('#bkImport', view).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const ds = JSON.parse(await file.text());
        if (!ds || ds.v !== 1 || !Array.isArray(ds.transactions)) throw new Error('El archivo no es un respaldo de MobaFinance.');
        app().setData(ds, 'Respaldo restaurado: ' + fmt.num(ds.transactions.length) + ' movimientos.');
      } catch (err) {
        toast(err.message || 'No pudimos leer el respaldo.', 'error');
      }
    });
    $('#useDemo2', view).addEventListener('click', async () => {
      if (st.ds.source !== 'demo' && !(await confirmDialog('Restaurar datos de ejemplo', 'Tus datos actuales se reemplazarán por los de la empresa de ejemplo. Exporta un respaldo si quieres conservarlos.', 'Restaurar', true))) return;
      app().setData(DATA.demo(), 'Datos de ejemplo restaurados.');
    });
    $('#wipe', view).addEventListener('click', async () => {
      if (!(await confirmDialog('Borrar todo', 'Se eliminarán todos los movimientos y saldos de este navegador. Esta acción no se puede deshacer.', 'Borrar todo', true))) return;
      app().setData(DATA.empty(), 'Listo. Empieza cargando tu Excel o registrando movimientos.');
      app().go('#/panel');
    });
  }

  /* =========================================================
     DATOS → CONTEXTO PARA LA IA
     ========================================================= */
  const NEGOCIO = [
    ['descripcion', '¿Qué hace tu empresa?', 'Ej.: Tostamos y vendemos café. Vendemos al detal y al por mayor a cafeterías y hoteles.'],
    ['productos', 'Productos o servicios y sus márgenes', 'Ej.: El café molido de 500 g es el que más vende; el canal mayorista deja menos margen.'],
    ['clientes', 'Clientes clave y cómo pagan en la práctica', 'Ej.: La cadena pactó 60 días pero paga a 75. Las cafeterías pagan a 30.'],
    ['proveedores', 'Proveedores clave y condiciones', 'Ej.: El proveedor principal nos da 20 días; subió precios 12 % este año.'],
    ['estacionalidad', 'Temporadas altas y bajas', 'Ej.: Diciembre es el mejor mes; enero y febrero son bajos.'],
    ['preocupaciones', 'Preocupaciones, restricciones y compromisos', 'Ej.: No queremos más deuda de largo plazo. El banco nos exige liquidez corriente mayor a 1,2.'],
    ['preferencias', 'Cómo quieres que te responda la IA', 'Ej.: Corto, con acciones concretas y cifras; explícame los términos técnicos.'],
    ['notas', 'Otras notas', 'Cualquier cosa que la IA deba saber y que no esté en tus números.'],
  ];
  const IMPACT_TYPES = [
    ['ninguno', 'Sin impacto en el modelo'],
    ['inversion', 'Inversión (pago único)'],
    ['contratacion', 'Contratación (salario mensual)'],
    ['credito', 'Crédito recibido'],
    ['gasto', 'Nuevo gasto fijo mensual'],
    ['ventas', 'Ventas adicionales mensuales'],
  ];

  function dataContexto(body) {
    const st = S();
    const m = M();
    const ctx = ensureContext(st.ds);
    const k = m.empty ? {} : m.kpis;
    const eventos = (ctx.eventos || []).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const planes = eventos.filter((e) => e.tipo === 'plan');
    const pasados = eventos.filter((e) => e.tipo !== 'plan');
    const terceros = Object.entries(ctx.terceros || {});
    const metaRow = (key, label, kind, actual) => {
      const val = ctx.metas[key];
      const shown = val == null || val === '' ? '' : kind === 'cop' ? moneyInput(val) : kind === 'pct' ? fmt.num(val * 100, 1) : fmt.num(val, kind === 'months' ? 1 : 0);
      const suf = kind === 'pct' ? '<b>%</b>' : kind === 'days' ? '<b>días</b>' : kind === 'months' ? '<b>meses</b>' : '';
      const hoy = actual == null || !isFinite(actual) ? '—' : kind === 'cop' ? cop(actual) : kind === 'pct' ? fmt.pct(actual) : kind === 'days' ? fmt.days(actual) : fmt.months(actual);
      return '<label class="field"><span>' + label + '</span><span class="input-group">' + (kind === 'cop' ? '<i>$</i>' : '') + '<input class="input' + (suf ? ' has-suffix' : '') + '" data-meta="' + key + '" data-kind="' + kind + '" inputmode="decimal" value="' + esc(shown) + '" placeholder="Sin meta">' + suf + '</span><small>Hoy: ' + hoy + '</small></label>';
    };
    const eventItem = (e) =>
      '<article class="ev ev--' + (e.tipo === 'plan' ? 'plan' : 'evento') + '"><div class="ev__date"><strong>' + esc(D.label(D.month(e.fecha), 'abbr')) + '</strong><small>' + e.fecha.slice(0, 4) + '</small></div><div class="ev__body"><div class="ev__title">' + esc(e.titulo) +
      (e.tipo === 'plan' ? ' <span class="tag tag--info">Plan</span>' : '') + (e.impacto && e.impacto.tipo && e.impacto.tipo !== 'ninguno' && Number(e.impacto.monto) > 0 ? ' <span class="tag tag--muted">' + esc(impactLabel(e.impacto)) + '</span>' : '') + '</div>' +
      (e.detalle ? '<p>' + esc(e.detalle) + '</p>' : '') + '</div><div class="ev__actions"><button class="icon-btn" type="button" data-ev-edit="' + esc(e.id) + '" aria-label="Editar">' + icon('edit') + '</button><button class="icon-btn" type="button" data-ev-del="' + esc(e.id) + '" aria-label="Eliminar">' + icon('trash') + '</button></div></article>';

    body.innerHTML =
      '<div class="grid">' +
      '<section class="card span-12 ctx-hero"><div><span class="eyebrow">Contexto para la IA</span><h2>La IA entiende tus números; tú le cuentas lo que los números no dicen</h2><p class="muted">Todo lo que escribas aquí viaja con cada pregunta al asistente y ajusta el modelo financiero: tus metas se comparan con tus resultados, tus planes entran en la proyección y tus restricciones cambian las recomendaciones.</p></div>' +
      '<div class="ctx-hero__score" id="ctxScore"></div></section>' +
      '<section class="card span-7 lg-span-12">' + cardHead('briefcase', 'Tu negocio', 'Se guarda automáticamente', '<span class="saved" id="negSaved" hidden>' + icon('check') + 'Guardado</span>') +
      '<div class="form-grid ctx-form">' + NEGOCIO.map(([key, label, ph]) => '<label class="field" style="grid-column:1/-1"><span>' + label + '</span><textarea class="textarea" data-neg="' + key + '" rows="2" maxlength="800" placeholder="' + esc(ph) + '">' + esc(ctx.negocio[key] || '') + '</textarea></label>').join('') + '</div></section>' +
      '<div class="span-5 lg-span-12 stack-col">' +
      '<section class="card">' + cardHead('target', 'Metas', 'La IA mide tu avance contra ellas', '<span class="saved" id="metaSaved" hidden>' + icon('check') + 'Guardado</span>') +
      '<div class="form-grid">' + metaRow('ventasMes', 'Ventas mensuales', 'cop', k.ventasMes) + metaRow('margenNeto', 'Margen neto', 'pct', k.margenNeto) + metaRow('dso', 'Días de cobro', 'days', k.dso) + metaRow('colchonMeses', 'Colchón de caja', 'months', k.coberturaCaja) + metaRow('crecimiento', 'Crecimiento anual de ventas', 'pct', k.crecimientoPeriodo) + '</div></section>' +
      '<section class="card">' + cardHead('users', 'Notas de clientes y proveedores', terceros.length ? terceros.length + ' notas' : 'Condiciones reales, acuerdos, riesgos', '<button class="btn btn--xs" type="button" id="addTnote">' + icon('plus') + 'Agregar</button>') +
      (terceros.length ? '<div class="notes">' + terceros.map(([name, v]) => '<div class="note-item"><div><strong>' + esc(name) + '</strong><p>' + esc(v.nota) + '</p></div><button class="icon-btn" type="button" data-tn="' + esc(name) + '" aria-label="Editar nota">' + icon('edit') + '</button></div>').join('') + '</div>' : '<p class="muted">También puedes agregarlas desde Análisis → Cartera.</p>') + '</section>' +
      '</div>' +
      '<section class="card span-12">' + cardHead('layers', 'Bitácora: eventos y planes', 'Los eventos explican tus números; los planes con impacto entran en el modelo financiero', '<button class="btn btn--xs" type="button" data-ev-new="evento">' + icon('plus') + 'Evento</button><button class="btn btn--xs btn--light" type="button" data-ev-new="plan">' + icon('plus') + 'Plan</button>') +
      '<div class="ev-cols"><div><h5 class="mono ev-h">Planes · ' + planes.length + '</h5>' + (planes.length ? planes.map(eventItem).join('') : '<p class="muted">¿Vas a contratar, invertir, abrir un local o tomar un crédito? Agrégalo con su mes y monto y lo verás en los estados proyectados.</p>') + '</div>' +
      '<div><h5 class="mono ev-h">Eventos · ' + pasados.length + '</h5>' + (pasados.length ? pasados.map(eventItem).join('') : '<p class="muted">Registra lo que explica tus números: un cliente nuevo, una falla, un crédito, una temporada atípica.</p>') + '</div></div></section>' +
      '<section class="card span-12">' + cardHead('message', 'Movimientos con contexto', (m.notasTx || []).length + ' movimientos tienen nota o están marcados como extraordinarios', '<button class="btn btn--xs" type="button" id="seeTxNotes">Ver en movimientos</button>') +
      ((m.notasTx || []).length ? '<div class="table-wrap"><table class="tbl tbl--compact"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Naturaleza</th><th>Nota</th><th class="num">Monto</th></tr></thead><tbody>' + m.notasTx.slice(0, 8).map((t) => '<tr><td style="white-space:nowrap">' + D.fmt(t.fecha) + '</td><td>' + esc(t.descripcion || t.categoria) + '</td><td>' + (t.naturaleza ? '<span class="tag ' + (t.naturaleza === 'extraordinario' ? 'tag--warn' : 'tag--muted') + '">' + esc(DATA.NATURALEZA_LABEL[t.naturaleza]) + '</span>' : '—') + '</td><td class="muted">' + esc(t.nota || '') + '</td><td class="num">' + cop(t.monto) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">Al crear o editar un movimiento puedes marcarlo como extraordinario y escribir una nota para la IA. En Excel, usa las columnas «Naturaleza» y «Nota para la IA».</p>') +
      '</section></div>';

    const paintScore = () => {
      const cs = M().contextScore || { score: 0, missing: [] };
      const pct = Math.round(cs.score * 100);
      $('#ctxScore', body).innerHTML = '<div class="ctx-score"><div class="ctx-score__top"><span>La IA conoce tu negocio</span><b>' + pct + ' %</b></div><div class="meter" style="--c:var(--ai-accent)"><i style="width:' + pct + '%"></i></div></div>' +
        (cs.missing.length ? '<ul class="ctx-todo">' + cs.missing.slice(0, 3).map((t) => '<li>' + icon('plus') + esc(t) + '</li>').join('') + '</ul>' : '<p class="ctx-done">' + icon('checkCircle') + 'Tu contexto está completo. Mantenlo al día.</p>');
    };
    paintScore();
    // Las áreas de texto crecen con su contenido
    const fit = (ta) => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(320, ta.scrollHeight + 2) + 'px';
    };
    $$('[data-neg]', body).forEach((ta) => {
      fit(ta);
      ta.addEventListener('input', () => fit(ta));
    });
    const flash = (id) => {
      const el = $(id, body);
      el.hidden = false;
      clearTimeout(el._t);
      el._t = setTimeout(() => (el.hidden = true), 1600);
    };
    const saveNeg = util.debounce(() => {
      app().saveData({ rerender: false });
      paintScore();
      flash('#negSaved');
    }, 600);
    $$('[data-neg]', body).forEach((ta) => ta.addEventListener('input', () => {
      ctx.negocio[ta.dataset.neg] = ta.value;
      saveNeg();
    }));
    $$('[data-meta]', body).forEach((inp) => inp.addEventListener('change', () => {
      const kind = inp.dataset.kind;
      const raw = inp.value.trim();
      let val = null;
      if (raw) {
        const n = kind === 'cop' ? readNumber(raw) : parseFloat(raw.replace(/\./g, '').replace(',', '.'));
        if (isFinite(n)) val = kind === 'pct' ? n / 100 : n;
      }
      if (val == null) delete ctx.metas[inp.dataset.meta];
      else ctx.metas[inp.dataset.meta] = val;
      inp.value = val == null ? '' : kind === 'cop' ? moneyInput(val) : kind === 'pct' ? fmt.num(val * 100, 1) : fmt.num(val, kind === 'months' ? 1 : 0);
      app().saveData({ rerender: false });
      paintScore();
      flash('#metaSaved');
    }));
    $$('[data-ev-new]', body).forEach((b) => b.addEventListener('click', () => eventModal(null, b.dataset.evNew)));
    $$('[data-ev-edit]', body).forEach((b) => b.addEventListener('click', () => eventModal(ctx.eventos.find((e) => e.id === b.dataset.evEdit))));
    $$('[data-ev-del]', body).forEach((b) => b.addEventListener('click', async () => {
      const ev = ctx.eventos.find((e) => e.id === b.dataset.evDel);
      if (!ev || !(await confirmDialog('Eliminar de la bitácora', '«' + ev.titulo + '» dejará de usarse en el modelo y en las respuestas de la IA.', 'Eliminar', true))) return;
      ctx.eventos = ctx.eventos.filter((e) => e.id !== ev.id);
      app().saveData({ msg: 'Eliminado de la bitácora.' });
    }));
    $$('[data-tn]', body).forEach((b) => b.addEventListener('click', () => terceroNoteModal(b.dataset.tn)));
    $('#addTnote', body).addEventListener('click', () => newTerceroNote());
    $('#seeTxNotes', body).addEventListener('click', () => {
      st.ui.datos.ctx = 'nota';
      st.ui.datos.page = 0;
      app().go('#/datos/movimientos');
    });
  }

  function impactLabel(i) {
    const t = { inversion: 'Inversión', contratacion: 'Contratación', credito: 'Crédito', gasto: 'Gasto fijo', ventas: 'Ventas adicionales' }[i.tipo] || '';
    return t + ' · ' + cop(Number(i.monto)) + (i.tipo === 'gasto' || i.tipo === 'ventas' || i.tipo === 'contratacion' ? '/mes' : '') + (i.tipo === 'contratacion' && Number(i.cantidad) > 1 ? ' × ' + i.cantidad : '');
  }

  function eventModal(ev, tipoNuevo) {
    const st = S();
    const ctx = ensureContext(st.ds);
    const e = ev ? JSON.parse(JSON.stringify(ev)) : { id: util.uid('e'), tipo: tipoNuevo || 'evento', fecha: tipoNuevo === 'plan' ? D.addMonths(D.month(D.today()), 1) + '-01' : D.today(), titulo: '', detalle: '', impacto: tipoNuevo === 'plan' ? { tipo: 'inversion', monto: '' } : null };
    const imp = e.impacto || { tipo: 'ninguno' };
    modal(
      '<div class="modal__head"><div><span class="eyebrow">Bitácora</span><h2>' + (ev ? 'Editar' : e.tipo === 'plan' ? 'Nuevo plan' : 'Nuevo evento') + '</h2></div><button class="icon-btn" type="button" data-close aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<form id="evForm" class="form-grid" novalidate>' +
      '<label class="field"><span>Tipo</span><select class="select" name="tipo"><option value="evento"' + (e.tipo !== 'plan' ? ' selected' : '') + '>Evento (algo que pasó)</option><option value="plan"' + (e.tipo === 'plan' ? ' selected' : '') + '>Plan (algo que harás)</option></select></label>' +
      '<label class="field"><span>Fecha</span><input class="input" type="date" name="fecha" value="' + esc(e.fecha) + '" required></label>' +
      '<label class="field" style="grid-column:1/-1"><span>Título</span><input class="input" name="titulo" maxlength="90" value="' + esc(e.titulo) + '" placeholder="Ej.: Abrir un segundo punto de venta" required></label>' +
      '<label class="field" style="grid-column:1/-1"><span>Detalle para la IA</span><textarea class="textarea" name="detalle" rows="2" maxlength="400" placeholder="Qué pasó o qué piensas hacer y por qué.">' + esc(e.detalle || '') + '</textarea></label>' +
      '<div class="ctx-box" id="impBox" style="grid-column:1/-1"' + (e.tipo === 'plan' ? '' : ' hidden') + '><div class="ctx-box__head">' + icon('calculator') + '<strong>Impacto en el modelo financiero</strong><small>Con monto, el plan entra en los estados proyectados</small></div>' +
      '<div class="form-grid"><label class="field"><span>Tipo de impacto</span><select class="select" name="impTipo">' + IMPACT_TYPES.map(([v2, l]) => '<option value="' + v2 + '"' + (imp.tipo === v2 ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label class="field"><span id="impMontoLbl">Monto</span><span class="input-group"><i>$</i><input class="input" name="impMonto" inputmode="numeric" value="' + (imp.monto ? moneyInput(Number(imp.monto)) : '') + '"></span></label>' +
      '<label class="field" data-only="contratacion"><span>Número de personas</span><input class="input" name="impCantidad" inputmode="numeric" value="' + esc(imp.cantidad || 1) + '"></label>' +
      '<label class="field" data-only="credito"><span>Tasa E.A.</span><span class="input-group"><input class="input has-suffix" name="impTasa" inputmode="decimal" value="' + fmt.num((imp.tasa || 0.21) * 100, 1) + '"><b>%</b></span></label>' +
      '<label class="field" data-only="credito"><span>Plazo</span><span class="input-group"><input class="input has-suffix" name="impPlazo" inputmode="numeric" value="' + esc(imp.plazo || 24) + '"><b>meses</b></span></label></div></div>' +
      '<p class="muted" id="evErr" style="grid-column:1/-1;color:var(--crit-ink)" hidden></p></form>' +
      '<div class="modal__foot"><button class="btn" type="button" data-close>Cancelar</button><button class="btn btn--light" type="submit" form="evForm">Guardar</button></div>',
      (el, close) => {
        const f = $('#evForm', el);
        const sync = () => {
          $('#impBox', el).hidden = f.tipo.value !== 'plan';
          const t = f.impTipo.value;
          $$('[data-only]', el).forEach((x) => (x.hidden = x.dataset.only !== t));
          $('#impMontoLbl', el).textContent = t === 'contratacion' ? 'Salario mensual por persona' : t === 'gasto' || t === 'ventas' ? 'Monto mensual' : 'Monto';
          f.impMonto.disabled = t === 'ninguno';
        };
        f.tipo.addEventListener('change', sync);
        f.impTipo.addEventListener('change', sync);
        sync();
        f.addEventListener('submit', (evt) => {
          evt.preventDefault();
          const err = $('#evErr', el);
          if (!f.fecha.value || !f.titulo.value.trim()) {
            err.textContent = 'Escribe un título y una fecha.';
            err.hidden = false;
            return;
          }
          const rec = { id: e.id, tipo: f.tipo.value, fecha: f.fecha.value, titulo: f.titulo.value.trim(), detalle: f.detalle.value.trim(), impacto: null };
          if (rec.tipo === 'plan' && f.impTipo.value !== 'ninguno') {
            const monto = readNumber(f.impMonto.value);
            if (!isFinite(monto) || monto <= 0) {
              err.textContent = 'Escribe el monto del impacto o elige «Sin impacto en el modelo».';
              err.hidden = false;
              return;
            }
            rec.impacto = { tipo: f.impTipo.value, monto: Math.round(monto) };
            if (f.impTipo.value === 'contratacion') rec.impacto.cantidad = Math.max(1, Math.round(Number(f.impCantidad.value) || 1));
            if (f.impTipo.value === 'credito') {
              rec.impacto.tasa = (parseFloat(String(f.impTasa.value).replace(',', '.')) || 21) / 100;
              rec.impacto.plazo = Math.max(1, Math.round(Number(f.impPlazo.value) || 24));
            }
          }
          const i = ctx.eventos.findIndex((x) => x.id === rec.id);
          if (i >= 0) ctx.eventos[i] = rec;
          else ctx.eventos.push(rec);
          close();
          const corte = M().empty ? D.today() : M().meta.corte;
          app().saveData({ msg: rec.tipo === 'plan' && rec.impacto && rec.fecha > corte ? 'Plan guardado. Ya está en tu modelo financiero proyectado.' : 'Guardado en tu bitácora.' });
        });
      }
    );
  }

  function newTerceroNote() {
    const m = M();
    const names = Array.from(new Set((m.clients || []).map((c) => c.tercero).concat((m.suppliers || []).map((s) => s.tercero)))).filter((n) => n && n !== 'Sin nombre');
    modal(
      '<div class="modal__head"><div><span class="eyebrow">Contexto para la IA</span><h2>Nota de cliente o proveedor</h2></div><button class="icon-btn" type="button" data-close aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<label class="field"><span>Cliente o proveedor</span><input class="input" id="tnName" list="tnList" maxlength="80" placeholder="Escribe o elige un nombre"><datalist id="tnList">' + names.map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist></label>' +
      '<div class="modal__foot"><button class="btn" type="button" data-close>Cancelar</button><button class="btn btn--light" type="button" id="tnNext">Continuar</button></div>',
      (el, close) => {
        $('#tnNext', el).addEventListener('click', () => {
          const name = $('#tnName', el).value.trim();
          if (!name) return;
          close();
          terceroNoteModal(name);
        });
      }
    );
  }

  /* =========================================================
     ESTADOS FINANCIEROS (históricos + modelo proyectado)
     ========================================================= */
  const EST_TABS = [
    ['resultados', 'Estado de resultados'],
    ['balance', 'Situación financiera'],
    ['flujo', 'Flujo de efectivo'],
    ['supuestos', 'Supuestos del modelo'],
  ];
  /** Supuestos del modelo: calculados de tus datos + lo que el usuario cambió */
  function modeloSupuestos(m) {
    return Object.assign(E.modelDefaults(m), S().ds.modelo || {});
  }

  function estados(view, r) {
    const m = M();
    if (m.empty) return emptyState(view);
    const st = S();
    const o = st.ui.estados || (st.ui.estados = { periodo: 'ambos', vista: 'mensual' });
    const sub = EST_TABS.some(([key]) => key === r.sub) ? r.sub : 'resultados';
    const sup = modeloSupuestos(m);
    const pf = E.proforma(m, sup);
    const cuadra = Math.abs(m.balance.diff) < 1000 && pf.summary.maxDiff < 1000;
    const H = pf.rows.length;
    view.innerHTML =
      pageHead('Estados financieros', 'Estados financieros', 'Históricos calculados de tus movimientos y proyectados con un modelo de tres estados conectado: lo que pasa en resultados se refleja en el balance y en la caja.', '<button class="btn btn--sm" type="button" id="estPdf">' + icon('file') + 'PDF ejecutivo</button><button class="btn btn--sm btn--primary" type="button" id="estXlsx">' + icon('download') + 'Exportar a Excel</button>') +
      '<div class="est-bar">' + (cuadra ? status('good', 'El balance cuadra en los ' + (m.monthly.length + H) + ' cierres') : status('critical', 'Revisa el cuadre del balance')) +
      '<span class="muted">Histórico: ' + D.label(m.meta.months[0]) + ' – ' + D.label(m.kpis.mes) + ' · Proyección: ' + D.label(pf.rows[0].key) + ' – ' + D.label(pf.rows[H - 1].key) + (pf.planesIncluidos.length ? ' · incluye ' + pf.planesIncluidos.length + (pf.planesIncluidos.length === 1 ? ' plan' : ' planes') + ' de tu bitácora' : '') + '</span></div>' +
      '<nav class="tabs" aria-label="Estados">' + EST_TABS.map(([key, lab]) => '<a href="#/estados/' + key + '" class="' + (key === sub ? 'is-active' : '') + '">' + lab + '</a>').join('') + '</nav>' +
      (sub !== 'supuestos'
        ? '<div class="filters est-filters"><div class="seg" role="group" aria-label="Período"><button type="button" data-per="historico">Histórico</button><button type="button" data-per="proyeccion">Proyección</button><button type="button" data-per="ambos">Ambos</button></div>' +
          '<div class="seg" role="group" aria-label="Vista"><button type="button" data-vis="mensual">Mensual</button><button type="button" data-vis="resumen">Resumen</button></div><span class="muted" style="font-size:12.5px">Cifras en millones de pesos · la proyección va en azul</span></div>'
        : '') +
      '<div id="estBody"></div>';
    $$('[data-per]', view).forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.per === o.periodo));
      b.addEventListener('click', () => {
        o.periodo = b.dataset.per;
        estados(view, r);
      });
    });
    $$('[data-vis]', view).forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.vis === o.vista));
      b.addEventListener('click', () => {
        o.vista = b.dataset.vis;
        estados(view, r);
      });
    });
    const body = $('#estBody', view);
    if (sub === 'supuestos') modelForm(body, m, view, r);
    else statementView(body, sub, m, pf, o);
    $('#estXlsx', view).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const prev = btn.innerHTML;
      btn.innerHTML = icon('refresh') + 'Generando…';
      try {
        await MF.statements.exportExcel({ model: m, pf: E.proforma(m, modeloSupuestos(m)), ds: st.ds, supuestos: modeloSupuestos(m) });
        toast('Listo: descargamos tus estados financieros en Excel.');
      } catch (err) {
        toast(err.message || 'No pudimos generar el Excel.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
    $('#estPdf', view).addEventListener('click', () => MF.statements.printReport({ model: m, pf: E.proforma(m, modeloSupuestos(m)) }));
  }

  function statementView(body, type, m, pf, o) {
    const L = m.LTM;
    const ps = pf.summary;
    const last = pf.rows[pf.rows.length - 1];
    const B = m.balance;
    let minis = '';
    if (type === 'resultados') {
      minis = mini('Ventas', cop(L.ventas), 'Proyección: ' + cop(ps.ventasTotal)) + mini('EBITDA', cop(L.ebitda), 'Proyección: ' + cop(ps.ebitdaTotal)) +
        mini('Utilidad neta', cop(L.utilidadNeta), 'Proyección: ' + cop(ps.utilidadTotal)) + mini('Margen neto', fmt.pct(m.kpis.margenNeto), 'Proyección: ' + fmt.pct(ps.margenNeto));
    } else if (type === 'balance') {
      const liqP = last.bal.pasivosCorrientes ? last.bal.corrientes / last.bal.pasivosCorrientes : null;
      minis = mini('Activo total', cop(B.activos.total), 'Al cierre proyectado: ' + cop(last.bal.activos)) + mini('Pasivo total', cop(B.pasivos.total), 'Al cierre proyectado: ' + cop(last.bal.pasivos)) +
        mini('Patrimonio', cop(B.patrimonio), 'Al cierre proyectado: ' + cop(last.bal.patrimonio)) + mini('Liquidez corriente', fmt.times(m.kpis.liquidezCorriente), 'Al cierre proyectado: ' + fmt.times(liqP));
    } else {
      const sumR = (f) => util.sum(pf.rows, f);
      minis = mini('Flujo de operación', cop(L.flujoOperativo, { signed: true }), 'Proyección: ' + cop(sumR((x) => x.flujoOper), { signed: true })) + mini('Flujo de inversión', cop(-L.inversion, { signed: true }), 'Proyección: ' + cop(sumR((x) => x.flujoInv), { signed: true })) +
        mini('Flujo de financiación', cop(L.prestamos + L.aportes - L.abonos - L.retiros, { signed: true }), 'Proyección: ' + cop(sumR((x) => x.flujoFin), { signed: true })) + mini('Efectivo al cierre', cop(m.kpis.caja), 'Proyectado: ' + cop(last.caja));
    }
    const showChart = type !== 'balance';
    body.innerHTML =
      '<div class="sim__kpis">' + minis + '</div>' +
      (showChart ? '<section class="card" style="margin-bottom:16px">' + cardHead(type === 'resultados' ? 'chart' : 'wallet', type === 'resultados' ? 'Ventas y utilidad neta' : 'Efectivo al cierre de cada mes', 'Real y proyectado', '<span id="estLegend"></span>') + '<div class="chart-box" id="estChart"></div></section>' : '') +
      '<section class="card card--flush">' + '<div style="padding:20px 20px 0">' + cardHead('receipt', MF.statements.TITLES[type], o.vista === 'resumen' ? 'Totales del período histórico y del proyectado' : 'Mes a mes') + '</div>' + MF.statements.tableHtml(type, m, pf, o) + '</section>' +
      '<p class="explain est-note">' + (type === 'resultados'
        ? 'La depreciación se calcula en línea recta según la vida útil de tus activos y el impuesto de renta es una estimación (' + (m.saldos.regimen === 'simple' ? 'régimen simple' : 'tarifa ' + fmt.pct(m.saldos.tasaRenta == null ? 0.35 : m.saldos.tasaRenta, 0)) + '). Valídalo con tu contador.'
        : type === 'balance'
          ? 'El patrimonio inicial se calcula como activos menos pasivos a la fecha de inicio. La porción corriente de las obligaciones financieras corresponde a los abonos de los próximos 12 meses.'
          : 'Método indirecto: parte de la utilidad neta, suma lo que no es caja (depreciación) y ajusta por los cambios en capital de trabajo.') + '</p>';
    if (!showChart) return;
    const hist = m.monthly.slice(-12);
    const labels = hist.map((x) => x.key).concat(pf.rows.map((x) => x.key));
    const nH = hist.length;
    let series;
    if (type === 'resultados') {
      series = [
        { label: 'Ventas', color: 'var(--s1)', values: hist.map((x) => x.ventas).concat(Array(pf.rows.length).fill(null)), area: true },
        { label: 'Ventas proyectadas', color: 'var(--s1)', dashed: true, values: Array(nH - 1).fill(null).concat([hist[nH - 1].ventas], pf.rows.map((x) => x.ventas)) },
        { label: 'Utilidad neta', color: 'var(--s4)', values: hist.map((x) => x.utilidadNeta).concat(Array(pf.rows.length).fill(null)) },
        { label: 'Utilidad proyectada', color: 'var(--s4)', dashed: true, values: Array(nH - 1).fill(null).concat([hist[nH - 1].utilidadNeta], pf.rows.map((x) => x.utilidad)) },
      ];
      $('#estLegend', body).innerHTML = legend([{ label: 'Ventas', color: 'var(--s1)' }, { label: 'Utilidad neta', color: 'var(--s4)' }, { label: 'Proyección', color: 'var(--muted)', dash: true }]);
      C.line($('#estChart', body), { labels, series, height: 260, shadeFrom: nH - 1, shadeLabel: 'Proyección', endDots: false, xFormat: (k2) => D.label(k2, 'tiny'), ariaLabel: 'Ventas y utilidad neta, real y proyectada' });
    } else {
      series = [
        { label: 'Efectivo', color: 'var(--s2)', values: hist.map((x) => x.caja).concat(Array(pf.rows.length).fill(null)), area: true },
        { label: 'Efectivo proyectado', color: 'var(--s2)', dashed: true, values: Array(nH - 1).fill(null).concat([hist[nH - 1].caja], pf.rows.map((x) => x.caja)) },
      ];
      $('#estLegend', body).innerHTML = legend([{ label: 'Efectivo', color: 'var(--s2)' }, { label: 'Proyección', color: 'var(--s2)', dash: true }, { label: 'Caja mínima', color: 'var(--warn)', dash: true }]);
      C.line($('#estChart', body), { labels, series, height: 260, shadeFrom: nH - 1, shadeLabel: 'Proyección', threshold: { value: pf.supuestos.cajaMinima, label: 'Caja mínima: ' + cop(pf.supuestos.cajaMinima), color: 'var(--warn)' }, xFormat: (k2) => D.label(k2, 'tiny'), ariaLabel: 'Efectivo real y proyectado' });
    }
  }

  /* ---------- Supuestos del modelo (editables, se guardan) ---------- */
  const MODEL_FIELDS = [
    ['Ventas', [['ventasBase', 'Ventas base mensuales', 'cop'], ['crecimiento', 'Crecimiento mensual', 'pct2'], ['estacionalidad', 'Aplicar la estacionalidad de tu historia', 'bool'], ['ventasPct', 'Variación de volumen', 'pct'], ['precioPct', 'Variación de precios', 'pct']]],
    ['Costos y gastos', [['costoVentasPct', 'Costo de ventas (% de las ventas)', 'pct'], ['variablesPct', 'Gastos variables (% de las ventas)', 'pct'], ['fijosBase', 'Gastos fijos mensuales', 'cop'], ['nominaBase', 'De los cuales, nómina', 'cop'], ['aumentoEnero', 'Aumento de gastos fijos cada enero', 'pct'], ['prestaciones', 'Pagar prima y cesantías en su calendario', 'bool']]],
    ['Capital de trabajo', [['dso', 'Días de cobro', 'days'], ['dio', 'Días de inventario', 'days'], ['dpo', 'Días de pago a proveedores', 'days']]],
    ['Inversiones e impuestos', [['capexPct', 'Inversión de mantenimiento (% de las ventas)', 'pct'], ['vidaUtil', 'Vida útil de nuevas inversiones', 'years'], ['regimen', 'Régimen tributario', 'regimen'], ['tasaRenta', 'Tarifa de renta (ordinario)', 'pct'], ['tasaSimple', 'Tarifa régimen simple (sobre ingresos)', 'pct']]],
    ['Financiación', [['abonoMensual', 'Abono mensual a la deuda actual', 'cop'], ['tasaDeuda', 'Tasa de la deuda actual (E.A.)', 'pct'], ['dividendos', 'Retiros o dividendos mensuales', 'cop'], ['cajaMinima', 'Caja mínima deseada', 'cop'], ['lineaCredito', 'Usar línea de crédito si la caja baja del mínimo', 'bool'], ['tasaLinea', 'Tasa de la línea de crédito (E.A.)', 'pct']]],
  ];
  const fmtSup = (val, kind) => (kind === 'cop' ? moneyInput(val) : kind === 'pct' ? fmt.num(val * 100, 1) : kind === 'pct2' ? fmt.num(val * 100, 2) : kind === 'days' || kind === 'years' ? fmt.num(val) : val);
  const showSup = (val, kind) => (kind === 'cop' ? cop(val) : kind === 'pct' || kind === 'pct2' ? fmt.pct(val, kind === 'pct2' ? 2 : 1) : kind === 'days' ? fmt.days(val) : kind === 'years' ? fmt.num(val) + ' años' : kind === 'bool' ? (val ? 'Sí' : 'No') : kind === 'regimen' ? (val === 'simple' ? 'Simple' : 'Ordinario') : String(val));

  function modelForm(body, m, view, r) {
    const st = S();
    const defs = E.modelDefaults(m);
    const ov = (st.ds.modelo = st.ds.modelo || {});
    const sup = () => Object.assign({}, defs, ov);
    const field = ([key, label, kind]) => {
      const val = sup()[key];
      const changed = key in ov;
      const hint = '<small class="sup-hint">' + (changed ? 'Calculado: ' + showSup(defs[key], kind) + ' · <button type="button" class="link-btn" data-reset="' + key + '">Restablecer</button>' : 'Calculado de tus datos') + '</small>';
      if (kind === 'bool') return '<label class="check sup-field' + (changed ? ' is-changed' : '') + '" style="grid-column:1/-1"><input type="checkbox" data-sup="' + key + '" data-kind="bool"' + (val ? ' checked' : '') + '>' + label + '</label>';
      if (kind === 'regimen') return '<label class="field sup-field' + (changed ? ' is-changed' : '') + '"><span>' + label + '</span><select class="select" data-sup="' + key + '" data-kind="regimen"><option value="ordinario"' + (val !== 'simple' ? ' selected' : '') + '>Ordinario</option><option value="simple"' + (val === 'simple' ? ' selected' : '') + '>Simple</option></select>' + hint + '</label>';
      const suf = kind === 'pct' || kind === 'pct2' ? '<b>%</b>' : kind === 'days' ? '<b>días</b>' : kind === 'years' ? '<b>años</b>' : '';
      return '<label class="field sup-field' + (changed ? ' is-changed' : '') + '"><span>' + label + '</span><span class="input-group">' + (kind === 'cop' ? '<i>$</i>' : '') + '<input class="input' + (suf ? ' has-suffix' : '') + '" data-sup="' + key + '" data-kind="' + kind + '" inputmode="decimal" value="' + esc(fmtSup(val, kind)) + '">' + suf + '</span>' + hint + '</label>';
    };
    const planes = m.context.planes;
    body.innerHTML =
      '<div class="sim"><aside class="card sim__controls model-form" aria-label="Supuestos del modelo">' +
      '<div class="sim__group"><h4>Horizonte</h4><div class="seg" role="group" aria-label="Horizonte">' + [12, 24].map((h) => '<button type="button" data-hz="' + h + '" aria-pressed="' + (sup().horizonte === h) + '">' + h + ' meses</button>').join('') + '</div></div>' +
      MODEL_FIELDS.map(([g, fields]) => '<div class="sim__group"><h4>' + g + '</h4><div class="form-grid">' + fields.map(field).join('') + '</div></div>').join('') +
      '<div class="sim__group"><h4>Planes de tu bitácora</h4><label class="check"><input type="checkbox" data-sup="incluirPlanes" data-kind="bool"' + (sup().incluirPlanes ? ' checked' : '') + '>Incluir mis planes en la proyección</label>' +
      (planes.length ? '<ul class="plan-list">' + planes.map((p) => '<li><strong>' + esc(D.label(D.month(p.fecha))) + '</strong> · ' + esc(p.titulo) + ' <span class="muted">(' + esc(impactLabel(p.impacto)) + ')</span></li>').join('') + '</ul>' : '<p class="muted">No tienes planes con impacto.</p>') +
      '<a class="btn btn--xs" href="#/datos/contexto">' + icon('edit') + 'Editar planes</a></div>' +
      '<div class="sim__group"><button class="btn btn--sm" type="button" id="supReset">' + icon('refresh') + 'Restablecer todos los supuestos</button></div>' +
      '</aside><div id="supOut"></div></div>';

    const out = $('#supOut', body);
    const paint = () => {
      const s = sup();
      const pf = E.proforma(m, s);
      const ps = pf.summary;
      const last = pf.rows[pf.rows.length - 1];
      out.innerHTML =
        '<div class="sim__kpis">' +
        mini('Efectivo al final', '<span class="' + (ps.cajaFinal < 0 ? 'neg' : '') + '">' + cop(ps.cajaFinal) + '</span>', D.label(last.key)) +
        mini('Punto más bajo', '<span class="' + (ps.cajaMin < 0 ? 'neg' : '') + '">' + cop(ps.cajaMin) + '</span>', D.label(ps.mesMin, 'long')) +
        mini(s.lineaCredito ? 'Uso máximo de la línea' : 'Financiación necesaria', cop(ps.financiacion), s.lineaCredito ? 'Para no bajar de ' + cop(s.cajaMinima) : ps.financiacion > 0 ? 'Para una caja mínima de ' + cop(s.cajaMinima) : 'No la necesitas') +
        mini('Utilidad neta', cop(ps.utilidadTotal), 'Margen ' + fmt.pct(ps.margenNeto)) +
        '</div>' +
        '<section class="card" style="margin-bottom:16px">' + cardHead('wallet', 'Efectivo proyectado', (pf.planesIncluidos.length ? 'Incluye ' + pf.planesIncluidos.length + (pf.planesIncluidos.length === 1 ? ' plan' : ' planes') : 'Sin planes') + ' · ' + (Math.abs(ps.maxDiff) < 1000 ? 'balance cuadrado ✓' : 'revisar cuadre')) +
        cashLegend([{ label: 'Proyección', color: 'var(--s2)' }]) + '<div class="chart-box" id="supChart"></div></section>' +
        '<section class="reading">' + '<div class="reading__head"><span class="card__icon" style="background:rgba(107,92,240,.25);color:#D7D2FF">' + icon('sparkles') + '</span><span class="card__title">Lectura del modelo</span><a class="btn btn--sm btn--light" href="#/estados/resultados" style="margin-left:auto">Ver estados</a></div>' +
        '<p>Con estos supuestos, en ' + pf.rows.length + ' meses venderías <strong>' + cop(ps.ventasTotal) + '</strong> con una utilidad neta de <strong>' + cop(ps.utilidadTotal) + '</strong> (margen ' + fmt.pct(ps.margenNeto) + ').</p>' +
        '<p>' + (ps.primerNegativo ? '<span class="tag tag--crit">Riesgo</span> El efectivo quedaría en negativo desde <strong>' + D.label(ps.primerNegativo, 'long') + '</strong>.' : ps.cajaMin < s.cajaMinima ? '<span class="tag tag--warn">Atención</span> El efectivo bajaría de tu mínimo de ' + cop(s.cajaMinima) + ' durante ' + ps.mesesBajoColchon + (ps.mesesBajoColchon === 1 ? ' mes' : ' meses') + '.' : '<span class="tag tag--good">Sano</span> El efectivo se mantiene sobre tu mínimo de ' + cop(s.cajaMinima) + '.') +
        (ps.impuestosPagados.length ? ' Incluye pagos de renta de ' + joinList(ps.impuestosPagados.map((x) => cop(x.value) + ' en ' + D.label(x.key, 'month'))) + '.' : '') + '</p>' +
        (pf.planesIncluidos.length ? '<p>Planes incluidos: ' + esc(joinList(pf.planesIncluidos.map((p) => p.titulo))) + '.</p>' : '') +
        '<div class="answer__actions"><button class="btn btn--sm" type="button" id="supAsk">' + icon('message') + 'Pedir recomendaciones a la IA</button></div></section>';
      cashProjection($('#supChart', out), m, [{ label: 'Proyección', color: 'var(--s2)', proj: pf }], { height: 280 });
      $('#supAsk', out).addEventListener('click', () => app().ask(pf.planesIncluidos.length ? '¿Puedo financiar mis planes?' : '¿Cuánto efectivo voy a necesitar en los próximos ' + Math.min(12, pf.rows.length) + ' meses?'));
    };
    const persist = () => {
      app().saveData({ rerender: false });
      paint();
    };
    // Vuelve a pintar el formulario sin perder la posición del panel de supuestos
    const rerender = () => {
      const top = ($('.model-form', body) || {}).scrollTop || 0;
      modelForm(body, m, view, r);
      const el = $('.model-form', body);
      if (el) el.scrollTop = top;
    };
    $$('[data-sup]', body).forEach((inp) => {
      const key = inp.dataset.sup;
      const kind = inp.dataset.kind;
      inp.addEventListener('change', () => {
        let val;
        if (kind === 'bool') val = inp.checked;
        else if (kind === 'regimen') val = inp.value;
        else if (kind === 'cop') val = readNumber(inp.value);
        else {
          const n = parseFloat(String(inp.value).replace(/\./g, '').replace(',', '.'));
          val = kind === 'pct' || kind === 'pct2' ? n / 100 : n;
        }
        if (val === '' || (typeof val === 'number' && !isFinite(val))) val = defs[key];
        if (val === defs[key] || (typeof val === 'number' && Math.abs(val - defs[key]) < 1e-9)) delete ov[key];
        else ov[key] = val;
        persist();
        rerender();
      });
    });
    $$('[data-reset]', body).forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      delete ov[b.dataset.reset];
      persist();
      rerender();
    }));
    $$('[data-hz]', body).forEach((b) => b.addEventListener('click', () => {
      const h = Number(b.dataset.hz);
      if (h === defs.horizonte) delete ov.horizonte;
      else ov.horizonte = h;
      persist();
      rerender();
    }));
    $('#supReset', body).addEventListener('click', () => {
      st.ds.modelo = {};
      persist();
      rerender();
      toast('Supuestos restablecidos a los calculados de tus datos.');
    });
    paint();
  }

  MF.views = {
    panel, analisis, estados, asistente, simulador, valoracion, datos, ajustes, emptyState, mountViz,
    // Piezas compartidas con otras vistas (finanzas personales)
    kit: { pageHead, cardHead, mini, hbarsHtml, STATUS_COLOR, SEV_LABEL, scrollChat, setComposer, liveAnswer, agentMessage, answerMeta, agentDetails, mountCharts },
  };
})(typeof window !== 'undefined' ? window : globalThis);
