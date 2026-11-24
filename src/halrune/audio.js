// The listening room's music: an original ambient piece made live with WebAudio. Nothing is downloaded.
// A slow chord pad, a soft bass, a plucked arpeggio with an echo, a gentle kick and quiet ticks, all through a
// generated room reverb. It starts only from a click. An analyser feeds the 3D speakers and the room light.
import { midiToFreq, chordAt } from './audio-math.js';

const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 4;

function reverbIR(ctx, seconds = 3.6) {
  const len = Math.floor(ctx.sampleRate * seconds), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return ir;
}

export function createMusic() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.7;
  master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
  const verb = ctx.createConvolver(); verb.buffer = reverbIR(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.45; verb.connect(wet); wet.connect(master);
  const dry = ctx.createGain(); dry.gain.value = 0.7; dry.connect(master); dry.connect(verb);
  // Echo for the plucks: a dotted eighth with soft feedback.
  const delay = ctx.createDelay(1); delay.delayTime.value = BEAT * 0.75;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const dtone = ctx.createBiquadFilter(); dtone.type = 'lowpass'; dtone.frequency.value = 2600;
  delay.connect(dtone); dtone.connect(fb); fb.connect(delay); dtone.connect(verb); dtone.connect(dry);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  noise.getChannelData(0).forEach((_, i, a) => { a[i] = Math.random() * 2 - 1; });

  function pad(t, chord) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1400, t + BAR * 0.6); f.frequency.linearRampToValueAtTime(700, t + BAR);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 1.6); g.gain.setValueAtTime(0.06, t + BAR - 0.4); g.gain.linearRampToValueAtTime(0, t + BAR + 1.8);
    f.connect(g); g.connect(dry);
    for (const n of chord.slice(1)) for (const det of [-7, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiToFreq(n); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + BAR + 2);
    }
  }
  function bass(t, root) {
    for (let b = 0; b < 4; b++) {
      const s = t + b * BEAT, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = midiToFreq(root - 12);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.22, s + 0.04); g.gain.exponentialRampToValueAtTime(0.02, s + BEAT * 0.95);
      o.connect(g); g.connect(dry); o.start(s); o.stop(s + BEAT);
    }
  }
  function kick(s) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, s); o.frequency.exponentialRampToValueAtTime(45, s + 0.18);
    g.gain.setValueAtTime(0.5, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.35);
    o.connect(g); g.connect(dry); o.start(s); o.stop(s + 0.4);
  }
  function tick(s) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(0.05, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.05);
    src.connect(f); f.connect(g); g.connect(dry); src.start(s, Math.random() * 0.5, 0.06);
  }
  function pluck(s, n) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = midiToFreq(n);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.07, s + 0.01); g.gain.exponentialRampToValueAtTime(0.001, s + 0.9);
    o.connect(g); g.connect(dry); g.connect(delay); o.start(s); o.stop(s + 1);
  }

  let timer = null, next = 0, bar = 0, playing = false, muted = false;
  function schedule() {
    while (next < ctx.currentTime + 0.4) {
      const chord = chordAt(bar);
      pad(next, chord);
      bass(next, chord[0]);
      const tones = chord.slice(1).map((n) => n + 12);
      for (let i = 0; i < 8; i++) {
        const s = next + i * BEAT / 2;
        if (i % 4 === 0 && bar > 0) kick(s);
        if (i % 2 === 1 && bar > 1) tick(s);
        if (bar > 0 && (i + bar) % 3 !== 2) pluck(s, tones[(i * 3 + bar) % tones.length]);
      }
      next += BAR;
      bar += 1;
    }
  }
  const level = () => (muted ? 0 : 0.8);
  return {
    analyser,
    get playing() { return playing; },
    get muted() { return muted; },
    get sampleRate() { return ctx.sampleRate; },
    async start() {
      if (playing) return;
      await ctx.resume();
      playing = true;
      next = ctx.currentTime + 0.1;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(level(), ctx.currentTime, 0.4);
      schedule();
      timer = setInterval(schedule, 100);
    },
    stop() {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    },
    setMuted(m) {
      muted = m;
      if (playing) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.1);
    },
  };
}
