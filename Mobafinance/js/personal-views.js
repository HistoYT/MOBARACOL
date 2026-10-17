/* =========================================================
   MobaFinance AI — Finanzas personales: vistas
   Resumen · Mis datos · Plan de deudas · Metas y futuro · Asistente personal
   ========================================================= */
(function (root) {
  'use strict';
  const MF = root.MF;
  const { fmt, D, util } = MF;
  const { sum } = util;
  const C = MF.charts;
  const AI = MF.ai;
  const P = MF.personal;
  const { icon, $, $$, esc, status, SEV_ICON, legend, toast, modal, confirmDialog, readNumber, moneyInput } = MF.ui;
  const { pageHead, cardHead, mini, hbarsHtml, STATUS_COLOR, SEV_LABEL, scrollChat, setComposer, liveAnswer, agentMessage, answerMeta, agentDetails, mountCharts } = MF.views.kit;
  const app = () => MF.app;
  const S = () => P.state;
  const cop = (n, o) => fmt.cop(n, o);
  const pct = (x, d = 0) => fmt.pct(x, d);
  const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
  const settings = () => app().state.settings;
  const useClaude = () => settings().provider === 'claude' && !!settings().apiKey;
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, '');

  const TABS = [['resumen', 'Resumen'], ['datos', 'Mis datos'], ['deudas', 'Plan de deudas'], ['metas', 'Metas y futuro'], ['asistente', 'Asistente personal']];
  const INFO = {
    resumen: ['Tus finanzas personales', 'Cuánto te entra, a dónde se va, qué debes, qué tienes y qué hacer primero. El motor calcula; la IA te explica.'],
    datos: ['Mis datos', 'Tus ingresos, gastos, deudas, ahorros, metas y lo que la IA debe saber de ti. Todo se guarda solo en este navegador.'],
    deudas: ['Plan de deudas', 'Cuándo sales de deudas y cuánto pagas en intereses con cada estrategia. Mueve el pago extra y mira el efecto al instante.'],
    metas: ['Metas y futuro', 'Tu fondo de emergencia, el avance de tus metas y tu patrimonio a 10 años si sigues igual o con un plan.'],
    asistente: ['Asistente personal', 'Pregúntale en tus palabras. Responde con los números de tu motor personal, no con suposiciones.'],
  };

  /* =========================================================
     Piezas comunes
     ========================================================= */
  function shell(view, sub, actions) {
    const st = S();
    const [title, desc] = INFO[sub];
    view.innerHTML =
      pageHead('Finanzas personales', title, desc, actions) +
      (st.pf.source === 'demo' ? '<div class="note note--info" style="margin-bottom:16px">' + icon('info') + '<span>Estás viendo un ejemplo: Camila, socia de Café Alto Andino. Cuando registres tus datos, reemplazarán a estos. <button class="link-btn" type="button" data-start>Empezar con mis datos ' + icon('arrowRight') + '</button></span></div>' : '') +
      '<nav class="tabs" aria-label="Secciones de finanzas personales">' + TABS.map(([k, l]) => '<a href="#/personal/' + k + '" class="' + (k === sub ? 'is-active' : '') + '"' + (k === sub ? ' aria-current="page"' : '') + '>' + l + '</a>').join('') + '</nav><div id="pBody"></div>';
    const start = $('[data-start]', view);
    if (start) start.addEventListener('click', () => startOwn());
    return $('#pBody', view);
  }
  function bindAsk(rootEl) {
    $$('[data-ask]', rootEl).forEach((b) => b.addEventListener('click', () => personal.ask(b.getAttribute('data-ask'))));
  }
  /** Guarda los datos personales, recalcula y vuelve a pintar la vista actual */
  function save(msg) {
    P.commit();
    app().render();
    if (msg) toast(msg);
  }
  async function startOwn() {
    const st = S();
    if (st.pf.source === 'user' && (st.pf.ingresos.length || st.pf.gastos.length) && !(await confirmDialog('Empezar de nuevo', 'Tus datos personales actuales se reemplazarán por una plantilla en blanco.', 'Usar plantilla', true))) return;
    const pf = P.template();
    const biz = app().state.ds && app().state.ds.profile;
    if (biz && biz.usuario && app().state.ds.source !== 'demo') pf.perfil.nombre = biz.usuario;
    P.setData(pf);
    st.chat = [];
    P.saveChat();
    app().go('#/personal/datos');
    toast('Plantilla lista: escribe los montos que apliquen y borra lo que no uses.');
  }
  const kpiCard = (ic, label, value, meta) => '<section class="card kpi span-3 lg-span-6 sm-span-6"><div class="kpi__label"><span class="card__icon">' + icon(ic) + '</span>' + esc(label) + '</div><div class="kpi__value">' + value + '</div><div class="kpi__meta">' + meta + '</div></section>';

  function insightHtml(i) {
    return (
      '<article class="insight insight--' + i.severity + '"><span class="insight__icon">' + icon(SEV_ICON[i.severity]) + '</span><div>' +
      '<div class="insight__title"><span>' + i.title + '</span> <span class="tag tag--' + ({ critical: 'crit', warning: 'warn', info: 'info', good: 'good' })[i.severity] + '">' + SEV_LABEL[i.severity] + '</span></div>' +
      '<p class="insight__body">' + i.body + '</p>' +
      '<div class="insight__foot"><button class="link-btn" type="button" data-ask="' + esc(i.ask) + '">Preguntar a la IA ' + icon('arrowRight') + '</button>' +
      (i.ctx && i.ctx.length ? '<span class="insight__ctx">' + i.ctx.map((c) => '<a class="source source--ctx" href="#/personal/datos">' + icon('sparkles') + esc(c) + '</a>').join('') + '</span>' : '') + '</div></div></article>'
    );
  }

  /* =========================================================
     Gráficos y bloques del motor personal
     ========================================================= */
  function saludHtml(R, size) {
    const h = R.health;
    return '<div class="health"><div class="health__ring">' + C.ring(h.score, h.status, size) + '<div class="health__score"><strong' + (size ? ' style="font-size:28px"' : '') + '>' + h.score + '</strong><small>de 100</small></div></div><div class="health__dims">' +
      h.dims.map((d) => '<div class="dim"><div class="dim__top"><span>' + esc(d.label) + '</span>' + status(d.status, d.score + '/100') + '</div><div class="meter" style="--c:' + STATUS_COLOR[d.status] + '"><i style="width:' + d.score + '%"></i></div><small class="muted">' + esc(d.detalle) + '</small></div>').join('') + '</div></div>';
  }
  function distribucionHtml(R) {
    const f = R.flujo;
    const ing = R.ingresos.promedio || 1;
    const parts = [
      { label: 'Básicos', value: R.gastos.necesidades, color: 'var(--s4)' },
      { label: 'Cuotas de deudas', value: R.deudas.cuotas, color: 'var(--o3)' },
      { label: 'Gustos', value: R.gastos.deseos, color: 'var(--s3)' },
      f.capacidad >= 0 ? { label: 'Te queda para ahorrar', value: f.capacidad, color: 'var(--s1)' } : { label: 'Déficit (sale de ahorros o deudas)', value: -f.capacidad, color: 'var(--crit)' },
    ].filter((p) => p.value > 0);
    const tot = sum(parts, (p) => p.value) || 1;
    return (
      '<div class="stack" style="height:22px" role="img" aria-label="A dónde va tu ingreso">' + parts.map((p) => '<span class="stack__seg" tabindex="0" style="flex:' + p.value / tot + ';--c:' + p.color + '" data-tip-title="' + esc(p.label) + '" data-tip-rows="' + esc(JSON.stringify([{ color: p.color, box: true, value: cop(p.value), label: pct(p.value / ing) + ' de tu ingreso' }])) + '"></span>').join('') + '</div>' +
      '<div class="stack-legend">' + parts.map((p) => '<div><span><i style="--c:' + p.color + '"></i>' + esc(p.label) + '</span><strong>' + cop(p.value) + '</strong><small class="muted">' + pct(p.value / ing) + ' del ingreso</small></div>').join('') + '</div>' +
      '<p class="explain">Referencia 50/30/20: básicos y cuotas hasta <strong>50 %</strong> del ingreso, gustos hasta <strong>30 %</strong> y ahorro de al menos <strong>20 %</strong>. Hoy vas en ' + pct(f.basicoPct) + ' / ' + pct(f.deseosPct) + ' / ' + pct(Math.max(0, f.ahorroPct)) + '.</p>'
    );
  }
  const gastosHtml = (R, n = 7) => hbarsHtml(R.gastos.porCategoria.slice(0, n).map((c) => ({ label: c.categoria, value: c.mensual, sub: pct(c.pct || 0, 1) + ' del ingreso' + (c.tipo === 'necesidad' ? '' : ' · gusto') })), 'var(--s3)');
  function emergenciaHtml(R) {
    const e = R.emergencia;
    const ratio = e.meta ? Math.min(1, (e.cobertura || 0) / e.meta) : 0;
    const st = (e.cobertura || 0) >= e.meta ? 'good' : (e.cobertura || 0) >= 1 ? 'warning' : 'critical';
    return '<div class="ctx-score__top"><span>Libre para imprevistos</span><b>' + fmt.months(e.cobertura || 0) + '</b></div><div class="meter" style="--c:' + STATUS_COLOR[st] + '"><i style="width:' + ratio * 100 + '%"></i></div>' +
      '<div class="goal__foot"><span>Hoy: <b>' + cop(e.libre) + '</b></span><span>Meta: ' + cop(e.objetivo) + ' (' + fmt.months(e.meta) + ')</span></div>';
  }
  function metasHtml(R, detailed) {
    if (!R.metas.items.length) return '<p class="muted">Aún no tienes metas. Agrega qué quieres lograr, cuánto cuesta y para cuándo.</p>';
    return '<div class="goals">' + R.metas.items.map((g) => {
      const st = g.cumplida ? 'good' : g.estado;
      const lab = g.cumplida ? 'Lista' : g.estado === 'good' ? 'A tiempo' : g.fechaAlcance ? 'Llega en ' + D.label(g.fechaAlcance) : 'No se alcanza';
      return '<div class="goal"><div class="dim__top"><span><b>' + esc(g.nombre) + '</b> <span class="muted">· ' + esc(g.tipoLabel) + '</span></span>' + status(st, lab) + '</div><div class="meter" style="--c:' + STATUS_COLOR[st] + '"><i style="width:' + g.avance * 100 + '%"></i></div>' +
        '<div class="goal__foot"><span>Tienes <b>' + cop(g.ahorrado) + '</b> de ' + cop(g.objetivo) + (g.usaCes ? ' + cesantías' : '') + '</span><span>Para ' + D.label(g.fecha) + '</span></div>' +
        (detailed ? '<div class="goal__foot"><span>Aportas <b>' + cop(g.aporte) + '</b> al mes' + (g.activo ? ' en «' + esc(g.activo) + '»' : '') + '</span><span>' + (g.cumplida ? '' : 'Necesitas <b>' + cop(g.requerido) + '</b> al mes') + '</span></div>' +
          (g.conCes ? '<p class="goal__note">' + icon('info') + '<span>Con tus cesantías (≈' + cop(g.conCes.cesantias) + ' para esa fecha) bastarían ' + cop(g.conCes.requerido) + ' al mes. Se pueden usar para ' + (g.tipo === 'vivienda' ? 'vivienda' : 'educación') + '.</span></p>' : '') +
          (g.id ? '<div class="goal__actions"><button class="link-btn" type="button" data-edit="metas:' + esc(g.id) + '">' + icon('edit') + 'Editar meta</button></div>' : '') : '') +
        '</div>';
    }).join('') + '</div>';
  }
  function balanceHtml(R) {
    const a = R.activos;
    const items = [['Disponible', a.disponible], ['Inversiones', a.inversiones], ['Cesantías', a.cesantias], ['Bienes', a.bienes]].filter((x) => x[1] > 0).map(([label, value]) => ({ label, value }));
    return hbarsHtml(items, 'var(--s1)') + (R.deudas.total ? '<div style="margin-top:12px">' + hbarsHtml([{ label: 'Deudas', value: R.deudas.total }], 'var(--crit)') + '</div>' : '') +
      '<p class="explain">Patrimonio neto: <strong>' + cop(R.patrimonio.neto) + '</strong> (tienes ' + cop(R.patrimonio.activos) + ' y debes ' + cop(R.patrimonio.deudas) + ').</p>';
  }
  function flujoChart(el, R, height) {
    const rows = R.proyeccion12;
    const series = [
      { label: 'Te entra', color: 'var(--s1)', values: rows.map((r) => r.ingresos) },
      { label: 'Sale (gastos y cuotas)', color: 'var(--s3)', values: rows.map((r) => r.gastos + r.cuotas + r.extraDeuda) },
    ];
    C.bars(el, { labels: rows.map((r) => r.key), series, line: { label: 'Dinero disponible', color: 'var(--s2)', values: rows.map((r) => r.liquido) }, height: height || 262, ariaLabel: 'Ingresos, salidas y dinero disponible de los próximos 12 meses' });
  }
  const flujoLegend = () => legend([{ label: 'Te entra', color: 'var(--s1)', box: true }, { label: 'Sale (gastos y cuotas)', color: 'var(--s3)', box: true }, { label: 'Dinero disponible', color: 'var(--s2)' }]);
  /** Saldo total de deudas mes a mes: solo cuotas frente a un plan */
  function deudasSeries(R, opts) {
    const a = P.payoff(R.deudas.items, { estrategia: 'minimo' });
    const b = P.payoff(R.deudas.items, opts);
    const L = Math.min(240, Math.max(a.serie.length, b.serie.length));
    const pad = (s) => Array.from({ length: L }, (_, i) => (i < s.length ? s[i] : 0));
    return { labels: Array.from({ length: L }, (_, i) => D.addMonths(R.mes0, i)), base: pad(a.serie), plan: pad(b.serie), a, b };
  }
  function deudasChart(el, R, opts, height) {
    const s = deudasSeries(R, opts);
    const series = [
      { label: 'Solo cuotas', color: 'var(--base)', dashed: true, values: s.base },
      { label: opts.estrategia === 'bola' ? 'Bola de nieve' : opts.estrategia === 'minimo' ? 'Tu plan' : 'Avalancha', color: 'var(--s2)', area: true, values: s.plan },
    ];
    C.line(el, { labels: s.labels, series, height: height || 240, endLabels: false, xFormat: (k) => D.label(k, 'tiny'), ariaLabel: 'Saldo total de tus deudas mes a mes' });
    return series;
  }
  function patrimonioChart(el, R, base, plan, labelPlan, height) {
    const series = [
      { label: 'Si sigues igual', color: 'var(--base)', dashed: true, values: base.map((r) => r.real) },
      { label: labelPlan || 'Con el plan', color: 'var(--s1)', area: true, values: plan.map((r) => r.real) },
    ];
    C.line(el, { labels: plan.map((r) => r.key), series, height: height || 250, endLabels: true, xFormat: (k) => D.label(k, 'tiny'), ariaLabel: 'Patrimonio proyectado en pesos de hoy' });
    return series;
  }

  /** Gráficos del asistente (respuestas locales y etiquetas [[grafico:ID]] de Claude) */
  function mountPViz(el, viz) {
    if (!el.isConnected) return;
    const R = S().R;
    if (!R || R.empty) return el.remove();
    const box = (h) => (el.innerHTML = h);
    switch (viz.type) {
      case 'salud':
        box(saludHtml(R, 112));
        break;
      case 'distribucion':
        box(distribucionHtml(R));
        C.bindHtmlTips(el);
        break;
      case 'gastos':
        box(gastosHtml(R));
        C.bindHtmlTips(el);
        break;
      case 'flujo12':
        box(flujoLegend() + '<div class="chart-box"></div>');
        flujoChart(el.lastChild, R, 230);
        break;
      case 'emergencia':
        box(emergenciaHtml(R));
        break;
      case 'deudas':
        if (!R.deudas.items.length) return el.remove();
        box(legend([{ label: 'Solo cuotas', color: 'var(--base)', dash: true }, { label: 'Plan sugerido (avalancha)', color: 'var(--s2)' }]) + '<div class="chart-box"></div>');
        deudasChart(el.lastChild, R, { estrategia: R.planIA.estrategia === 'minimo' ? 'avalancha' : R.planIA.estrategia, extra: R.planIA.extraDeuda, abonos: R.planIA.abonos }, 220);
        break;
      case 'deudas_simuladas':
        if (!R.deudas.items.length) return el.remove();
        box(legend([{ label: 'Solo cuotas', color: 'var(--base)', dash: true }, { label: 'Plan calculado', color: 'var(--s2)' }]) + '<div class="chart-box"></div>');
        deudasChart(el.lastChild, R, { estrategia: viz.estrategia, extra: viz.extra, abonos: viz.abonos || [] }, 220);
        break;
      case 'metas':
        box(metasHtml(R, false));
        break;
      case 'patrimonio':
        box(legend([{ label: 'Si sigues igual', color: 'var(--base)', dash: true }, { label: 'Con el plan de la IA', color: 'var(--s1)' }]) + '<div class="chart-box"></div>');
        patrimonioChart(el.lastChild, R, R.futuro.base, R.futuro.plan, 'Con el plan', 230);
        break;
      case 'plan_simulado': {
        const N = viz.N || 60;
        box(legend([{ label: 'Si sigues igual', color: 'var(--base)', dash: true }, { label: viz.label || 'Plan calculado', color: 'var(--s1)' }]) + '<div class="chart-box"></div>');
        patrimonioChart(el.lastChild, R, P.simulate(R, null, N), P.simulate(R, viz.plan, N), viz.label, 230);
        break;
      }
      case 'balance':
        box(balanceHtml(R));
        C.bindHtmlTips(el);
        break;
      default:
        el.remove();
    }
  }
  const P_CHARTS = Object.fromEntries(['salud', 'distribucion', 'gastos', 'flujo12', 'emergencia', 'deudas', 'metas', 'patrimonio', 'balance'].map((id) => [id, { type: id }]));

  /* =========================================================
     Sin datos todavía
     ========================================================= */
  function onboarding(view) {
    view.innerHTML =
      '<section class="empty"><span class="eyebrow">Finanzas personales</span><h2>Tu dinero personal, claro y con un plan</h2>' +
      '<p>Registra lo que ganas, lo que gastas, lo que debes y lo que quieres lograr. El motor arma tu presupuesto, tu fondo de emergencia, tu plan de deudas y tu proyección a 10 años; la IA te explica qué hacer primero.</p>' +
      '<div class="steps3">' +
      '<div class="step3"><div class="step3__icon">' + icon('user') + '</div><strong>1. Tus datos</strong><p>Ingresos, gastos, deudas, ahorros, metas y lo que te preocupa.</p></div>' +
      '<div class="step3"><div class="step3__icon">' + icon('cpu') + '</div><strong>2. Motor personal</strong><p>Regla 50/30/20, prima y cesantías, avalancha de deudas y proyecciones.</p></div>' +
      '<div class="step3 is-ai"><div class="step3__icon">' + icon('sparkles') + '</div><strong>3. Inteligencia artificial</strong><p>Diagnóstico, plan de acción y respuestas con tus números.</p></div></div>' +
      '<div class="page-head__actions"><button class="btn btn--primary" type="button" id="pTpl">' + icon('edit') + 'Empezar con una plantilla</button><button class="btn" type="button" id="pDemo">' + icon('refresh') + 'Ver un ejemplo</button><a class="btn btn--ghost" href="#/personal/datos">Empezar en blanco</a></div></section>';
    $('#pTpl', view).addEventListener('click', () => startOwn());
    $('#pDemo', view).addEventListener('click', () => {
      P.setData(P.demo());
      app().render();
      toast('Cargamos el ejemplo de Camila.');
    });
  }

  /* =========================================================
     RESUMEN
     ========================================================= */
  function resumen(view, R) {
    const st = S();
    const f = R.flujo;
    const body = shell(view, 'resumen', '<a class="btn btn--sm" href="#/personal/datos">' + icon('edit') + 'Editar mis datos</a><button class="btn btn--sm btn--light" type="button" id="pReport">' + icon('sparkles') + 'Informe completo</button>');
    const tasaSt = f.tasaAhorro >= 0.2 ? 'good' : f.tasaAhorro >= 0.1 ? 'warning' : 'critical';
    const chips = P.SUGGESTED.slice(0, 4).map((q) => '<button class="chip" type="button" data-ask="' + esc(q) + '">' + esc(q) + '</button>').join('');
    const plan = R.plan;
    const emp = R.empresa;
    const rep = st.report;
    body.innerHTML =
      '<section class="greet" style="margin-top:0"><div><h1>' + (R.perfil.nombre ? 'Hola, ' + esc(R.perfil.nombre) : 'Tus finanzas hoy') + '</h1><p style="max-width:90ch">' + esc(R.titular) + '</p></div></section>' +
      '<div class="grid dash-top">' +
      '<section class="ai-card span-4 lg-span-12" aria-label="Asistente personal">' + cardHead('sparkles', 'Asistente personal', null, '<a class="icon-btn" href="#/personal/asistente" aria-label="Abrir asistente" title="Abrir asistente">' + icon('arrowUp') + '</a>') +
      '<div class="ai-card__body"><h2 class="ai-card__title">¿Qué quieres saber de tu dinero?</h2><div class="chips">' + chips + '</div></div>' +
      '<form class="ask" id="pAsk"><input name="q" autocomplete="off" placeholder="Pregunta lo que quieras…" aria-label="Pregunta al asistente personal"><button class="send-btn" type="submit" aria-label="Enviar pregunta">' + icon('send') + '</button></form>' +
      '<div class="ai-card__foot">' + icon('lock') + 'Responde con los números de tu motor personal</div></section>' +
      '<div class="span-8 lg-span-12 dash-right"><div class="grid kpis">' +
      kpiCard('wallet', 'Te entra al mes', cop(R.ingresos.promedio), 'Promedio con prima' + (R.ingresos.variableShare >= 0.2 ? ' · ' + pct(R.ingresos.variableShare) + ' variable' : '')) +
      kpiCard('receipt', 'Gastos y cuotas', cop(R.gastos.mensual + R.deudas.cuotas), pct((R.gastos.mensual + R.deudas.cuotas) / (R.ingresos.promedio || 1)) + ' de tu ingreso') +
      kpiCard('piggy', f.capacidad >= 0 ? 'Te queda para ahorrar' : 'Te falta al mes', cop(Math.abs(f.capacidad)), status(tasaSt, pct(f.tasaAhorro, 1) + ' de tu ingreso')) +
      kpiCard('trendUp', 'Patrimonio neto', cop(R.patrimonio.neto), 'Tienes ' + cop(R.patrimonio.activos) + ' · debes ' + cop(R.patrimonio.deudas)) +
      '</div><section class="card chart-card">' + cardHead('chart', 'Tus próximos 12 meses', 'Con prima, cesantías y gastos de una vez al año', '<a class="btn btn--xs" href="#/personal/metas">Simular mi futuro</a>') +
      '<div style="margin-bottom:8px">' + flujoLegend() + '</div><div class="chart-box" id="pFlujo"></div></section></div></div>' +
      '<div class="grid" style="margin-top:16px">' +
      '<section class="card span-4 lg-span-6 md-span-12">' + cardHead('pulse', 'Salud financiera', 'Puntaje del motor de 0 a 100') + saludHtml(R) +
      '<div class="card__foot">' + status(R.health.status, R.health.label) + '<button class="link-btn" type="button" data-ask="¿Cómo están mis finanzas?" style="margin-left:auto">Ver diagnóstico ' + icon('arrowRight') + '</button></div></section>' +
      '<section class="card span-8 lg-span-6 md-span-12">' + cardHead('sparkles', 'Hallazgos de la IA', 'Interpretación automática de tus números y tu contexto', '<a class="btn btn--xs" href="#/personal/asistente">Abrir asistente</a>') +
      '<div class="insights">' + R.insights.slice(0, 4).map(insightHtml).join('') + '</div></section>' +
      '<section class="card span-6 lg-span-12">' + cardHead('flag', 'Tu plan de acción', 'Pasos en orden de prioridad, con su impacto') +
      (plan.length ? '<div class="flow">' + plan.map((s, i) => '<div class="flow__step' + (i === 0 ? ' is-ai' : '') + '"><span class="flow__num">' + (i + 1) + '</span><div><strong>' + esc(s.titulo) + '</strong><small style="display:block;margin-top:2px">' + s.detalle + '</small>' + (s.impacto ? '<span class="tag tag--good" style="margin-top:6px">' + esc(s.impacto) + '</span>' : '') + (s.link ? ' <a class="link-btn" href="' + esc(s.link) + '" style="font-size:12px">Ir ' + icon('arrowRight') + '</a>' : '') + '</div></div>').join('') + '</div>' : '<p class="muted">Vas bien: mantén tu ahorro y revisa tus metas cada mes.</p>') + '</section>' +
      '<section class="card span-6 lg-span-12">' + cardHead('dollar', '¿A dónde va tu ingreso?', 'Promedio mensual frente a la regla 50/30/20') + distribucionHtml(R) +
      '<h3 class="section-title" style="font-size:14px;margin:18px 0 10px">Por categoría</h3>' + gastosHtml(R, 6) + '</section>' +
      '<section class="card span-6 lg-span-12">' + cardHead('shield', 'Fondo de emergencia', 'Meta: ' + fmt.months(R.emergencia.meta) + ' de gastos esenciales', '<a class="btn btn--xs" href="#/personal/metas">Ver detalle</a>') + emergenciaHtml(R) +
      (R.emergencia.razones.length && !R.emergencia.metaManual ? '<p class="explain">Te recomendamos ' + fmt.months(R.emergencia.meta) + ' porque ' + esc(R.emergencia.razones.join(', ')) + '.</p>' : '') + '</section>' +
      '<section class="card span-6 lg-span-12">' + cardHead('target', 'Tus metas', R.metas.items.length ? R.metas.items.filter((g) => g.estado === 'good').length + ' de ' + R.metas.items.length + ' a tiempo' : 'Defínelas para que la IA mida tu avance', '<a class="btn btn--xs" href="#/personal/metas">Ver detalle</a>') + metasHtml(R, false) + '</section>' +
      (emp ? '<section class="card span-12">' + cardHead('briefcase', 'Tu ingreso y ' + esc(emp.nombre), 'Vinculado con el análisis de tu empresa en MobaFinance', '<a class="btn btn--xs" href="#/panel">Ver la empresa</a>') +
        '<div class="sim__kpis" style="margin-bottom:0">' + mini('Caja de la empresa', cop(emp.caja), 'Al ' + D.fmt(emp.corte)) + mini('Cubre gastos fijos', emp.cobertura != null ? fmt.months(emp.cobertura) : '—', emp.cobertura != null && emp.cobertura < 1.5 ? 'Por debajo de 1,5 meses' : 'Holgura razonable') + mini('Salud de la empresa', emp.salud + '/100', esc(emp.estado)) + mini('Tu colchón recomendado', fmt.months(R.emergencia.meta), emp.riesgo ? 'Más alto por el riesgo de la empresa' : 'Según tu situación') + '</div></section>' : '') +
      (rep ? '<section class="card span-12">' + cardHead('book', 'Tu último informe de la IA', 'Generado el ' + D.fmt(D.fromDate(new Date(rep.at))) + (rep.msg.kind === 'claude' ? ' con Claude' : ' con el motor local'), '<button class="btn btn--xs" type="button" id="pRepView">Ver informe</button><button class="btn btn--xs btn--light" type="button" id="pRepNew">Actualizar</button>') +
        '<p class="muted">' + esc(reportPreview(rep.msg)) + '</p></section>' : '') +
      '</div>';

    flujoChart($('#pFlujo', body), R);
    C.bindHtmlTips(body);
    bindAsk(body);
    $('#pAsk', body).addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      if (q) personal.ask(q);
    });
    $('#pReport', view).addEventListener('click', () => personal.report());
    if (rep) {
      $('#pRepView', body).addEventListener('click', () => reportModal(rep.msg));
      $('#pRepNew', body).addEventListener('click', () => personal.report());
    }
  }
  function reportPreview(msg) {
    const t = msg.kind === 'claude' ? strip(AI.md(msg.text || '')) : strip((msg.answer || {}).lead || '');
    return t.length > 280 ? t.slice(0, 277).trim() + '…' : t;
  }
  function reportModal(msg) {
    modal('<div class="modal__head"><div><span class="eyebrow">Informe de la IA</span><h2>Tus finanzas personales</h2></div><button class="icon-btn" type="button" data-close aria-label="Cerrar">' + icon('x') + '</button></div><div id="repBody"></div><div class="modal__foot"><button class="btn btn--light" type="button" data-close>Cerrar</button></div>', (el) => {
      const node = renderMessage(msg);
      node.classList.add('msg--report');
      $('#repBody', el).appendChild(node);
    });
  }

  /* =========================================================
     MIS DATOS
     ========================================================= */
  const MESES = D.MONTHS_LONG.map((m, i) => [String(i + 1), util.cap(m)]);
  const readPct = (raw) => {
    const s = String(raw ?? '').trim().replace(/\s|%/g, '');
    if (!s) return NaN;
    return (s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s)) / 100;
  };
  const NOTA = ['nota', 'Nota para la IA', 'textarea', { ph: 'Lo que los números no dicen. Ej.: «No es negociable», «Depende de los eventos», «Vence en marzo».' }];
  const FORMS = {
    ingresos: {
      uno: 'ingreso',
      nuevo: () => ({ concepto: '', tipo: 'salario', monto: 0, frecuencia: 'mensual', mes: 1, estable: true, prestaciones: false, salarioBase: 0, nota: '' }),
      fields: [
        ['concepto', 'Concepto', 'text', { ph: 'Ej.: Salario', wide: true }],
        ['tipo', 'Tipo', 'select', { options: P.INGRESO_TIPOS }],
        ['monto', 'Monto que recibes', 'money', { hint: 'Lo que te llega a la cuenta.' }],
        ['frecuencia', 'Cada cuánto', 'select', { options: P.FRECUENCIAS }],
        ['mes', 'Mes en que llega', 'select', { options: MESES, when: (x) => x.frecuencia !== 'mensual' }],
        ['estable', 'Es estable: llega siempre por el mismo valor', 'check'],
        ['prestaciones', 'Contrato laboral: recibo prima y cesantías', 'check', { when: (x) => x.tipo === 'salario' }],
        ['salarioBase', 'Salario base (antes de descuentos)', 'money', { when: (x) => x.tipo === 'salario' && x.prestaciones, hint: 'Sobre él se calculan la prima, las cesantías y sus intereses.' }],
        NOTA,
      ],
      validate: (x) => (!x.concepto ? 'Escribe el concepto.' : !(x.monto > 0) ? 'Escribe el monto.' : null),
    },
    gastos: {
      uno: 'gasto',
      nuevo: () => ({ concepto: '', categoria: 'Alimentación', tipo: 'necesidad', monto: 0, frecuencia: 'mensual', mes: 1, nota: '' }),
      fields: [
        ['concepto', 'Concepto', 'text', { ph: 'Ej.: Mercado', wide: true }],
        ['categoria', 'Categoría', 'select', { options: P.GASTO_CATS.map(([c]) => [c, c]) }],
        ['tipo', 'Tipo', 'select', { options: [['necesidad', 'Básico (necesidad)'], ['deseo', 'Gusto']], hint: 'Los gustos son lo primero que la IA te propone recortar.' }],
        ['monto', 'Monto', 'money'],
        ['frecuencia', 'Cada cuánto', 'select', { options: P.FRECUENCIAS }],
        ['mes', 'Mes en que se paga', 'select', { options: MESES, when: (x) => x.frecuencia !== 'mensual' }],
        NOTA,
      ],
      onChange: (t, form) => {
        if (t.name === 'categoria') form.elements.tipo.value = P.catTipo(t.value);
      },
      validate: (x) => (!x.concepto ? 'Escribe el concepto.' : !(x.monto > 0) ? 'Escribe el monto.' : null),
    },
    deudas: {
      uno: 'deuda',
      nuevo: () => ({ nombre: '', tipo: 'tarjeta', saldo: 0, tasa: null, cuota: 0, nota: '' }),
      fields: [
        ['nombre', 'Nombre', 'text', { ph: 'Ej.: Tarjeta de crédito', wide: true }],
        ['tipo', 'Tipo', 'select', { options: P.DEUDA_TIPOS }],
        ['saldo', 'Saldo que debes hoy', 'money'],
        ['tasa', 'Tasa efectiva anual (E.A.)', 'pct', { hint: 'Está en tu extracto. Una tarjeta suele estar entre 25 % y 30 % E.A.' }],
        ['cuota', 'Cuota mensual', 'money', { hint: 'Si la dejas vacía, la estimamos.' }],
        NOTA,
      ],
      validate: (x) => (!x.nombre ? 'Escribe el nombre de la deuda.' : !(x.saldo > 0) ? 'Escribe el saldo.' : x.tasa == null || x.tasa < 0 || x.tasa > 2 ? 'Escribe la tasa efectiva anual (por ejemplo, 26,5).' : null),
    },
    activos: {
      uno: 'ahorro o bien',
      nuevo: () => ({ nombre: '', tipo: 'cuenta', valor: 0, rentabilidad: null, nota: '' }),
      fields: [
        ['nombre', 'Nombre', 'text', { ph: 'Ej.: Cuenta de ahorros', wide: true }],
        ['tipo', 'Tipo', 'select', { options: P.ACTIVO_TIPOS.map(([v, l]) => [v, l]) }],
        ['valor', 'Valor hoy', 'money'],
        ['rentabilidad', 'Rentabilidad o valorización anual', 'pct', { hint: 'Opcional. Para un carro, negativa (por ejemplo, −10).' }],
        NOTA,
      ],
      validate: (x) => (!x.nombre ? 'Escribe el nombre.' : !(x.valor > 0) ? 'Escribe el valor.' : null),
    },
    metas: {
      uno: 'meta',
      nuevo: () => ({ nombre: '', tipo: 'otro', objetivo: 0, fecha: D.addMonths(D.month(D.today()), 12), activoId: '', ahorrado: 0, aporte: 0, usarCesantias: false, nota: '' }),
      fields: [
        ['nombre', 'Meta', 'text', { ph: 'Ej.: Cuota inicial del apartamento', wide: true }],
        ['tipo', 'Tipo', 'select', { options: P.META_TIPOS }],
        ['objetivo', 'Cuánto necesitas', 'money'],
        ['fecha', 'Para cuándo', 'month'],
        ['activoId', 'Dónde lo guardas', 'select', { options: () => [['', 'No está en una cuenta aparte']].concat(S().pf.activos.filter((a) => ['disponible', 'inversion'].includes(P.grupoDe(a.tipo))).map((a) => [a.id, a.nombre])), hint: 'Si eliges una cuenta, su saldo cuenta como lo ahorrado.' }],
        ['ahorrado', 'Lo que ya tienes ahorrado', 'money', { when: (x) => !x.activoId }],
        ['aporte', 'Cuánto aportas al mes', 'money'],
        ['usarCesantias', 'Usar mis cesantías para esta meta', 'check', { when: (x) => x.tipo === 'vivienda' || x.tipo === 'educacion' }],
        NOTA,
      ],
      validate: (x) => (!x.nombre ? 'Escribe la meta.' : !(x.objetivo > 0) ? 'Escribe cuánto necesitas.' : !/^\d{4}-\d{2}$/.test(x.fecha || '') ? 'Elige el mes de la meta.' : null),
    },
  };

  function fieldHtml(f, x) {
    const [key, label, type, o = {}] = f;
    const v = x[key];
    const ph = o.ph ? ' placeholder="' + esc(o.ph) + '"' : '';
    if (type === 'check') return '<label class="check" data-f="' + key + '" style="grid-column:1/-1"><input type="checkbox" name="' + key + '"' + (v ? ' checked' : '') + '>' + esc(label) + '</label>';
    let input = '';
    if (type === 'text') input = '<input class="input" name="' + key + '" maxlength="80" value="' + esc(v || '') + '"' + ph + '>';
    else if (type === 'select') {
      const opts = typeof o.options === 'function' ? o.options() : o.options;
      input = '<select class="select" name="' + key + '">' + opts.map(([val, l]) => '<option value="' + esc(val) + '"' + (String(v ?? '') === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    } else if (type === 'money') input = '<span class="input-group"><i>$</i><input class="input" name="' + key + '" inputmode="numeric" value="' + (Number(v) ? moneyInput(Number(v)) : '') + '"' + ph + '></span>';
    else if (type === 'pct') input = '<span class="input-group"><input class="input has-suffix" name="' + key + '" inputmode="decimal" value="' + (v != null && v !== '' && isFinite(Number(v)) ? fmt.num(Number(v) * 100, 1) : '') + '"' + ph + '><b>%</b></span>';
    else if (type === 'month') input = '<input class="input" type="month" name="' + key + '" value="' + esc(v || '') + '">';
    else if (type === 'int') input = '<input class="input" name="' + key + '" inputmode="numeric" value="' + (v != null ? esc(v) : '') + '">';
    else if (type === 'textarea') input = '<textarea class="textarea" name="' + key + '" rows="2" maxlength="300"' + ph + '>' + esc(v || '') + '</textarea>';
    return '<label class="field" data-f="' + key + '"' + (type === 'textarea' || o.wide ? ' style="grid-column:1/-1"' : '') + '><span>' + esc(label) + '</span>' + input + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</label>';
  }
  function readForm(form, fields) {
    const out = {};
    fields.forEach(([key, , type]) => {
      const el = form.elements[key];
      if (!el) return;
      if (type === 'check') out[key] = el.checked;
      else if (type === 'money') {
        const n = readNumber(el.value);
        out[key] = isFinite(n) ? Math.round(n) : 0;
      } else if (type === 'pct') {
        const n = readPct(el.value);
        out[key] = isFinite(n) ? n : null;
      } else if (type === 'int') {
        const n = parseInt(el.value, 10);
        out[key] = isFinite(n) ? n : null;
      } else if (key === 'mes') out[key] = Number(el.value) || 1;
      else out[key] = el.value.trim();
    });
    return out;
  }
  function itemModal(kind, item) {
    const F = FORMS[kind];
    const st = S();
    const isNew = !item;
    const x = Object.assign(F.nuevo(), item ? JSON.parse(JSON.stringify(item)) : {});
    modal(
      '<div class="modal__head"><div><span class="eyebrow">Mis datos</span><h2>' + (isNew ? 'Agregar ' : 'Editar ') + F.uno + '</h2></div><button class="icon-btn" type="button" data-close aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<form id="pForm" class="form-grid" novalidate>' + F.fields.map((f) => fieldHtml(f, x)).join('') + '<p class="muted" id="pErr" style="grid-column:1/-1;color:var(--crit-ink)" hidden></p></form>' +
      '<div class="modal__foot">' + (isNew ? '' : '<button class="btn btn--danger" type="button" id="pDel" style="margin-right:auto">' + icon('trash') + 'Eliminar</button>') + '<button class="btn" type="button" data-close>Cancelar</button><button class="btn btn--light" type="submit" form="pForm">Guardar</button></div>',
      (el, close) => {
        const form = $('#pForm', el);
        const sync = () => {
          const cur = Object.assign({}, x, readForm(form, F.fields));
          F.fields.forEach(([key, , , o = {}]) => {
            const node = $('[data-f="' + key + '"]', el);
            if (node && o.when) node.hidden = !o.when(cur);
          });
        };
        form.addEventListener('change', (e) => {
          if (F.onChange) F.onChange(e.target, form);
          sync();
        });
        sync();
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const v = Object.assign({}, x, readForm(form, F.fields));
          const err = F.validate ? F.validate(v) : null;
          if (err) {
            const p = $('#pErr', el);
            p.textContent = err;
            p.hidden = false;
            return;
          }
          if (kind === 'deudas' && !(v.cuota > 0)) v.cuota = 0;
          const list = st.pf[kind];
          const i = v.id ? list.findIndex((y) => y.id === v.id) : -1;
          if (i >= 0) list[i] = v;
          else list.push(Object.assign(v, { id: util.uid(kind[0]) }));
          if (st.pf.source === 'demo') st.pf.source = 'user';
          close();
          save(isNew ? 'Agregado. Tus números ya se recalcularon.' : 'Guardado. Tus números ya se recalcularon.');
        });
        const del = $('#pDel', el);
        if (del) {
          del.addEventListener('click', async () => {
            close();
            if (!(await confirmDialog('Eliminar', '«' + (x.concepto || x.nombre) + '» saldrá de tus cálculos y de lo que ve la IA.', 'Eliminar', true))) return;
            st.pf[kind] = st.pf[kind].filter((y) => y.id !== x.id);
            save('Eliminado.');
          });
        }
      }
    );
  }

  const CONTEXTO = [
    ['situacion', 'Tu situación', 'Trabajo, familia, vivienda. Ej.: Soy independiente, vivo en arriendo con mi pareja y una hija de 5 años.'],
    ['preocupaciones', 'Lo que te preocupa de tu dinero', 'Ej.: Siento que no ahorro nada y la tarjeta no baja. No quiero más deudas.'],
    ['planes', 'Tus planes', 'Ej.: Comprar apartamento en 2029, cambiar de trabajo el próximo año, un viaje en diciembre.'],
    ['preferencias', 'Cómo quieres que te responda la IA', 'Ej.: Corto y con pasos concretos; explícame los términos técnicos.'],
  ];
  const SUPUESTOS = [
    ['inflacion', 'Inflación anual', 'pct'],
    ['rentabilidad', 'Rentabilidad esperada de tus ahorros', 'pct'],
    ['aumentoIngresos', 'Aumento anual de tus ingresos', 'pct'],
    ['tasaHipoteca', 'Tasa de un crédito de vivienda', 'pct'],
    ['plazoHipoteca', 'Plazo de un crédito de vivienda (años)', 'int'],
    ['emergenciaMeses', 'Meses de colchón (vacío = lo calcula la IA)', 'int'],
  ];

  function datos(view, R) {
    const st = S();
    const pf = st.pf;
    const body = shell(view, 'datos', '<button class="btn btn--sm" type="button" id="pExport">' + icon('download') + 'Exportar respaldo</button><label class="btn btn--sm" style="cursor:pointer">' + icon('upload') + 'Importar respaldo<input type="file" id="pImport" accept=".json,application/json" hidden></label>');
    const p = pf.perfil;
    const biz = app().state.model;
    const bizName = biz && !biz.empty ? biz.profile.empresa : null;
    const row = (kind, x, cells) => '<tr>' + cells.join('') + '<td class="num"><button class="icon-btn" type="button" style="width:30px;height:30px" data-edit="' + kind + ':' + esc(x.id) + '" aria-label="Editar">' + icon('edit') + '</button></td></tr>';
    const notaCell = (name, nota, tag) => '<td><div class="cell-main"><span>' + esc(name) + (tag || '') + '</span>' + (nota ? '<small class="tx-note">' + icon('message') + esc(nota) + '</small>' : '') + '</div></td>';
    const freqTxt = (x) => (x.frecuencia === 'mensual' ? 'Mensual' : P.label(P.FRECUENCIAS, x.frecuencia) + ' · ' + D.MONTHS_LONG[(Number(x.mes) || 1) - 1]);
    const tableCard = (kind, ic, title, sub, head, rows, foot, cls) =>
      '<section class="card card--flush ' + (cls || 'span-12') + '"><div style="padding:20px 20px 0">' + cardHead(ic, title, sub, '<button class="btn btn--xs btn--light" type="button" data-add="' + kind + '">' + icon('plus') + 'Agregar</button>') + '</div>' +
      (rows.length ? '<div class="table-wrap"><table class="tbl"><thead><tr>' + head.map((h) => '<th' + (/^num:/.test(h) ? ' class="num"' : '') + '>' + h.replace(/^num:/, '') + '</th>').join('') + '<th></th></tr></thead><tbody>' + rows.join('') + '</tbody>' + (foot || '') + '</table></div>' : '<p class="muted" style="padding:0 20px 20px">Aún no tienes registros.</p>') + '</section>';

    // Siempre listamos lo que registró la persona (también lo que está en $0), con lo que calculó el motor
    const merge = (list, computed, extra) => list.map((x) => Object.assign({}, x, extra ? extra(x) : {}, (computed || []).find((c) => c.id === x.id) || {}));
    const ing = merge(pf.ingresos, R.empty ? null : R.ingresos.items, (x) => ({ mensual: P.mensualDe(x) }));
    const gastos = merge(pf.gastos, R.empty ? null : R.gastos.items, (x) => ({ mensual: P.mensualDe(x), negociable: !P.noNegociable(x.nota) })).sort((a, b) => b.mensual - a.mensual);
    const deudasL = merge(pf.deudas, R.empty ? null : R.deudas.items);
    const activosL = merge(pf.activos, R.empty ? null : R.activos.items);
    const metasL = merge(pf.metas, R.empty ? null : R.metas.items);
    const ceros = pf.gastos.filter((g) => !(Number(g.monto) > 0)).length + pf.ingresos.filter((g) => !(Number(g.monto) > 0)).length;
    const sinMonto = (x, campo) => (Number(x[campo]) > 0 ? '' : ' <span class="tag tag--warn">Sin monto</span>');

    body.innerHTML =
      '<div class="grid">' +
      '<section class="card span-12 ctx-hero"><div><span class="eyebrow">Contexto para la IA</span><h2>La IA entiende tus números; tú le cuentas lo que los números no dicen</h2><p class="muted">Lo que escribas aquí y en las notas de cada registro viaja con cada pregunta al asistente: respeta lo que marques como no negociable, tu tolerancia al riesgo, lo que te preocupa y tus planes.</p></div><div class="ctx-hero__score" id="pScore"></div></section>' +
      (ceros ? '<div class="note span-12">' + icon('info') + '<span>Tienes ' + ceros + (ceros === 1 ? ' registro' : ' registros') + ' en $0: el motor los ignora. Ábrelos para escribir el monto o elimínalos.</span></div>' : '') +
      '<section class="card span-5 lg-span-12">' + cardHead('user', 'Tu perfil', 'Ajusta tu fondo de emergencia y el contexto de la IA', '<span class="saved" id="perSaved" hidden>' + icon('check') + 'Guardado</span>') +
      '<form id="perForm" class="form-grid">' +
      '<label class="field"><span>Tu nombre</span><input class="input" name="nombre" maxlength="40" value="' + esc(p.nombre || '') + '"></label>' +
      '<label class="field"><span>Edad</span><input class="input" name="edad" inputmode="numeric" maxlength="3" value="' + esc(p.edad || '') + '"></label>' +
      '<label class="field"><span>Ciudad</span><input class="input" name="ciudad" maxlength="40" value="' + esc(p.ciudad || '') + '"></label>' +
      '<label class="field"><span>Situación laboral</span><select class="select" name="ocupacion">' + P.OCUPACIONES.map(([v, l]) => '<option value="' + v + '"' + (p.ocupacion === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Personas a cargo</span><input class="input" name="dependientes" inputmode="numeric" maxlength="2" value="' + esc(p.dependientes || 0) + '"></label>' +
      '<label class="field"><span>Vivienda</span><select class="select" name="vivienda">' + P.VIVIENDAS.map(([v, l]) => '<option value="' + v + '"' + (p.vivienda === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label class="check" style="grid-column:1/-1"><input type="checkbox" name="ingresoDeEmpresa"' + (p.ingresoDeEmpresa ? ' checked' : '') + '>Mi ingreso depende de ' + (bizName ? esc(bizName) + ', la empresa que analizo aquí' : 'la empresa que analizo en MobaFinance') + '</label>' +
      '</form></section>' +
      '<section class="card span-7 lg-span-12">' + cardHead('sparkles', 'Lo que la IA debe saber de ti', 'Se guarda automáticamente', '<span class="saved" id="ctxSaved" hidden>' + icon('check') + 'Guardado</span>') +
      '<div class="form-grid ctx-form">' + CONTEXTO.map(([k, l, ph]) => '<label class="field" style="grid-column:1/-1"><span>' + l + '</span><textarea class="textarea" data-ctx="' + k + '" rows="2" maxlength="800" placeholder="' + esc(ph) + '">' + esc(pf.contexto[k] || '') + '</textarea></label>').join('') +
      '<label class="field" style="grid-column:1/-1"><span>Tolerancia al riesgo al invertir</span><select class="select" data-ctx="riesgo">' + P.RIESGOS.map(([v, l]) => '<option value="' + v + '"' + ((pf.contexto.riesgo || '') === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label></div></section>' +
      tableCard('ingresos', 'wallet', 'Ingresos', R.empty ? 'Lo que te entra' : 'Promedio mensual con prima: ' + cop(R.ingresos.promedio), ['Concepto', 'Tipo', 'Frecuencia', 'num:Monto', 'num:Al mes'],
        ing.map((x) => row('ingresos', x, [notaCell(x.concepto, x.nota, sinMonto(x, 'monto')), '<td><span class="tag tag--muted">' + esc(P.label(P.INGRESO_TIPOS, x.tipo)) + '</span>' + (x.prestaciones ? ' <span class="tag tag--info">Prima y cesantías</span>' : '') + (x.estable === false ? ' <span class="tag tag--warn">Variable</span>' : '') + '</td>', '<td class="muted">' + freqTxt(x) + '</td>', '<td class="num">' + cop(Number(x.monto)) + '</td>', '<td class="num">' + cop(x.mensual) + '</td>']))) +
      tableCard('gastos', 'receipt', 'Gastos', R.empty ? 'Básicos y gustos' : 'Básicos ' + cop(R.gastos.necesidades) + ' · gustos ' + cop(R.gastos.deseos) + ' al mes', ['Concepto', 'Categoría', 'Tipo', 'Frecuencia', 'num:Monto', 'num:Al mes'],
        gastos.map((x) => row('gastos', x, [notaCell(x.concepto, x.nota, sinMonto(x, 'monto')), '<td class="muted">' + esc(x.categoria) + '</td>', '<td><span class="tag ' + (x.tipo === 'necesidad' ? 'tag--muted' : 'tag--info') + '">' + (x.tipo === 'necesidad' ? 'Básico' : 'Gusto') + '</span>' + (x.negociable === false ? ' <span class="tag tag--warn">No negociable</span>' : '') + '</td>', '<td class="muted">' + freqTxt(x) + '</td>', '<td class="num">' + cop(Number(x.monto)) + '</td>', '<td class="num">' + cop(x.mensual) + '</td>'])),
        R.empty ? '' : '<tfoot><tr class="total"><td colspan="5">Total al mes</td><td class="num">' + cop(R.gastos.mensual) + '</td><td></td></tr></tfoot>') +
      tableCard('deudas', 'card', 'Deudas', R.empty || !R.deudas.total ? 'Tarjetas, créditos y préstamos' : 'Debes ' + cop(R.deudas.total) + ' · cuotas de ' + cop(R.deudas.cuotas) + ' al mes', ['Deuda', 'num:Saldo', 'num:Tasa E.A.', 'num:Cuota', 'num:Termina'],
        deudasL.map((x) => row('deudas', x, [notaCell(x.nombre, x.nota), '<td class="num">' + cop(Number(x.saldo)) + '</td>', '<td class="num">' + (x.tasa != null ? pct(Number(x.tasa), 1) : '—') + '</td>', '<td class="num">' + (x.cuota ? cop(Number(x.cuota)) + (x.cuotaEstimada ? ' <span class="tag tag--muted">estimada</span>' : '') : '—') + '</td>', '<td class="num">' + (x.negAm ? '<span class="tag tag--crit">No baja</span>' : x.fin ? D.label(x.fin) : '—') + '</td>'])), '', 'span-6 lg-span-12') +
      tableCard('activos', 'piggy', 'Ahorros, inversiones y bienes', R.empty ? 'Lo que tienes' : 'Tienes ' + cop(R.activos.total), ['Nombre', 'num:Valor', 'num:Rinde al año'],
        activosL.map((x) => row('activos', x, [notaCell(x.nombre, x.nota || (x.meta ? 'Para: ' + x.meta : '')), '<td class="num">' + cop(Number(x.valor)) + '</td>', '<td class="num">' + (x.rentabilidad != null && x.rentabilidad !== '' ? pct(Number(x.rentabilidad), 1) : '—') + '</td>'])), '', 'span-6 lg-span-12') +
      tableCard('metas', 'target', 'Metas', R.empty || !R.metas.items.length ? 'Lo que quieres lograr' : 'Aportas ' + cop(R.flujo.aportes) + ' al mes', ['Meta', 'num:Objetivo', 'num:Para', 'num:Aporte', 'Estado'],
        metasL.map((x) => row('metas', x, [notaCell(x.nombre, x.nota), '<td class="num">' + cop(Number(x.objetivo)) + '</td>', '<td class="num">' + (x.fecha ? D.label(x.fecha) : '—') + '</td>', '<td class="num">' + cop(Number(x.aporte)) + '</td>', '<td>' + (x.estado ? status(x.cumplida ? 'good' : x.estado, x.cumplida ? 'Lista' : x.estado === 'good' ? 'A tiempo' : 'Atrasada') : '—') + '</td>']))) +
      '<section class="card span-12">' + cardHead('sliders', 'Supuestos de tus proyecciones', 'Cámbialos si conoces mejor tu caso; vacío = valor por defecto', '<span class="saved" id="supSaved" hidden>' + icon('check') + 'Guardado</span>') +
      '<div class="form-grid">' + SUPUESTOS.map(([k, l, t]) => {
        const val = pf.supuestos[k];
        const def = P.SUP_DEFAULTS[k];
        const shown = val == null || val === '' ? '' : t === 'pct' ? fmt.num(Number(val) * 100, 1) : String(val);
        const ph = def == null ? 'Automático' : t === 'pct' ? fmt.num(def * 100, 1) : String(def);
        return '<label class="field"><span>' + l + '</span>' + (t === 'pct' ? '<span class="input-group"><input class="input has-suffix" data-sup="' + k + '" data-kind="pct" inputmode="decimal" value="' + esc(shown) + '" placeholder="' + esc(ph) + '"><b>%</b></span>' : '<input class="input" data-sup="' + k + '" data-kind="int" inputmode="numeric" value="' + esc(shown) + '" placeholder="' + esc(ph) + '">') + '</label>';
      }).join('') + '</div></section>' +
      '<section class="card span-12">' + cardHead('database', 'Tus datos personales', st.pf.source === 'demo' ? 'Estás usando el ejemplo de Camila' : 'Guardados solo en este navegador') +
      '<div class="answer__actions" style="margin-top:0"><button class="btn btn--sm" type="button" id="pTpl2">' + icon('edit') + 'Empezar con plantilla</button><button class="btn btn--sm" type="button" id="pDemo2">' + icon('refresh') + 'Cargar el ejemplo</button><button class="btn btn--sm btn--danger" type="button" id="pWipe">' + icon('trash') + 'Borrar mis datos personales</button></div>' +
      '<p class="explain">Tus finanzas personales se guardan aparte de los datos de la empresa. Exporta un respaldo con frecuencia.</p></section>' +
      '</div>';

    const paintScore = () => {
      const cs = P.contextScore(st.pf);
      const pctTxt = Math.round(cs.score * 100);
      $('#pScore', body).innerHTML = '<div class="ctx-score"><div class="ctx-score__top"><span>La IA conoce tu situación</span><b>' + pctTxt + ' %</b></div><div class="meter" style="--c:var(--ai-accent)"><i style="width:' + pctTxt + '%"></i></div></div>' +
        (cs.missing.length ? '<ul class="ctx-todo">' + cs.missing.slice(0, 3).map((t) => '<li>' + icon('plus') + esc(t) + '</li>').join('') + '</ul>' : '<p class="ctx-done">' + icon('checkCircle') + 'Tu contexto está completo. Mantenlo al día.</p>');
    };
    paintScore();
    const flash = (id) => {
      const el = $(id, body);
      el.hidden = false;
      clearTimeout(el._t);
      el._t = setTimeout(() => (el.hidden = true), 1600);
    };
    const quiet = (id) => {
      if (st.pf.source === 'demo') st.pf.source = 'user';
      P.commit();
      paintScore();
      flash(id);
    };
    // Perfil
    $('#perForm', body).addEventListener('change', (e) => {
      const f = e.currentTarget;
      p.nombre = f.nombre.value.trim();
      const edad = parseInt(f.edad.value, 10);
      p.edad = isFinite(edad) && edad > 0 && edad < 120 ? edad : null;
      p.ciudad = f.ciudad.value.trim();
      p.ocupacion = f.ocupacion.value;
      p.dependientes = Math.max(0, parseInt(f.dependientes.value, 10) || 0);
      p.vivienda = f.vivienda.value;
      p.ingresoDeEmpresa = f.ingresoDeEmpresa.checked;
      quiet('#perSaved');
    });
    // Contexto escrito (se guarda mientras escribes)
    const fit = (ta) => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(320, ta.scrollHeight + 2) + 'px';
    };
    const saveCtx = util.debounce(() => quiet('#ctxSaved'), 600);
    $$('[data-ctx]', body).forEach((el) => {
      if (el.tagName === 'TEXTAREA') fit(el);
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        if (el.tagName === 'TEXTAREA') fit(el);
        pf.contexto[el.dataset.ctx] = el.value;
        saveCtx();
      });
    });
    // Supuestos
    $$('[data-sup]', body).forEach((inp) => inp.addEventListener('change', () => {
      const k = inp.dataset.sup;
      const raw = inp.value.trim();
      let val = null;
      if (raw) {
        const n = inp.dataset.kind === 'pct' ? readPct(raw) : parseInt(raw, 10);
        if (isFinite(n)) val = n;
      }
      if (val == null) delete pf.supuestos[k];
      else pf.supuestos[k] = val;
      inp.value = val == null ? '' : inp.dataset.kind === 'pct' ? fmt.num(val * 100, 1) : String(val);
      quiet('#supSaved');
    }));
    // Registros
    $$('[data-add]', body).forEach((b) => b.addEventListener('click', () => itemModal(b.dataset.add)));
    $$('[data-edit]', body).forEach((b) => b.addEventListener('click', () => {
      const [kind, id] = b.dataset.edit.split(':');
      itemModal(kind, st.pf[kind].find((x) => x.id === id));
    }));
    $('#pTpl2', body).addEventListener('click', () => startOwn());
    $('#pDemo2', body).addEventListener('click', async () => {
      if (st.pf.source !== 'demo' && !(await confirmDialog('Cargar el ejemplo', 'Tus datos personales se reemplazarán por los de Camila. Exporta un respaldo si quieres conservarlos.', 'Cargar ejemplo', true))) return;
      P.setData(P.demo());
      save('Cargamos el ejemplo de Camila.');
    });
    $('#pWipe', body).addEventListener('click', async () => {
      if (!(await confirmDialog('Borrar mis datos personales', 'Se eliminarán tus ingresos, gastos, deudas, ahorros, metas y contexto personal de este navegador. Los datos de la empresa no se tocan.', 'Borrar', true))) return;
      P.setData(P.blank());
      st.chat = [];
      P.saveChat();
      save('Listo. Empieza cuando quieras.');
    });
    $('#pExport', view).addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(Object.assign({ tipo: 'mobafinance-personal' }, st.pf), null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mobafinance-personal-' + D.today() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $('#pImport', view).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const pfIn = JSON.parse(await file.text());
        if (!pfIn || pfIn.tipo !== 'mobafinance-personal' || !Array.isArray(pfIn.gastos)) throw new Error('El archivo no es un respaldo de finanzas personales de MobaFinance.');
        delete pfIn.tipo;
        P.setData(Object.assign(pfIn, { source: 'user' }));
        save('Respaldo restaurado.');
      } catch (err) {
        toast(err.message || 'No pudimos leer el respaldo.', 'error');
      }
    });
  }

  /* =========================================================
     PLAN DE DEUDAS
     ========================================================= */
  function deudas(view, R) {
    const st = S();
    const body = shell(view, 'deudas', '<button class="btn btn--sm btn--light" type="button" data-ask="¿Qué deuda pago primero?">' + icon('sparkles') + 'Preguntar a la IA</button>');
    bindAsk(view);
    if (!R.deudas.items.length) {
      body.innerHTML = '<section class="card"><div class="empty" style="padding:30px 10px"><h2>No tienes deudas registradas</h2><p>Si tienes tarjetas, créditos o préstamos, agrégalos con su saldo, tasa y cuota: te mostramos cuándo sales de ellos y cuánto ahorras pagando en el orden correcto.</p><button class="btn btn--light" type="button" id="pAddD">' + icon('plus') + 'Agregar una deuda</button></div></section>';
      $('#pAddD', body).addEventListener('click', () => itemModal('deudas'));
      return;
    }
    const ui = st.ui;
    const plan = R.planIA;
    if (ui.extra == null) ui.extra = plan.extraDeuda;
    if (!ui.estrategia) ui.estrategia = 'avalancha';
    if (ui.abono == null) ui.abono = plan.abonos[0] ? { mes: plan.abonos[0].mes, monto: plan.abonos[0].monto } : { mes: 0, monto: 0 };
    const maxExtra = Math.max(500000, Math.ceil((Math.max(0, R.flujo.capacidad) * 2 + plan.liberado * 2 + plan.extraDeuda) / 100000) * 100000);
    ui.extra = Math.min(ui.extra, maxExtra);
    const meses12 = R.proyeccion12.map((r) => [r.k, D.label(r.key) + (r.prima ? ' · prima' : '')]);
    body.innerHTML =
      '<div class="sim">' +
      '<aside class="card sim__controls" aria-label="Tu plan de pago">' +
      '<div class="sim__group"><h4>Estrategia</h4><div class="seg" role="group" aria-label="Estrategia de pago" style="flex-wrap:wrap">' +
      [['avalancha', 'Avalancha'], ['bola', 'Bola de nieve'], ['minimo', 'Solo cuotas']].map(([v, l]) => '<button type="button" data-est="' + v + '" aria-pressed="' + (ui.estrategia === v) + '">' + l + '</button>').join('') + '</div>' +
      '<p class="muted" id="estTxt" style="font-size:12.5px"></p></div>' +
      '<div class="sim__group"><h4>Pago extra cada mes</h4><div class="range"><div class="range__top"><span>Además de las cuotas</span><output id="extraOut"></output></div><input type="range" id="extraIn" min="0" max="' + maxExtra + '" step="10000" value="' + ui.extra + '" aria-label="Pago extra mensual"><div class="range__scale"><span>$0</span><span>' + cop(maxExtra) + '</span></div></div>' +
      '<p class="muted" style="font-size:12.5px">Hoy te quedan ' + cop(Math.max(0, R.flujo.capacidad)) + ' al mes' + (plan.liberado > 0 ? ' y recortando ' + pct(plan.recorteDeseos) + ' tus gustos liberas ' + cop(plan.liberado) : '') + '.</p></div>' +
      '<div class="sim__group"><h4>Abono único</h4><div class="form-grid" style="grid-template-columns:minmax(0,1fr)"><label class="field"><span>Monto</span><span class="input-group"><i>$</i><input class="input" id="abMonto" inputmode="numeric" value="' + (ui.abono.monto ? moneyInput(ui.abono.monto) : '') + '" placeholder="0"></span></label>' +
      '<label class="field"><span>Mes</span><select class="select" id="abMes">' + meses12.map(([k, l]) => '<option value="' + k + '"' + (ui.abono.mes === k ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label></div>' +
      (plan.abonoPrima ? '<p class="muted" style="font-size:12.5px">Sugerencia: ' + cop(plan.abonoPrima.monto) + ' de tu prima de ' + D.label(plan.abonoPrima.key, 'month') + '.</p>' : '') + '</div>' +
      '<div class="sim__group"><button class="btn btn--sm" type="button" id="usePlan">' + icon('sparkles') + 'Usar el plan sugerido</button></div>' +
      '</aside>' +
      '<div><div class="sim__kpis" id="dKpis"></div>' +
      '<section class="card">' + cardHead('chart', 'Saldo total de tus deudas', 'Mes a mes, frente a pagar solo las cuotas') + '<div id="dLegend" style="margin-bottom:8px"></div><div class="chart-box" id="dChart"></div></section>' +
      '<section class="reading" style="margin-top:16px" id="dRead"></section>' +
      '<section class="card card--flush" style="margin-top:16px"><div style="padding:20px 20px 0">' + cardHead('card', 'Tus deudas', 'En el orden en que las terminas con tu plan', '<button class="btn btn--xs btn--light" type="button" data-add="deudas">' + icon('plus') + 'Agregar</button>') + '</div><div class="table-wrap" id="dTable"></div></section>' +
      '</div></div>';

    const EST_TXT = {
      avalancha: 'Pagas todas las cuotas y cada peso extra va a la deuda con mayor tasa. Cuando la terminas, su cuota pasa a la siguiente. Es la que menos intereses paga.',
      bola: 'Cada peso extra va a la deuda más pequeña: terminas deudas antes y eso motiva, aunque pagas algo más de intereses.',
      minimo: 'Solo pagas las cuotas actuales, sin extra. Sirve de comparación.',
    };
    const paint = () => {
      const opts = { estrategia: ui.estrategia, extra: ui.estrategia === 'minimo' ? 0 : ui.extra, abonos: ui.abono.monto > 0 && ui.abono.mes ? [{ mes: ui.abono.mes, monto: ui.abono.monto }] : [] };
      $$('[data-est]', body).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.est === ui.estrategia)));
      $('#estTxt', body).textContent = EST_TXT[ui.estrategia];
      const out = $('#extraOut', body);
      out.textContent = cop(ui.extra);
      out.classList.toggle('is-changed', ui.extra !== plan.extraDeuda);
      const inp = $('#extraIn', body);
      inp.style.setProperty('--a', '0%');
      inp.style.setProperty('--b', (ui.extra / maxExtra) * 100 + '%');
      inp.disabled = ui.estrategia === 'minimo';
      const s = deudasSeries(R, opts);
      const a = s.a;
      const b = s.b;
      const fecha = (n) => (n && isFinite(n) ? D.addMonths(R.mes0, n) : null);
      const ahorro = a.pagado && b.pagado ? a.intereses - b.intereses : null;
      const meses = b.pagado ? b.meses : null;
      $('#dKpis', body).innerHTML =
        mini('Libre de deudas', b.pagado ? D.label(fecha(b.meses)) : 'No terminas', b.pagado ? (meses < 12 ? meses + ' meses' : fmt.num(meses / 12, 1) + ' años') : 'Alguna cuota no cubre sus intereses') +
        mini('Intereses que pagas', b.pagado ? cop(b.intereses) : '—', a.pagado ? 'Solo cuotas: ' + cop(a.intereses) : 'Solo cuotas: no terminas') +
        mini('Ahorro en intereses', ahorro != null && ahorro > 0 ? cop(ahorro) : '—', ahorro != null && ahorro > 0 ? 'Frente a pagar solo cuotas' : 'Mueve el pago extra') +
        mini('Cuotas hoy', cop(R.deudas.cuotas), pct(R.flujo.endeudamiento || 0) + ' de tu ingreso');
      $('#dLegend', body).innerHTML = legend([{ label: 'Solo cuotas', color: 'var(--base)', dash: true }, { label: ui.estrategia === 'bola' ? 'Bola de nieve' : ui.estrategia === 'minimo' ? 'Solo cuotas' : 'Avalancha', color: 'var(--s2)' }]);
      C.line($('#dChart', body), { labels: s.labels, series: [{ label: 'Solo cuotas', color: 'var(--base)', dashed: true, values: s.base }, { label: 'Tu plan', color: 'var(--s2)', area: true, values: s.plan }], height: 260, endLabels: false, xFormat: (k) => D.label(k, 'tiny'), ariaLabel: 'Saldo total de deudas mes a mes' });
      const orden = R.deudas.items.slice().sort((x, y) => (b.fin[x.id] || 1e9) - (b.fin[y.id] || 1e9));
      $('#dTable', body).innerHTML = '<table class="tbl"><thead><tr><th>#</th><th>Deuda</th><th class="num">Saldo</th><th class="num">Tasa E.A.</th><th class="num">Cuota</th><th class="num">Intereses este mes</th><th class="num">Solo cuotas</th><th class="num">Con tu plan</th><th></th></tr></thead><tbody>' +
        orden.map((d, i) => '<tr><td class="muted">' + (i + 1) + '</td><td class="cell-wide"><div class="cell-main"><span>' + esc(d.nombre) + (d.cara ? ' <span class="tag tag--crit">Cara</span>' : '') + '</span>' + (d.nota ? '<small class="tx-note">' + icon('message') + esc(d.nota) + '</small>' : '') + '</div></td><td class="num">' + cop(d.saldo) + '</td><td class="num">' + pct(d.tasa, 1) + '</td><td class="num">' + cop(d.cuota) + '</td><td class="num">' + cop(d.interesMes) + '</td><td class="num muted">' + (a.fin[d.id] ? D.label(fecha(a.fin[d.id])) : 'No termina') + '</td><td class="num"><b>' + (b.fin[d.id] ? D.label(fecha(b.fin[d.id])) : 'No termina') + '</b></td><td class="num"><button class="icon-btn" type="button" style="width:30px;height:30px" data-edit="deudas:' + esc(d.id) + '" aria-label="Editar">' + icon('edit') + '</button></td></tr>').join('') + '</tbody></table>';
      $$('[data-edit]', $('#dTable', body)).forEach((btn) => btn.addEventListener('click', () => itemModal('deudas', st.pf.deudas.find((x) => x.id === btn.dataset.edit.split(':')[1]))));
      const cara = R.deudas.items.slice().sort((x, y) => y.tasa - x.tasa)[0];
      const negAm = R.deudas.negAm;
      $('#dRead', body).innerHTML = '<div class="reading__head"><span class="card__icon" style="background:rgba(107,92,240,.25);color:#D7D2FF">' + icon('sparkles') + '</span><strong>Lectura de la IA</strong></div>' +
        (negAm.length ? '<p><strong>Ojo:</strong> la cuota de tu ' + esc(lowerFirst(negAm[0].nombre)) + ' no alcanza a cubrir sus intereses; necesitas pagar al menos ' + cop(negAm[0].interesMes * 1.25) + ' al mes o refinanciarla.</p>' : '') +
        '<p>' + (b.pagado ? 'Con ' + (ui.estrategia === 'minimo' ? 'solo las cuotas' : (ui.estrategia === 'bola' ? 'bola de nieve' : 'avalancha') + (opts.extra ? ' y ' + cop(opts.extra) + ' extra al mes' : '')) + (opts.abonos.length ? ', más un abono de ' + cop(opts.abonos[0].monto) : '') + ', sales de deudas en <strong>' + D.label(fecha(b.meses), 'long') + '</strong>' + (ahorro > 50000 ? ' y te ahorras <strong>' + cop(ahorro) + '</strong> en intereses frente a pagar solo las cuotas.' : '.') : 'Con este plan no terminas de pagar: sube el pago extra o revisa las cuotas.') + '</p>' +
        (cara && cara.cara ? '<p>Tu ' + esc(lowerFirst(cara.nombre)) + ' cobra ' + pct(cara.tasa, 1) + ' E.A.: pagarla te «rinde» más que casi cualquier ahorro. ' + (cara.tipo === 'tarjeta' ? 'Mientras la pagas, no sigas comprando con ella.' : 'Pide que los abonos vayan a capital.') + '</p>' : '') +
        '<div class="answer__actions"><button class="chip chip--dark" type="button" data-q="¿Qué deuda pago primero?">¿Qué deuda pago primero?</button><button class="chip chip--dark" type="button" data-q="¿Qué hago con mi prima?">¿Qué hago con mi prima?</button><button class="chip chip--dark" type="button" data-q="' + esc('¿Me conviene pagar ' + cop(opts.extra || 200000) + ' extra al mes a mis deudas o ahorrarlos?') + '">¿Abono o ahorro?</button></div>';
      $$('[data-q]', $('#dRead', body)).forEach((x) => x.addEventListener('click', () => personal.ask(x.dataset.q)));
    };
    paint();
    $$('[data-est]', body).forEach((b) => b.addEventListener('click', () => {
      ui.estrategia = b.dataset.est;
      paint();
    }));
    const inp = $('#extraIn', body);
    inp.addEventListener('input', () => {
      ui.extra = Number(inp.value);
      paint();
    });
    $('#abMonto', body).addEventListener('change', (e) => {
      const n = readNumber(e.target.value);
      ui.abono.monto = isFinite(n) && n > 0 ? Math.round(n) : 0;
      e.target.value = ui.abono.monto ? moneyInput(ui.abono.monto) : '';
      if (!ui.abono.mes) ui.abono.mes = 1;
      paint();
    });
    $('#abMes', body).addEventListener('change', (e) => {
      ui.abono.mes = Number(e.target.value);
      paint();
    });
    $('#usePlan', body).addEventListener('click', () => {
      ui.estrategia = plan.estrategia === 'minimo' ? 'avalancha' : plan.estrategia;
      ui.extra = plan.extraDeuda;
      ui.abono = plan.abonos[0] ? { mes: plan.abonos[0].mes, monto: plan.abonos[0].monto } : { mes: 0, monto: 0 };
      inp.value = ui.extra;
      $('#abMonto', body).value = ui.abono.monto ? moneyInput(ui.abono.monto) : '';
      if (ui.abono.mes) $('#abMes', body).value = ui.abono.mes;
      paint();
    });
    $$('[data-add]', body).forEach((b) => b.addEventListener('click', () => itemModal(b.dataset.add)));
  }

  /* =========================================================
     METAS Y FUTURO
     ========================================================= */
  function metas(view, R) {
    const st = S();
    const body = shell(view, 'metas', '<button class="btn btn--sm btn--light" type="button" data-ask="¿Voy a lograr mis metas?">' + icon('sparkles') + 'Preguntar a la IA</button>');
    const e = R.emergencia;
    const v = R.vivienda;
    const plan = R.planIA;
    if (!st.ui.sim) st.ui.sim = { recorte: plan.recorteDeseos, ingresoExtra: 0, extraDeuda: plan.extraDeuda, rent: plan.rentabilidadLibre, anios: 10 };
    const sim = st.ui.sim;
    const mitad = Math.max(0, R.flujo.capacidad) * 0.5;
    const range = (id, label, min, max, step, val, fmtV) => '<div class="range"><div class="range__top"><span>' + label + '</span><output id="' + id + 'Out">' + fmtV(val) + '</output></div><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" aria-label="' + esc(label) + '"></div>';
    const maxIng = Math.max(1000000, Math.ceil((R.ingresos.promedio * 0.5) / 100000) * 100000);
    const maxDeu = Math.max(500000, Math.ceil((Math.max(0, R.flujo.capacidad) * 2 + plan.extraDeuda) / 100000) * 100000);
    body.innerHTML =
      '<div class="grid">' +
      '<section class="card span-5 lg-span-12">' + cardHead('shield', 'Fondo de emergencia', 'Tu primer seguro: el dinero que te sostiene si pierdes tu ingreso') + emergenciaHtml(R) +
      '<div class="ctx-list" style="margin-top:16px">' +
      [['Gastos esenciales al mes', cop(e.esenciales)], ['Meta recomendada', fmt.months(e.meta) + ' · ' + cop(e.objetivo)], ['Te falta', e.faltante > 0 ? cop(e.faltante) : 'Nada: está completo'], ['Ya reservado para metas', cop(Math.max(0, R.activos.disponible - e.libre))]].map(([a, b2]) => '<div class="ctx-row"><span>' + a + '</span><b>' + b2 + '</b></div>').join('') + '</div>' +
      (e.razones.length && !e.metaManual ? '<p class="explain">' + fmt.months(e.meta) + ' porque ' + esc(e.razones.join(', ')) + '.</p>' : '') +
      (e.faltante > 0 ? '<p class="explain">' + (mitad > 0 ? 'Con la mitad de lo que te sobra (' + cop(mitad) + ' al mes) lo completas en unos <strong>' + Math.ceil(e.faltante / mitad) + ' meses</strong>.' : 'Hoy no te sobra dinero: primero libera gastos.') + '</p>' : '') +
      '<div class="answer__actions"><button class="chip chip--dark" type="button" data-ask="¿Cómo armo mi fondo de emergencia?">¿Cómo lo armo?</button></div></section>' +
      '<section class="card span-7 lg-span-12">' + cardHead('target', 'Tus metas', R.metas.items.length ? 'Aportas ' + cop(R.flujo.aportes) + ' al mes y te quedan ' + cop(Math.max(0, R.flujo.capacidad)) + ' después de gastos y cuotas' : 'Qué quieres lograr, cuánto cuesta y para cuándo', '<button class="btn btn--xs btn--light" type="button" data-add="metas">' + icon('plus') + 'Agregar meta</button>') +
      (R.flujo.aportes > Math.max(0, R.flujo.capacidad) + 1000 ? '<div class="note" style="margin-bottom:14px">' + icon('alert') + '<span>Te comprometiste a ahorrar más de lo que te sobra (' + cop(R.flujo.aportes - Math.max(0, R.flujo.capacidad)) + ' de diferencia al mes). Ajusta los aportes o libera gastos.</span></div>' : '') +
      metasHtml(R, true) + '</section>' +
      (v ? '<section class="card span-12">' + cardHead('home', '¿Te alcanza para vivienda?', 'Referencia con una tasa de ' + pct(v.tasa, 1) + ' E.A. a ' + v.plazo + ' años (cámbiala en Mis datos → Supuestos)', '<button class="btn btn--xs" type="button" data-ask="¿Me alcanza para comprar vivienda?">Preguntar a la IA</button>') +
        '<div class="sim__kpis" style="margin-bottom:0">' + mini('Cuota máxima (30 %)', cop(v.cuotaMax), 'De un ingreso de ' + cop(v.ingreso)) + mini('Crédito posible', cop(v.creditoMax), 'Vivienda de hasta ' + cop(v.precioPorCredito)) +
        (v.precioMeta ? mini('Tu vivienda objetivo', cop(v.precioMeta), 'Cuota de ' + cop(v.cuotaMeta) + ' (' + pct(v.pctMeta) + ' del ingreso)') : mini('Cuota inicial hoy', cop(v.inicialHoy), 'Ahorro para vivienda y cesantías')) + mini('Arriendo actual', v.arriendo ? cop(v.arriendo) : '—', 'Gastos de vivienda al mes') + '</div></section>' : '') +
      '<section class="card span-12">' + cardHead('sliders', 'Simula tu futuro', 'Patrimonio (lo que tienes menos lo que debes) en pesos de hoy, mes a mes') +
      '<div class="sim" style="margin-top:4px">' +
      '<div class="sim__controls" style="position:static;max-height:none">' +
      '<div class="presets"><button class="chip chip--dark" type="button" id="simPlan">' + icon('sparkles') + 'Plan de la IA</button><button class="chip chip--dark" type="button" id="simReset">Seguir igual</button></div>' +
      range('sRec', 'Recortar tus gustos', 0, 50, 5, Math.round(sim.recorte * 100), (x) => x + ' %') +
      range('sIng', 'Ingreso extra al mes', 0, maxIng, 50000, sim.ingresoExtra, (x) => cop(Number(x))) +
      (R.deudas.items.length ? range('sDeu', 'Pago extra a deudas', 0, maxDeu, 10000, sim.extraDeuda, (x) => cop(Number(x))) : '') +
      range('sRen', 'Rentabilidad de lo que ahorras (E.A.)', 0, 15, 0.5, Math.round(sim.rent * 1000) / 10, (x) => fmt.num(Number(x), 1) + ' %') +
      range('sAn', 'Horizonte', 1, 10, 1, sim.anios, (x) => x + (Number(x) === 1 ? ' año' : ' años')) +
      '</div><div><div class="sim__kpis" id="sKpis"></div><div id="sLegend" style="margin-bottom:8px"></div><div class="chart-box" id="sChart"></div><div id="sHitos"></div></div></div></section>' +
      '</div>';

    bindAsk(body);
    $$('[data-add]', body).forEach((b) => b.addEventListener('click', () => itemModal(b.dataset.add)));
    $$('[data-edit]', body).forEach((b) => b.addEventListener('click', () => {
      const [kind, id] = b.dataset.edit.split(':');
      itemModal(kind, st.pf[kind].find((x) => x.id === id));
    }));
    const paintSim = () => {
      const N = sim.anios * 12;
      const planSim = { recorteDeseos: sim.recorte, ingresoExtra: sim.ingresoExtra, extraDeuda: sim.extraDeuda, estrategia: sim.extraDeuda > 0 ? 'avalancha' : 'minimo', abonos: [], rentabilidadLibre: sim.rent };
      const base = P.simulate(R, null, N);
      const rows = P.simulate(R, planSim, N);
      const fin = rows[N - 1];
      const finB = base[N - 1];
      const libre = (rs) => (R.deudas.total <= 0 ? 'Sin deudas' : (rs.find((x) => x.deuda <= 0.5) || {}).key);
      const lp = libre(rows);
      const minLiq = rows.slice(0, 12).reduce((a, x) => (x.liquido < a.liquido ? x : a), rows[0]);
      $('#sKpis', body).innerHTML =
        mini('Patrimonio en ' + sim.anios + (sim.anios === 1 ? ' año' : ' años'), cop(fin.real), 'Si sigues igual: ' + cop(finB.real)) +
        mini('Diferencia', cop(fin.real - finB.real, { signed: true }), 'En pesos de hoy') +
        mini('Libre de deudas', lp === 'Sin deudas' ? 'Ya' : lp ? D.label(lp) : 'Después', lp && lp !== 'Sin deudas' ? (libre(base) && libre(base) !== lp ? 'Igual: ' + D.label(libre(base)) : 'Con tus cuotas') : '') +
        mini('Mes más apretado', cop(minLiq.liquido), util.cap(D.label(minLiq.key, 'long')));
      $('#sLegend', body).innerHTML = legend([{ label: 'Si sigues igual', color: 'var(--base)', dash: true }, { label: 'Con estos cambios', color: 'var(--s1)' }]);
      patrimonioChart($('#sChart', body), R, base, rows, 'Con estos cambios', 270);
      const hitos = [];
      rows.forEach((x) => x.eventos.filter((ev) => /^(Meta lista|Terminas de pagar)/.test(ev)).forEach((ev) => hitos.push([x.key, ev])));
      $('#sHitos', body).innerHTML = hitos.length ? '<div class="levers">' + hitos.slice(0, 8).map(([k, ev]) => '<div class="lever">' + esc(D.label(k)) + '<b>' + esc(ev) + '</b></div>').join('') + '</div>' : '';
      const set = (id, txt) => {
        const o = $('#' + id + 'Out', body);
        if (o) o.textContent = txt;
      };
      set('sRec', Math.round(sim.recorte * 100) + ' %');
      set('sIng', cop(sim.ingresoExtra));
      set('sDeu', cop(sim.extraDeuda));
      set('sRen', fmt.num(sim.rent * 100, 1) + ' %');
      set('sAn', sim.anios + (sim.anios === 1 ? ' año' : ' años'));
      $$('input[type=range]', body).forEach((r) => {
        r.style.setProperty('--a', '0%');
        r.style.setProperty('--b', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
      });
    };
    const bindR = (id, apply) => {
      const el = $('#' + id, body);
      if (el) el.addEventListener('input', () => {
        apply(Number(el.value));
        paintSim();
      });
    };
    bindR('sRec', (x) => (sim.recorte = x / 100));
    bindR('sIng', (x) => (sim.ingresoExtra = x));
    bindR('sDeu', (x) => (sim.extraDeuda = x));
    bindR('sRen', (x) => (sim.rent = x / 100));
    bindR('sAn', (x) => (sim.anios = x));
    const setRanges = () => {
      const put = (id, val) => {
        const el = $('#' + id, body);
        if (el) el.value = val;
      };
      put('sRec', Math.round(sim.recorte * 100));
      put('sIng', sim.ingresoExtra);
      put('sDeu', sim.extraDeuda);
      put('sRen', Math.round(sim.rent * 1000) / 10);
      put('sAn', sim.anios);
      paintSim();
    };
    $('#simPlan', body).addEventListener('click', () => {
      Object.assign(sim, { recorte: plan.recorteDeseos, ingresoExtra: 0, extraDeuda: plan.extraDeuda, rent: plan.rentabilidadLibre });
      setRanges();
    });
    $('#simReset', body).addEventListener('click', () => {
      Object.assign(sim, { recorte: 0, ingresoExtra: 0, extraDeuda: 0, rent: R.activos.rentLibre });
      setRanges();
    });
    paintSim();
  }

  /* =========================================================
     ASISTENTE PERSONAL
     ========================================================= */
  function asistente(view, R) {
    const st = S();
    const claude = useClaude();
    const effort = (AI.EFFORTS[settings().effort] || 'Profundo').toLowerCase();
    const body = shell(view, 'asistente', '<a class="ai-status' + (claude ? ' is-claude' : '') + '" href="#/ajustes"><i></i><span>' + (claude ? 'Claude · análisis ' + esc(effort) : 'Motor local') + '</span></a><button class="btn btn--sm btn--light" type="button" id="pRep">' + icon('book') + 'Informe completo</button><button class="btn btn--sm" type="button" id="clearChat">' + icon('refresh') + 'Nueva conversación</button>');
    const cs = P.contextScore(st.pf);
    const csPct = Math.round(cs.score * 100);
    body.innerHTML =
      '<div class="chat-layout"><section class="chat" aria-label="Conversación"><div class="chat__log" id="chatLog"></div>' +
      '<form class="composer" id="composer"><label class="sr-only" for="chatInput">Tu pregunta</label><textarea id="chatInput" rows="1" placeholder="Ej.: ¿Me conviene abonar a la tarjeta o ahorrar para el apartamento?"></textarea><button class="send-btn" type="submit" id="sendBtn" aria-label="Enviar">' + icon('send') + '</button></form></section>' +
      '<aside class="context-panel">' +
      (R.empty ? '' : '<section class="card">' + cardHead('cpu', 'Lo que ve la IA', 'Resultados de tu motor personal') + '<div class="ctx-list">' +
        [['Te entra al mes', cop(R.ingresos.promedio)], ['Gastos y cuotas', cop(R.gastos.mensual + R.deudas.cuotas)], [R.flujo.capacidad >= 0 ? 'Te queda' : 'Te falta', cop(Math.abs(R.flujo.capacidad))], ['Deudas', cop(R.deudas.total)], ['Colchón libre', fmt.months(R.emergencia.cobertura || 0)], ['Patrimonio neto', cop(R.patrimonio.neto)], ['Salud financiera', R.health.score + '/100']].map(([a, b2]) => '<div class="ctx-row"><span>' + a + '</span><b>' + b2 + '</b></div>').join('') +
        '</div>' + (R.empresa ? '<div class="card__foot"><span>También ve la caja de ' + esc(R.empresa.nombre) + '</span></div>' : '') + '</section>') +
      '<section class="card">' + cardHead('sparkles', 'Tu contexto', 'La IA lo usa en cada respuesta') +
      '<div class="ctx-score"><div class="ctx-score__top"><span>La IA conoce tu situación</span><b>' + csPct + ' %</b></div><div class="meter" style="--c:var(--ai-accent)"><i style="width:' + csPct + '%"></i></div></div>' +
      (cs.missing.length ? '<p class="explain ctx-next">' + icon('info') + '<span><strong>Siguiente paso:</strong> ' + esc(cs.missing[0]) + '</span></p>' : '') +
      '<div class="answer__actions"><a class="btn btn--sm btn--light" href="#/personal/datos">' + icon('edit') + 'Editar mi contexto</a></div></section>' +
      '<section class="card">' + cardHead('message', 'Preguntas sugeridas') + '<div class="chips" style="justify-content:flex-start">' + P.SUGGESTED.slice(5).map((q) => '<button class="chip chip--dark" type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div></section>' +
      '</aside></div>';

    const log = $('#chatLog', body);
    if (!st.chat.length) log.innerHTML = chatEmpty();
    else st.chat.forEach((msg) => log.appendChild(renderMessage(msg)));
    bindEmpty(log);
    $$('[data-q]', body).forEach((b) => b.addEventListener('click', () => chat.send(b.dataset.q)));
    const input = $('#chatInput', body);
    const grow = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(160, input.scrollHeight) + 'px';
    };
    input.addEventListener('input', grow);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('#composer', body).requestSubmit();
      }
    });
    $('#composer', body).addEventListener('submit', (e) => {
      e.preventDefault();
      if (st.streaming) {
        st.streaming.abort();
        return;
      }
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      grow();
      chat.send(q);
    });
    $('#clearChat', view).addEventListener('click', () => {
      if (st.streaming) st.streaming.abort();
      st.chat = [];
      P.saveChat();
      log.innerHTML = chatEmpty();
      bindEmpty(log);
      input.focus();
    });
    $('#pRep', view).addEventListener('click', () => chat.send(P.REPORT_PROMPT, { report: true, label: 'Hazme un análisis completo de mis finanzas personales.' }));
    if (st.pendingReport) {
      st.pendingReport = false;
      chat.send(P.REPORT_PROMPT, { report: true, label: 'Hazme un análisis completo de mis finanzas personales.' });
    } else if (st.pending) {
      const q = st.pending;
      st.pending = null;
      chat.send(q);
    } else scrollChat(log, true);
  }

  function chatEmpty() {
    return '<div class="chat-empty"><span class="chat-empty__icon">' + icon('sparkles') + '</span><h2>¿Qué quieres entender de tu dinero?</h2><p>Pregúntame como le preguntarías a alguien de confianza que sabe de finanzas. Te respondo con tus números, tus metas y lo que me contaste de ti.</p><div class="suggest-grid">' +
      P.SUGGESTED.slice(0, 6).map((q) => '<button class="suggest" type="button" data-sq="' + esc(q) + '">' + icon('sparkles') + '<span>' + esc(q) + '</span></button>').join('') + '</div></div>';
  }
  function bindEmpty(log) {
    $$('[data-sq]', log).forEach((b) => b.addEventListener('click', () => chat.send(b.dataset.sq)));
  }
  function buildHistory(msgs) {
    const out = [];
    msgs.slice(-12).forEach((mm) => {
      if (mm.role === 'user') out.push({ role: 'user', content: mm.q || mm.text });
      else if (mm.kind === 'claude' && mm.text) out.push({ role: 'assistant', content: mm.text });
      else if (mm.kind === 'local' && mm.answer) out.push({ role: 'assistant', content: P.answerToText(mm.answer) });
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  /** Informe completo sin Claude: une las respuestas clave del motor local */
  function localReport(R) {
    const qs = ['¿Cómo están mis finanzas?', '¿Cuánto debería ahorrar al mes?', '¿Qué deuda pago primero?', '¿Cómo armo mi fondo de emergencia?', '¿Voy a lograr mis metas?', '¿Cuánto tendré en 10 años?'];
    const parts = qs.map((q) => P.answer(q, R));
    const sections = parts.map((a) => ({ heading: strip(a.title), items: [a.lead].concat(((a.sections || [])[0] || { items: [] }).items).filter(Boolean).slice(0, 4) }));
    sections.push({ heading: 'Tu plan para los próximos 90 días', ordered: true, items: R.plan.map((s) => '<strong>' + esc(s.titulo) + '.</strong> ' + s.detalle + (s.impacto ? ' <span class="muted">(' + esc(s.impacto) + ')</span>' : '')) });
    return {
      title: 'Tu informe financiero personal: ' + R.health.label.toLowerCase() + ' (' + R.health.score + '/100)',
      lead: esc(R.titular),
      sections,
      viz: { type: 'salud' },
      followups: ['¿Qué deuda pago primero?', '¿Dónde puedo recortar gastos?'],
      contextUsed: Array.from(new Set(parts.flatMap((a) => a.contextUsed || []))),
    };
  }

  function renderMessage(msg) {
    const wrap = document.createElement('div');
    if (msg.role === 'user') {
      wrap.className = 'msg msg--user';
      const bub = document.createElement('div');
      bub.className = 'msg__bubble';
      bub.textContent = msg.text;
      wrap.appendChild(bub);
      return wrap;
    }
    wrap.className = 'msg';
    const meta = answerMeta(msg, msg.fecha ? ' · tus datos al ' + D.fmt(msg.fecha) : '');
    if (msg.kind === 'claude') {
      wrap.innerHTML = '<span class="msg__avatar">' + icon('sparkles') + '</span><article class="answer"><div class="answer__md">' + AI.md(msg.text || '') + '</div>' + agentDetails(msg) + meta + '</article>';
      mountCharts(wrap, msg, P_CHARTS, mountPViz);
      return wrap;
    }
    const a = msg.answer || {};
    let h = '<span class="msg__avatar">' + icon('sparkles') + '</span><article class="answer' + (msg.error ? ' is-error' : '') + '">';
    if (msg.error) h += '<div class="note" style="margin-bottom:12px">' + icon('alert') + '<span>' + esc(msg.error) + ' Esta es la respuesta del motor local.</span></div>';
    h += '<h3 class="answer__title">' + (a.title || '') + '</h3>' + (a.lead ? '<p class="answer__lead">' + a.lead + '</p>' : '');
    (a.sections || []).forEach((s) => {
      if (!s || !s.items || !s.items.length) return;
      const tag = s.ordered ? 'ol' : 'ul';
      h += '<div class="answer__section"><h5>' + esc(s.heading) + '</h5><' + tag + '>' + s.items.map((i) => '<li>' + i + '</li>').join('') + '</' + tag + '></div>';
    });
    if (a.viz) h += '<div class="answer__viz" data-viz></div>';
    if (a.contextUsed && a.contextUsed.length) h += '<div class="answer__sources"><span>Tu contexto</span>' + a.contextUsed.map((c) => '<a class="source source--ctx" href="#/personal/datos">' + icon('sparkles') + esc(c) + '</a>').join('') + '</div>';
    if ((a.followups && a.followups.length) || a.action) {
      h += '<div class="answer__actions">' + (a.action ? '<a class="btn btn--sm btn--light" href="' + esc(a.action.route) + '">' + esc(a.action.label) + icon('arrowRight') + '</a>' : '') + (a.followups || []).map((f) => '<button class="chip chip--dark" type="button" data-fq="' + esc(f) + '">' + esc(f) + '</button>').join('') + '</div>';
    }
    h += meta + '</article>';
    wrap.innerHTML = h;
    $$('[data-fq]', wrap).forEach((b) => b.addEventListener('click', () => chat.send(b.dataset.fq)));
    const vizEl = $('[data-viz]', wrap);
    if (vizEl) requestAnimationFrame(() => mountPViz(vizEl, a.viz));
    return wrap;
  }

  const chat = {
    async send(q, opts = {}) {
      const st = S();
      const log = $('#chatLog');
      if (!log || st.busy || !q) return;
      const R = P.get().R;
      const empty = log.querySelector('.chat-empty');
      if (empty) empty.remove();
      const userMsg = { role: 'user', text: opts.label || q, q, at: Date.now() };
      st.chat.push(userMsg);
      log.appendChild(renderMessage(userMsg));
      const claude = useClaude() && !R.empty;
      const effort = settings().effort;
      const pending = document.createElement('div');
      pending.className = 'msg';
      pending.innerHTML = '<span class="msg__avatar">' + icon('sparkles') + '</span><article class="answer"><div class="thinking">' +
        '<div class="thinking__step is-on"><i></i>Leyendo tus datos' + (R.empty ? '' : ' · ' + R.ingresos.items.length + ' ingresos, ' + R.gastos.items.length + ' gastos, ' + R.deudas.items.length + ' deudas') + '</div>' +
        '<div class="thinking__step"><i></i>Motor personal · presupuesto, deudas, metas y proyección</div>' +
        '<div class="thinking__step"><i></i>' + (claude ? 'Claude está analizando tus números' : 'Interpretando resultados') + '</div></div></article>';
      log.appendChild(pending);
      scrollChat(log);
      st.busy = true;
      setComposer(true, claude);
      const steps = $$('.thinking__step', pending);
      const advance = (i) => steps.forEach((s, j) => {
        s.classList.toggle('is-done', j < i);
        s.classList.toggle('is-on', j === i);
      });
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      let msg = null;
      try {
        if (!claude) {
          await wait(240);
          advance(1);
          await wait(260);
          advance(2);
          await wait(240);
          msg = { role: 'assistant', kind: 'local', answer: opts.report && !R.empty ? localReport(R) : P.answer(q, R), at: Date.now(), fecha: R.empty ? null : R.hoy };
        } else {
          advance(1);
          await wait(180);
          advance(2);
          const live = liveAnswer(pending, log);
          let res;
          try {
            const { stream, done } = await P.askClaude({ apiKey: settings().apiKey, question: q, history: buildHistory(st.chat.slice(0, -1)), R, effort, onText: live.text, onThinking: live.thinking, onTool: live.tool });
            st.streaming = stream;
            res = await done;
          } catch (err) {
            live.stop();
            if (err.aborted) msg = { role: 'assistant', kind: 'claude', text: (err.partial || live.latest() || '') + '\n\n*Respuesta detenida.*', at: Date.now(), model: AI.MODEL, fecha: R.hoy };
            else msg = { role: 'assistant', kind: 'local', answer: opts.report ? localReport(R) : P.answer(q, R), at: Date.now(), fecha: R.hoy, error: err.message };
          }
          if (res) {
            live.stop();
            msg = agentMessage(res, effort, null);
            msg.fecha = R.hoy;
            if (res.stopReason === 'refusal' || !res.text.trim()) {
              msg = { role: 'assistant', kind: 'local', answer: opts.report ? localReport(R) : P.answer(q, R), at: Date.now(), fecha: R.hoy, error: 'El modelo no completó esta respuesta; te muestro la del motor local.' };
            }
          }
        }
        st.chat.push(msg);
        pending.replaceWith(renderMessage(msg));
        if (opts.report && !msg.error && !/Respuesta detenida/.test(msg.text || '')) {
          st.report = { at: Date.now(), msg };
          P.saveReport();
        }
      } finally {
        st.busy = false;
        st.streaming = null;
        setComposer(false);
        P.saveChat();
        scrollChat(log);
      }
    },
  };

  /* =========================================================
     Vista y API
     ========================================================= */
  const personal = {
    render(view, r) {
      const st = P.get();
      const sub = INFO[r.sub] ? r.sub : 'resumen';
      const R = st.R;
      if (R.empty && sub !== 'datos' && sub !== 'asistente') return onboarding(view);
      ({ resumen, datos, deudas, metas, asistente })[sub](view, R, r);
    },
    /** Lleva una pregunta al asistente personal desde cualquier vista */
    ask(q) {
      if (!q) return;
      const r = app().state.route;
      if (r.name === 'personal' && r.sub === 'asistente' && $('#chatLog')) return chat.send(q);
      S().pending = q;
      app().go('#/personal/asistente');
    },
    /** Pide el informe completo (Claude o motor local) en el asistente personal */
    report() {
      const r = app().state.route;
      if (r.name === 'personal' && r.sub === 'asistente' && $('#chatLog')) return chat.send(P.REPORT_PROMPT, { report: true, label: 'Hazme un análisis completo de mis finanzas personales.' });
      S().pendingReport = true;
      app().go('#/personal/asistente');
    },
    mountViz: mountPViz,
    chat,
  };

  MF.views.personal = personal;
})(typeof window !== 'undefined' ? window : globalThis);
