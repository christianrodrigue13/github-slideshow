// =====================================================================
// input.js — Lit le clavier, la souris et l'écran tactile, et les
// transforme en une "commande" neutre :
//
//   { moveX, up, aimX, aimY, fire, switchWeapon, reload }
//
// Le personnage (player.js) ne sait PAS d'où vient la commande :
// un bot fabrique la même commande, et plus tard un joueur en ligne
// pourra l'envoyer par le réseau. C'est ce qui prépare le multijoueur.
// =====================================================================

import { CONFIG } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.w = window.innerWidth;
    this.h = window.innerHeight;

    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, used: false };
    this.touchMode = false;        // passe à true dès le premier toucher

    // Joysticks virtuels : null quand aucun doigt n'est posé
    this.leftStick = null;         // { id, ox, oy, x, y }
    this.rightStick = null;
    this.lastAim = { x: 1, y: 0 }; // dernière direction de visée connue

    // Actions "une seule fois" (consommées à la mise à jour suivante)
    this.pending = { switchWeapon: false, reload: false, pause: false };
    // Touchers/clics sur les menus (positions écran)
    this.taps = [];
    // Quand un menu est affiché, tout toucher devient un "tap" de menu
    this.uiMode = true;

    // Fonction appelée au premier geste (sert à démarrer le son)
    this.onFirstGesture = null;

    this.buttons = this.layoutButtons();
    this.bindEvents();
  }

  // Taille de l'écran en pixels CSS (appelé par main.js au redimensionnement)
  resize(w, h) {
    this.w = w;
    this.h = h;
    this.buttons = this.layoutButtons();
  }

  // Position des boutons tactiles (en pixels CSS)
  layoutButtons() {
    const r = Math.max(24, this.h * 0.07);
    const m = 14 + r;               // marge depuis le bord
    return {
      pause:  { x: this.w - 34, y: 34, r: 22, label: 'II' },
      reload: { x: this.w - m, y: this.h * 0.36, r, label: 'R' },
      swap:   { x: this.w - m - r * 2.5, y: this.h * 0.30, r, label: '⇄' },
    };
  }

  stickRadius() {
    return this.h * CONFIG.touch.stickRadius;
  }

  bindEvents() {
    const c = this.canvas;

    // ---- Clavier ----
    // On utilise e.code (position physique de la touche) : W A S D sur un
    // clavier QWERTY correspond automatiquement à Z Q S D sur un AZERTY.
    window.addEventListener('keydown', (e) => {
      this.firstGesture();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyR') this.pending.reload = true;
      if (e.code === 'KeyE' || e.code === 'Digit1' || e.code === 'Digit2' ||
          e.code === 'Tab') this.pending.switchWeapon = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.pending.pause = true;
      if (this.uiMode && (e.code === 'Enter' || e.code === 'Space')) {
        this.taps.push({ x: -1, y: -1, key: true });
      }
      // Empêche la page de défiler avec espace / flèches / tab
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Molette = changer d'arme
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.pending.switchWeapon = true;
    }, { passive: false });

    // ---- Souris + tactile (Pointer Events gère les deux, en multi-touch) ----
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    // Si on quitte l'onglet, on relâche tout (évite un personnage "bloqué")
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  firstGesture() {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  onDown(e) {
    e.preventDefault();
    this.firstGesture();
    const x = e.clientX, y = e.clientY;

    if (e.pointerType === 'mouse') {
      this.touchMode = false;
      this.mouse.x = x; this.mouse.y = y; this.mouse.used = true;
      if (this.uiMode) { this.taps.push({ x, y }); return; }
      if (this.hitButton(this.buttons.pause, x, y)) { this.pending.pause = true; return; }
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.pending.reload = true;
      return;
    }

    // --- Doigt ---
    this.touchMode = true;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }

    if (this.uiMode) { this.taps.push({ x, y }); return; }

    // Boutons d'abord
    const b = this.buttons;
    if (this.hitButton(b.pause, x, y)) { this.pending.pause = true; return; }
    if (this.hitButton(b.reload, x, y)) { this.pending.reload = true; return; }
    if (this.hitButton(b.swap, x, y)) { this.pending.switchWeapon = true; return; }

    // Moitié gauche = déplacement, moitié droite = visée/tir.
    // Le joystick apparaît là où le doigt se pose.
    const stick = { id: e.pointerId, ox: x, oy: y, x, y };
    if (x < this.w / 2) {
      if (!this.leftStick) this.leftStick = stick;
    } else if (!this.rightStick) {
      this.rightStick = stick;
    }
  }

  onMove(e) {
    if (e.pointerType === 'mouse') {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.used = true;
      return;
    }
    for (const s of [this.leftStick, this.rightStick]) {
      if (s && s.id === e.pointerId) {
        s.x = e.clientX; s.y = e.clientY;
        // Si le doigt va trop loin, le centre du joystick le suit
        const R = this.stickRadius();
        const dx = s.x - s.ox, dy = s.y - s.oy;
        const d = Math.hypot(dx, dy);
        if (d > R * 1.6) {
          s.ox = s.x - (dx / d) * R * 1.6;
          s.oy = s.y - (dy / d) * R * 1.6;
        }
      }
    }
  }

  onUp(e) {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.mouse.down = false;
      return;
    }
    if (this.leftStick && this.leftStick.id === e.pointerId) this.leftStick = null;
    if (this.rightStick && this.rightStick.id === e.pointerId) this.rightStick = null;
  }

  releaseAll() {
    this.keys.clear();
    this.mouse.down = false;
    this.leftStick = null;
    this.rightStick = null;
  }

  hitButton(b, x, y) {
    return Math.hypot(x - b.x, y - b.y) <= b.r * 1.25;
  }

  // Valeur d'un joystick : vecteur de longueur 0 à 1
  stickValue(s) {
    if (!s) return { x: 0, y: 0, mag: 0 };
    const R = this.stickRadius();
    let dx = (s.x - s.ox) / R, dy = (s.y - s.oy) / R;
    let mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; mag = 1; }
    if (mag < CONFIG.touch.deadZone) return { x: 0, y: 0, mag: 0 };
    return { x: dx, y: dy, mag };
  }

  // Lit et efface un tap de menu
  takeTap() {
    return this.taps.shift() || null;
  }

  takePause() {
    const p = this.pending.pause;
    this.pending.pause = false;
    return p;
  }

  // Construit la commande du joueur pour cette mise à jour.
  // (px, py) = position du joueur à l'écran, pour viser à la souris.
  getCommand(px, py) {
    const k = this.keys;
    const cmd = { moveX: 0, up: false, aimX: this.lastAim.x, aimY: this.lastAim.y,
                  fire: false, switchWeapon: false, reload: false };

    // Clavier
    if (k.has('KeyA') || k.has('ArrowLeft')) cmd.moveX -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) cmd.moveX += 1;
    if (k.has('KeyW') || k.has('ArrowUp') || k.has('Space')) cmd.up = true;

    // Joystick gauche : déplacement + jetpack (pousser vers le haut)
    const L = this.stickValue(this.leftStick);
    if (L.mag > 0) {
      cmd.moveX = Math.abs(L.x) > 0.25 ? L.x : 0;
      if (-L.y > CONFIG.touch.jetThreshold) cmd.up = true;
    }

    // Joystick droit : viser, et tirer tant qu'on pousse assez loin
    const Rv = this.stickValue(this.rightStick);
    if (Rv.mag > 0) {
      cmd.aimX = Rv.x / Rv.mag; cmd.aimY = Rv.y / Rv.mag;
      cmd.fire = Rv.mag > CONFIG.touch.fireThreshold;
    } else if (!this.touchMode && this.mouse.used) {
      // Souris : on vise le curseur
      const dx = this.mouse.x - px, dy = this.mouse.y - py;
      const d = Math.hypot(dx, dy);
      if (d > 1) { cmd.aimX = dx / d; cmd.aimY = dy / d; }
      cmd.fire = this.mouse.down;
    }
    this.lastAim.x = cmd.aimX; this.lastAim.y = cmd.aimY;

    // Actions uniques
    cmd.switchWeapon = this.pending.switchWeapon;
    cmd.reload = this.pending.reload;
    this.pending.switchWeapon = false;
    this.pending.reload = false;
    return cmd;
  }
}
