'use strict';
/* Audioanalyse im Browser: Wellenform, Tempo (BPM), erster Beat, Tonart. */
const Analyze = (() => {
  let ctx;

  async function decode(file) {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    return ctx.decodeAudioData(await file.arrayBuffer());
  }

  function mono(buf) {
    const n = buf.length, ch = buf.numberOfChannels, out = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) out[i] += d[i];
    }
    if (ch > 1) for (let i = 0; i < n; i++) out[i] /= ch;
    return out;
  }

  function peaks(x, n = 1200) {
    const out = new Uint8Array(n), step = x.length / n;
    let max = 1e-6;
    const tmp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      const a = Math.floor(i * step), b = Math.min(x.length, Math.floor((i + 1) * step));
      for (let j = a; j < b; j++) s += x[j] * x[j];
      tmp[i] = Math.sqrt(s / Math.max(1, b - a));
      if (tmp[i] > max) max = tmp[i];
    }
    for (let i = 0; i < n; i++) out[i] = Math.round(255 * Math.sqrt(tmp[i] / max));
    return out;
  }

  /* Tempo über Autokorrelation der Einsatzstärke; Ergebnis im Bereich 70–180 BPM. */
  function tempo(x, sr) {
    const hop = Math.max(64, Math.round(sr / 172)), fr = sr / hop;
    const total = Math.floor(x.length / hop);
    const span = Math.min(total, Math.round(120 * fr));
    const off = Math.floor((total - span) / 2);
    if (span < fr * 8) return { bpm: 0, gridStart: 0 };

    // Einsatzstärke: positiver Anstieg der Log-Energie (gesamt + Bassanteil)
    // Energie je Hop, danach über 4 Hops geglättet (verhindert Schwebungs-Artefakte tonaler Signale)
    const onset = new Float32Array(span), eF = new Float32Array(span), eL = new Float32Array(span);
    const k = Math.exp(-2 * Math.PI * 180 / sr);
    let lp = 0, prevF = 0, prevL = 0;
    for (let f = 0; f < span; f++) {
      let ef = 0, el = 0;
      const base = (off + f) * hop;
      for (let j = 0; j < hop; j++) {
        const v = x[base + j];
        lp = lp * k + v * (1 - k);
        ef += v * v; el += lp * lp;
      }
      eF[f] = ef / hop; eL[f] = el / hop;
    }
    for (let f = 3; f < span; f++) {
      const lf = Math.log(1 + 500 * (eF[f] + eF[f - 1] + eF[f - 2] + eF[f - 3])), ll = Math.log(1 + 2000 * (eL[f] + eL[f - 1] + eL[f - 2] + eL[f - 3]));
      if (f > 3) onset[f] = Math.max(0, lf - prevF) + Math.max(0, ll - prevL);
      prevF = lf; prevL = ll;
    }
    let mean = 0;
    for (let i = 0; i < span; i++) mean += onset[i];
    mean /= span;
    if (mean < 1e-5) return { bpm: 0, gridStart: 0 };
    for (let i = 0; i < span; i++) onset[i] -= mean;

    const maxLag = Math.min(span - 1, Math.ceil(8 * fr * 60 / 70) + 2);
    const ac = new Float32Array(maxLag + 1);
    for (let lag = 1; lag <= maxLag; lag++) {
      let s = 0;
      const n = span - lag;
      for (let i = 0; i < n; i++) s += onset[i] * onset[i + lag];
      ac[lag] = s / n;
    }
    const at = l => {
      if (l >= maxLag) return 0;
      const i = Math.floor(l), t = l - i;
      return ac[i] * (1 - t) + ac[i + 1] * t;
    };
    let best = 0, bestScore = -Infinity;
    for (let bpm = 70; bpm <= 180; bpm += 0.02) {
      const L = fr * 60 / bpm;
      const score = at(L) + at(2 * L) + at(4 * L) + at(8 * L);
      if (score > bestScore) { bestScore = score; best = bpm; }
    }
    let bpm = Math.round(best * 100) / 100;
    if (Math.abs(bpm - Math.round(bpm)) < 0.12) bpm = Math.round(bpm);

    // Phase: Raster so legen, dass die Beats auf den stärksten Einsätzen liegen
    const P = fr * 60 / bpm;
    let bestPhase = 0, bestSum = -Infinity;
    for (let ph = 0; ph < P; ph += 0.25) {
      let s = 0;
      for (let p = ph; p < span - 1; p += P) s += onset[Math.round(p)];
      if (s > bestSum) { bestSum = s; bestPhase = ph; }
    }
    const beat = 60 / bpm;
    let gridStart = ((off + bestPhase) * hop / sr) % beat;
    if (gridStart < 0) gridStart += beat;
    return { bpm, gridStart: Math.round(gridStart * 1000) / 1000 };
  }

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < len / 2; j++) {
          const a = i + j, b = a + len / 2;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  /* Tonart über Chromagramm und Krumhansl-Schmuckler-Profile. Rückgabe { pc, minor } oder null. */
  function key(x, sr) {
    const d = Math.max(1, Math.floor(sr / 11025)), dsr = sr / d;
    const n = Math.floor(x.length / d);
    const N = 8192;
    if (n < N * 2) return null;
    const frames = Math.min(160, Math.floor(n / (N / 2)) - 1);
    const stride = Math.floor((n - N) / Math.max(1, frames - 1));
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    const lo = Math.ceil(65 * N / dsr), hi = Math.min(N / 2 - 1, Math.floor(2000 * N / dsr));
    const binPc = new Int8Array(hi + 1);
    for (let b = lo; b <= hi; b++) binPc[b] = ((Math.round(12 * Math.log2(b * dsr / N / 440) + 69) % 12) + 12) % 12;
    const chroma = new Float64Array(12), re = new Float32Array(N), im = new Float32Array(N);
    for (let f = 0; f < frames; f++) {
      const start = f * stride;
      for (let i = 0; i < N; i++) {
        let s = 0;
        const p = (start + i) * d;
        for (let j = 0; j < d; j++) s += x[p + j];
        re[i] = s / d * win[i]; im[i] = 0;
      }
      fft(re, im);
      for (let b = lo; b <= hi; b++) chroma[binPc[b]] += Math.sqrt(re[b] * re[b] + im[b] * im[b]);
    }
    const corr = (prof, shift) => {
      let mc = 0, mp = 0;
      for (let i = 0; i < 12; i++) { mc += chroma[i]; mp += prof[i]; }
      mc /= 12; mp /= 12;
      let num = 0, a = 0, b = 0;
      for (let i = 0; i < 12; i++) {
        const c = chroma[(i + shift) % 12] - mc, p = prof[i] - mp;
        num += c * p; a += c * c; b += p * p;
      }
      return a && b ? num / Math.sqrt(a * b) : -1;
    };
    let bestR = -2, out = null;
    for (let pc = 0; pc < 12; pc++) {
      const rM = corr(MAJOR, pc), rm = corr(MINOR, pc);
      if (rM > bestR) { bestR = rM; out = { pc, minor: false }; }
      if (rm > bestR) { bestR = rm; out = { pc, minor: true }; }
    }
    return out;
  }

  async function run(file) {
    const buf = await decode(file);
    const x = mono(buf);
    const t = tempo(x, buf.sampleRate);
    // Lautheit (RMS in dBFS) und daraus eine grobe Energie-Schätzung von 1 bis 10
    let sum = 0;
    for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
    const loud = Math.round(10 * Math.log10(sum / Math.max(1, x.length) + 1e-12) * 10) / 10;
    const n = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
    const energy = Math.round(1 + 9 * (0.7 * n(loud, -26, -8) + 0.3 * n(t.bpm || 120, 90, 150)));
    return { duration: buf.duration, wave: peaks(x), bpm: t.bpm, gridStart: t.gridStart, key: key(x, buf.sampleRate), loud, energy };
  }

  return { run, tempo, key };
})();
