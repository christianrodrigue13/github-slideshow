// =====================================================================
// audio.js — Sons générés par le code (API Web Audio, aucun fichier)
// et vibrations du téléphone. Les navigateurs interdisent le son avant
// un premier geste : unlock() est appelée au premier toucher/clic.
// =====================================================================

import { CONFIG } from './config.js';

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;          // 1 seconde de bruit blanc, réutilisée
    this.jet = null;            // son continu du jetpack
    this.muted = false;
    try { this.muted = localStorage.getItem('jetarena-muted') === '1'; } catch (_) { /* rien */ }
  }

  // Démarre le son (à appeler pendant un geste de l'utilisateur)
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;            // navigateur sans Web Audio : on joue sans son
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : CONFIG.feedback.volume;
    this.master.connect(this.ctx.destination);

    // Bruit blanc
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Jetpack : bruit filtré en boucle, volume à 0 au départ
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.jet = gain;
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('jetarena-muted', this.muted ? '1' : '0'); } catch (_) { /* rien */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : CONFIG.feedback.volume;
  }

  // Volume du jetpack (0 = silence)
  setJet(level) {
    if (!this.jet) return;
    this.jet.gain.setTargetAtTime(level * 0.35, this.ctx.currentTime, 0.04);
  }

  // --- Briques de base ---
  // Rafale de bruit filtré (coups de feu)
  burst(duration, freq, type, vol) {
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration);
  }

  // Note qui glisse d'une fréquence à une autre
  tone(type, f0, f1, duration, vol, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration);
  }

  // --- Sons du jeu --- (vol de 0 à 1, selon la distance)
  play(name, vol = 1) {
    if (!this.ctx || this.muted || vol <= 0.02) return;
    switch (name) {
      case 'rifle':
        this.burst(0.09, 1800, 'bandpass', 0.6 * vol);
        this.tone('sine', 160, 60, 0.08, 0.5 * vol);
        break;
      case 'shotgun':
        this.burst(0.28, 1100, 'lowpass', 0.9 * vol);
        this.tone('sine', 120, 40, 0.2, 0.8 * vol);
        break;
      case 'sniper':
        this.burst(0.18, 2600, 'highpass', 0.7 * vol);
        this.tone('sawtooth', 420, 50, 0.22, 0.35 * vol);
        break;
      case 'launcher':
        this.tone('sine', 220, 70, 0.18, 0.7 * vol);
        this.burst(0.12, 500, 'lowpass', 0.5 * vol);
        break;
      case 'explosion':
        this.burst(0.7, 450, 'lowpass', 1.0 * vol);
        this.tone('sine', 90, 30, 0.6, 0.9 * vol);
        break;
      case 'pickup':
        this.tone('triangle', 600, 1200, 0.12, 0.3 * vol);
        this.tone('triangle', 900, 1500, 0.1, 0.25 * vol, 0.1);
        break;
      case 'hurt':      // on est touché
        this.tone('square', 240, 90, 0.12, 0.25 * vol);
        break;
      case 'hitmark':   // on touche quelqu'un
        this.tone('sine', 1300, 1100, 0.05, 0.2 * vol);
        break;
      case 'kill':
        this.tone('triangle', 660, 660, 0.08, 0.35 * vol);
        this.tone('triangle', 990, 990, 0.14, 0.35 * vol, 0.08);
        break;
      case 'death':
        this.tone('sawtooth', 320, 50, 0.5, 0.3 * vol);
        break;
      case 'reload':
        this.tone('square', 900, 700, 0.03, 0.15 * vol);
        this.tone('square', 600, 900, 0.04, 0.15 * vol, 0.12);
        break;
      case 'switch':
        this.tone('square', 500, 650, 0.04, 0.12 * vol);
        break;
      case 'spawn':
        this.tone('sine', 300, 900, 0.25, 0.2 * vol);
        break;
    }
  }
}

// Vibration courte (Android ; l'iPhone ne la gère pas dans le navigateur)
export function vibrate(ms) {
  if (ms > 0 && navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (_) { /* rien */ }
  }
}
