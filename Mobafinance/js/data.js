/* =========================================================
   MobaFinance AI — Capa 1: Datos
   Catálogo de categorías, datos de ejemplo, importación de Excel/CSV
   ========================================================= */
(function (root) {
  'use strict';
  const MF = root.MF;
  const { D, util } = MF;
  const { norm } = util;

  const STORE_KEY = 'mobafinance:dataset:v1';
  const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

  /* ---------- Catálogo ----------
     comportamiento: fijo | variable (para margen de contribución y punto de equilibrio)
     grupo: costo | operacional | financiero  */
  const TIPOS = ['Ingreso', 'Gasto', 'Inversión', 'Financiamiento'];
  const CATALOG = {
    Ingreso: [
      { name: 'Ventas de productos', aliases: ['ventas', 'venta', 'ventas productos', 'facturacion', 'ingresos operacionales', 'ventas de mercancia', 'ventas mostrador', 'ventas online'] },
      { name: 'Ventas de servicios', aliases: ['servicios prestados', 'venta de servicios', 'prestacion de servicios'] },
      { name: 'Otros ingresos', aliases: ['otros ingresos', 'rendimientos', 'intereses ganados', 'ingresos no operacionales', 'recuperaciones', 'otros'] },
    ],
    Gasto: [
      { name: 'Costo de ventas', grupo: 'costo', comportamiento: 'variable', aliases: ['costo de ventas', 'costo', 'costos', 'materia prima', 'insumos', 'mercancia', 'compras', 'inventario', 'cafe verde', 'empaques', 'proveedores', 'costo de mercancia'] },
      { name: 'Nómina', grupo: 'operacional', comportamiento: 'fijo', aliases: ['nomina', 'salarios', 'sueldos', 'prestaciones', 'seguridad social', 'prima', 'cesantias', 'personal', 'parafiscales'] },
      { name: 'Arriendo', grupo: 'operacional', comportamiento: 'fijo', aliases: ['arriendo', 'alquiler', 'canon', 'arrendamiento'] },
      { name: 'Servicios públicos', grupo: 'operacional', comportamiento: 'fijo', aliases: ['servicios publicos', 'energia', 'luz', 'agua', 'gas', 'acueducto', 'servicios'] },
      { name: 'Marketing y publicidad', grupo: 'operacional', comportamiento: 'fijo', aliases: ['marketing', 'publicidad', 'pauta', 'redes sociales', 'mercadeo', 'marketing y publicidad'] },
      { name: 'Transporte y logística', grupo: 'operacional', comportamiento: 'variable', aliases: ['transporte', 'fletes', 'envios', 'domicilios', 'logistica', 'mensajeria', 'transporte y logistica'] },
      { name: 'Software y tecnología', grupo: 'operacional', comportamiento: 'fijo', aliases: ['software', 'tecnologia', 'internet', 'licencias', 'telefonia', 'hosting', 'software y tecnologia'] },
      { name: 'Mantenimiento', grupo: 'operacional', comportamiento: 'fijo', aliases: ['mantenimiento', 'reparaciones', 'repuestos'] },
      { name: 'Honorarios', grupo: 'operacional', comportamiento: 'fijo', aliases: ['honorarios', 'contador', 'asesoria', 'consultoria', 'abogado', 'revisor fiscal'] },
      { name: 'Impuestos y contribuciones', grupo: 'operacional', comportamiento: 'variable', aliases: ['impuestos', 'ica', 'predial', 'contribuciones', 'industria y comercio', 'camara de comercio', 'impuestos y contribuciones'] },
      { name: 'Gastos financieros', grupo: 'financiero', comportamiento: 'fijo', aliases: ['intereses', 'gastos financieros', 'comisiones bancarias', 'gastos bancarios', '4x1000', 'gmf', 'cuota de manejo', 'intereses prestamo'] },
      { name: 'Otros gastos', grupo: 'operacional', comportamiento: 'fijo', aliases: ['otros gastos', 'varios', 'papeleria', 'aseo', 'cafeteria', 'otros'] },
      // El impuesto de renta se causa en el motor; aquí se registran sus pagos
      { name: 'Impuesto de renta', grupo: 'renta', comportamiento: 'fijo', aliases: ['impuesto de renta', 'renta', 'declaracion de renta', 'anticipo de renta', 'impuesto sobre la renta', 'pago de renta'] },
    ],
    'Inversión': [
      { name: 'Maquinaria y equipo', vida: 10, aliases: ['maquinaria', 'equipo', 'equipos', 'maquinas', 'maquinaria y equipo'] },
      { name: 'Tecnología', vida: 5, aliases: ['computadores', 'tecnologia', 'hardware', 'computador'] },
      { name: 'Adecuaciones', vida: 10, aliases: ['adecuaciones', 'remodelacion', 'obras', 'mejoras'] },
      { name: 'Vehículos', vida: 10, aliases: ['vehiculo', 'vehiculos', 'moto', 'camion', 'furgon'] },
    ],
    Financiamiento: [
      { name: 'Préstamo recibido', signo: 1, aliases: ['prestamo recibido', 'prestamo', 'credito', 'desembolso', 'financiacion'] },
      { name: 'Abono a capital', signo: -1, aliases: ['abono a capital', 'pago prestamo', 'amortizacion', 'cuota capital', 'abono', 'pago credito'] },
      { name: 'Aporte de socios', signo: 1, aliases: ['aporte de socios', 'aporte', 'capitalizacion'] },
      { name: 'Retiro de socios', signo: -1, aliases: ['retiro de socios', 'retiro', 'dividendos', 'utilidades repartidas'] },
    ],
  };
  const DEFAULT_CAT = { Ingreso: 'Ventas de productos', Gasto: 'Otros gastos', 'Inversión': 'Maquinaria y equipo', Financiamiento: 'Préstamo recibido' };

  const META = {};
  TIPOS.forEach((t) => CATALOG[t].forEach((c) => (META[t + '|' + c.name] = { tipo: t, ...c })));

  function catMeta(tipo, categoria) {
    return META[tipo + '|' + categoria] || { tipo, name: categoria, grupo: 'operacional', comportamiento: 'fijo', aliases: [] };
  }
  function categoriesFor(tipo) {
    return (CATALOG[tipo] || []).map((c) => c.name);
  }
  /** Dirección del dinero: +1 entra, −1 sale */
  function signOf(tx) {
    if (tx.tipo === 'Ingreso') return 1;
    if (tx.tipo === 'Financiamiento') return catMeta(tx.tipo, tx.categoria).signo || 1;
    return -1;
  }

  /* =========================================================
     Datos de ejemplo — Café Alto Andino S.A.S. (empresa ficticia)
     Historia: las ventas crecen ~50 % en 12 meses (entra una cadena de
     supermercados que paga a 60+ días), compran una tostadora nueva y la caja cae.
     ========================================================= */
  function demo() {
    const r = MF.rng(20260930);
    const CORTE = '2026-09-30';
    const months = D.monthsBetween('2025-10', '2026-09');
    const tx = [];
    let n = 0;
    const pad = (x) => String(x).padStart(2, '0');
    const day = (key, d) => key + '-' + pad(Math.min(d, D.daysInMonth(key)));
    const paid = (fecha, delay) => {
      const p = D.addDays(fecha, Math.max(0, Math.round(delay)));
      return p <= CORTE ? p : '';
    };
    const add = (o) => {
      tx.push({
        id: 'd' + (++n).toString(36),
        tipo: o.tipo,
        categoria: o.categoria,
        descripcion: o.descripcion || '',
        tercero: o.tercero || '',
        fecha: o.fecha,
        monto: Math.round(o.monto / 1000) * 1000,
        fechaPago: o.fechaPago ?? o.fecha,
        vence: o.vence || '',
        naturaleza: o.naturaleza || '',
        nota: o.nota || '',
      });
    };
    const season = { '01': 0.86, '02': 0.92, '03': 0.98, '04': 0.97, '05': 1.02, '06': 1.02, '07': 1.04, '08': 1.06, '09': 1.05, '10': 1.0, '11': 1.04, '12': 1.2 };
    const s = (key) => season[key.slice(5)];
    const idx = (key) => Math.max(0, months.indexOf(key));

    /* ---------- Ventas ---------- */
    const cafes = ['Café La Cumbre', 'Barista Lab', 'Tinto & Arte', 'La Molienda', 'Café Ventana', 'El Grano Dorado', 'Café Aurora', 'Taza Fina'];
    const hoteles = ['Hotel Sierra Azul', 'Hotel Mirador del Valle', 'Casa Cielo Hotel Boutique', 'Restaurante Leña y Fuego'];
    const superVentas = { '2026-02': 12e6, '2026-03': 18e6, '2026-04': 21e6, '2026-05': 24e6, '2026-06': 26e6, '2026-07': 27e6, '2026-08': 29e6, '2026-09': 30e6 };

    function invoices(key, total, clients, perClient, terms, delayMu, delaySd, cat, label) {
      const shares = clients.map(() => 0.6 + r() * 0.8);
      const tot = util.sum(shares);
      clients.forEach((c, i) => {
        const amount = (total * shares[i]) / tot;
        for (let k = 0; k < perClient; k++) {
          const fecha = day(key, Math.round(((k + 0.5) / perClient) * 27) + r.int(-3, 3) + 1);
          const pago = paid(fecha, terms + r.normal(delayMu, delaySd));
          add({
            tipo: 'Ingreso', categoria: cat, tercero: c, fecha,
            descripcion: label + ' · factura ' + (1000 + n),
            monto: (amount / perClient) * (0.9 + r() * 0.2),
            vence: D.addDays(fecha, terms),
            // Un hotel dejó de pagar desde junio
            fechaPago: c === 'Hotel Mirador del Valle' && fecha >= '2026-06-01' ? '' : pago,
          });
        }
      });
    }

    // Facturas de agosto y septiembre de 2025: forman la cartera inicial
    ['2025-08', '2025-09'].forEach((key) => {
      invoices(key, 25e6, cafes, 1, 30, 4, 5, 'Ventas de productos', 'Café tostado para cafetería');
      invoices(key, 11.5e6, hoteles, 1, 45, 6, 6, 'Ventas de productos', 'Café para hotel y restaurante');
    });

    months.forEach((key) => {
      const i = idx(key);
      // Tienda online y punto de venta: se cobra el mismo día (lotes semanales)
      const retail = 30e6 * Math.pow(1.012, i) * s(key);
      [7, 14, 21, 28].forEach((d, k) => {
        const f = day(key, d);
        add({ tipo: 'Ingreso', categoria: 'Ventas de productos', tercero: k % 2 ? 'Punto de venta Laureles' : 'Tienda online', fecha: f, descripcion: 'Ventas al detal · semana ' + (k + 1), monto: (retail / 4) * (0.9 + r() * 0.2), fechaPago: f });
      });
      invoices(key, 26e6 * Math.pow(1.018, i) * s(key), cafes, 2, 30, 4 + i * 0.45, 5, 'Ventas de productos', 'Café tostado para cafetería');
      invoices(key, 12e6 * Math.pow(1.015, i) * s(key), hoteles, 1, 45, 6 + i * 0.4, 6, 'Ventas de productos', 'Café para hotel y restaurante');
      // La cadena paga cada vez más tarde: de 8 a ~19 días después del plazo pactado
      if (superVentas[key]) invoices(key, superVentas[key], ['Cadena Súper Ahorro'], 2, 60, 8 + (i - 4) * 1.6, 3, 'Ventas de productos', 'Pedido góndola café molido');
      if (key >= '2026-01') invoices(key, (6e6 + (i - 3) * 0.3e6) * s(key), ['Distribuciones Eje Cafetero'], 1, 30, 5, 4, 'Ventas de productos', 'Café para distribución regional');
      if (key === '2026-03' || key === '2026-08') add({ tipo: 'Ingreso', categoria: 'Ventas de servicios', tercero: 'Barista Lab', fecha: day(key, 18), descripcion: 'Taller de barismo y catación', monto: 2.4e6, fechaPago: day(key, 18) });
      add({ tipo: 'Ingreso', categoria: 'Otros ingresos', tercero: 'Banco · cuenta de ahorros', fecha: day(key, 30), descripcion: 'Rendimientos financieros', monto: 60e3 + r() * 40e3, fechaPago: day(key, 30) });
    });

    /* ---------- Costo de ventas (café verde, empaques) ---------- */
    const ventasMes = {};
    tx.forEach((t) => {
      if (t.tipo === 'Ingreso' && t.categoria !== 'Otros ingresos') ventasMes[D.month(t.fecha)] = (ventasMes[D.month(t.fecha)] || 0) + t.monto;
    });
    // El café verde sube durante 2026: el margen bruto se comprime
    const cogsPct = { '2025-09': 0.5, '2025-10': 0.5, '2025-11': 0.5, '2025-12': 0.5, '2026-01': 0.51, '2026-02': 0.52, '2026-03': 0.535, '2026-04': 0.545, '2026-05': 0.555, '2026-06': 0.565, '2026-07': 0.575, '2026-08': 0.583, '2026-09': 0.59 };
    const suppliers = [
      { t: 'Trilladora San Isidro', share: 0.68, terms: 20, d: 'Café verde excelso' },
      { t: 'Empaques Andinos S.A.S.', share: 0.2, terms: 30, d: 'Bolsas con válvula y etiquetas' },
      { t: 'Finca La Esperanza', share: 0.12, terms: 8, d: 'Café especial de origen' },
    ];
    ['2025-09', ...months].forEach((key) => {
      const base = key === '2025-09' ? 72e6 : ventasMes[key];
      const total = base * cogsPct[key];
      suppliers.forEach((sp) => {
        [6, 20].forEach((d0) => {
          const fecha = day(key, d0 + r.int(-2, 2));
          add({ tipo: 'Gasto', categoria: 'Costo de ventas', tercero: sp.t, fecha, descripcion: sp.d, monto: ((total * sp.share) / 2) * (0.94 + r() * 0.12), vence: D.addDays(fecha, sp.terms), fechaPago: paid(fecha, sp.terms + r.normal(0, 2)) });
        });
      });
    });

    /* ---------- Gastos operacionales ---------- */
    months.forEach((key) => {
      const v = ventasMes[key];
      const base = key < '2026-01' ? 16.2e6 : key < '2026-03' ? 17.6e6 : 22.4e6; // salarios + seguridad social
      add({ tipo: 'Gasto', categoria: 'Nómina', tercero: 'Empleados', fecha: day(key, 15), descripcion: 'Nómina 1ª quincena', monto: base / 2 });
      add({ tipo: 'Gasto', categoria: 'Nómina', tercero: 'Empleados', fecha: day(key, 30), descripcion: 'Nómina 2ª quincena y seguridad social', monto: base / 2 });
      const prima = 'Prima de servicios semestral (obligatoria en junio y diciembre).';
      if (key === '2025-12') add({ tipo: 'Gasto', categoria: 'Nómina', tercero: 'Empleados', fecha: day(key, 18), descripcion: 'Prima de servicios (2º semestre)', monto: 6.1e6, naturaleza: 'recurrente', nota: prima });
      if (key === '2026-06') add({ tipo: 'Gasto', categoria: 'Nómina', tercero: 'Empleados', fecha: day(key, 26), descripcion: 'Prima de servicios (1er semestre)', monto: 8.4e6, naturaleza: 'recurrente', nota: prima });
      if (key === '2026-01') add({ tipo: 'Gasto', categoria: 'Nómina', tercero: 'Empleados', fecha: day(key, 30), descripcion: 'Intereses sobre cesantías 2025', monto: 1.46e6, naturaleza: 'recurrente' });
      if (key === '2026-02') add({ tipo: 'Gasto', categoria: 'Nómina', tercero: 'Fondo de cesantías', fecha: day(key, 13), descripcion: 'Consignación de cesantías 2025', monto: 12.2e6, naturaleza: 'recurrente', nota: 'Pago anual de cesantías al fondo; se repite cada febrero.' });

      add({ tipo: 'Gasto', categoria: 'Arriendo', tercero: 'Inmobiliaria Los Andes', fecha: day(key, 5), descripcion: 'Arriendo bodega y tostadora', monto: key < '2026-01' ? 4.6e6 : 4.84e6 });
      add({ tipo: 'Gasto', categoria: 'Servicios públicos', tercero: 'Empresa de servicios públicos', fecha: day(key, 22), descripcion: 'Energía, agua y gas', monto: (key >= '2026-06' ? 1.78e6 : 1.32e6) * (0.92 + r() * 0.16), vence: day(key, 28), fechaPago: day(key, 27) });
      add({ tipo: 'Gasto', categoria: 'Marketing y publicidad', tercero: 'Pauta en redes sociales', fecha: day(key, 10), descripcion: 'Campañas digitales', monto: key === '2025-12' ? 4.5e6 : 2.1e6 + r() * 1.1e6 });
      add({ tipo: 'Gasto', categoria: 'Transporte y logística', tercero: 'Transportes La Ruta S.A.S.', fecha: day(key, 28), descripcion: 'Fletes y entregas a clientes', monto: v * 0.03 * (0.95 + r() * 0.1), vence: D.addDays(day(key, 28), 15), fechaPago: paid(day(key, 28), 15) });
      add({ tipo: 'Gasto', categoria: 'Software y tecnología', tercero: 'Software contable y POS', fecha: day(key, 3), descripcion: 'Suscripciones de software', monto: 0.62e6 });
      add({ tipo: 'Gasto', categoria: 'Honorarios', tercero: 'Contadores Asociados', fecha: day(key, 25), descripcion: 'Asesoría contable y tributaria', monto: 1.45e6 });
      add({ tipo: 'Gasto', categoria: 'Otros gastos', tercero: 'Varios', fecha: day(key, 16), descripcion: 'Papelería, aseo y cafetería', monto: 0.35e6 + r() * 0.35e6 });
      // ICA (≈ 0,9 % de las ventas del mes)
      add({ tipo: 'Gasto', categoria: 'Impuestos y contribuciones', tercero: 'Secretaría de Hacienda', fecha: day(key, 19), descripcion: 'Impuesto de industria y comercio (ICA)', monto: v * 0.009 });
      add({ tipo: 'Gasto', categoria: 'Gastos financieros', tercero: 'Banco', fecha: day(key, 30), descripcion: 'GMF (4×1000) y comisiones', monto: v * 0.0035 });
    });
    [['2025-11', 0.9e6, 'Mantenimiento preventivo molinos'], ['2026-02', 1.2e6, 'Cambio de rodamientos'], ['2026-04', 4.8e6, 'Reparación mayor tostadora antigua'], ['2026-08', 0.8e6, 'Calibración de báscula y empacadora']].forEach(([key, m, d]) =>
      add({ tipo: 'Gasto', categoria: 'Mantenimiento', tercero: 'Servicio técnico industrial', fecha: day(key, 12), descripcion: d, monto: m, ...(key === '2026-04' ? { naturaleza: 'extraordinario', nota: 'Falla del quemador de la tostadora antigua. No debería repetirse con la máquina nueva.' } : {}) })
    );
    // Impuesto de renta del año gravable 2025, pagado en dos cuotas
    add({ tipo: 'Gasto', categoria: 'Impuesto de renta', tercero: 'DIAN', fecha: '2026-04-21', descripcion: 'Impuesto de renta año gravable 2025 (1ª cuota)', monto: 5.2e6, naturaleza: 'recurrente' });
    add({ tipo: 'Gasto', categoria: 'Impuesto de renta', tercero: 'DIAN', fecha: '2026-06-16', descripcion: 'Impuesto de renta año gravable 2025 (2ª cuota)', monto: 5.2e6, naturaleza: 'recurrente' });

    /* ---------- Créditos: anterior (vehículo) y nuevo (tostadora) ---------- */
    const mr = Math.pow(1.21, 1 / 12) - 1; // 21 % E.A.
    let saldoAnt = 24e6;
    months.forEach((key) => {
      const int = saldoAnt * mr;
      add({ tipo: 'Gasto', categoria: 'Gastos financieros', tercero: 'Banco · crédito vehículo', fecha: day(key, 8), descripcion: 'Intereses crédito vehículo', monto: int });
      add({ tipo: 'Financiamiento', categoria: 'Abono a capital', tercero: 'Banco · crédito vehículo', fecha: day(key, 8), descripcion: 'Abono a capital crédito vehículo', monto: 1e6 });
      saldoAnt -= 1e6;
    });
    add({ tipo: 'Financiamiento', categoria: 'Préstamo recibido', tercero: 'Banco · crédito comercial', fecha: '2026-05-08', descripcion: 'Desembolso crédito tostadora (36 meses, 21 % E.A.)', monto: 50e6, nota: 'Crédito para financiar la tostadora nueva; cuota fija mensual de unos $1,84 M.' });
    const cuota = (50e6 * mr) / (1 - Math.pow(1 + mr, -36));
    let saldoNuevo = 50e6;
    D.monthsBetween('2026-06', '2026-09').forEach((key) => {
      const int = saldoNuevo * mr;
      const cap = cuota - int;
      saldoNuevo -= cap;
      add({ tipo: 'Gasto', categoria: 'Gastos financieros', tercero: 'Banco · crédito comercial', fecha: day(key, 8), descripcion: 'Intereses crédito tostadora', monto: int });
      add({ tipo: 'Financiamiento', categoria: 'Abono a capital', tercero: 'Banco · crédito comercial', fecha: day(key, 8), descripcion: 'Abono a capital crédito tostadora', monto: cap });
    });

    /* ---------- Inversiones ---------- */
    add({ tipo: 'Inversión', categoria: 'Tecnología', tercero: 'Tecnología Comercial S.A.S.', fecha: '2025-11-14', descripcion: 'Computadores y sistema POS', monto: 4.2e6 });
    const tost = 'Tostadora de 30 kg: triplica la capacidad de tostión para atender a Súper Ahorro.';
    add({ tipo: 'Inversión', categoria: 'Maquinaria y equipo', tercero: 'Maquinaria Térmica S.A.S.', fecha: '2026-05-12', descripcion: 'Anticipo tostadora industrial 30 kg', monto: 39e6, nota: tost });
    add({ tipo: 'Inversión', categoria: 'Maquinaria y equipo', tercero: 'Maquinaria Térmica S.A.S.', fecha: '2026-06-18', descripcion: 'Saldo tostadora industrial 30 kg', monto: 39e6, nota: tost });

    tx.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    // Notas de contexto sobre facturas puntuales
    const firstSuper = tx.find((t) => t.tercero === 'Cadena Súper Ahorro');
    if (firstSuper) firstSuper.nota = 'Primer pedido de la cadena; plazo pactado de 60 días.';
    const hotelJun = tx.find((t) => t.tercero === 'Hotel Mirador del Valle' && t.fecha >= '2026-06-01');
    if (hotelJun) hotelJun.nota = 'Primera factura sin pagar: el hotel entró en reestructuración.';

    const ev = (id, fecha, tipo, titulo, detalle, impacto) => ({ id, fecha, tipo, titulo, detalle, impacto: impacto || null });
    const context = {
      negocio: {
        descripcion: 'Tostamos y vendemos café especial colombiano. Vendemos al detal (tienda online y punto de venta en Laureles) y al por mayor a cafeterías, hoteles y, desde febrero de 2026, a la cadena de supermercados Súper Ahorro.',
        productos: 'Café en grano y molido de 250 g, 500 g y 2,5 kg. El canal de supermercados compra con precio 12 % más bajo que el mayorista; el detal es el canal con mejor margen.',
        clientes: 'Súper Ahorro pactó 60 días, pero en la práctica paga a 70–75. Las cafeterías pagan a 30 días. Hotel Mirador del Valle está en reestructuración y no paga desde junio.',
        proveedores: 'Trilladora San Isidro (café verde) nos da 20 días de plazo. El café verde subió cerca de 12 % en 2026 y no lo hemos trasladado a precios.',
        estacionalidad: 'Diciembre es el mejor mes por regalos corporativos y temporada hotelera. Enero y febrero son bajos.',
        preocupaciones: 'No queremos más deuda bancaria de largo plazo; si hace falta, preferimos factoring o descuentos por pronto pago. El banco nos pide mantener una liquidez corriente mayor a 1,2.',
        preferencias: 'Explícame como a alguien que no es financiero y dame acciones concretas con cifras.',
        notas: '',
      },
      metas: { ventasMes: 140e6, margenNeto: 0.05, dso: 30, colchonMeses: 1.5, crecimiento: 0.25 },
      eventos: [
        ev('e1', '2026-02-05', 'evento', 'Primer pedido de Súper Ahorro', 'Entramos a 18 tiendas de la cadena con plazo de 60 días.'),
        ev('e2', '2026-03-02', 'evento', 'Contratamos dos personas', 'Un operario de tostión y una auxiliar de despachos por el aumento de pedidos.'),
        ev('e3', '2026-04-12', 'evento', 'Reparación mayor de la tostadora antigua', 'Falla del quemador; gasto extraordinario de $4,8 M.'),
        ev('e4', '2026-05-08', 'evento', 'Crédito y compra de la tostadora de 30 kg', 'Crédito de $50 M a 36 meses; la tostadora costó $78 M, pagada en mayo y junio.'),
        ev('e5', '2026-06-01', 'evento', 'Hotel Mirador del Valle deja de pagar', 'Entró en reestructuración; hay un acuerdo de pago verbal.'),
        ev('p1', '2027-01-15', 'plan', 'Contratar un ejecutivo comercial B2B', 'Para abrir nuevas cadenas y hoteles.', { tipo: 'contratacion', monto: 2.8e6, cantidad: 1 }),
        ev('p2', '2027-03-01', 'plan', 'Abrir punto de venta en Envigado', 'Adecuación del local y equipos de barra.', { tipo: 'inversion', monto: 35e6 }),
        ev('p3', '2027-03-01', 'plan', 'Arriendo del local de Envigado', 'Canon mensual con administración.', { tipo: 'gasto', monto: 3.2e6 }),
        ev('p4', '2027-04-01', 'plan', 'Ventas del punto de Envigado', 'Estimamos $9 M al mes desde el segundo mes de operación.', { tipo: 'ventas', monto: 9e6 }),
      ],
      terceros: {
        'Cadena Súper Ahorro': { nota: 'Plazo pactado de 60 días; paga a 70–75. Estamos negociando 2 % de descuento por pronto pago.' },
        'Hotel Mirador del Valle': { nota: 'En reestructuración. Prometió un abono de $5 M en octubre.' },
        'Trilladora San Isidro': { nota: 'Proveedor principal de café verde. Plazo de 20 días; podría darnos 30 si compramos por volumen.' },
      },
    };

    return {
      v: 1,
      source: 'demo',
      demoVersion: DEMO_VERSION,
      updatedAt: new Date().toISOString(),
      profile: { empresa: 'Café Alto Andino S.A.S.', usuario: 'Camila', sector: 'Tostión y distribución de café', ciudad: 'Medellín' },
      saldos: {
        fechaInicio: '2025-10-01', cajaInicial: 115e6, inventario: 42e6, activosFijos: 96e6, deudaInicial: 24e6, tasaDeudaEA: 0.21, colchonMeses: 1,
        vidaUtil: 10, regimen: 'ordinario', tasaRenta: 0.35, tasaSimple: 0.04, impuestoPorPagarInicial: 7.5e6, capitalSocial: 60e6,
      },
      transactions: tx,
      context,
    };
  }

  function empty(profile, context) {
    return {
      v: 1,
      source: 'empty',
      updatedAt: new Date().toISOString(),
      profile: profile || { empresa: 'Mi empresa', usuario: '', sector: '', ciudad: '' },
      saldos: { fechaInicio: '', cajaInicial: 0, inventario: 0, activosFijos: 0, deudaInicial: 0, tasaDeudaEA: 0.21, colchonMeses: 1, vidaUtil: 10, regimen: 'ordinario', tasaRenta: 0.35, tasaSimple: 0.04, impuestoPorPagarInicial: 0, capitalSocial: null },
      transactions: [],
      context: context || { negocio: {}, metas: {}, eventos: [], terceros: {} },
    };
  }

  const DEMO_VERSION = 2;
  function load() {
    const ds = MF.store.get(STORE_KEY);
    // Los datos de ejemplo de versiones anteriores se regeneran; los del usuario nunca se tocan
    if (ds && ds.v === 1 && Array.isArray(ds.transactions) && !(ds.source === 'demo' && ds.demoVersion !== DEMO_VERSION)) {
      if (!ds.context) ds.context = { negocio: {}, metas: {}, eventos: [], terceros: {} };
      return ds;
    }
    return demo();
  }
  function save(ds) {
    ds.updatedAt = new Date().toISOString();
    return MF.store.set(STORE_KEY, ds);
  }

  /* =========================================================
     Importación — mapea encabezados libres a nuestro formato
     ========================================================= */
  const FIELDS = {
    fecha: ['fecha', 'fecha factura', 'fecha de factura', 'fecha causacion', 'fecha de causacion', 'fecha documento', 'fecha movimiento', 'date'],
    tipo: ['tipo', 'tipo de movimiento', 'movimiento', 'naturaleza', 'clase'],
    categoria: ['categoria', 'cuenta', 'rubro', 'concepto', 'clasificacion'],
    descripcion: ['descripcion', 'detalle', 'glosa', 'concepto detalle'],
    tercero: ['tercero', 'cliente', 'proveedor', 'cliente/proveedor', 'cliente o proveedor', 'contraparte', 'nombre', 'razon social'],
    monto: ['monto', 'valor', 'importe', 'total', 'valor total', 'monto (cop)', 'valor (cop)', 'cantidad'],
    ingreso: ['ingreso', 'ingresos', 'entrada', 'entradas', 'credito', 'abono'],
    egreso: ['egreso', 'egresos', 'gasto', 'gastos', 'salida', 'salidas', 'debito', 'cargo'],
    fechaPago: ['fecha de pago', 'fecha pago', 'fecha de cobro', 'fecha cobro', 'fecha de cobro/pago', 'fecha cobro/pago', 'pagado el', 'fecha real de pago'],
    vence: ['vencimiento', 'fecha de vencimiento', 'vence', 'fecha vencimiento'],
    estado: ['estado', 'pagado', 'situacion'],
    naturaleza: ['naturaleza', 'recurrencia', 'recurrente', 'extraordinario', 'tipo de gasto', 'clase de movimiento'],
    nota: ['nota para la ia', 'nota ia', 'nota', 'notas', 'comentario', 'comentarios', 'observacion', 'observaciones', 'contexto'],
  };

  /** «extraordinario» · «recurrente» · '' desde texto libre (o un Sí en una columna «Extraordinario») */
  function parseNaturaleza(v, header) {
    const n = norm(v);
    if (!n) return '';
    const h = norm(header);
    if (h.includes('extraordinario') && /^(si|x|1|true|verdadero)$/.test(n)) return 'extraordinario';
    if (/extra|no recurrente|unico|unica|excepcional|puntual|ocasional/.test(n)) return 'extraordinario';
    if (/recurrente|fijo|mensual|normal|habitual|periodic/.test(n)) return 'recurrente';
    return '';
  }

  function mapHeaders(headers) {
    const mapping = {};
    const used = new Set();
    // primero coincidencias exactas, luego parciales
    for (const pass of ['exact', 'partial']) {
      for (const [field, aliases] of Object.entries(FIELDS)) {
        if (mapping[field]) continue;
        const h = headers.find((hh) => {
          if (used.has(hh)) return false;
          const n = norm(hh).replace(/[*:]/g, '').trim();
          return pass === 'exact' ? aliases.includes(n) : aliases.some((a) => a.length > 3 && n.includes(a));
        });
        if (h != null) {
          mapping[field] = h;
          used.add(h);
        }
      }
    }
    return mapping;
  }

  /** Fecha desde Date, serial de Excel o texto dd/mm/aaaa · aaaa-mm-dd */
  function parseDate(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return D.fromDate(new Date(v.getTime() + 12 * 36e5));
    if (typeof v === 'number' && v > 20000 && v < 80000) return D.fromDays(Math.round(v) - 25569);
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
      let y = +m[3];
      if (y < 100) y += 2000;
      return valid(y, +m[2], +m[1]); // formato colombiano día/mes/año
    }
    const mm = s.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\.?\s+(?:de\s+)?(\d{4})$/i);
    if (mm) {
      const mi = D.MONTHS.findIndex((x) => norm(mm[2]).startsWith(x));
      if (mi >= 0) return valid(+mm[3], mi + 1, +mm[1]);
    }
    return '';
    function valid(y, mo, d) {
      if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return '';
      const out = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      return D.fromDays(D.toDays(out)) === out ? out : '';
    }
  }

  /** Monto desde número o texto: "$ 1.234.567,50" · "1,234,567.50" · "(25.000)" */
  function parseAmount(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    let s = String(v).trim();
    if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) {
      neg = true;
      s = s.slice(1, -1);
    }
    s = s.replace(/[^\d.,-]/g, '');
    if (s.startsWith('-')) {
      neg = !neg;
      s = s.slice(1);
    }
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) {
      const dec = lastDot > lastComma ? '.' : ',';
      const th = dec === '.' ? ',' : '.';
      s = s.split(th).join('').replace(dec, '.');
    } else if (lastComma >= 0) {
      const parts = s.split(',');
      s = parts.length === 2 && parts[1].length !== 3 ? parts.join('.') : parts.join('');
    } else if (lastDot >= 0) {
      const parts = s.split('.');
      s = parts.length > 2 || (parts.length === 2 && parts[1].length === 3) ? parts.join('') : s;
    }
    const n = parseFloat(s);
    return isNaN(n) ? NaN : neg ? -n : n;
  }

  function parseTipo(v) {
    const n = norm(v);
    if (!n) return '';
    if (/^(ingreso|venta|entrada|cobro|recaudo|credito)/.test(n)) return 'Ingreso';
    if (/^(gasto|egreso|costo|salida|compra|pago|debito)/.test(n)) return 'Gasto';
    if (/^(inversion|activo|capex)/.test(n)) return 'Inversión';
    if (/^(financ|prestamo|abono|aporte|retiro|dividendo)/.test(n)) return 'Financiamiento';
    return '';
  }

  /** Busca la categoría del catálogo; devuelve {tipo, categoria, exacta} */
  function matchCategory(raw, tipoHint) {
    const n = norm(raw);
    const tipos = tipoHint ? [tipoHint, ...TIPOS.filter((t) => t !== tipoHint)] : TIPOS;
    if (n) {
      for (const t of tipos) for (const c of CATALOG[t]) if (norm(c.name) === n) return { tipo: t, categoria: c.name, exacta: true };
      for (const t of tipos) for (const c of CATALOG[t]) if (c.aliases.includes(n)) return { tipo: t, categoria: c.name, exacta: true };
      for (const t of tipos) for (const c of CATALOG[t]) if (c.aliases.some((a) => a.length > 3 && n.includes(a))) return { tipo: t, categoria: c.name, exacta: false };
    }
    return null;
  }

  /**
   * Convierte filas (objetos encabezado→valor) en movimientos validados.
   * Devuelve { rows, issues, mapping, stats }
   */
  function parseRows(rawRows) {
    const rows = rawRows.filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
    const headers = rows.length ? Object.keys(rows.reduce((acc, r) => Object.assign(acc, r), {})) : [];
    const mapping = mapHeaders(headers);
    const issues = [];
    const out = [];
    const get = (row, f) => (mapping[f] != null ? row[mapping[f]] : '');

    if (!mapping.fecha) issues.push({ row: 0, level: 'error', msg: 'No encontramos una columna de fecha (usa «Fecha»).' });
    if (!mapping.monto && !mapping.ingreso && !mapping.egreso) issues.push({ row: 0, level: 'error', msg: 'No encontramos una columna de monto (usa «Monto» o «Valor»).' });
    if (issues.length) return { rows: [], issues, mapping, stats: { total: rows.length, ok: 0, warn: 0, skipped: rows.length } };

    rows.forEach((row, i) => {
      const line = i + 2; // fila 1 = encabezados
      const fecha = parseDate(get(row, 'fecha'));
      if (!fecha) {
        issues.push({ row: line, level: 'error', msg: 'Fecha vacía o no reconocida: «' + String(get(row, 'fecha')) + '». Se omitió la fila.' });
        return;
      }
      let monto = parseAmount(get(row, 'monto'));
      let tipo = parseTipo(get(row, 'tipo'));
      if (isNaN(monto)) {
        const inc = parseAmount(get(row, 'ingreso'));
        const egr = parseAmount(get(row, 'egreso'));
        if (!isNaN(inc) && inc !== 0) {
          monto = Math.abs(inc);
          tipo = tipo || 'Ingreso';
        } else if (!isNaN(egr) && egr !== 0) {
          monto = Math.abs(egr);
          tipo = tipo || 'Gasto';
        }
      }
      if (isNaN(monto) || monto === 0) {
        issues.push({ row: line, level: 'error', msg: 'Monto vacío o no numérico. Se omitió la fila.' });
        return;
      }
      let warn = false;
      if (monto < 0) {
        if (!tipo) tipo = 'Gasto';
        monto = Math.abs(monto);
      }
      const rawCat = get(row, 'categoria');
      const cm = matchCategory(rawCat, tipo || null);
      if (!tipo) {
        tipo = cm ? cm.tipo : '';
        if (!tipo) {
          tipo = 'Gasto';
          warn = true;
          issues.push({ row: line, level: 'warn', msg: 'Sin tipo; se registró como Gasto.' });
        }
      }
      let categoria;
      if (cm && cm.tipo === tipo) categoria = cm.categoria;
      else {
        categoria = DEFAULT_CAT[tipo];
        if (String(rawCat ?? '').trim()) {
          warn = true;
          issues.push({ row: line, level: 'warn', msg: 'Categoría «' + rawCat + '» no reconocida; se usó «' + categoria + '».' });
        }
      }
      let fechaPago = parseDate(get(row, 'fechaPago'));
      const estado = norm(get(row, 'estado'));
      if (!fechaPago && mapping.fechaPago == null) {
        // sin columna de pago: si el estado dice pendiente, queda por cobrar/pagar
        fechaPago = /pendiente|por cobrar|por pagar|no|credito/.test(estado) ? '' : fecha;
      } else if (!fechaPago && /pagad|cobrad|^si$|cancelad/.test(estado)) fechaPago = fecha;
      if (fechaPago && fechaPago < fecha) {
        warn = true;
        issues.push({ row: line, level: 'warn', msg: 'La fecha de pago es anterior a la fecha del documento.' });
      }
      if (tipo === 'Inversión' || tipo === 'Financiamiento') fechaPago = fechaPago || fecha;
      out.push({
        id: util.uid('i'),
        tipo,
        categoria,
        descripcion: String(get(row, 'descripcion') ?? '').trim().slice(0, 140),
        tercero: String(get(row, 'tercero') ?? '').trim().slice(0, 80),
        fecha,
        monto: Math.round(monto),
        fechaPago,
        vence: parseDate(get(row, 'vence')),
        naturaleza: parseNaturaleza(get(row, 'naturaleza'), mapping.naturaleza),
        nota: String(get(row, 'nota') ?? '').trim().slice(0, 400),
        _warn: warn,
      });
    });
    const warnRows = out.filter((t) => t._warn).length;
    out.forEach((t) => delete t._warn);
    return {
      rows: out,
      issues,
      mapping,
      stats: { total: rows.length, ok: out.length - warnRows, warn: warnRows, skipped: rows.length - out.length },
    };
  }

  /* ---------- SheetJS (se carga solo cuando hace falta) ---------- */
  let xlsxPromise = null;
  function loadXLSX() {
    if (root.XLSX) return Promise.resolve(root.XLSX);
    if (!xlsxPromise) {
      xlsxPromise = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = SHEETJS_URL;
        sc.async = true;
        sc.onload = () => (root.XLSX ? resolve(root.XLSX) : reject(new Error('No se pudo cargar el lector de Excel.')));
        sc.onerror = () => {
          xlsxPromise = null;
          reject(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión a internet.'));
        };
        document.head.appendChild(sc);
      });
    }
    return xlsxPromise;
  }

  async function readFile(file) {
    const XLSX = await loadXLSX();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const name = wb.SheetNames.find((n) => /movim|datos|transac|registro/i.test(n)) || wb.SheetNames[0];
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    return { sheet: name, sheets: wb.SheetNames, rows };
  }

  const TEMPLATE_HEADERS = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Cliente/Proveedor', 'Monto', 'Fecha de pago', 'Vencimiento', 'Naturaleza', 'Nota para la IA'];
  const NATURALEZA_LABEL = { recurrente: 'Recurrente', extraordinario: 'Extraordinario' };

  async function downloadTemplate() {
    const XLSX = await loadXLSX();
    const ex = [
      ['2026-09-02', 'Ingreso', 'Ventas de productos', 'Factura 1045', 'Cliente Ejemplo S.A.S.', 3500000, '2026-09-30', '2026-10-02', '', 'Cliente nuevo; pidió 30 días de plazo.'],
      ['2026-09-05', 'Gasto', 'Arriendo', 'Arriendo local', 'Inmobiliaria', 2800000, '2026-09-05', '', 'Recurrente', ''],
      ['2026-09-10', 'Gasto', 'Costo de ventas', 'Compra de insumos', 'Proveedor Ejemplo', 1900000, '', '2026-10-10', '', ''],
      ['2026-09-15', 'Gasto', 'Nómina', 'Nómina 1ª quincena', 'Empleados', 4200000, '2026-09-15', '', 'Recurrente', ''],
      ['2026-09-18', 'Gasto', 'Mantenimiento', 'Reparación del horno', 'Servicio técnico', 2300000, '2026-09-18', '', 'Extraordinario', 'Daño eléctrico por una tormenta; no se repite.'],
      ['2026-09-20', 'Inversión', 'Maquinaria y equipo', 'Horno nuevo', 'Proveedor de equipos', 8000000, '2026-09-20', '', '', 'Duplica la capacidad de producción.'],
      ['2026-09-21', 'Financiamiento', 'Préstamo recibido', 'Crédito de libre inversión', 'Banco', 10000000, '2026-09-21', '', '', '24 meses al 21 % E.A.'],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...ex]);
    ws['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 26 }, { wch: 30 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 48 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    const help = [
      ['Columna', 'Qué escribir'],
      ['Fecha', 'Fecha de la factura o del gasto (AAAA-MM-DD o DD/MM/AAAA).'],
      ['Tipo', 'Ingreso, Gasto, Inversión o Financiamiento.'],
      ['Categoría', 'Una de la lista de abajo. Si no coincide, la asignamos a «Otros».'],
      ['Descripción', 'Opcional. Qué fue.'],
      ['Cliente/Proveedor', 'Opcional, pero clave para analizar tu cartera.'],
      ['Monto', 'Valor en pesos, siempre positivo.'],
      ['Fecha de pago', 'Cuándo entró o salió el dinero. Vacía = pendiente (por cobrar o por pagar).'],
      ['Vencimiento', 'Opcional. Fecha límite de pago de la factura.'],
      ['Naturaleza', 'Opcional. «Recurrente» o «Extraordinario» (no se repite). La IA excluye lo extraordinario al normalizar tus márgenes.'],
      ['Nota para la IA', 'Opcional. Contexto que la IA debe tener en cuenta sobre ese movimiento.'],
      [],
      ['Tipo', 'Categorías'],
      ...TIPOS.map((t) => [t, categoriesFor(t).join(' · ')]),
    ];
    const wh = XLSX.utils.aoa_to_sheet(help);
    wh['!cols'] = [{ wch: 18 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wh, 'Instrucciones');
    XLSX.writeFile(wb, 'Plantilla-MobaFinance.xlsx');
  }

  async function exportXLSX(ds) {
    const XLSX = await loadXLSX();
    const rows = ds.transactions.map((t) => [t.fecha, t.tipo, t.categoria, t.descripcion, t.tercero, t.monto, t.fechaPago, t.vence, NATURALEZA_LABEL[t.naturaleza] || '', t.nota || '']);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
    ws['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 26 }, { wch: 36 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 48 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, 'MobaFinance-' + String(ds.profile.empresa || 'datos').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.xlsx');
  }

  MF.data = {
    TIPOS, CATALOG, catMeta, categoriesFor, signOf,
    demo, empty, load, save, STORE_KEY,
    parseRows, parseDate, parseAmount, mapHeaders, matchCategory, parseNaturaleza,
    loadXLSX, readFile, downloadTemplate, exportXLSX, TEMPLATE_HEADERS, NATURALEZA_LABEL,
  };
})(typeof window !== 'undefined' ? window : globalThis);
