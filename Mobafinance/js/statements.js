/* =========================================================
   MobaFinance AI — Estados financieros
   Estructura formal (resultados, situación financiera, flujo de efectivo)
   para históricos y proyectados, render en tabla, Excel con formato y PDF.
   ========================================================= */
(function (root) {
  'use strict';
  const MF = root.MF;
  const { fmt, D, util } = MF;
  const esc = util.esc;
  const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';

  /* ---------- Columnas: meses históricos, meses proyectados y totales ---------- */
  function columns(model, pf, opts) {
    const o = Object.assign({ periodo: 'ambos', vista: 'mensual' }, opts);
    const hist = model.monthly.map((m, i) => ({
      id: 'h' + i, kind: 'hist', key: m.key, label: D.label(m.key, 'tiny'), long: D.label(m.key),
      pyg: m, bal: m.bal, cf: Object.assign({}, m.cf, { prestamos: m.prestamos, abonos: -m.abonos, aportes: m.aportes, retiros: -m.retiros }),
      cajaIni: i ? model.monthly[i - 1].caja : model.saldos.cajaInicial,
    }));
    const lastM = model.monthly[model.monthly.length - 1];
    const lastCaja = lastM.caja;
    // El capital y las utilidades retenidas iniciales no cambian en la proyección
    const keep = { capital: lastM.bal.capital, retenidas: lastM.bal.retenidas, aportesAcum: lastM.bal.aportesAcum };
    const proj = pf.rows.map((r, i) => ({
      id: 'p' + i, kind: 'proj', key: r.key, label: D.label(r.key, 'tiny'), long: D.label(r.key),
      pyg: Object.assign({}, r, { utilidadNeta: r.utilidad, otrosIngresos: r.otrosIngresos }), bal: Object.assign({}, keep, r.bal), cf: r.cf,
      cajaIni: i ? pf.rows[i - 1].caja : lastCaja,
    }));
    const sumCols = (cols, kind, label, long) => (cols.length ? { id: kind + 'T', kind, total: true, label, long, parts: cols, bal: cols[cols.length - 1].bal, cajaIni: cols[0].cajaIni } : null);
    const hTot = sumCols(hist, 'hist', 'Total histórico', D.label(hist[0].key) + ' – ' + D.label(hist[hist.length - 1].key));
    const pTot = proj.length ? sumCols(proj, 'proj', 'Total proyectado', D.label(proj[0].key) + ' – ' + D.label(proj[proj.length - 1].key)) : null;
    if (o.vista === 'resumen') {
      const apertura = { id: 'ap', kind: 'hist', total: true, opening: true, label: 'Apertura', long: D.fmt(model.meta.inicio), bal: openingBal(model) };
      const out = [];
      if (o.periodo !== 'proyeccion') out.push(hTot);
      if (o.periodo !== 'historico' && pTot) out.push(pTot);
      return { cols: out, apertura };
    }
    let cols = [];
    if (o.periodo !== 'proyeccion') cols = cols.concat(hist, [hTot]);
    if (o.periodo !== 'historico') cols = cols.concat(proj, pTot ? [pTot] : []);
    return { cols };
  }

  function openingBal(model) {
    const o = model.opening;
    const s = model.saldos;
    const capital = s.capitalSocial != null && s.capitalSocial !== '' && isFinite(Number(s.capitalSocial)) ? Number(s.capitalSocial) : o.patrimonio;
    return {
      caja: o.caja, cxc: o.cxc, antProv: o.antProv, inventario: o.inventario, afBruto: o.afBruto, depAcum: 0, afNeto: o.afBruto,
      cxp: o.cxp, cxpCapex: o.cxpCapex, antCli: o.antCli, impuestos: o.impuestos, deuda: o.deuda, deudaCP: Math.min(o.deuda, (model.kpis.abonosMes || 0) * 12),
      deudaLP: Math.max(0, o.deuda - Math.min(o.deuda, (model.kpis.abonosMes || 0) * 12)), linea: 0,
      activos: o.activos, pasivos: o.pasivos, patrimonio: o.patrimonio, capital, retenidas: o.patrimonio - capital, utilidadAcum: 0, aportesAcum: 0, diff: 0,
    };
  }

  /* ---------- Definición de los estados ---------- */
  // tipo de fila: sec (título de sección), line, sub (subtotal), total, pct, check
  const v = (f) => (c) => {
    if (c.total && c.parts) return util.sum(c.parts, (p) => f(p) || 0);
    return f(c);
  };
  const pygv = (field) => v((c) => c.pyg[field]);
  const ratio = (num, den) => (c) => {
    const n = num(c);
    const d = den(c);
    return d ? n / d : null;
  };

  const PYG = [
    { t: 'line', label: 'Ventas', f: pygv('ventas'), bold: true },
    { t: 'line', label: '(−) Costo de ventas', f: pygv('cogs') },
    { t: 'sub', label: 'Utilidad bruta', f: pygv('utilidadBruta') },
    { t: 'pct', label: 'Margen bruto', f: ratio(pygv('utilidadBruta'), pygv('ventas')) },
    { t: 'line', label: '(−) Gastos fijos (nómina, arriendo, servicios…)', f: pygv('fijos'), indent: 1 },
    { t: 'line', label: '(−) Gastos variables (transporte, ICA…)', f: pygv('variables'), indent: 1 },
    { t: 'sub', label: 'EBITDA', f: pygv('ebitda') },
    { t: 'pct', label: 'Margen EBITDA', f: ratio(pygv('ebitda'), pygv('ventas')) },
    { t: 'line', label: '(−) Depreciación', f: pygv('depreciacion') },
    { t: 'sub', label: 'Utilidad operativa', f: pygv('utilidadOperativa') },
    { t: 'line', label: '(−) Gastos financieros', f: pygv('financieros') },
    { t: 'line', label: '(+) Otros ingresos', f: pygv('otrosIngresos') },
    { t: 'sub', label: 'Utilidad antes de impuestos', f: pygv('uai') },
    { t: 'line', label: '(−) Impuesto de renta (estimado)', f: pygv('impuesto') },
    { t: 'total', label: 'Utilidad neta', f: pygv('utilidadNeta') },
    { t: 'pct', label: 'Margen neto', f: ratio(pygv('utilidadNeta'), pygv('ventas')) },
  ];

  const bal = (field) => (c) => (c.bal ? c.bal[field] || 0 : null);
  const BALANCE = [
    { t: 'sec', label: 'Activo' },
    { t: 'line', label: 'Efectivo y equivalentes', f: bal('caja'), indent: 1 },
    { t: 'line', label: 'Cuentas por cobrar comerciales', f: bal('cxc'), indent: 1 },
    { t: 'line', label: 'Anticipos a proveedores', f: bal('antProv'), indent: 1, optional: true },
    { t: 'line', label: 'Inventarios', f: bal('inventario'), indent: 1 },
    { t: 'sub', label: 'Total activo corriente', f: (c) => (c.bal ? c.bal.caja + c.bal.cxc + c.bal.antProv + c.bal.inventario : null) },
    { t: 'line', label: 'Propiedad, planta y equipo', f: bal('afBruto'), indent: 1 },
    { t: 'line', label: '(−) Depreciación acumulada', f: (c) => (c.bal ? -c.bal.depAcum : null), indent: 1 },
    { t: 'sub', label: 'Total activo no corriente', f: (c) => (c.bal ? c.bal.afBruto - c.bal.depAcum : null) },
    { t: 'total', label: 'TOTAL ACTIVO', f: bal('activos') },
    { t: 'sec', label: 'Pasivo' },
    { t: 'line', label: 'Proveedores y cuentas por pagar', f: (c) => (c.bal ? c.bal.cxp + c.bal.cxpCapex : null), indent: 1 },
    { t: 'line', label: 'Anticipos de clientes', f: bal('antCli'), indent: 1, optional: true },
    { t: 'line', label: 'Impuesto de renta por pagar', f: bal('impuestos'), indent: 1 },
    { t: 'line', label: 'Obligaciones financieras de corto plazo', f: bal('deudaCP'), indent: 1 },
    { t: 'sub', label: 'Total pasivo corriente', f: (c) => (c.bal ? c.bal.cxp + c.bal.cxpCapex + c.bal.antCli + c.bal.impuestos + c.bal.deudaCP : null) },
    { t: 'line', label: 'Obligaciones financieras de largo plazo', f: bal('deudaLP'), indent: 1 },
    { t: 'sub', label: 'Total pasivo no corriente', f: bal('deudaLP') },
    { t: 'total', label: 'TOTAL PASIVO', f: bal('pasivos') },
    { t: 'sec', label: 'Patrimonio' },
    { t: 'line', label: 'Capital social', f: (c) => (c.bal ? c.bal.capital : null), indent: 1, hist: true },
    { t: 'line', label: 'Utilidades retenidas al inicio', f: (c) => (c.bal ? c.bal.retenidas : null), indent: 1, hist: true },
    { t: 'line', label: 'Resultados desde el inicio del análisis', f: (c) => (c.bal ? c.bal.patrimonio - c.bal.capital - c.bal.retenidas - (c.bal.aportesAcum || 0) : null), indent: 1 },
    { t: 'line', label: 'Aportes y retiros de socios', f: (c) => (c.bal ? c.bal.aportesAcum || 0 : null), indent: 1, optional: true },
    { t: 'total', label: 'TOTAL PATRIMONIO', f: bal('patrimonio') },
    { t: 'total', label: 'TOTAL PASIVO + PATRIMONIO', f: (c) => (c.bal ? c.bal.pasivos + c.bal.patrimonio : null) },
    { t: 'check', label: 'Cuadre (activo − pasivo − patrimonio)', f: (c) => (c.bal ? c.bal.activos - c.bal.pasivos - c.bal.patrimonio : null) },
  ];

  const cfv = (field) => v((c) => (c.cf ? c.cf[field] || 0 : 0));
  const FLUJO = [
    { t: 'sec', label: 'Actividades de operación' },
    { t: 'line', label: 'Utilidad neta', f: cfv('utilidadNeta'), indent: 1 },
    { t: 'line', label: '(+) Depreciación', f: cfv('depreciacion'), indent: 1 },
    { t: 'line', label: '(Aumento) disminución en cuentas por cobrar', f: cfv('cxc'), indent: 1 },
    { t: 'line', label: '(Aumento) disminución en inventarios', f: cfv('inventario'), indent: 1 },
    { t: 'line', label: '(Aumento) disminución en anticipos a proveedores', f: cfv('antProv'), indent: 1, optional: true },
    { t: 'line', label: 'Aumento (disminución) en proveedores', f: cfv('cxp'), indent: 1 },
    { t: 'line', label: 'Aumento (disminución) en impuestos por pagar', f: cfv('impuestos'), indent: 1 },
    { t: 'line', label: 'Aumento (disminución) en anticipos de clientes', f: cfv('antCli'), indent: 1, optional: true },
    { t: 'sub', label: 'Flujo de efectivo de operación', f: cfv('operacion') },
    { t: 'sec', label: 'Actividades de inversión' },
    { t: 'line', label: 'Compras de propiedad, planta y equipo', f: cfv('inversion'), indent: 1 },
    { t: 'sub', label: 'Flujo de efectivo de inversión', f: cfv('inversion') },
    { t: 'sec', label: 'Actividades de financiación' },
    { t: 'line', label: 'Préstamos recibidos', f: cfv('prestamos'), indent: 1 },
    { t: 'line', label: 'Abonos a obligaciones financieras', f: cfv('abonos'), indent: 1 },
    { t: 'line', label: 'Aportes de socios', f: cfv('aportes'), indent: 1, optional: true },
    { t: 'line', label: 'Retiros y dividendos', f: cfv('retiros'), indent: 1, optional: true },
    { t: 'sub', label: 'Flujo de efectivo de financiación', f: cfv('financiacion') },
    { t: 'total', label: 'Variación neta del efectivo', f: cfv('neto') },
    { t: 'line', label: 'Efectivo al inicio del período', f: (c) => c.cajaIni },
    { t: 'total', label: 'Efectivo al final del período', f: (c) => (c.bal ? c.bal.caja : null) },
  ];

  const DEFS = { resultados: PYG, balance: BALANCE, flujo: FLUJO };
  const TITLES = { resultados: 'Estado de resultados', balance: 'Estado de situación financiera', flujo: 'Estado de flujos de efectivo' };

  /** Filas evaluadas: [{ def, values[] }] (omite filas opcionales en cero) */
  function evaluate(type, cols) {
    return DEFS[type]
      .map((def) => ({ def, values: def.t === 'sec' ? cols.map(() => null) : cols.map((c) => def.f(c)) }))
      .filter((r) => !r.def.optional || r.values.some((x) => x && Math.abs(x) > 1));
  }

  /* ---------- Tabla HTML (cifras en millones) ---------- */
  /** El balance es una foto: sin columnas de total en la vista mensual y con rótulos de cierre */
  function forType(type, cols, apertura) {
    if (type !== 'balance') return cols;
    const out = (apertura ? [apertura] : []).concat(cols.filter((c) => !(c.total && c.parts) || apertura));
    return out.map((c) => (c.total && c.parts ? Object.assign({}, c, { label: c.kind === 'proj' ? 'Cierre proyectado' : 'Al corte' }) : c));
  }

  function tableHtml(type, model, pf, opts) {
    const { cols, apertura } = columns(model, pf, opts);
    const all = forType(type, cols, apertura);
    const rows = evaluate(type, all);
    const mm = (x, t) => {
      if (x == null || !isFinite(x)) return '';
      if (t === 'pct') return fmt.pct(x);
      if (t === 'check') return Math.abs(x) < 1000 ? '<span class="pos">✓ 0</span>' : '<span class="neg">' + fmt.num(x / 1e6, 1) + '</span>';
      return fmt.num(x / 1e6, 1);
    };
    const head =
      '<tr class="est-group"><th></th>' +
      groupHeaders(all) +
      '</tr><tr><th>Concepto</th>' +
      all.map((c) => '<th class="num' + (c.kind === 'proj' ? ' is-proj' : '') + (c.total ? ' is-total' : '') + '" title="' + esc(c.long || '') + '">' + esc(c.label) + '</th>').join('') +
      '</tr>';
    const body = rows
      .map((r) => {
        const d = r.def;
        if (d.t === 'sec') return '<tr class="est-sec"><td colspan="' + (all.length + 1) + '">' + esc(d.label) + '</td></tr>';
        const cls = { sub: 'strong', total: 'total', pct: 'pct', check: 'est-check' }[d.t] || '';
        return '<tr class="' + cls + '"><td' + (d.indent ? ' class="ind"' : '') + '>' + esc(d.label) + '</td>' + r.values.map((x, i) => '<td class="num' + (all[i].kind === 'proj' ? ' is-proj' : '') + (all[i].total ? ' is-total' : '') + (x < 0 && d.t !== 'check' ? ' neg-num' : '') + '">' + mm(x, d.t) + '</td>').join('') + '</tr>';
      })
      .join('');
    return '<div class="table-wrap est-wrap"><table class="tbl tbl--sticky tbl--compact est"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }
  function groupHeaders(cols) {
    // Agrupa columnas consecutivas por tipo (Histórico / Proyección)
    let h = '';
    let i = 0;
    while (i < cols.length) {
      const kind = cols[i].kind;
      let j = i;
      while (j < cols.length && cols[j].kind === kind) j++;
      h += '<th colspan="' + (j - i) + '" class="' + (kind === 'proj' ? 'is-proj' : 'is-hist') + '">' + (kind === 'proj' ? 'Proyección' : 'Histórico') + '</th>';
      i = j;
    }
    return h;
  }

  /* ---------- Excel con formato (ExcelJS, se carga bajo demanda) ---------- */
  let exPromise = null;
  function loadExcelJS() {
    if (root.ExcelJS) return Promise.resolve(root.ExcelJS);
    if (!exPromise) {
      exPromise = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = EXCELJS_URL;
        sc.async = true;
        sc.onload = () => (root.ExcelJS ? resolve(root.ExcelJS) : reject(new Error('No se pudo cargar el generador de Excel.')));
        sc.onerror = () => {
          exPromise = null;
          reject(new Error('No se pudo cargar el generador de Excel. Revisa tu conexión a internet.'));
        };
        document.head.appendChild(sc);
      });
    }
    return exPromise;
  }

  /** «Café Alto Andino S.A.S.» → «Cafe-Alto-Andino-S-A-S» */
  const fileSafe = (s) => String(s || 'empresa').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
  const NAVY = 'FF0B1F3A';
  const BLUE = 'FF1560BD';
  const MONEY = '#,##0;[Red]-#,##0';
  const PCT = '0.0%;[Red]-0.0%';

  async function exportExcel({ model, pf, ds, supuestos }) {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'MobaFinance AI';
    wb.created = new Date();
    const empresa = model.profile.empresa || 'Mi empresa';
    const { cols } = columns(model, pf, { periodo: 'ambos', vista: 'mensual' });

    const titleBlock = (ws, title, sub) => {
      ws.getCell('A1').value = empresa;
      ws.getCell('A1').font = { bold: true, size: 15, color: { argb: NAVY } };
      ws.getCell('A2').value = title;
      ws.getCell('A2').font = { bold: true, size: 12 };
      ws.getCell('A3').value = sub;
      ws.getCell('A3').font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };
    };

    const statementSheet = (type, sheetName) => {
      const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      const all = type === 'balance' ? [Object.assign(columns(model, pf, { vista: 'resumen' }).apertura, { label: 'Apertura ' + D.fmt(model.meta.inicio) })].concat(forType('balance', cols, null)) : cols;
      titleBlock(ws, TITLES[type], 'Cifras en pesos colombianos (COP). Histórico calculado de tus movimientos; proyección según la hoja «Supuestos». Generado por MobaFinance AI el ' + D.fmtLong(D.today()) + '.');
      // Fila 4: grupos; fila 5: encabezados
      const r4 = ws.getRow(4);
      const r5 = ws.getRow(5);
      r5.getCell(1).value = 'Concepto';
      all.forEach((c, i) => {
        const cell = r5.getCell(i + 2);
        cell.value = c.total ? c.label : c.long;
        const g = r4.getCell(i + 2);
        g.value = c.kind === 'proj' ? 'Proyección' : 'Histórico';
        [cell, g].forEach((x) => {
          x.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.kind === 'proj' ? BLUE : NAVY } };
          x.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      });
      r5.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      r5.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      r4.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      r5.height = 30;
      let rowN = 6;
      evaluate(type, all).forEach((r) => {
        const d = r.def;
        const row = ws.getRow(rowN++);
        row.getCell(1).value = (d.indent ? '   ' : '') + d.label;
        if (d.t === 'sec') {
          row.getCell(1).font = { bold: true, color: { argb: NAVY } };
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3FA' } };
          return;
        }
        r.values.forEach((x, i) => {
          const cell = row.getCell(i + 2);
          cell.value = x == null || !isFinite(x) ? null : d.t === 'pct' ? x : Math.round(x);
          cell.numFmt = d.t === 'pct' ? PCT : MONEY;
          if (all[i].kind === 'proj') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F8FE' } };
          if (all[i].total) cell.font = { bold: true };
        });
        if (d.t === 'sub' || d.t === 'total') {
          row.font = { bold: true };
          row.eachCell((cell) => (cell.border = { top: { style: d.t === 'total' ? 'medium' : 'thin', color: { argb: 'FF9CA3AF' } } }));
        }
        if (d.t === 'pct' || d.t === 'check') row.font = { italic: true, color: { argb: 'FF6B7280' }, size: 9 };
      });
      ws.getColumn(1).width = 48;
      for (let i = 2; i <= all.length + 1; i++) ws.getColumn(i).width = 14;
      return ws;
    };

    // Resumen
    const res = wb.addWorksheet('Resumen', { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1 } });
    titleBlock(res, 'Resumen financiero', 'Período histórico: ' + D.label(model.meta.months[0]) + ' – ' + D.label(model.kpis.mes) + ' · Proyección: ' + (pf.rows.length ? D.label(pf.rows[0].key) + ' – ' + D.label(pf.rows[pf.rows.length - 1].key) : '—'));
    const k = model.kpis;
    const L = model.LTM;
    const ps = pf.summary;
    const lastP = pf.rows[pf.rows.length - 1];
    const resumen = [
      ['Indicador', 'Histórico (12 meses)', 'Proyección'],
      ['Ventas', L.ventas, ps.ventasTotal],
      ['EBITDA', L.ebitda, ps.ebitdaTotal],
      ['Utilidad neta', L.utilidadNeta, ps.utilidadTotal],
      ['Margen neto', k.margenNeto, ps.margenNeto],
      ['Efectivo al cierre', k.caja, lastP ? lastP.caja : null],
      ['Punto más bajo de caja', null, ps.cajaMin],
      ['Financiación necesaria', null, ps.financiacion],
      ['Obligaciones financieras', k.deuda, lastP ? lastP.bal.deuda : null],
      ['Patrimonio', model.balance.patrimonio, lastP ? lastP.bal.patrimonio : null],
      ['Salud financiera (0–100)', model.health.score, null],
    ];
    resumen.forEach((r, i) => {
      const row = res.getRow(5 + i);
      r.forEach((x, j) => {
        const cell = row.getCell(j + 1);
        cell.value = x == null ? null : x;
        if (i === 0) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        } else if (j > 0 && typeof x === 'number') cell.numFmt = r[0] === 'Margen neto' ? PCT : r[0].startsWith('Salud') ? '0' : MONEY;
      });
    });
    res.getColumn(1).width = 34;
    res.getColumn(2).width = 22;
    res.getColumn(3).width = 22;
    const notes = [
      'Notas',
      'Los estados históricos se calculan a partir de los movimientos registrados: ventas y gastos por fecha de factura, caja por fecha real de pago.',
      'La depreciación es en línea recta según la vida útil. El impuesto de renta es una estimación (' + (model.saldos.regimen === 'simple' ? 'régimen simple' : 'tarifa ' + fmt.pct(model.saldos.tasaRenta || 0.35, 0)) + '); valídalo con tu contador.',
      'La proyección usa los supuestos de la hoja «Supuestos»' + (pf.planesIncluidos.length ? ' e incluye los planes de tu bitácora' : '') + '. El balance cuadra en todos los meses.',
    ];
    notes.forEach((t, i) => {
      const c = res.getCell('A' + (18 + i));
      c.value = t;
      c.font = i === 0 ? { bold: true } : { size: 9, color: { argb: 'FF374151' } };
    });

    statementSheet('resultados', 'Estado de resultados');
    statementSheet('balance', 'Situación financiera');
    statementSheet('flujo', 'Flujo de efectivo');

    // Indicadores por mes
    const ind = wb.addWorksheet('Indicadores', { views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }] });
    titleBlock(ind, 'Indicadores', 'Calculados por el motor financiero para cada mes.');
    const indDefs = [
      ['Margen bruto', (c) => (c.pyg && c.pyg.ventas ? c.pyg.utilidadBruta / c.pyg.ventas : null), PCT],
      ['Margen EBITDA', (c) => (c.pyg && c.pyg.ventas ? c.pyg.ebitda / c.pyg.ventas : null), PCT],
      ['Margen neto', (c) => (c.pyg && c.pyg.ventas ? c.pyg.utilidadNeta / c.pyg.ventas : null), PCT],
      ['Liquidez corriente (veces)', (c) => (c.bal && c.bal.pasivosCorrientes ? c.bal.corrientes / c.bal.pasivosCorrientes : null), '0.00'],
      ['Endeudamiento', (c) => (c.bal && c.bal.activos ? c.bal.pasivos / c.bal.activos : null), PCT],
      ['Días de cobro', (c) => (c.pyg && c.pyg.dso != null ? c.pyg.dso : null), '0'],
      ['Efectivo', (c) => (c.bal ? c.bal.caja : null), MONEY],
    ];
    const monthsOnly = cols.filter((c) => !c.total);
    const ir5 = ind.getRow(5);
    ir5.getCell(1).value = 'Indicador';
    monthsOnly.forEach((c, i) => (ir5.getCell(i + 2).value = (c.kind === 'proj' ? 'Proy. ' : '') + c.long));
    ir5.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: 'center', wrapText: true };
    });
    indDefs.forEach(([label, f, nf], i) => {
      const row = ind.getRow(6 + i);
      row.getCell(1).value = label;
      monthsOnly.forEach((c, j) => {
        const x = f(c);
        const cell = row.getCell(j + 2);
        cell.value = x == null || !isFinite(x) ? null : x;
        cell.numFmt = nf;
      });
    });
    ind.getColumn(1).width = 30;
    for (let i = 2; i <= monthsOnly.length + 1; i++) ind.getColumn(i).width = 13;

    // Supuestos
    const sup = wb.addWorksheet('Supuestos');
    titleBlock(sup, 'Supuestos del modelo proyectado', 'Edítalos en MobaFinance AI → Estados financieros → Supuestos del modelo.');
    const S = supuestos || pf.supuestos;
    const supRows = [
      ['Supuesto', 'Valor'],
      ['Horizonte (meses)', S.horizonte],
      ['Ventas base mensuales', S.ventasBase],
      ['Crecimiento mensual de ventas', S.crecimiento],
      ['Aplica estacionalidad histórica', S.estacionalidad ? 'Sí' : 'No'],
      ['Variación de volumen', S.ventasPct],
      ['Variación de precios', S.precioPct],
      ['Costo de ventas (% de ventas)', S.costoVentasPct * (1 + (S.costoPct || 0))],
      ['Gastos variables (% de ventas)', S.variablesPct],
      ['Gastos fijos mensuales', S.fijosBase * (1 + (S.fijosPct || 0))],
      ['Aumento de gastos fijos en enero', S.aumentoEnero],
      ['Prima y cesantías en su calendario', S.prestaciones ? 'Sí' : 'No'],
      ['Días de cobro', S.dso],
      ['Días de inventario', S.dio],
      ['Días de pago a proveedores', S.dpo],
      ['Inversión de mantenimiento (% de ventas)', S.capexPct],
      ['Vida útil de nuevas inversiones (años)', S.vidaUtil],
      ['Régimen tributario', S.regimen === 'simple' ? 'Simple (sobre ingresos)' : 'Ordinario (sobre utilidad)'],
      ['Tarifa de impuesto', S.regimen === 'simple' ? S.tasaSimple : S.tasaRenta],
      ['Abono mensual a la deuda actual', S.abonoMensual],
      ['Tasa de la deuda (E.A.)', S.tasaDeuda],
      ['Retiros o dividendos mensuales', S.dividendos],
      ['Caja mínima deseada', S.cajaMinima],
      ['Línea de crédito automática', S.lineaCredito ? 'Sí, al ' + fmt.pct(S.tasaLinea) + ' E.A.' : 'No'],
      ['Incluye planes de la bitácora', S.incluirPlanes ? 'Sí' : 'No'],
    ];
    const pctKeys = ['Crecimiento mensual de ventas', 'Variación de volumen', 'Variación de precios', 'Costo de ventas (% de ventas)', 'Gastos variables (% de ventas)', 'Aumento de gastos fijos en enero', 'Inversión de mantenimiento (% de ventas)', 'Tarifa de impuesto', 'Tasa de la deuda (E.A.)'];
    supRows.forEach((r, i) => {
      const row = sup.getRow(5 + i);
      row.getCell(1).value = r[0];
      row.getCell(2).value = r[1];
      if (i === 0) row.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; });
      else if (typeof r[1] === 'number') row.getCell(2).numFmt = pctKeys.includes(r[0]) ? '0.0%' : r[0].startsWith('Días') || r[0].startsWith('Vida') || r[0].startsWith('Horizonte') ? '0' : MONEY;
    });
    let sr = 6 + supRows.length;
    if (pf.planesIncluidos.length) {
      sup.getCell('A' + sr).value = 'Planes incluidos';
      sup.getCell('A' + sr).font = { bold: true };
      pf.planesIncluidos.forEach((p) => {
        sr++;
        sup.getCell('A' + sr).value = D.label(D.month(p.fecha)) + ' · ' + p.titulo;
        sup.getCell('B' + sr).value = p.impacto ? Number(p.impacto.monto) : null;
        sup.getCell('B' + sr).numFmt = MONEY;
      });
    }
    sup.getColumn(1).width = 46;
    sup.getColumn(2).width = 22;

    // Movimientos
    const mv = wb.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1 }] });
    const heads = MF.data.TEMPLATE_HEADERS;
    mv.addRow(heads);
    mv.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; });
    ds.transactions.forEach((t) => mv.addRow([t.fecha, t.tipo, t.categoria, t.descripcion, t.tercero, t.monto, t.fechaPago, t.vence, MF.data.NATURALEZA_LABEL[t.naturaleza] || '', t.nota || '']));
    mv.getColumn(6).numFmt = MONEY;
    [12, 15, 26, 36, 28, 14, 14, 14, 16, 48].forEach((w, i) => (mv.getColumn(i + 1).width = w));

    // Contexto para la IA
    const cx = wb.addWorksheet('Contexto IA');
    titleBlock(cx, 'Contexto del negocio para la IA', 'Lo que escribiste para que la IA interprete mejor tus números.');
    const C = model.context;
    const LBL = { descripcion: 'Qué hace la empresa', productos: 'Productos y márgenes', clientes: 'Clientes clave', proveedores: 'Proveedores clave', estacionalidad: 'Estacionalidad', preocupaciones: 'Preocupaciones y restricciones', preferencias: 'Cómo quiere las respuestas', notas: 'Otras notas' };
    let cr = 5;
    Object.entries(C.negocio).forEach(([key, val]) => {
      if (!val) return;
      cx.getCell('A' + cr).value = LBL[key] || key;
      cx.getCell('A' + cr).font = { bold: true };
      cx.getCell('B' + cr).value = val;
      cx.getCell('B' + cr).alignment = { wrapText: true, vertical: 'top' };
      cr++;
    });
    if (C.eventos.length) {
      cr++;
      cx.getCell('A' + cr).value = 'Bitácora';
      cx.getCell('A' + cr).font = { bold: true, color: { argb: NAVY } };
      C.eventos.forEach((e) => {
        cr++;
        cx.getCell('A' + cr).value = e.fecha + ' · ' + (e.tipo === 'plan' ? 'Plan' : 'Evento');
        cx.getCell('B' + cr).value = e.titulo + (e.detalle ? ': ' + e.detalle : '');
        cx.getCell('B' + cr).alignment = { wrapText: true };
      });
    }
    const terc = Object.entries(C.terceros);
    if (terc.length) {
      cr += 2;
      cx.getCell('A' + cr).value = 'Notas de clientes y proveedores';
      cx.getCell('A' + cr).font = { bold: true, color: { argb: NAVY } };
      terc.forEach(([t, n]) => {
        cr++;
        cx.getCell('A' + cr).value = t;
        cx.getCell('B' + cr).value = n.nota;
        cx.getCell('B' + cr).alignment = { wrapText: true };
      });
    }
    cx.getColumn(1).width = 34;
    cx.getColumn(2).width = 100;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Estados-financieros-' + fileSafe(empresa) + '-' + D.today() + '.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- PDF ejecutivo (impresión del navegador) ---------- */
  function printReport({ model, pf }) {
    const old = document.getElementById('printRoot');
    if (old) old.remove();
    const rootEl = document.createElement('div');
    rootEl.id = 'printRoot';
    const k = model.kpis;
    const opts = { vista: 'resumen', periodo: 'ambos' };
    const section = (type) => '<section class="pr-sec"><h2>' + TITLES[type] + '</h2>' + tableHtml(type, model, pf, opts).replace('est-wrap', 'pr-wrap') + '</section>';
    rootEl.innerHTML =
      '<header class="pr-head"><div><div class="pr-brand">MobaFinance <span>AI</span></div><h1>' + esc(model.profile.empresa) + '</h1><p>Estados financieros · Histórico ' + D.label(model.meta.months[0]) + ' – ' + D.label(k.mes) + (pf.rows.length ? ' · Proyección ' + D.label(pf.rows[0].key) + ' – ' + D.label(pf.rows[pf.rows.length - 1].key) : '') + '</p></div>' +
      '<div class="pr-meta">Cifras en millones de pesos<br>Generado el ' + D.fmtLong(D.today()) + '</div></header>' +
      '<div class="pr-kpis">' +
      [['Ventas 12 meses', fmt.cop(model.LTM.ventas)], ['Utilidad neta 12 meses', fmt.cop(model.LTM.utilidadNeta)], ['Efectivo al corte', fmt.cop(k.caja)], ['Salud financiera', model.health.score + '/100']].map(([a, b]) => '<div><small>' + a + '</small><strong>' + b + '</strong></div>').join('') +
      '</div>' +
      section('resultados') + section('balance') + section('flujo') +
      '<footer class="pr-foot">Estados calculados por MobaFinance AI a partir de los movimientos registrados. La depreciación es en línea recta y el impuesto de renta es una estimación; valida las cifras con tu contador antes de presentarlas a terceros.' + (pf.planesIncluidos.length ? ' La proyección incluye los planes de la bitácora.' : '') + '</footer>';
    document.body.appendChild(rootEl);
    const cleanup = () => {
      rootEl.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 50);
  }

  MF.statements = { columns, evaluate, tableHtml, exportExcel, printReport, loadExcelJS, TITLES };
})(typeof window !== 'undefined' ? window : globalThis);
