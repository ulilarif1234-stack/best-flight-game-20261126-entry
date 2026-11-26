// Synthesised sound only: no audio files. A WebAudio graph built on the
// first user gesture (the Start button), with a mute toggle.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc1 = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let windSource = null, windGain = null, windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // Engine: two detuned saws through a lowpass, pitch follows throttle.
    engineOsc1 = ctx.createOscillator(); engineOsc1.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'sawtooth';
    engineOsc1.frequency.value = 52; engineOsc2.frequency.value = 78;
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320; engineFilter.Q.value = 1.2;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc1.connect(engineFilter); engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc1.start(); engineOsc2.start();
    // Wind: looped noise through a bandpass, gain follows airspeed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSource = ctx.createBufferSource(); windSource.buffer = buf; windSource.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass';
    windFilter.frequency.value = 700; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSource.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    windSource.start();
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator(); osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 400;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // Called every frame with the live flight state.
    update(throttle, speed, airborne) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const rpm = 0.35 + throttle * 0.65;
      engineOsc1.frequency.setTargetAtTime(46 + rpm * 62, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(69 + rpm * 93, t, 0.08);
      engineFilter.frequency.setTargetAtTime(240 + rpm * 900, t, 0.1);
      engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.11 : 0.04 + throttle * 0.06, t, 0.1);
      const wind = Math.min(1, Math.max(0, (speed - 8) / 60));
      windGain.gain.setTargetAtTime(airborne ? wind * 0.16 : wind * 0.05, t, 0.15);
      windFilter.frequency.setTargetAtTime(420 + speed * 16, t, 0.15);
    },
    ringChime() { tone(880, 0.35, 'sine', 0.22); tone(1318, 0.5, 'sine', 0.18, 0.09); },
    touchdown() { tone(120, 0.28, 'sine', 0.4, 0, 42); noiseBurst(0.18, 0.25, 300); },
    crash() { noiseBurst(0.7, 0.5, 240); tone(90, 0.8, 'sine', 0.4, 0, 30); },
    warning() { tone(620, 0.16, 'square', 0.08); tone(620, 0.16, 'square', 0.08, 0.22); },
  };
}
