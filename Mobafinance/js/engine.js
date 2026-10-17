/* =========================================================
   MobaFinance AI — Capa 2: Motor financiero
   Estados financieros (resultados, situación financiera, flujo de efectivo),
   indicadores, validaciones, modelo proyectado de tres estados y valoración.
   Todo es determinista: la IA interpreta estos resultados, no los inventa.
   ========================================================= */
(function (root) {
  'use strict';
  const MF = root.MF;
  const { D, util } = MF;
  const { sum, avg, clamp } = util;
  const data = MF.data;

  /* ---------- Catálogo de indicadores (para explicar y citar) ---------- */
  const IND = {
    ventasMes: { label: 'Ventas del mes', fmt: 'cop', group: 'Crecimiento', explain: 'Lo que facturaste en el mes, se haya cobrado o no.' },
    crecimiento3m: { label: 'Crecimiento de ventas', fmt: 'delta', group: 'Crecimiento', formula: 'Ventas de los últimos 3 meses ÷ ventas de los 3 meses anteriores − 1', explain: 'Si tus ventas recientes van al alza o a la baja frente al trimestre anterior.', ref: 'Positivo es buena señal. Si creces rápido, vigila que la caja acompañe.' },
    crecimientoPeriodo: { label: 'Crecimiento en el período', fmt: 'delta', group: 'Crecimiento', formula: 'Ventas promedio de los últimos 3 meses ÷ primeros 3 meses − 1', explain: 'Cuánto crecieron tus ventas desde el inicio de tus datos.' },
    margenBruto: { label: 'Margen bruto', fmt: 'pct', group: 'Rentabilidad', formula: '(Ventas − Costo de ventas) ÷ Ventas', explain: 'De cada $100 que vendes, cuánto te queda después de pagar el producto (insumos, mercancía).', ref: 'Compáralo contigo mismo: si baja mes a mes, revisa costos de insumos o precios.' },
    margenEbitda: { label: 'Margen EBITDA', fmt: 'pct', group: 'Rentabilidad', formula: 'EBITDA ÷ Ventas (12 meses)', explain: 'Lo que genera la operación antes de depreciación, intereses e impuestos, por cada $100 vendidos.', ref: 'Es la base de las valoraciones por múltiplos.' },
    margenOperativo: { label: 'Margen operativo', fmt: 'pct', group: 'Rentabilidad', formula: 'Utilidad operativa (después de depreciación) ÷ Ventas', explain: 'Lo que deja la operación después de costos, gastos y depreciación, antes de intereses e impuestos.', ref: 'Por encima de 10 % es sólido para una pyme.' },
    margenNeto: { label: 'Margen neto', fmt: 'pct', group: 'Rentabilidad', formula: 'Utilidad neta ÷ Ventas (últimos 12 meses)', explain: 'Lo que realmente gana la empresa de cada $100 vendidos, después de gastos, depreciación e impuesto de renta estimado.', ref: '3–8 %: aceptable · más de 8 %: muy bueno · negativo: pierdes dinero.' },
    roe: { label: 'Rentabilidad del patrimonio (ROE)', fmt: 'pct', group: 'Rentabilidad', formula: 'Utilidad neta 12 meses ÷ Patrimonio', explain: 'Cuánto rinde el dinero que los socios tienen invertido en la empresa.', ref: 'Debería superar lo que rendiría ese dinero en otra inversión de riesgo parecido.' },
    roa: { label: 'Rentabilidad del activo (ROA)', fmt: 'pct', group: 'Rentabilidad', formula: 'Utilidad neta 12 meses ÷ Activos totales', explain: 'Cuánta utilidad generan todos los recursos que usa la empresa.' },
    caja: { label: 'Caja disponible', fmt: 'cop', group: 'Liquidez', formula: 'Caja inicial + entradas de dinero − salidas de dinero', explain: 'El efectivo que tienes hoy en caja y bancos, según tus registros.' },
    coberturaCaja: { label: 'Cobertura de caja', fmt: 'months', group: 'Liquidez', formula: 'Caja ÷ gastos fijos mensuales', explain: 'Cuántos meses podrías pagar tus gastos fijos (nómina, arriendo…) solo con el efectivo actual.', ref: 'Ideal: 2–3 meses · mínimo prudente: 1 mes.' },
    runway: { label: 'Autonomía de caja', fmt: 'months', group: 'Liquidez', formula: 'Caja ÷ consumo neto mensual de caja (promedio 3 meses)', explain: 'Si la caja sigue cayendo al ritmo reciente, en cuántos meses se agotaría.' },
    liquidezCorriente: { label: 'Liquidez corriente', fmt: 'times', group: 'Liquidez', formula: 'Activo corriente ÷ Pasivo corriente', explain: 'Cuántas veces cubren tus activos de corto plazo las deudas de corto plazo.', ref: 'Mayor a 1,5× es sano, pero mira cuánto de eso es efectivo.' },
    pruebaAcida: { label: 'Prueba ácida', fmt: 'times', group: 'Liquidez', formula: '(Activo corriente − Inventario) ÷ Pasivo corriente', explain: 'Igual que la liquidez corriente pero sin contar inventario.', ref: 'Mayor a 1× es sano.' },
    razonEfectivo: { label: 'Razón de efectivo', fmt: 'times', group: 'Liquidez', formula: 'Caja ÷ Pasivo corriente', explain: 'Cuánto de tus deudas de corto plazo podrías pagar hoy solo con efectivo.', ref: 'Por debajo de 0,3× tu operación depende de cobrar a tiempo.' },
    cxc: { label: 'Cuentas por cobrar', fmt: 'cop', group: 'Eficiencia', formula: 'Facturas emitidas que tus clientes aún no pagan', explain: 'Dinero que ya vendiste pero todavía no recibes.' },
    dso: { label: 'Días de cobro', fmt: 'days', group: 'Eficiencia', formula: 'Cuentas por cobrar ÷ ventas diarias (promedio 90 días)', explain: 'En promedio, cuántos días tardan tus clientes en pagarte.', ref: 'Menos de 30 días: sano · más de 45: tu caja financia a tus clientes.' },
    dpo: { label: 'Días de pago a proveedores', fmt: 'days', group: 'Eficiencia', formula: 'Cuentas por pagar ÷ compras diarias (promedio 90 días)', explain: 'Cuántos días tardas tú en pagar a tus proveedores.', ref: 'Si es mucho menor que tus días de cobro, pagas antes de cobrar.' },
    ccc: { label: 'Ciclo de caja', fmt: 'days', group: 'Eficiencia', formula: 'Días de cobro + días de inventario − días de pago', explain: 'Cuántos días pasa tu dinero «atrapado» entre que pagas insumos y cobras la venta.', ref: 'Entre más corto, menos efectivo necesitas para crecer.' },
    endeudamiento: { label: 'Endeudamiento', fmt: 'pct', group: 'Endeudamiento', formula: 'Pasivos totales ÷ Activos totales', explain: 'Qué parte de lo que tiene la empresa está financiado con deudas.', ref: 'Menos de 50 % es cómodo · más de 70 % es riesgoso.' },
    coberturaIntereses: { label: 'Cobertura de intereses', fmt: 'times', group: 'Endeudamiento', formula: 'Utilidad operativa ÷ Gastos financieros (12 meses)', explain: 'Cuántas veces la operación alcanza para pagar los intereses.', ref: 'Más de 3× es sano.' },
    puntoEquilibrio: { label: 'Punto de equilibrio', fmt: 'cop', group: 'Rentabilidad', formula: '(Gastos fijos + depreciación + financieros) ÷ Margen de contribución', explain: 'Lo mínimo que debes vender al mes para no perder dinero.' },
    margenContribucion: { label: 'Margen de contribución', fmt: 'pct', group: 'Rentabilidad', formula: '(Ventas − Costos variables) ÷ Ventas', explain: 'De cada $100 vendidos, cuánto queda para cubrir gastos fijos y generar utilidad.' },
    concentracion: { label: 'Concentración de clientes', fmt: 'pct', group: 'Riesgo', formula: 'Ventas del mayor cliente ÷ ventas totales (3 meses)', explain: 'Cuánto dependes de tu cliente más grande.', ref: 'Más de 25 % en un solo cliente es una dependencia relevante.' },
    gastosFijosMes: { label: 'Gastos fijos mensuales', fmt: 'cop', group: 'Rentabilidad', formula: 'Promedio de los últimos 3 meses de gastos que no dependen de las ventas', explain: 'Lo que pagas cada mes vendas o no: nómina, arriendo, servicios, software…' },
  };

  /* ---------- Utilidades internas ---------- */
  const isPending = (t, date) => !t.fechaPago || t.fechaPago > date;
  const venceDe = (t) => t.vence || D.addDays(t.fecha, 30);
  const isRenta = (t) => t.tipo === 'Gasto' && data.catMeta('Gasto', t.categoria).grupo === 'renta';
  const monthsBetweenKeys = (a, b) => {
    const [ya, ma] = a.split('-').map(Number);
    const [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  };

  function validTx(t) {
    return t && t.fecha && /^\d{4}-\d{2}-\d{2}$/.test(t.fecha) && data.TIPOS.includes(t.tipo) && typeof t.monto === 'number' && isFinite(t.monto) && t.monto > 0;
  }

  const SALDOS_DEFAULT = {
    cajaInicial: 0, inventario: 0, activosFijos: 0, deudaInicial: 0, tasaDeudaEA: 0.21, colchonMeses: 1,
    vidaUtil: 10, regimen: 'ordinario', tasaRenta: 0.35, tasaSimple: 0.04, impuestoPorPagarInicial: 0, capitalSocial: null,
  };

  /* =========================================================
     Contexto escrito por el usuario (para la IA y el modelo)
     ========================================================= */
  const NEGOCIO_FIELDS = ['descripcion', 'productos', 'clientes', 'proveedores', 'estacionalidad', 'preocupaciones', 'preferencias', 'notas'];
  function normalizeContext(ctx, corte) {
    const c = ctx || {};
    const negocio = {};
    NEGOCIO_FIELDS.forEach((f) => (negocio[f] = String((c.negocio || {})[f] || '').trim()));
    const metas = Object.assign({ ventasMes: null, margenNeto: null, dso: null, colchonMeses: null, crecimiento: null }, c.metas || {});
    Object.keys(metas).forEach((key) => {
      const v = metas[key];
      metas[key] = v === '' || v == null || !isFinite(Number(v)) ? null : Number(v);
    });
    const eventos = (c.eventos || [])
      .filter((e) => e && e.fecha && e.titulo)
      .map((e) => Object.assign({ tipo: 'evento', detalle: '', impacto: null }, e))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    const planes = eventos.filter((e) => e.tipo === 'plan' && e.impacto && e.impacto.tipo && e.impacto.tipo !== 'ninguno' && Number(e.impacto.monto) > 0 && (!corte || e.fecha > corte));
    const terceros = {};
    Object.entries(c.terceros || {}).forEach(([k, v]) => {
      if (v && String(v.nota || '').trim()) terceros[k] = { nota: String(v.nota).trim() };
    });
    return { negocio, metas, eventos, planes, terceros };
  }

  /** Qué tan completo está el contexto (0–1) y qué falta */
  function contextScore(context, nNotas) {
    const n = context.negocio;
    const metas = Object.values(context.metas).filter((v) => v != null).length;
    const items = [
      { ok: n.descripcion.length > 20, w: 20, tip: 'Describe qué hace tu empresa, a quién le vendes y por qué canales.' },
      { ok: n.productos.length > 10, w: 10, tip: 'Cuenta tus productos o servicios principales y cuál deja más margen.' },
      { ok: n.clientes.length > 10, w: 10, tip: 'Anota cómo pagan tus clientes clave (plazos reales, acuerdos).' },
      { ok: n.proveedores.length > 10, w: 5, tip: 'Anota condiciones de tus proveedores principales.' },
      { ok: n.estacionalidad.length > 5, w: 10, tip: 'Indica tus meses altos y bajos.' },
      { ok: metas >= 2, w: 15, tip: 'Define al menos dos metas (ventas, margen, días de cobro…).' },
      { ok: context.eventos.some((e) => e.tipo !== 'plan'), w: 10, tip: 'Registra en la bitácora hechos que expliquen tus números (un cliente nuevo, una falla, un crédito).' },
      { ok: context.eventos.some((e) => e.tipo === 'plan'), w: 10, tip: 'Agrega tus planes (contrataciones, inversiones, nuevos locales) para que el modelo los incluya.' },
      { ok: n.preocupaciones.length > 10, w: 5, tip: 'Cuéntale a la IA tus preocupaciones o restricciones (p. ej., no tomar más deuda).' },
      { ok: nNotas >= 3, w: 5, tip: 'Agrega notas a los movimientos que sean especiales o extraordinarios.' },
    ];
    const score = sum(items.filter((i) => i.ok), (i) => i.w) / 100;
    return { score, missing: items.filter((i) => !i.ok).map((i) => i.tip) };
  }

  /* =========================================================
     compute(dataset) → modelo financiero completo
     ========================================================= */
  function compute(ds) {
    const saldos = Object.assign({}, SALDOS_DEFAULT, ds.saldos || {});
    const all = (ds.transactions || []).filter(validTx);
    if (!all.length) {
      const context = normalizeContext(ds.context, null);
      return { empty: true, profile: ds.profile, saldos, meta: { nTx: 0 }, IND, context, contextScore: contextScore(context, 0) };
    }

    const today = D.today();
    let maxFecha = '';
    let minFecha = '9999';
    all.forEach((t) => {
      if (t.fecha > maxFecha) maxFecha = t.fecha;
      if (t.fecha < minFecha) minFecha = t.fecha;
      if (t.fechaPago && t.fechaPago <= today && t.fechaPago > maxFecha) maxFecha = t.fechaPago;
    });
    const corte = maxFecha;
    const inicio = saldos.fechaInicio && saldos.fechaInicio <= corte ? saldos.fechaInicio : D.month(minFecha) + '-01';
    const months = D.monthsBetween(D.month(inicio), D.month(corte));
    const parcial = corte !== D.endOfMonth(D.month(corte));
    const inRange = (d) => d && d >= inicio && d <= corte;
    const dayBefore = D.addDays(inicio, -1);

    /* --- Buckets mensuales --- */
    const M = {};
    months.forEach((k) => {
      M[k] = {
        key: k, ventas: 0, otrosIngresos: 0, cogs: 0, opex: {}, opexTotal: 0, fijos: 0, variables: 0, nomina: 0, financieros: 0, extraordinario: 0,
        capexDevengado: 0, cobros: 0, pagos: 0, pagosRenta: 0, inversion: 0, prestamos: 0, abonos: 0, aportes: 0, retiros: 0,
      };
    });
    const clients = {};
    const client = (name) => (clients[name] = clients[name] || { tercero: name, ventas: {}, saldo: 0, vencido: 0, maxMora: 0, facturasAbiertas: 0, diasPago: [], plazos: [] });
    const vidaDefault = Math.max(1, Number(saldos.vidaUtil) || 10);
    const capexList = [];

    all.forEach((t) => {
      const meta = data.catMeta(t.tipo, t.categoria);
      const renta = isRenta(t);
      // Devengado (por fecha del documento)
      if (inRange(t.fecha)) {
        const b = M[D.month(t.fecha)];
        if (t.tipo === 'Ingreso') {
          if (t.categoria === 'Otros ingresos') b.otrosIngresos += t.monto;
          else {
            b.ventas += t.monto;
            const c = client(t.tercero || 'Sin nombre');
            c.ventas[b.key] = (c.ventas[b.key] || 0) + t.monto;
          }
          if (t.naturaleza === 'extraordinario') b.extraordinario += t.monto;
        } else if (t.tipo === 'Gasto' && !renta) {
          if (t.categoria === 'Costo de ventas') b.cogs += t.monto;
          else if (meta.grupo === 'financiero') b.financieros += t.monto;
          else {
            b.opex[t.categoria] = (b.opex[t.categoria] || 0) + t.monto;
            b.opexTotal += t.monto;
            if (meta.comportamiento === 'variable') b.variables += t.monto;
            else b.fijos += t.monto;
            if (t.categoria === 'Nómina') b.nomina += t.monto;
          }
          if (t.naturaleza === 'extraordinario') b.extraordinario -= t.monto;
        } else if (t.tipo === 'Inversión') {
          b.capexDevengado += t.monto;
          capexList.push({ key: b.key, monto: t.monto, vida: Math.max(1, meta.vida || vidaDefault) * 12 });
        }
      }
      // Caja (por fecha de pago)
      if (t.fechaPago && inRange(t.fechaPago)) {
        const b = M[D.month(t.fechaPago)];
        if (t.tipo === 'Ingreso') b.cobros += t.monto;
        else if (t.tipo === 'Gasto') {
          if (renta) b.pagosRenta += t.monto;
          else b.pagos += t.monto;
        } else if (t.tipo === 'Inversión') b.inversion += t.monto;
        else if (t.categoria === 'Préstamo recibido') b.prestamos += t.monto;
        else if (t.categoria === 'Abono a capital') b.abonos += t.monto;
        else if (t.categoria === 'Aporte de socios') b.aportes += t.monto;
        else if (t.categoria === 'Retiro de socios') b.retiros += t.monto;
      }
    });

    /* --- Saldos de balance a una fecha (cuentas por cobrar, por pagar y anticipos) --- */
    const ingresosAll = all.filter((t) => t.tipo === 'Ingreso');
    const gastosOper = all.filter((t) => t.tipo === 'Gasto' && !isRenta(t));
    const capexTx = all.filter((t) => t.tipo === 'Inversión');
    const pend = (list, d) => sum(list.filter((t) => t.fecha <= d && isPending(t, d)), (t) => t.monto);
    const adv = (list, d) => sum(list.filter((t) => t.fecha > d && t.fechaPago && t.fechaPago <= d), (t) => t.monto);
    const wcAt = (d) => ({ cxc: pend(ingresosAll, d), antCli: adv(ingresosAll, d), cxp: pend(gastosOper, d), antProv: adv(gastosOper.concat(capexTx), d), cxpCapex: pend(capexTx, d) });

    const tasaRenta = saldos.tasaRenta == null ? 0.35 : Number(saldos.tasaRenta);
    const taxOf = (b) => (saldos.regimen === 'simple' ? (b.ventas + b.otrosIngresos) * (Number(saldos.tasaSimple) || 0) : b.uai * tasaRenta);
    const dep0 = (Number(saldos.activosFijos) || 0) / (vidaDefault * 12);

    // Balance de apertura (día anterior al inicio)
    const w0 = wcAt(dayBefore);
    const inventario = Number(saldos.inventario) || 0;
    const imp0 = Number(saldos.impuestoPorPagarInicial) || 0;
    const opening = {
      caja: saldos.cajaInicial, cxc: w0.cxc, antProv: w0.antProv, inventario, afBruto: Number(saldos.activosFijos) || 0, depAcum: 0,
      cxp: w0.cxp, cxpCapex: w0.cxpCapex, antCli: w0.antCli, impuestos: imp0, deuda: saldos.deudaInicial,
    };
    opening.activos = opening.caja + opening.cxc + opening.antProv + inventario + opening.afBruto;
    opening.pasivos = opening.cxp + opening.cxpCapex + opening.antCli + imp0 + opening.deuda;
    opening.patrimonio = opening.activos - opening.pasivos;
    const capital = saldos.capitalSocial != null && saldos.capitalSocial !== '' && isFinite(Number(saldos.capitalSocial)) ? Number(saldos.capitalSocial) : null;

    let caja = saldos.cajaInicial;
    let deuda = saldos.deudaInicial;
    let depAcum = 0;
    let afBruto = opening.afBruto;
    let impuestos = imp0;
    let utilAcum = 0;
    let aportesAcum = 0;
    let prev = Object.assign({}, opening);
    const monthly = months.map((k, i) => {
      const b = M[k];
      const end = i === months.length - 1 ? corte : D.endOfMonth(k);
      b.end = end;
      b.depreciacion = dep0 + sum(capexList.filter((c) => c.key < k), (c) => c.monto / c.vida);
      b.utilidadBruta = b.ventas - b.cogs;
      b.ebitda = b.utilidadBruta - b.opexTotal;
      b.utilidadOperativa = b.ebitda - b.depreciacion;
      b.uai = b.utilidadOperativa - b.financieros + b.otrosIngresos;
      b.impuesto = taxOf(b);
      b.utilidadNeta = b.uai - b.impuesto;
      b.gastosTotales = b.cogs + b.opexTotal + b.financieros + b.depreciacion + b.impuesto;
      b.flujoOperativo = b.cobros - b.pagos - b.pagosRenta;
      b.financiamiento = b.prestamos + b.aportes - b.abonos - b.retiros;
      b.flujoNeto = b.flujoOperativo - b.inversion + b.financiamiento;
      caja += b.flujoNeto;
      deuda += b.prestamos - b.abonos;
      depAcum += b.depreciacion;
      afBruto += b.capexDevengado;
      impuestos += b.impuesto - b.pagosRenta;
      utilAcum += b.utilidadNeta;
      aportesAcum += b.aportes - b.retiros;
      b.caja = caja;
      b.deuda = deuda;
      const w = wcAt(end);
      b.cxc = w.cxc;
      b.cxp = w.cxp;
      const bal = {
        caja, cxc: w.cxc, antProv: w.antProv, inventario, afBruto, depAcum, afNeto: afBruto - depAcum,
        cxp: w.cxp, cxpCapex: w.cxpCapex, antCli: w.antCli, impuestos, deuda,
      };
      bal.corrientes = Math.max(0, caja) + w.cxc + w.antProv + inventario;
      bal.activos = caja + w.cxc + w.antProv + inventario + bal.afNeto;
      bal.pasivos = w.cxp + w.cxpCapex + w.antCli + impuestos + deuda;
      bal.patrimonio = opening.patrimonio + utilAcum + aportesAcum;
      bal.capital = capital != null ? capital : opening.patrimonio;
      bal.retenidas = opening.patrimonio - bal.capital;
      bal.utilidadAcum = utilAcum;
      bal.aportesAcum = aportesAcum;
      bal.diff = bal.activos - bal.pasivos - bal.patrimonio;
      b.bal = bal;
      // Flujo de efectivo por método indirecto
      b.cf = {
        utilidadNeta: b.utilidadNeta, depreciacion: b.depreciacion,
        cxc: -(w.cxc - prev.cxc), antProv: -(w.antProv - prev.antProv), inventario: 0,
        cxp: w.cxp - prev.cxp, impuestos: impuestos - prev.impuestos, antCli: w.antCli - prev.antCli,
      };
      b.cf.operacion = b.cf.utilidadNeta + b.cf.depreciacion + b.cf.cxc + b.cf.antProv + b.cf.inventario + b.cf.cxp + b.cf.impuestos + b.cf.antCli;
      b.cf.inversion = -b.inversion;
      b.cf.financiacion = b.financiamiento;
      b.cf.neto = b.cf.operacion + b.cf.inversion + b.cf.financiacion;
      b.margenBruto = b.ventas ? b.utilidadBruta / b.ventas : null;
      b.margenOperativo = b.ventas ? b.utilidadOperativa / b.ventas : null;
      b.margenNeto = b.ventas ? b.utilidadNeta / b.ventas : null;
      prev = Object.assign({}, bal);
      return b;
    });
    // Días de cobro y de pago con ventana móvil de 3 meses
    monthly.forEach((b, i) => {
      const w = monthly.slice(Math.max(0, i - 2), i + 1);
      const days = sum(w, (x) => (x.key === D.month(corte) && parcial ? Number(corte.slice(8)) : D.daysInMonth(x.key)));
      const v = sum(w, (x) => x.ventas);
      const compras = sum(w, (x) => x.cogs + x.opexTotal - x.nomina);
      b.dso = v ? b.cxc / (v / days) : null;
      b.dpo = compras ? b.cxp / (compras / days) : null;
      // Porción corriente de la deuda: abonos de los próximos 12 meses al ritmo reciente
      const abonosRec = avg(w, (x) => x.abonos);
      b.bal.deudaCP = Math.min(b.bal.deuda, abonosRec * 12);
      b.bal.deudaLP = b.bal.deuda - b.bal.deudaCP;
      b.bal.pasivosCorrientes = b.bal.cxp + b.bal.cxpCapex + b.bal.antCli + Math.max(0, b.bal.impuestos) + b.bal.deudaCP;
    });

    const n = monthly.length;
    const last = monthly[n - 1];
    const prevM = monthly[n - 2] || null;
    const full = parcial && n > 1 ? monthly.slice(0, -1) : monthly;
    const last3 = full.slice(-3);
    const prev3 = full.slice(-6, -3);
    const first3 = full.slice(0, 3);
    const ltm = monthly.slice(-12);

    const tot = (arr, f) => sum(arr, typeof f === 'string' ? (x) => x[f] : f);
    const LTM = { meses: ltm.length };
    ['ventas', 'cogs', 'opexTotal', 'financieros', 'otrosIngresos', 'utilidadBruta', 'ebitda', 'depreciacion', 'utilidadOperativa', 'uai', 'impuesto', 'utilidadNeta', 'cobros', 'pagos', 'pagosRenta', 'inversion', 'prestamos', 'abonos', 'aportes', 'retiros', 'flujoOperativo', 'flujoNeto', 'extraordinario'].forEach((f) => (LTM[f] = tot(ltm, f)));
    LTM.opex = LTM.opexTotal;
    const P = {};
    ['ventas', 'utilidadNeta', 'inversion', 'prestamos', 'abonos', 'aportes', 'retiros', 'cobros', 'pagos', 'pagosRenta', 'flujoOperativo', 'depreciacion', 'impuesto'].forEach((f) => (P[f] = tot(monthly, f)));

    // Puente de caja: caja inicial → caja final
    const lb = last.bal;
    const bridge = [
      { key: 'inicial', label: 'Caja inicial', value: saldos.cajaInicial, total: true },
      { key: 'utilidad', label: 'Utilidad antes de depreciación', value: P.utilidadNeta + P.depreciacion },
      { key: 'cartera', label: 'Más cartera por cobrar', value: -(lb.cxc - opening.cxc) },
      { key: 'proveedores', label: 'Más cuentas por pagar', value: lb.cxp - opening.cxp },
      { key: 'impuestos', label: 'Impuestos causados aún no pagados', value: lb.impuestos - opening.impuestos },
      { key: 'inversion', label: 'Inversiones', value: -P.inversion },
      { key: 'prestamos', label: 'Préstamos y aportes', value: P.prestamos + P.aportes },
      { key: 'abonos', label: 'Abonos y retiros', value: -(P.abonos + P.retiros) },
      { key: 'final', label: 'Caja final', value: last.caja, total: true },
    ].filter((x) => x.total || Math.abs(x.value) > 1000);
    const explained = sum(bridge.filter((b) => !b.total), (b) => b.value) + saldos.cajaInicial;
    const residual = last.caja - explained;
    if (Math.abs(residual) > 1000) bridge.splice(bridge.length - 1, 0, { key: 'otros', label: 'Anticipos y otros ajustes', value: residual });

    /* --- Cartera por edades al corte --- */
    const abiertas = ingresosAll.filter((t) => t.fecha <= corte && isPending(t, corte));
    const aging = [
      { key: 'vigente', label: 'Por vencer', value: 0, count: 0 },
      { key: 'd30', label: '1–30 días vencida', value: 0, count: 0 },
      { key: 'd60', label: '31–60 días vencida', value: 0, count: 0 },
      { key: 'd60p', label: 'Más de 60 días', value: 0, count: 0 },
    ];
    abiertas.forEach((t) => {
      const mora = D.diff(venceDe(t), corte);
      const bucket = mora <= 0 ? aging[0] : mora <= 30 ? aging[1] : mora <= 60 ? aging[2] : aging[3];
      bucket.value += t.monto;
      bucket.count += 1;
      const c = client(t.tercero || 'Sin nombre');
      c.saldo += t.monto;
      c.facturasAbiertas += 1;
      if (mora > 0) {
        c.vencido += t.monto;
        c.maxMora = Math.max(c.maxMora, mora);
      }
    });
    const desde6 = D.addDays(corte, -183);
    ingresosAll.forEach((t) => {
      if (t.fechaPago && t.fechaPago <= corte && t.fecha >= desde6) client(t.tercero || 'Sin nombre').diasPago.push(D.diff(t.fecha, t.fechaPago));
      if (t.vence && t.fecha >= desde6) client(t.tercero || 'Sin nombre').plazos.push(D.diff(t.fecha, t.vence));
    });
    const v3 = tot(last3, 'ventas');
    const clientList = Object.values(clients)
      .map((c) => {
        const ventas3m = sum(last3, (m) => c.ventas[m.key] || 0);
        return {
          tercero: c.tercero, ventasLTM: sum(ltm, (m) => c.ventas[m.key] || 0), ventas3m, share3m: v3 ? ventas3m / v3 : 0,
          saldo: c.saldo, vencido: c.vencido, maxMora: c.maxMora, facturasAbiertas: c.facturasAbiertas,
          diasPago: c.diasPago.length ? avg(c.diasPago) : null, plazo: c.plazos.length ? avg(c.plazos) : null,
          serie: monthly.map((m) => c.ventas[m.key] || 0),
        };
      })
      .sort((a, b) => b.ventasLTM - a.ventasLTM);

    /* --- Gastos por categoría --- */
    const cats = {};
    monthly.forEach((m) => Object.keys(m.opex).forEach((k) => (cats[k] = true)));
    const expenses = ['Costo de ventas', ...Object.keys(cats), 'Gastos financieros']
      .filter((k, i, a) => a.indexOf(k) === i)
      .map((k) => {
        const val = (m) => (k === 'Costo de ventas' ? m.cogs : k === 'Gastos financieros' ? m.financieros : m.opex[k] || 0);
        const l3 = sum(last3, val);
        const p3 = sum(prev3, val);
        const meta = data.catMeta('Gasto', k);
        return {
          categoria: k, comportamiento: meta.comportamiento, grupo: meta.grupo, ltm: sum(ltm, val),
          mes3: l3 / Math.max(1, last3.length), prev3: p3 / Math.max(1, prev3.length), cambio: p3 ? l3 / p3 - 1 : null,
          pctVentas: v3 ? l3 / v3 : null, serie: monthly.map(val),
        };
      })
      .filter((e) => e.ltm > 0)
      .sort((a, b) => b.ltm - a.ltm);

    /* --- Proveedores de costo de ventas (últimos 3 meses) --- */
    const desde3 = last3.length ? last3[0].key + '-01' : inicio;
    const supMap = {};
    all.forEach((t) => {
      if (t.tipo === 'Gasto' && t.categoria === 'Costo de ventas' && t.fecha >= desde3 && t.fecha <= corte) supMap[t.tercero || 'Sin nombre'] = (supMap[t.tercero || 'Sin nombre'] || 0) + t.monto;
    });
    const cogsL3 = sum(last3, (m) => m.cogs) || 1;
    const suppliers = Object.entries(supMap).map(([tercero, v]) => ({ tercero, compras3m: v, share: v / cogsL3 })).sort((a, b) => b.compras3m - a.compras3m);

    /* --- Balance al corte (forma usada por vistas y la IA) --- */
    const balance = {
      activos: { caja: lb.caja, cxc: lb.cxc, anticipos: lb.antProv, inventario, corrientes: lb.corrientes, afBruto: lb.afBruto, depAcum: lb.depAcum, activosFijos: lb.afNeto, total: lb.activos },
      pasivos: { cxp: lb.cxp, cxpCapex: lb.cxpCapex, anticipos: lb.antCli, impuestos: lb.impuestos, deuda: lb.deuda, deudaCP: lb.deudaCP, deudaLP: lb.deudaLP, corrientes: lb.pasivosCorrientes, total: lb.pasivos },
      patrimonio: lb.patrimonio,
      diff: lb.diff,
    };

    /* --- KPIs --- */
    const fijosMes = avg(last3, (m) => m.fijos);
    const financierosMes = avg(last3, (m) => m.financieros);
    const depMes = last.depreciacion;
    const cogs3 = tot(last3, 'cogs');
    const var3 = tot(last3, 'variables');
    const mc = v3 ? (v3 - cogs3 - var3) / v3 : null;
    const flujoNeto3m = avg(last3, (m) => m.flujoNeto);
    const top = clientList.filter((c) => c.ventas3m > 0).sort((a, b) => b.ventas3m - a.ventas3m)[0];
    const ref3 = first3.length ? avg(first3, (m) => m.ventas) : null;
    const pc = lb.pasivosCorrientes;
    const k = {
      mes: last.key,
      mesPrev: prevM ? prevM.key : null,
      ventasMes: last.ventas,
      ventasMoM: prevM && prevM.ventas ? last.ventas / prevM.ventas - 1 : null,
      ventas3m: v3,
      crecimiento3m: prev3.length === 3 && tot(prev3, 'ventas') ? v3 / tot(prev3, 'ventas') - 1 : null,
      crecimientoPeriodo: ref3 && full.length >= 6 ? avg(last3, (m) => m.ventas) / ref3 - 1 : null,
      utilidadNetaMes: last.utilidadNeta,
      utilidadNetaPrev: prevM ? prevM.utilidadNeta : null,
      utilidadNetaLTM: LTM.utilidadNeta,
      uaiLTM: LTM.uai,
      ebitdaLTM: LTM.ebitda,
      margenNeto: LTM.ventas ? LTM.utilidadNeta / LTM.ventas : null,
      margenNetoMes: last.margenNeto,
      margenBruto: v3 ? (v3 - cogs3) / v3 : null,
      margenBrutoInicio: first3.length ? (tot(first3, 'ventas') - tot(first3, 'cogs')) / tot(first3, 'ventas') : null,
      margenEbitda: LTM.ventas ? LTM.ebitda / LTM.ventas : null,
      margenOperativo: LTM.ventas ? LTM.utilidadOperativa / LTM.ventas : null,
      margenContribucion: mc,
      caja: last.caja,
      cajaInicial: saldos.cajaInicial,
      cajaPrev: prevM ? prevM.caja : null,
      cajaMax: Math.max(...monthly.map((m) => m.caja)),
      flujoNeto3m,
      cxc: lb.cxc,
      cxcInicial: opening.cxc,
      cxp: lb.cxp,
      cxpInicial: opening.cxp,
      dso: last.dso,
      dsoInicio: monthly[Math.min(2, n - 1)].dso,
      dpo: last.dpo,
      dio: inventario && cogs3 ? inventario / (cogs3 / (last3.length * 30)) : null,
      deuda: lb.deuda,
      impuestosPorPagar: lb.impuestos,
      gastosFijosMes: fijosMes,
      financierosMes,
      depreciacionMes: depMes,
      abonosMes: avg(last3, (m) => m.abonos),
      puntoEquilibrio: mc > 0 ? (fijosMes + depMes + financierosMes) / mc : null,
      coberturaCaja: fijosMes ? last.caja / fijosMes : null,
      runway: flujoNeto3m < 0 && last.caja > 0 ? last.caja / -flujoNeto3m : null,
      liquidezCorriente: pc ? lb.corrientes / pc : null,
      pruebaAcida: pc ? (lb.corrientes - inventario) / pc : null,
      razonEfectivo: pc ? Math.max(0, lb.caja) / pc : null,
      endeudamiento: lb.activos ? lb.pasivos / lb.activos : null,
      coberturaIntereses: LTM.financieros ? LTM.utilidadOperativa / LTM.financieros : null,
      roe: lb.patrimonio > 0 ? LTM.utilidadNeta / lb.patrimonio : null,
      roa: lb.activos > 0 ? LTM.utilidadNeta / lb.activos : null,
      concentracion: top ? top.share3m : null,
      topCliente: top ? top.tercero : null,
      vencido: aging[1].value + aging[2].value + aging[3].value,
      colchon: fijosMes * (saldos.colchonMeses || 1),
      extraordinarioLTM: LTM.extraordinario,
    };
    k.ccc = k.dso != null ? k.dso + (k.dio || 0) - (k.dpo || 0) : null;

    /* --- Contexto del usuario --- */
    const context = normalizeContext(ds.context, corte);
    const notasTx = all.filter((t) => String(t.nota || '').trim() || t.naturaleza === 'extraordinario').sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const extraordinarios = all.filter((t) => t.naturaleza === 'extraordinario' && t.fecha >= (ltm[0] ? ltm[0].key + '-01' : inicio) && t.fecha <= corte);

    const model = {
      empty: false,
      profile: ds.profile,
      saldos,
      IND,
      meta: { inicio, corte, parcial, months, nTx: all.length, nTxPeriodo: all.filter((t) => inRange(t.fecha)).length, source: ds.source, mesesCompletos: full.length },
      monthly, LTM, P, kpis: k, bridge, aging, clients: clientList, expenses, suppliers, opening, balance,
      open: { cxc: abiertas.sort((a, b) => D.diff(venceDe(b), corte) - D.diff(venceDe(a), corte)), cxp: gastosOper.filter((t) => t.fecha <= corte && isPending(t, corte)) },
      context,
      notasTx,
      extraordinarios,
      contextScore: contextScore(context, notasTx.length),
    };
    model.goals = goals(model);
    model.season = seasonIndex(model);
    model.validations = validate(all, model);
    model.health = health(model);
    model.assumptions = baseAssumptions(model);
    return model;
  }

  /* =========================================================
     Metas del usuario frente a la realidad
     ========================================================= */
  function goals(model) {
    const g = model.context.metas;
    const k = model.kpis;
    const out = [];
    const push = (key, label, meta, actual, higherIsBetter, fmt) => {
      if (meta == null || actual == null || !isFinite(actual)) return;
      const ratio = higherIsBetter ? (meta ? actual / meta : null) : actual ? meta / actual : null;
      out.push({ key, label, meta, actual, avance: ratio, cumple: higherIsBetter ? actual >= meta : actual <= meta, fmt });
    };
    push('ventasMes', 'Ventas mensuales', g.ventasMes, k.ventasMes, true, 'cop');
    push('margenNeto', 'Margen neto', g.margenNeto, k.margenNeto, true, 'pct');
    push('dso', 'Días de cobro', g.dso, k.dso, false, 'days');
    push('colchonMeses', 'Colchón de caja', g.colchonMeses, k.coberturaCaja, true, 'months');
    push('crecimiento', 'Crecimiento anual de ventas', g.crecimiento, k.crecimientoPeriodo, true, 'pct');
    return out;
  }

  /* =========================================================
     Estacionalidad: índice por mes calendario (sin tendencia)
     ========================================================= */
  function seasonIndex(model) {
    const full = model.meta.parcial ? model.monthly.slice(0, -1) : model.monthly;
    const lastY = full.slice(-12);
    if (lastY.length < 12) return null;
    const ys = lastY.map((m) => m.ventas);
    const xs = ys.map((_, i) => i);
    const mx = avg(xs);
    const my = avg(ys);
    const b = sum(xs, (x) => (x - mx) * (ys[x] - my)) / sum(xs, (x) => (x - mx) ** 2);
    const a = my - b * mx;
    const idx = {};
    lastY.forEach((m, i) => {
      const tr = a + b * i;
      idx[m.key.slice(5)] = tr > 0 ? m.ventas / tr : 1;
    });
    const mean = avg(Object.values(idx));
    Object.keys(idx).forEach((key) => (idx[key] = clamp(idx[key] / mean, 0.75, 1.3)));
    return idx;
  }

  /* =========================================================
     Validaciones del motor
     ========================================================= */
  function validate(all, model) {
    const out = [];
    const { months } = model.meta;
    // 1. Duplicados
    const seen = {};
    let dup = 0;
    all.forEach((t) => {
      const key = [t.fecha, t.tipo, t.categoria, t.monto, util.norm(t.tercero), util.norm(t.descripcion)].join('|');
      if (seen[key]) dup++;
      seen[key] = true;
    });
    out.push(dup
      ? { id: 'dup', status: 'warn', title: 'Posibles duplicados', detail: dup + ' movimiento(s) tienen la misma fecha, monto, tercero y descripción que otro. Revísalos en Datos.', count: dup }
      : { id: 'dup', status: 'ok', title: 'Sin duplicados', detail: 'Ningún movimiento repetido.' });
    // 2. Fechas de pago coherentes
    const bad = all.filter((t) => t.fechaPago && t.fechaPago < t.fecha).length;
    out.push(bad
      ? { id: 'fechas', status: 'warn', title: 'Fechas de pago anteriores al documento', detail: bad + ' movimiento(s) se pagaron antes de su fecha. Puede ser un anticipo o un error de digitación.', count: bad }
      : { id: 'fechas', status: 'ok', title: 'Fechas coherentes', detail: 'Todas las fechas de pago son posteriores o iguales a la fecha del documento.' });
    // 3. Valores atípicos (> 3× la mediana del mismo proveedor y categoría, o de la categoría; > $1 M)
    const median = (arr) => {
      const s = arr.map((t) => t.monto).sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const byCat = {};
    const byPair = {};
    const gastos = all.filter((t) => t.tipo === 'Gasto' && !isRenta(t));
    gastos.forEach((t) => {
      (byCat[t.categoria] = byCat[t.categoria] || []).push(t);
      const pk = t.categoria + '|' + util.norm(t.tercero);
      (byPair[pk] = byPair[pk] || []).push(t);
    });
    const atipicos = gastos.filter((t) => {
      const pair = byPair[t.categoria + '|' + util.norm(t.tercero)];
      const ref = pair.length >= 4 ? median(pair) : byCat[t.categoria].length >= 6 ? median(byCat[t.categoria]) : null;
      return ref != null && t.monto > ref * 3 && t.monto > 1e6;
    });
    const sinExplicar = atipicos.filter((t) => t.naturaleza !== 'extraordinario' && !String(t.nota || '').trim());
    out.push(sinExplicar.length
      ? { id: 'atipicos', status: 'warn', title: sinExplicar.length === 1 ? '1 valor atípico sin explicar' : sinExplicar.length + ' valores atípicos sin explicar', detail: sinExplicar.slice(0, 3).map((t) => '«' + (t.descripcion || t.categoria) + '» por ' + MF.fmt.cop(t.monto) + ' (' + D.fmt(t.fecha) + ')').join(' · ') + '. Márcalos como extraordinarios o agrégales una nota para que la IA los entienda.', count: sinExplicar.length, items: sinExplicar }
      : { id: 'atipicos', status: 'ok', title: atipicos.length ? 'Valores atípicos explicados' : 'Sin valores atípicos', detail: atipicos.length ? atipicos.length + ' valor(es) atípico(s) tienen nota o están marcados como extraordinarios.' : 'Los montos son consistentes dentro de cada categoría.' });
    // 4. Continuidad
    const gaps = model.monthly.filter((m) => !m.ventas || !m.gastosTotales).map((m) => D.label(m.key));
    out.push(gaps.length
      ? { id: 'continuidad', status: 'warn', title: 'Meses incompletos', detail: 'Sin ventas o sin gastos registrados en: ' + gaps.join(', ') + '. Los promedios pueden distorsionarse.', count: gaps.length }
      : { id: 'continuidad', status: 'ok', title: 'Meses completos', detail: months.length + ' meses con ventas y gastos registrados (' + D.label(months[0]) + ' – ' + D.label(months[months.length - 1]) + ').' });
    // 5. Caja negativa
    const neg = model.monthly.filter((m) => m.caja < 0).map((m) => D.label(m.key));
    out.push(neg.length
      ? { id: 'caja', status: 'error', title: 'Caja calculada negativa', detail: 'La caja queda en negativo en ' + neg.join(', ') + '. Revisa el saldo inicial de caja en Datos → Saldos iniciales o si faltan ingresos.', count: neg.length }
      : { id: 'caja', status: 'ok', title: 'Caja consistente', detail: 'El saldo de caja nunca queda negativo con el saldo inicial registrado.' });
    // 6. Cuadre del balance
    const maxDiff = Math.max(...model.monthly.map((m) => Math.abs(m.bal.diff)));
    out.push(maxDiff > 1000
      ? { id: 'cuadre', status: 'error', title: 'El balance no cuadra', detail: 'Diferencia máxima de ' + MF.fmt.cop(maxDiff) + ' entre activos y pasivos más patrimonio.', count: 1 }
      : { id: 'cuadre', status: 'ok', title: 'Balance cuadrado', detail: 'Activo = Pasivo + Patrimonio en los ' + months.length + ' cierres mensuales.' });
    // 7. Ventas a crédito sin cliente
    const sinTercero = all.filter((t) => t.tipo === 'Ingreso' && !t.tercero && (!t.fechaPago || t.fechaPago > t.fecha)).length;
    out.push(sinTercero
      ? { id: 'tercero', status: 'warn', title: 'Ventas a crédito sin cliente', detail: sinTercero + ' factura(s) a crédito no tienen cliente; no podremos decirte quién te debe.', count: sinTercero }
      : { id: 'tercero', status: 'ok', title: 'Cartera identificada', detail: 'Todas las ventas a crédito tienen cliente asignado.' });
    // 8. Fechas futuras
    const fut = all.filter((t) => t.fecha > D.today()).length;
    if (fut) out.push({ id: 'futuro', status: 'warn', title: 'Movimientos con fecha futura', detail: fut + ' movimiento(s) tienen fecha posterior a hoy.', count: fut });
    return out;
  }

  /* =========================================================
     Salud financiera 0–100
     ========================================================= */
  function health(model) {
    const k = model.kpis;
    const lin = (x, x0, x1) => clamp(((x - x0) / (x1 - x0)) * 100, 0, 100);
    const dims = [
      { key: 'liquidez', label: 'Liquidez', weight: 0.3, score: k.coberturaCaja == null ? 50 : lin(k.coberturaCaja, 0, 3), value: k.coberturaCaja, ind: 'coberturaCaja', note: 'Meses de gastos fijos cubiertos con caja' },
      { key: 'rentabilidad', label: 'Rentabilidad', weight: 0.25, score: k.margenNeto == null ? 50 : k.margenNeto < 0 ? lin(k.margenNeto, -0.1, 0) * 0.3 : 30 + lin(k.margenNeto, 0, 0.1) * 0.7, value: k.margenNeto, ind: 'margenNeto', note: 'Margen neto de los últimos 12 meses' },
      { key: 'cobro', label: 'Cobro a clientes', weight: 0.2, score: k.dso == null ? 50 : 100 - lin(k.dso, 30, 75), value: k.dso, ind: 'dso', note: 'Días promedio que tardan en pagarte' },
      { key: 'deuda', label: 'Endeudamiento', weight: 0.1, score: k.endeudamiento == null ? 50 : 100 - lin(k.endeudamiento, 0.4, 0.85), value: k.endeudamiento, ind: 'endeudamiento', note: 'Parte de los activos financiada con deuda' },
      { key: 'crecimiento', label: 'Crecimiento', weight: 0.15, score: k.crecimiento3m == null ? 50 : lin(k.crecimiento3m, -0.1, 0.1), value: k.crecimiento3m, ind: 'crecimiento3m', note: 'Ventas del último trimestre vs. el anterior' },
    ];
    dims.forEach((d) => {
      d.score = Math.round(d.score);
      d.status = d.score >= 70 ? 'good' : d.score >= 40 ? 'warning' : 'critical';
    });
    const score = Math.round(sum(dims, (d) => d.score * d.weight));
    const label = score >= 75 ? 'Saludable' : score >= 50 ? 'Requiere atención' : 'En riesgo';
    const status = score >= 75 ? 'good' : score >= 50 ? 'warning' : 'critical';
    return { score, label, status, dims };
  }

  /* =========================================================
     Supuestos base para proyectar
     ========================================================= */
  const FACTOR_PRESTACIONAL = 1.52; // costo total de un empleado ÷ salario (referencia, ajustable)
  const FACTOR_MENSUAL = 1.35; // salario + seguridad social y parafiscales (sin prima/cesantías)
  // Pagos de prestaciones en Colombia, como fracción de la nómina mensual (salario + seguridad social)
  const CALENDARIO = { '06': { f: 0.37, label: 'Prima de servicios' }, '12': { f: 0.37, label: 'Prima de servicios' }, '02': { f: 0.74, label: 'Cesantías' }, '01': { f: 0.089, label: 'Intereses sobre cesantías' } };

  function baseAssumptions(model) {
    const full = model.meta.parcial && model.monthly.length > 1 ? model.monthly.slice(0, -1) : model.monthly;
    const last3 = full.slice(-3);
    const v3 = sum(last3, (m) => m.ventas) || 1;
    const w = full.slice(-6).filter((m) => m.ventas > 0);
    let g = 0;
    if (w.length >= 4) {
      const xs = w.map((_, i) => i);
      const ys = w.map((m) => Math.log(m.ventas));
      const mx = avg(xs);
      const my = avg(ys);
      const slope = sum(xs, (x) => (x - mx) * (ys[x] - my)) / sum(xs, (x) => (x - mx) ** 2);
      g = clamp(Math.exp(slope) - 1, -0.02, 0.015);
    }
    const nominas = last3.map((m) => m.nomina).sort((a, b) => a - b);
    const nominaBase = nominas.length ? nominas[Math.floor(nominas.length / 2)] : 0;
    const fijosProm = avg(last3, (m) => m.fijos);
    const k = model.kpis;
    // Si hubo estacionalidad en los últimos 3 meses, la base se lleva a un mes «normal»
    const idx = model.season;
    const vBase = idx ? avg(last3, (m) => m.ventas / (idx[m.key.slice(5)] || 1)) : v3 / last3.length;
    return {
      lastKey: full[full.length - 1].key,
      R0: v3 / last3.length,
      ventasBase: vBase,
      g,
      cogsPct: sum(last3, (m) => m.cogs) / v3,
      varPct: sum(last3, (m) => m.variables) / v3,
      nominaBase,
      fijosBase: fijosProm - (avg(last3, (m) => m.nomina) - nominaBase),
      financieros: avg(last3, (m) => m.financieros),
      abonos: avg(last3, (m) => m.abonos),
      otros: avg(last3, (m) => m.otrosIngresos),
      dso: k.dso || 30,
      dpo: k.dpo || 30,
      dio: k.dio || 0,
      caja: k.caja,
      cxc: k.cxc,
      cxp: k.cxp,
      colchon: k.colchon,
    };
  }

  /** Supuestos editables del modelo de tres estados */
  function modelDefaults(model) {
    const A = model.assumptions;
    const k = model.kpis;
    const s = model.saldos;
    const mrD = Math.pow(1 + (Number(s.tasaDeudaEA) || 0), 1 / 12) - 1;
    return {
      horizonte: 12,
      ventasBase: Math.round(A.ventasBase),
      crecimiento: A.g,
      estacionalidad: !!model.season,
      costoVentasPct: A.cogsPct,
      variablesPct: A.varPct,
      fijosBase: Math.round(A.fijosBase),
      nominaBase: Math.round(A.nominaBase),
      aumentoEnero: 0.06,
      prestaciones: true,
      otrosIngresos: Math.round(A.otros),
      dso: A.dso,
      dpo: A.dpo,
      dio: A.dio,
      capexPct: 0,
      vidaUtil: Number(s.vidaUtil) || 10,
      regimen: s.regimen || 'ordinario',
      tasaRenta: s.tasaRenta == null ? 0.35 : Number(s.tasaRenta),
      tasaSimple: Number(s.tasaSimple) || 0.04,
      tasaDeuda: Number(s.tasaDeudaEA) || 0,
      abonoMensual: Math.round(k.abonosMes),
      otrosFinancierosPct: Math.max(0, A.financieros - k.deuda * mrD) / (A.R0 || 1),
      dividendos: 0,
      cajaMinima: Math.round(k.colchon),
      lineaCredito: false,
      tasaLinea: 0.26,
      incluirPlanes: true,
      ventasPct: 0, precioPct: 0, costoPct: 0, fijosPct: 0,
      contrataciones: [], inversiones: [], creditos: [],
    };
  }

  /* =========================================================
     Modelo proyectado de tres estados (mensual)
     Resultados ⇄ Situación financiera ⇄ Flujo de efectivo, siempre cuadrado
     ========================================================= */
  function proforma(model, opts) {
    const P = Object.assign(modelDefaults(model), opts || {});
    const A = model.assumptions;
    const B = model.balance;
    const H = clamp(Math.round(P.horizonte) || 12, 1, 36);
    const season = P.estacionalidad ? model.season : null;
    const mrD = Math.pow(1 + (Number(P.tasaDeuda) || 0), 1 / 12) - 1;
    const mrL = Math.pow(1 + (Number(P.tasaLinea) || 0), 1 / 12) - 1;
    const tOf = (fecha) => monthsBetweenKeys(A.lastKey, D.month(fecha));
    const inH = (t) => t >= 1 && t <= H;

    // Planes registrados por el usuario en su bitácora
    const planes = P.incluirPlanes ? model.context.planes : [];
    const plan = (tipo) => planes.filter((p) => p.impacto.tipo === tipo && inH(tOf(p.fecha)));
    const contr = P.contrataciones.filter((c) => c.n > 0).map((c) => Object.assign({ origen: 'escenario' }, c))
      .concat(plan('contratacion').map((p) => ({ n: Number(p.impacto.cantidad) || 1, salario: Number(p.impacto.monto), mes: tOf(p.fecha), origen: p.titulo })));
    const invs = P.inversiones.filter((i) => i.monto > 0).map((i) => Object.assign({ origen: 'escenario' }, i))
      .concat(plan('inversion').map((p) => ({ monto: Number(p.impacto.monto), mes: tOf(p.fecha), origen: p.titulo })));
    const creds = P.creditos.filter((c) => c.monto > 0).map((c) => Object.assign({ origen: 'escenario' }, c))
      .concat(plan('credito').map((p) => ({ monto: Number(p.impacto.monto), tasa: Number(p.impacto.tasa) || 0.21, plazo: Number(p.impacto.plazo) || 24, mes: tOf(p.fecha), origen: p.titulo })))
      .map((c) => {
        const mr = Math.pow(1 + (Number(c.tasa) || 0), 1 / 12) - 1;
        const plazo = Math.max(1, Math.round(c.plazo || 24));
        return Object.assign({}, c, { mr, cuota: mr ? (c.monto * mr) / (1 - Math.pow(1 + mr, -plazo)) : c.monto / plazo, bal: 0 });
      });
    const gastosPlan = plan('gasto').map((p) => ({ monto: Number(p.impacto.monto), mes: tOf(p.fecha), origen: p.titulo }));
    const ventasPlan = plan('ventas').map((p) => ({ monto: Number(p.impacto.monto), mes: tOf(p.fecha), origen: p.titulo }));

    // Estado inicial: balance al corte
    let caja = B.activos.caja;
    let cxc = B.activos.cxc;
    let inv = B.activos.inventario;
    let cxp = B.pasivos.cxp;
    let impPagar = B.pasivos.impuestos;
    let deudaE = B.pasivos.deuda;
    let linea = 0;
    let afBruto = B.activos.afBruto;
    let depAcum = B.activos.depAcum;
    let patrimonio = B.patrimonio;
    const antProv = B.activos.anticipos;
    const antCli = B.pasivos.anticipos;
    let cxpCapex = B.pasivos.cxpCapex;
    const diff0 = B.diff;
    const depBase = model.monthly[model.monthly.length - 1].depreciacion;
    const newDep = [];
    // Impuesto de renta: se paga en abril y junio el saldo causado a diciembre del año anterior
    const snapDec = {};
    const pagadoAno = {};
    model.monthly.forEach((m) => {
      if (m.key.slice(5) === '12') snapDec[m.key.slice(0, 4)] = m.bal.impuestos;
      const y = String(Number(m.key.slice(0, 4)) - 1);
      pagadoAno[y] = (pagadoAno[y] || 0) + m.pagosRenta;
    });
    // Aumento de gastos fijos cada enero (salarios e IPC), contado desde que empieza cada gasto
    const aum = Number(P.aumentoEnero) || 0;
    const keyAt = (t) => D.addMonths(A.lastKey, t);
    const inflF = (from, to) => {
      let c = 0;
      for (let x = from + 1; x <= to; x++) if (keyAt(x).slice(5) === '01') c++;
      return Math.pow(1 + aum, c);
    };

    const rows = [];
    for (let t = 1; t <= H; t++) {
      const key = keyAt(t);
      const mm = key.slice(5);
      const year = key.slice(0, 4);
      const infl = inflF(0, t);
      const sIdx = season ? season[mm] || 1 : 1;
      const extraVentas = sum(ventasPlan.filter((v) => t >= v.mes), (v) => v.monto);
      const vol = P.ventasBase * Math.pow(1 + P.crecimiento, t) * sIdx * (1 + P.ventasPct) + extraVentas;
      const ventas = vol * (1 + P.precioPct);
      const cogs = vol * P.costoVentasPct * (1 + P.costoPct);
      const variables = ventas * P.variablesPct;
      const activos = contr.filter((c) => t >= c.mes);
      const salarios = sum(activos, (c) => c.n * c.salario * inflF(c.mes, t));
      const nominaNueva = salarios * (P.prestaciones ? FACTOR_MENSUAL : FACTOR_PRESTACIONAL);
      const cal = P.prestaciones ? CALENDARIO[mm] : null;
      let extra = 0;
      if (cal) {
        // Prima: semestre en curso · cesantías e intereses: año anterior. Los empleados nuevos, proporcional al tiempo trabajado
        const y = Number(year);
        const [desde, hasta, meses] = mm === '06' ? [y + '-01', y + '-06', 6] : mm === '12' ? [y + '-07', y + '-12', 6] : [y - 1 + '-01', y - 1 + '-12', 12];
        const nuevos = sum(activos, (c) => {
          const inicioC = keyAt(c.mes);
          const from = inicioC > desde ? inicioC : desde;
          const servidos = from > hasta ? 0 : monthsBetweenKeys(from, hasta) + 1;
          return c.n * c.salario * inflF(c.mes, t) * FACTOR_MENSUAL * Math.min(1, servidos / meses);
        });
        extra = cal.f * (P.nominaBase * infl + nuevos);
      }
      const gastoPlan = sum(gastosPlan.filter((g) => t >= g.mes), (g) => g.monto * inflF(g.mes, t));
      const fijos = P.fijosBase * (1 + P.fijosPct) * infl + nominaNueva + extra + gastoPlan;
      const ebitda = ventas - cogs - variables - fijos;
      // Inversiones del mes y su depreciación desde el mes siguiente
      const invMes = invs.filter((i) => i.mes === t);
      const capexAdd = ventas * (Number(P.capexPct) || 0) + sum(invMes, (i) => i.monto);
      if (capexAdd > 0) newDep.push({ m: capexAdd / (Math.max(1, Number(P.vidaUtil) || 10) * 12), from: t + 1 });
      const capexPaid = capexAdd + cxpCapex;
      cxpCapex = 0;
      const dep = depBase + sum(newDep.filter((d) => t >= d.from), (d) => d.m);
      const ebit = ebitda - dep;
      // Deuda actual, créditos nuevos y línea de crédito
      const intE = deudaE * mrD;
      const abE = Math.min(deudaE, Math.max(0, Number(P.abonoMensual) || 0));
      let intN = 0;
      let abN = 0;
      let disb = 0;
      creds.forEach((c) => {
        if (t === c.mes) {
          c.bal = c.monto;
          disb += c.monto;
        } else if (t > c.mes && c.bal > 0) {
          const i = c.bal * c.mr;
          const cap = Math.min(c.bal, c.cuota - i);
          c.bal -= cap;
          intN += i;
          abN += cap;
        }
      });
      const intL = linea * mrL;
      const otrosFin = ventas * (Number(P.otrosFinancierosPct) || 0);
      const financieros = intE + intN + intL + otrosFin;
      const otros = Number(P.otrosIngresos) || 0;
      const uai = ebit - financieros + otros;
      const impuesto = P.regimen === 'simple' ? (ventas + otros) * (Number(P.tasaSimple) || 0) : uai * (Number(P.tasaRenta) || 0);
      const utilidad = uai - impuesto;
      // Pago del impuesto de renta (abril y junio)
      let taxPaid = 0;
      if (mm === '04' || mm === '06') {
        const prevY = String(Number(year) - 1);
        const base = snapDec[prevY];
        if (base > 0) {
          const already = pagadoAno[prevY] || 0;
          const target = mm === '04' ? base * 0.5 : base;
          taxPaid = Math.max(0, target - already);
          pagadoAno[prevY] = already + taxPaid;
        }
      }
      // Capital de trabajo
      const f = Math.min(1, t / 2);
      const dsoT = A.dso + (P.dso - A.dso) * f;
      const dpoT = A.dpo + (P.dpo - A.dpo) * f;
      const newCxc = (ventas * dsoT) / 30;
      const newInv = (cogs * (Number(P.dio) || 0)) / 30;
      const nominaPart = P.nominaBase * infl + nominaNueva + extra;
      const compras = Math.max(0, cogs + variables + fijos - nominaPart);
      const newCxp = (compras * dpoT) / 30;
      const dCxc = newCxc - cxc;
      const dInv = newInv - inv;
      const dCxp = newCxp - cxp;
      const dImp = impuesto - taxPaid;
      const flujoOper = utilidad + dep - dCxc - dInv + dCxp + dImp;
      const flujoInv = -capexPaid;
      deudaE -= abE;
      let flujoFin = disb - abE - abN - (Number(P.dividendos) || 0);
      let cajaPre = caja + flujoOper + flujoInv + flujoFin;
      let draw = 0;
      let repay = 0;
      if (P.lineaCredito) {
        if (cajaPre < P.cajaMinima) draw = P.cajaMinima - cajaPre;
        else if (linea > 0) repay = Math.min(linea, cajaPre - P.cajaMinima);
        linea += draw - repay;
        flujoFin += draw - repay;
        cajaPre += draw - repay;
      }
      const cajaPrev = caja;
      caja = cajaPre;
      cxc = newCxc;
      inv = newInv;
      cxp = newCxp;
      impPagar += dImp;
      afBruto += capexAdd;
      depAcum += dep;
      patrimonio += utilidad - (Number(P.dividendos) || 0);
      if (mm === '12') snapDec[year] = impPagar;
      const deudaN = sum(creds, (c) => c.bal);
      const afNeto = afBruto - depAcum;
      const totalActivos = caja + cxc + antProv + inv + afNeto;
      const totalPasivos = cxp + cxpCapex + antCli + impPagar + deudaE + deudaN + linea;
      const deudaTotal = deudaE + deudaN + linea;
      const abonoProx = Math.min(deudaE, abE * 12) + sum(creds, (c) => (c.bal > 0 ? Math.min(c.bal, c.cuota * 12) : 0)) + linea;
      rows.push({
        t, key, ventas, cogs, variables, fijos, ebitda, depreciacion: dep, utilidadOperativa: ebit, financieros, otrosIngresos: otros, uai, impuesto, utilidad,
        utilidadBruta: ventas - cogs, opexTotal: variables + fijos,
        cobros: ventas + otros - dCxc,
        pagos: cogs + variables + fijos + financieros - dCxp + dInv + taxPaid,
        impuestoPagado: taxPaid, abonos: abE + abN, inversion: capexPaid, prestamo: disb + draw, repago: repay, dividendos: Number(P.dividendos) || 0,
        flujo: caja - cajaPrev, flujoOper, flujoInv, flujoFin, caja, cxc, cxp, inventario: inv, dso: dsoT,
        extra, extraLabel: cal && extra > 0 ? cal.label : null, nominaNueva, linea,
        cf: { utilidadNeta: utilidad, depreciacion: dep, cxc: -dCxc, inventario: -dInv, cxp: dCxp, impuestos: dImp, antProv: 0, antCli: 0, operacion: flujoOper, inversion: flujoInv, prestamos: disb + draw, abonos: -(abE + abN + repay), aportes: 0, retiros: -(Number(P.dividendos) || 0), financiacion: flujoFin, neto: flujoOper + flujoInv + flujoFin },
        bal: {
          caja, cxc, antProv, inventario: inv, afBruto, depAcum, afNeto, corrientes: Math.max(0, caja) + cxc + antProv + inv, activos: totalActivos,
          cxp, cxpCapex, antCli, impuestos: impPagar, deuda: deudaTotal, deudaCP: Math.min(deudaTotal, abonoProx), deudaLP: Math.max(0, deudaTotal - abonoProx), linea,
          pasivos: totalPasivos, patrimonio, diff: totalActivos - totalPasivos - patrimonio - diff0,
        },
      });
      rows[rows.length - 1].bal.pasivosCorrientes = cxp + cxpCapex + antCli + Math.max(0, impPagar) + rows[rows.length - 1].bal.deudaCP;
    }

    const minRow = rows.reduce((a, r) => (r.caja < a.caja ? r : a), rows[0]);
    const vT = sum(rows, (r) => r.ventas);
    const mcPct = (vT - sum(rows, (r) => r.cogs + r.variables)) / (vT || 1);
    const fijosProm = avg(rows, (r) => r.fijos - r.extra);
    const maxLinea = Math.max(0, ...rows.map((r) => r.linea));
    return {
      supuestos: P,
      planesIncluidos: planes.filter((p) => inH(tOf(p.fecha))),
      rows,
      summary: {
        cajaFinal: rows[rows.length - 1].caja,
        cajaMin: minRow.caja,
        mesMin: minRow.key,
        primerNegativo: (rows.find((r) => r.caja < 0) || {}).key || null,
        mesesBajoColchon: rows.filter((r) => r.caja < P.cajaMinima - 1).length,
        financiacion: P.lineaCredito ? maxLinea : Math.max(0, P.cajaMinima - minRow.caja),
        colchon: P.cajaMinima,
        utilidadTotal: sum(rows, (r) => r.utilidad),
        uaiTotal: sum(rows, (r) => r.uai),
        ebitdaTotal: sum(rows, (r) => r.ebitda),
        ventasTotal: vT,
        margenNeto: sum(rows, (r) => r.utilidad) / (vT || 1),
        puntoEquilibrio: mcPct > 0 ? (fijosProm + avg(rows, (r) => r.depreciacion) + avg(rows, (r) => r.financieros)) / mcPct : null,
        extras: rows.filter((r) => r.extraLabel).map((r) => ({ key: r.key, label: r.extraLabel, value: r.extra })),
        impuestosPagados: rows.filter((r) => r.impuestoPagado > 0).map((r) => ({ key: r.key, value: r.impuestoPagado })),
        maxLinea,
        maxDiff: Math.max(...rows.map((r) => Math.abs(r.bal.diff))),
      },
    };
  }

  /* =========================================================
     Escenarios del simulador (sobre el mismo modelo de tres estados)
     ========================================================= */
  const DEFAULT_SCENARIO = {
    horizonte: 6, ventasPct: 0, precioPct: 0, costoPct: 0, fijosPct: 0,
    nuevosEmpleados: 0, salario: 2500000, mesContratacion: 1,
    dso: null, dpo: null,
    inversionMonto: 0, inversionMes: 1,
    prestamoMonto: 0, prestamoTasa: 0.21, prestamoPlazo: 24, prestamoMes: 1,
    prestaciones: true,
    incluirPlanes: false,
  };

  function project(model, scenario) {
    const sc = Object.assign({}, DEFAULT_SCENARIO, scenario || {});
    const A = model.assumptions;
    if (sc.dso == null) sc.dso = A.dso;
    if (sc.dpo == null) sc.dpo = A.dpo;
    const pf = proforma(model, {
      horizonte: sc.horizonte, ventasPct: sc.ventasPct, precioPct: sc.precioPct, costoPct: sc.costoPct, fijosPct: sc.fijosPct,
      prestaciones: sc.prestaciones, dso: sc.dso, dpo: sc.dpo, incluirPlanes: !!sc.incluirPlanes,
      contrataciones: sc.nuevosEmpleados ? [{ n: sc.nuevosEmpleados, salario: sc.salario, mes: sc.mesContratacion }] : [],
      inversiones: sc.inversionMonto ? [{ monto: sc.inversionMonto, mes: sc.inversionMes }] : [],
      creditos: sc.prestamoMonto ? [{ monto: sc.prestamoMonto, tasa: sc.prestamoTasa, plazo: sc.prestamoPlazo, mes: sc.prestamoMes }] : [],
    });
    return { scenario: sc, rows: pf.rows, summary: pf.summary, proforma: pf };
  }

  /* =========================================================
     Valoración y herramientas avanzadas
     ========================================================= */
  const fin = {
    /** Tasa mensual equivalente a una efectiva anual */
    mensual: (ea) => Math.pow(1 + ea, 1 / 12) - 1,
    capm({ rf, beta, erp, crp = 0, size = 0 }) {
      return rf + beta * erp + crp + size;
    },
    relever(betaU, de, tax) {
      return betaU * (1 + (1 - tax) * de);
    },
    wacc({ E, D: Dd, ke, kd, tax }) {
      const V = E + Dd;
      if (!V) return null;
      return (E / V) * ke + (Dd / V) * kd * (1 - tax);
    },
    npv(rate, flows) {
      return flows.reduce((s, f, t) => s + f / Math.pow(1 + rate, t), 0);
    },
    irr(flows) {
      const f = (r) => fin.npv(r, flows);
      let lo = -0.99;
      let hi = 10;
      if (f(lo) * f(hi) > 0) return null;
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (f(lo) * f(mid) <= 0) hi = mid;
        else lo = mid;
      }
      return (lo + hi) / 2;
    },
    payback(flows) {
      let acc = 0;
      for (let t = 0; t < flows.length; t++) {
        const prevAcc = acc;
        acc += flows[t];
        if (t > 0 && acc >= 0 && prevAcc < 0) return t - 1 + -prevAcc / flows[t];
      }
      return null;
    },
    loan({ monto, tasaEA, plazo }) {
      const mr = fin.mensual(tasaEA);
      const cuota = mr ? (monto * mr) / (1 - Math.pow(1 + mr, -plazo)) : monto / plazo;
      let saldo = monto;
      const tabla = [];
      for (let i = 1; i <= plazo; i++) {
        const interes = saldo * mr;
        const capital = Math.min(saldo, cuota - interes);
        saldo -= capital;
        tabla.push({ n: i, cuota, interes, capital, saldo: Math.max(0, saldo) });
      }
      return { cuota, mr, tabla, totalInteres: sum(tabla, (r) => r.interes), totalPagado: cuota * plazo };
    },
    /** DCF a 5 años con valor terminal (Gordon) */
    dcf({ ventas0, crecimientos, margenEbitda, tax, capexPct, ctPct, wacc, g, deudaNeta }) {
      let ventas = ventas0;
      const years = crecimientos.map((gr, i) => {
        const vPrev = ventas;
        ventas = ventas * (1 + gr);
        const ebitda = ventas * margenEbitda;
        const impuestos = Math.max(0, ebitda) * tax;
        const capex = ventas * capexPct;
        const dCT = (ventas - vPrev) * ctPct;
        const fcf = ebitda - impuestos - capex - dCT;
        const df = 1 / Math.pow(1 + wacc, i + 1);
        return { year: i + 1, ventas, ebitda, impuestos, capex, dCT, fcf, df, vp: fcf * df };
      });
      const lastF = years[years.length - 1].fcf;
      const tv = wacc > g ? (lastF * (1 + g)) / (wacc - g) : null;
      const vpTv = tv != null ? tv * years[years.length - 1].df : null;
      const ev = sum(years, (y) => y.vp) + (vpTv || 0);
      return { years, tv, vpTv, ev, equity: ev - deudaNeta, pctTerminal: vpTv != null && ev ? vpTv / ev : null };
    },
  };

  /** Escenarios precalculados que el asistente puede citar */
  function presetScenarios(model) {
    const A = model.assumptions;
    const run = (label, sc) => ({ label, ...project(model, Object.assign({ horizonte: 6 }, sc)).summary });
    const out = {
      base: run('Proyección base (tendencia actual)', {}),
      ventas15: run('Ventas caen 15 %', { ventasPct: -0.15 }),
      contratar1: run('Contratar 1 persona con salario de $2,5 M', { nuevosEmpleados: 1, salario: 2500000 }),
      cobro30: run('Cobrar a 30 días', { dso: Math.min(30, A.dso) }),
      precio5: run('Subir precios 5 %', { precioPct: 0.05 }),
    };
    if (model.context.planes.length) out.planes = run('Ejecutar los planes de la bitácora (12 meses)', { incluirPlanes: true, horizonte: 12 });
    return out;
  }

  MF.engine = { compute, project, proforma, modelDefaults, baseAssumptions, presetScenarios, normalizeContext, fin, IND, DEFAULT_SCENARIO, FACTOR_PRESTACIONAL, CALENDARIO, venceDe };
})(typeof window !== 'undefined' ? window : globalThis);
