/* =========================================================
   MobaFinance AI — Gráficos SVG livianos
   Líneas suaves (monótonas), barras, cascada, chispas, anillo.
   Todos con tooltip, foco por teclado y vista de tabla.
   ========================================================= */
(function (root) {
  'use strict';
  const MF = root.MF;
  const { fmt, D, util } = MF;

  /* ---------- Montaje responsivo ---------- */
  let observers = [];
  function mount(el, render) {
    if (!el) return;
    if (el._mfRo) el._mfRo.disconnect();
    let lastW = 0;
    const draw = () => {
      const w = Math.floor(el.clientWidth);
      if (!w || w === lastW) return;
      lastW = w;
      render(w);
    };
    draw();
    if (root.ResizeObserver) {
      const ro = new ResizeObserver(() => draw());
      ro.observe(el);
      el._mfRo = ro;
      observers.push(ro);
    }
  }
  function cleanup() {
    observers.forEach((o) => o.disconnect());
    observers = [];
    tip.hide();
  }

  /* ---------- Tooltip único ---------- */
  const tip = {
    el: null,
    ensure() {
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.className = 'mf-tip';
        this.el.setAttribute('role', 'status');
        document.body.appendChild(this.el);
      }
      return this.el;
    },
    /** rows: [{ color, value, label, dash }] — los textos se insertan con textContent */
    show(x, y, title, rows) {
      const el = this.ensure();
      el.textContent = '';
      if (title) {
        const h = document.createElement('div');
        h.className = 'mf-tip__title';
        h.textContent = title;
        el.appendChild(h);
      }
      rows.forEach((r) => {
        const row = document.createElement('div');
        row.className = 'mf-tip__row';
        if (r.color) {
          const k = document.createElement('i');
          k.className = 'mf-tip__key' + (r.dash ? ' is-dash' : '') + (r.box ? ' is-box' : '');
          k.style.setProperty('--c', r.color);
          row.appendChild(k);
        }
        const v = document.createElement('strong');
        v.textContent = r.value;
        row.appendChild(v);
        if (r.label) {
          const l = document.createElement('span');
          l.textContent = r.label;
          row.appendChild(l);
        }
        el.appendChild(row);
      });
      el.classList.add('is-on');
      const rect = el.getBoundingClientRect();
      let left = x + 14;
      let top = y - rect.height - 12;
      if (left + rect.width > window.innerWidth - 8) left = x - rect.width - 14;
      if (left < 8) left = 8;
      if (top < 8) top = y + 16;
      el.style.left = left + 'px';
      el.style.top = top + 'px';
    },
    hide() {
      if (this.el) this.el.classList.remove('is-on');
    },
  };

  /* ---------- Escalas ---------- */
  function niceTicks(min, max, count = 4) {
    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 1;
    }
    if (min === max) max = min + (Math.abs(min) || 1);
    const step0 = (max - min) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const e = step0 / mag;
    const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 2.25 ? 2.5 : e >= 1.5 ? 2 : 1) * mag;
    const lo = Math.floor(min / step + 1e-9) * step;
    const hi = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { lo, hi: hi === lo ? lo + step : hi, step, ticks };
  }

  /* Curva monótona (sin sobrepasos), como d3.curveMonotoneX */
  function monotone(pts) {
    const n = pts.length;
    if (!n) return '';
    if (n === 1) return 'M' + pts[0][0] + ',' + pts[0][1];
    const x = pts.map((p) => p[0]);
    const y = pts.map((p) => p[1]);
    const sgn = (v) => (v < 0 ? -1 : 1);
    const slope3 = (i) => {
      const h0 = x[i] - x[i - 1];
      const h1 = x[i + 1] - x[i];
      const s0 = (y[i] - y[i - 1]) / h0;
      const s1 = (y[i + 1] - y[i]) / h1;
      const p = (s0 * h1 + s1 * h0) / (h0 + h1);
      return (sgn(s0) + sgn(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
    };
    const slope2 = (i0, i1, t) => {
      const h = x[i1] - x[i0];
      return h ? ((3 * (y[i1] - y[i0])) / h - t) / 2 : t;
    };
    const t = new Array(n);
    if (n === 2) {
      t[0] = t[1] = (y[1] - y[0]) / (x[1] - x[0]);
    } else {
      for (let i = 1; i < n - 1; i++) t[i] = slope3(i);
      t[0] = slope2(0, 1, t[1]);
      t[n - 1] = slope2(n - 2, n - 1, t[n - 2]);
    }
    let d = 'M' + r2(x[0]) + ',' + r2(y[0]);
    for (let i = 0; i < n - 1; i++) {
      const h = (x[i + 1] - x[i]) / 3;
      d += 'C' + r2(x[i] + h) + ',' + r2(y[i] + h * t[i]) + ' ' + r2(x[i + 1] - h) + ',' + r2(y[i + 1] - h * t[i + 1]) + ' ' + r2(x[i + 1]) + ',' + r2(y[i + 1]);
    }
    return d;
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  let gid = 0;

  /* =========================================================
     Línea / área (varias series, un solo eje)
     ========================================================= */
  function line(el, o) {
    const yFmt = o.yFormat || fmt.axis;
    const vFmt = o.valueFormat || ((v) => fmt.cop(v));
    const xFmt = o.xFormat || ((k) => D.label(k, 'abbr'));
    const tFmt = o.tipTitle || ((k) => util.cap(D.label(k, 'long')));
    mount(el, (w) => {
      const H = o.height || 240;
      const n = o.labels.length;
      const vals = [];
      o.series.forEach((s) => s.values.forEach((v) => v != null && isFinite(v) && vals.push(v)));
      if (o.threshold) vals.push(o.threshold.value);
      const nt = niceTicks(Math.min(0, ...vals), Math.max(...vals, 1), o.ticks || 4);
      const labW = Math.max(...nt.ticks.map((t) => yFmt(t).length)) * 6.4 + 12;
      const padL = Math.max(44, labW);
      const padR = o.endLabels && w > 420 ? 92 : 14;
      const padT = 14;
      const padB = 26;
      const pw = Math.max(40, w - padL - padR);
      const ph = H - padT - padB;
      const X = (i) => padL + (n === 1 ? pw / 2 : (i * pw) / (n - 1));
      const Y = (v) => padT + ph - ((v - nt.lo) / (nt.hi - nt.lo)) * ph;
      const id = 'g' + ++gid;
      let s = '<svg class="chart" width="' + w + '" height="' + H + '" viewBox="0 0 ' + w + ' ' + H + '" role="img" tabindex="0" aria-label="' + util.esc(o.ariaLabel || '') + '"><defs>';
      o.series.forEach((se, si) => {
        if (se.area) s += '<linearGradient id="' + id + 'a' + si + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + se.color + '" stop-opacity=".18"/><stop offset="1" stop-color="' + se.color + '" stop-opacity=".01"/></linearGradient>';
      });
      s += '</defs>';
      nt.ticks.forEach((t) => {
        s += '<line class="g-grid' + (t === 0 ? ' g-zero' : '') + '" x1="' + padL + '" x2="' + (padL + pw) + '" y1="' + r2(Y(t)) + '" y2="' + r2(Y(t)) + '"/>';
        s += '<text class="g-tick" x="' + (padL - 8) + '" y="' + r2(Y(t) + 4) + '" text-anchor="end">' + util.esc(yFmt(t)) + '</text>';
      });
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 52))));
      o.labels.forEach((k, i) => {
        if (i % every === 0) s += '<text class="g-tick" x="' + r2(X(i)) + '" y="' + (H - 7) + '" text-anchor="middle">' + util.esc(xFmt(k)) + '</text>';
      });
      if (o.shadeFrom != null) {
        const x0 = X(o.shadeFrom);
        s += '<rect class="g-shade" x="' + r2(x0) + '" y="' + padT + '" width="' + r2(padL + pw - x0) + '" height="' + ph + '"/>';
        if (o.shadeLabel) s += '<text class="g-tick g-shade-label g-halo" x="' + r2(x0 + 8) + '" y="' + (padT + 12) + '">' + util.esc(o.shadeLabel) + '</text>';
      }
      if (o.threshold) {
        const ty = r2(Y(o.threshold.value));
        s += '<line class="g-threshold" x1="' + padL + '" x2="' + (padL + pw) + '" y1="' + ty + '" y2="' + ty + '" style="stroke:' + (o.threshold.color || 'var(--warn)') + '"/>';
        s += '<text class="g-tick g-threshold-label g-halo" x="' + (padL + 6) + '" y="' + (ty - 6) + '">' + util.esc(o.threshold.label) + '</text>';
      }
      const ends = [];
      o.series.forEach((se, si) => {
        const idx = [];
        se.values.forEach((v, i) => v != null && isFinite(v) && idx.push(i));
        if (!idx.length) return;
        const pts = idx.map((i) => [X(i), Y(se.values[i])]);
        const d = monotone(pts);
        if (se.area) s += '<path d="' + d + 'L' + r2(pts[pts.length - 1][0]) + ',' + r2(Y(Math.max(nt.lo, 0))) + 'L' + r2(pts[0][0]) + ',' + r2(Y(Math.max(nt.lo, 0))) + 'Z" fill="url(#' + id + 'a' + si + ')"/>';
        s += '<path class="g-line' + (se.dashed ? ' is-dash' : '') + (se.muted ? ' is-muted' : '') + '" d="' + d + '" style="stroke:' + se.color + '"/>';
        const li = idx[idx.length - 1];
        if (o.endDots !== false) s += '<circle class="g-dot" cx="' + r2(X(li)) + '" cy="' + r2(Y(se.values[li])) + '" r="4" style="fill:' + se.color + '"/>';
        ends.push({ y: Y(se.values[li]), x: X(li), label: se.label, value: se.values[li] });
      });
      // Etiquetas directas al final, solo si no chocan
      if (padR > 20 && ends.length) {
        const sorted = ends.slice().sort((a, b) => a.y - b.y);
        const clash = sorted.some((e, i) => i && e.y - sorted[i - 1].y < 30);
        if (!clash) {
          ends.forEach((e) => {
            s += '<text class="g-end" x="' + r2(e.x + 10) + '" y="' + r2(e.y - 2) + '"><tspan class="g-end-v">' + util.esc(fmt.cop(e.value)) + '</tspan></text>';
            s += '<text class="g-tick g-halo" x="' + r2(e.x + 10) + '" y="' + r2(e.y + 12) + '">' + util.esc(e.label) + '</text>';
          });
        }
      }
      s += '<g class="g-cross" visibility="hidden"><line class="g-cross-line" y1="' + padT + '" y2="' + (padT + ph) + '"/>';
      o.series.forEach((se) => (s += '<circle class="g-cross-dot" r="4.5" style="fill:' + se.color + '"/>'));
      s += '</g><rect class="g-hit" x="' + padL + '" y="0" width="' + pw + '" height="' + H + '"/></svg>';
      el.innerHTML = s;

      const svg = el.firstChild;
      const cross = svg.querySelector('.g-cross');
      const cl = cross.querySelector('line');
      const dots = cross.querySelectorAll('circle');
      let cur = -1;
      const showAt = (i, cx, cy) => {
        cur = i;
        const xi = X(i);
        cl.setAttribute('x1', xi);
        cl.setAttribute('x2', xi);
        o.series.forEach((se, si) => {
          const v = se.values[i];
          if (v == null || !isFinite(v)) dots[si].setAttribute('visibility', 'hidden');
          else {
            dots[si].setAttribute('visibility', 'visible');
            dots[si].setAttribute('cx', xi);
            dots[si].setAttribute('cy', Y(v));
          }
        });
        cross.setAttribute('visibility', 'visible');
        const rows = o.series.filter((se) => se.values[i] != null && isFinite(se.values[i])).map((se) => ({ color: se.color, dash: se.dashed, value: vFmt(se.values[i], se), label: se.label }));
        if (o.threshold) rows.push({ color: o.threshold.color || 'var(--warn)', dash: true, value: vFmt(o.threshold.value), label: o.threshold.label });
        const box = svg.getBoundingClientRect();
        tip.show(cx ?? box.left + xi, cy ?? box.top + Y(Math.max(...o.series.map((se) => se.values[i] ?? -Infinity))), tFmt(o.labels[i]), rows);
      };
      const hide = () => {
        cross.setAttribute('visibility', 'hidden');
        tip.hide();
      };
      svg.addEventListener('pointermove', (ev) => {
        const box = svg.getBoundingClientRect();
        const px = ev.clientX - box.left;
        const i = Math.max(0, Math.min(n - 1, Math.round(((px - padL) / pw) * (n - 1))));
        showAt(i, ev.clientX, ev.clientY);
      });
      svg.addEventListener('pointerleave', hide);
      svg.addEventListener('blur', hide);
      svg.addEventListener('focus', () => showAt(cur >= 0 ? cur : n - 1));
      svg.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          showAt(Math.max(0, Math.min(n - 1, (cur < 0 ? n - 1 : cur) + (ev.key === 'ArrowRight' ? 1 : -1))));
        } else if (ev.key === 'Escape') hide();
      });
    });
  }

  /* =========================================================
     Columnas agrupadas (con línea opcional en el mismo eje)
     ========================================================= */
  const roundTop = (x, y, w, h, r, up) => {
    r = Math.min(r, w / 2, Math.abs(h));
    if (h <= 0.5) return '';
    if (up) return 'M' + r2(x) + ',' + r2(y + h) + 'V' + r2(y + r) + 'Q' + r2(x) + ',' + r2(y) + ' ' + r2(x + r) + ',' + r2(y) + 'H' + r2(x + w - r) + 'Q' + r2(x + w) + ',' + r2(y) + ' ' + r2(x + w) + ',' + r2(y + r) + 'V' + r2(y + h) + 'Z';
    return 'M' + r2(x) + ',' + r2(y) + 'V' + r2(y + h - r) + 'Q' + r2(x) + ',' + r2(y + h) + ' ' + r2(x + r) + ',' + r2(y + h) + 'H' + r2(x + w - r) + 'Q' + r2(x + w) + ',' + r2(y + h) + ' ' + r2(x + w) + ',' + r2(y + h - r) + 'V' + r2(y) + 'Z';
  };

  function bars(el, o) {
    const yFmt = o.yFormat || fmt.axis;
    const vFmt = o.valueFormat || ((v) => fmt.cop(v));
    const xFmt = o.xFormat || ((k) => D.label(k, 'abbr'));
    const tFmt = o.tipTitle || ((k) => util.cap(D.label(k, 'long')));
    mount(el, (w) => {
      const H = o.height || 240;
      const n = o.labels.length;
      const vals = [0];
      o.series.forEach((s) => s.values.forEach((v) => isFinite(v) && vals.push(v)));
      if (o.line) o.line.values.forEach((v) => isFinite(v) && vals.push(v));
      const nt = niceTicks(Math.min(...vals), Math.max(...vals), o.ticks || 4);
      const labW = Math.max(...nt.ticks.map((t) => yFmt(t).length)) * 6.4 + 12;
      const padL = Math.max(44, labW);
      const padR = 10;
      const padT = 12;
      const padB = 26;
      const pw = Math.max(40, w - padL - padR);
      const ph = H - padT - padB;
      const band = pw / n;
      const k = o.series.length;
      const bw = Math.max(3, Math.min(o.maxBar || 18, (band * 0.72 - (k - 1) * 2) / k));
      const groupW = k * bw + (k - 1) * 2;
      const Y = (v) => padT + ph - ((v - nt.lo) / (nt.hi - nt.lo)) * ph;
      const y0 = Y(0);
      let s = '<svg class="chart" width="' + w + '" height="' + H + '" viewBox="0 0 ' + w + ' ' + H + '" role="img" tabindex="0" aria-label="' + util.esc(o.ariaLabel || '') + '">';
      nt.ticks.forEach((t) => {
        s += '<line class="g-grid' + (t === 0 ? ' g-zero' : '') + '" x1="' + padL + '" x2="' + (padL + pw) + '" y1="' + r2(Y(t)) + '" y2="' + r2(Y(t)) + '"/>';
        s += '<text class="g-tick" x="' + (padL - 8) + '" y="' + r2(Y(t) + 4) + '" text-anchor="end">' + util.esc(yFmt(t)) + '</text>';
      });
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 46))));
      s += '<g class="g-bands">';
      for (let i = 0; i < n; i++) s += '<rect class="g-band" data-i="' + i + '" x="' + r2(padL + i * band) + '" y="' + padT + '" width="' + r2(band) + '" height="' + ph + '"/>';
      s += '</g>';
      o.labels.forEach((lab, i) => {
        const gx = padL + i * band + (band - groupW) / 2;
        o.series.forEach((se, si) => {
          const v = se.values[i];
          if (!isFinite(v) || v === 0) return;
          const x = gx + si * (bw + 2);
          const up = v > 0;
          const yy = up ? Y(v) : y0;
          s += '<path class="g-bar" d="' + roundTop(x, yy, bw, Math.abs(Y(v) - y0), 4, up) + '" style="fill:' + (se.colorFn ? se.colorFn(v, i) : se.color) + '"/>';
        });
        if (i % every === 0) s += '<text class="g-tick" x="' + r2(padL + i * band + band / 2) + '" y="' + (H - 7) + '" text-anchor="middle">' + util.esc(xFmt(lab)) + '</text>';
      });
      if (o.line) {
        const pts = o.line.values.map((v, i) => [padL + i * band + band / 2, Y(v)]);
        s += '<path class="g-line" d="' + monotone(pts) + '" style="stroke:' + o.line.color + '"/>';
        pts.forEach((p) => (s += '<circle class="g-dot g-dot--sm" cx="' + r2(p[0]) + '" cy="' + r2(p[1]) + '" r="3.5" style="fill:' + o.line.color + '"/>'));
      }
      s += '</svg>';
      el.innerHTML = s;
      const svg = el.firstChild;
      const bandsEl = svg.querySelectorAll('.g-band');
      let cur = -1;
      const showAt = (i, cx, cy) => {
        cur = i;
        bandsEl.forEach((b, j) => b.classList.toggle('is-on', j === i));
        const rows = o.series.map((se) => ({ color: se.colorFn ? se.colorFn(se.values[i], i) : se.color, box: true, value: vFmt(se.values[i], se), label: se.label }));
        if (o.line) rows.push({ color: o.line.color, value: vFmt(o.line.values[i]), label: o.line.label });
        const box = svg.getBoundingClientRect();
        tip.show(cx ?? box.left + padL + i * band + band / 2, cy ?? box.top + padT + 20, tFmt(o.labels[i]), rows);
      };
      const hide = () => {
        bandsEl.forEach((b) => b.classList.remove('is-on'));
        tip.hide();
      };
      svg.addEventListener('pointermove', (ev) => {
        const box = svg.getBoundingClientRect();
        const i = Math.floor((ev.clientX - box.left - padL) / band);
        if (i >= 0 && i < n) showAt(i, ev.clientX, ev.clientY);
        else hide();
      });
      svg.addEventListener('pointerleave', hide);
      svg.addEventListener('blur', hide);
      svg.addEventListener('focus', () => showAt(cur >= 0 ? cur : n - 1));
      svg.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          showAt(Math.max(0, Math.min(n - 1, (cur < 0 ? n - 1 : cur) + (ev.key === 'ArrowRight' ? 1 : -1))));
        } else if (ev.key === 'Escape') hide();
      });
    });
  }

  /* =========================================================
     Cascada (puente de caja)
     steps: [{ label, value, total }]
     ========================================================= */
  function waterfall(el, o) {
    mount(el, (w) => {
      const H = o.height || 260;
      const steps = o.steps;
      const n = steps.length;
      let run = 0;
      const geo = steps.map((st) => {
        if (st.total) {
          run = st.value;
          return { a: 0, b: st.value, st };
        }
        const a = run;
        run += st.value;
        return { a, b: run, st };
      });
      const vals = geo.flatMap((g) => [g.a, g.b]).concat([0]);
      const nt = niceTicks(Math.min(...vals), Math.max(...vals), 4);
      const padL = 52;
      const padR = 8;
      const padT = 22;
      const padB = o.compact ? 40 : 46;
      const pw = Math.max(40, w - padL - padR);
      const ph = H - padT - padB;
      const band = pw / n;
      const bw = Math.min(o.maxBar || 34, band * 0.62);
      const Y = (v) => padT + ph - ((v - nt.lo) / (nt.hi - nt.lo)) * ph;
      let s = '<svg class="chart" width="' + w + '" height="' + H + '" viewBox="0 0 ' + w + ' ' + H + '" role="img" tabindex="0" aria-label="' + util.esc(o.ariaLabel || 'Puente de caja') + '">';
      nt.ticks.forEach((t) => {
        s += '<line class="g-grid' + (t === 0 ? ' g-zero' : '') + '" x1="' + padL + '" x2="' + (padL + pw) + '" y1="' + r2(Y(t)) + '" y2="' + r2(Y(t)) + '"/>';
        s += '<text class="g-tick" x="' + (padL - 8) + '" y="' + r2(Y(t) + 4) + '" text-anchor="end">' + util.esc(fmt.axis(t)) + '</text>';
      });
      geo.forEach((g, i) => {
        const x = padL + i * band + (band - bw) / 2;
        const top = Math.min(Y(g.a), Y(g.b));
        const h = Math.max(1.5, Math.abs(Y(g.a) - Y(g.b)));
        const color = g.st.total ? 'var(--total)' : g.st.value >= 0 ? 'var(--good)' : 'var(--crit)';
        s += '<rect class="g-bar g-wf" data-i="' + i + '" x="' + r2(x) + '" y="' + r2(top) + '" width="' + r2(bw) + '" height="' + r2(h) + '" rx="3" style="fill:' + color + '"/>';
        if (i < n - 1) {
          const ny = Y(g.b);
          s += '<line class="g-connector" x1="' + r2(x + bw) + '" x2="' + r2(x + band) + '" y1="' + r2(ny) + '" y2="' + r2(ny) + '"/>';
        }
        const lab = (g.st.total ? '' : g.st.value >= 0 ? '+' : MF.MINUS) + fmt.cop(Math.abs(g.st.value));
        if (band > 44) s += '<text class="g-val" x="' + r2(x + bw / 2) + '" y="' + r2(top - 6) + '" text-anchor="middle">' + util.esc(lab) + '</text>';
        const words = String(g.st.short || g.st.label).split(' ');
        const l1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
        const l2 = words.slice(Math.ceil(words.length / 2)).join(' ');
        if (band > 40) {
          s += '<text class="g-tick g-wf-lab" x="' + r2(x + bw / 2) + '" y="' + (H - padB + 16) + '" text-anchor="middle">' + util.esc(l1) + '</text>';
          if (l2) s += '<text class="g-tick g-wf-lab" x="' + r2(x + bw / 2) + '" y="' + (H - padB + 29) + '" text-anchor="middle">' + util.esc(l2) + '</text>';
        }
      });
      s += '</svg>';
      el.innerHTML = s;
      const svg = el.firstChild;
      const rects = svg.querySelectorAll('.g-wf');
      let cur = -1;
      const showAt = (i, cx, cy) => {
        cur = i;
        rects.forEach((r, j) => r.classList.toggle('is-on', j === i));
        const st = steps[i];
        const box = rects[i].getBoundingClientRect();
        tip.show(cx ?? box.left + box.width / 2, cy ?? box.top, st.label, [
          { color: st.total ? 'var(--total)' : st.value >= 0 ? 'var(--good)' : 'var(--crit)', box: true, value: (st.total ? '' : st.value >= 0 ? '+' : MF.MINUS) + fmt.cop(Math.abs(st.value)), label: st.total ? 'Saldo' : st.value >= 0 ? 'Suma a la caja' : 'Resta a la caja' },
        ]);
      };
      const hide = () => {
        rects.forEach((r) => r.classList.remove('is-on'));
        tip.hide();
      };
      svg.addEventListener('pointermove', (ev) => {
        const b0 = svg.getBoundingClientRect();
        const i = Math.floor((ev.clientX - b0.left - padL) / band);
        if (i >= 0 && i < n) showAt(i, ev.clientX, ev.clientY);
        else hide();
      });
      svg.addEventListener('pointerleave', hide);
      svg.addEventListener('blur', hide);
      svg.addEventListener('focus', () => showAt(cur >= 0 ? cur : 0));
      svg.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          showAt(Math.max(0, Math.min(n - 1, (cur < 0 ? 0 : cur) + (ev.key === 'ArrowRight' ? 1 : -1))));
        } else if (ev.key === 'Escape') hide();
      });
    });
  }

  /* =========================================================
     Chispa (sparkline): tendencia en gris, último punto en acento
     ========================================================= */
  function spark(el, values, o = {}) {
    mount(el, (w) => {
      const H = o.height || 34;
      const v = values.filter((x) => isFinite(x));
      if (v.length < 2) {
        el.innerHTML = '';
        return;
      }
      const lo = Math.min(...v);
      const hi = Math.max(...v);
      const X = (i) => 3 + (i * (w - 8)) / (values.length - 1);
      const Y = (x) => 4 + (H - 8) * (1 - (hi === lo ? 0.5 : (x - lo) / (hi - lo)));
      const pts = values.map((x, i) => [X(i), Y(x)]);
      const last = pts[pts.length - 1];
      el.innerHTML = '<svg class="spark" width="' + w + '" height="' + H + '" viewBox="0 0 ' + w + ' ' + H + '" aria-hidden="true"><path d="' + monotone(pts) + '" class="spark__line"/><circle cx="' + r2(last[0]) + '" cy="' + r2(last[1]) + '" r="3.5" class="spark__dot" style="fill:' + (o.color || 'var(--brand-2)') + '"/></svg>';
    });
  }

  /* ---------- Anillo de puntaje (0–100) ---------- */
  function ring(score, status, size = 132) {
    const r = size / 2 - 9;
    const c = 2 * Math.PI * r;
    const color = { good: 'var(--good)', warning: 'var(--warn)', critical: 'var(--crit)' }[status] || 'var(--brand-2)';
    const off = c * (1 - util.clamp(score, 0, 100) / 100);
    return (
      '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring__track" style="stroke:' + color + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring__fill" style="stroke:' + color + ';stroke-dasharray:' + r2(c) + ';stroke-dashoffset:' + r2(off) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '</svg>'
    );
  }

  /* ---------- Vista de tabla (gemela accesible de cada gráfico) ---------- */
  function table(o) {
    const lf = o.labelFormat || ((k) => D.label(k));
    const vf = o.valueFormat || ((v) => fmt.cop(v));
    let h = '<div class="table-wrap"><table class="tbl tbl--compact"><thead><tr><th>' + util.esc(o.firstHeader || 'Mes') + '</th>' + o.series.map((s) => '<th class="num">' + util.esc(s.label) + '</th>').join('') + '</tr></thead><tbody>';
    o.labels.forEach((k, i) => {
      h += '<tr><td>' + util.esc(lf(k)) + '</td>' + o.series.map((s) => '<td class="num">' + (s.values[i] == null ? '—' : util.esc(vf(s.values[i], s))) + '</td>').join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  /** Conecta un botón «Tabla» que alterna entre el gráfico y su tabla */
  function bindTableToggle(btn, chartEl, tableHtml) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!on));
      let tbl = chartEl.nextElementSibling;
      if (!tbl || !tbl.classList.contains('chart-table')) {
        tbl = document.createElement('div');
        tbl.className = 'chart-table';
        tbl.innerHTML = typeof tableHtml === 'function' ? tableHtml() : tableHtml;
        chartEl.after(tbl);
      }
      chartEl.hidden = !on;
      tbl.hidden = on;
    });
  }

  /* ---------- Hover genérico para elementos HTML con data-tip ---------- */
  function bindHtmlTips(container) {
    container.querySelectorAll('[data-tip-title]').forEach((node) => {
      const show = (ev) => {
        const rows = JSON.parse(node.getAttribute('data-tip-rows') || '[]');
        const box = node.getBoundingClientRect();
        tip.show(ev && ev.clientX ? ev.clientX : box.left + box.width / 2, ev && ev.clientY ? ev.clientY : box.top, node.getAttribute('data-tip-title'), rows);
      };
      node.addEventListener('pointermove', show);
      node.addEventListener('pointerleave', () => tip.hide());
      node.addEventListener('focus', () => show());
      node.addEventListener('blur', () => tip.hide());
    });
  }

  MF.charts = { line, bars, waterfall, spark, ring, table, bindTableToggle, bindHtmlTips, niceTicks, monotone, cleanup, tip, mount };
})(typeof window !== 'undefined' ? window : globalThis);
