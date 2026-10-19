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

    // Options tactiles (remplies par main.js depuis l'écran Options)
    this.leftHanded = false;       // inverse les côtés (joystick de visée à gauche)
    this.fixedSticks = false;      // joysticks à une place fixe au lieu de flottants
    this.aimSpeed = 14;            // vitesse à laquelle la visée suit le pouce (rad/s)
    this.aimAngle = 0;             // angle de visée actuel (lissé)

    // Doigt maintenu sur un menu (pour l'appui long sur le titre)
    this.hold = null;              // { x, y, time }

    this.buttons = this.layoutButtons();
    this.bindEvents();
  }

  // Taille de l'écran en pixels CSS (appelé par main.js au redimensionnement)
  resize(w, h, safeRight = 0) {
    this.w = w;
    this.h = h;
    this.safeR = safeRight;           // marge de l'encoche à droite
    this.buttons = this.layoutButtons();
  }

  // Applique les options du joueur (appelé quand elles changent)
  setOptions({ leftHanded, fixedSticks, aimSpeed }) {
    this.leftHanded = leftHanded;
    this.fixedSticks = fixedSticks;
    this.aimSpeed = aimSpeed;
    this.buttons = this.layoutButtons();
    this.releaseAll();
  }

  // Position des boutons tactiles (en pixels CSS). Ils sont sur le côté
  // du pouce qui vise (à droite, ou à gauche en mode gaucher), sur une
  // ligne, assez gros et assez espacés pour ne jamais se chevaucher.
  layoutButtons() {
    const r = Math.max(30, this.h * CONFIG.touch.buttonRadius);
    const edge = this.leftHanded ? 0 : this.w - (this.safeR || 0);
    const side = this.leftHanded ? 1 : -1;      // vers l'intérieur de l'écran
    const m = 14 + r;                            // marge depuis le bord
    const y = this.h * 0.43;
    const right = this.w - (this.safeR || 0);
    return {
      pause:  { x: right - 36, y: 36, r: 26, label: 'II' },
      reload: { x: edge + side * m, y, r, label: 'R' },
      swap:   { x: edge + side * (m + r * 2.6), y, r, label: '⇄' },
    };
  }

  // Centre des joysticks fixes : déplacement et visée
  fixedStickCenter(which) {
    const y = this.h * CONFIG.touch.fixedStickY;
    const moveLeft = !this.leftHanded;
    const leftX = this.w * 0.14, rightX = this.w * 0.86;
    if (which === 'move') return { x: moveLeft ? leftX : rightX, y };
    return { x: moveLeft ? rightX : leftX, y };
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
      if (this.uiMode) { this.taps.push({ x, y }); this.hold = { x, y, time: performance.now() }; return; }
      if (this.hitButton(this.buttons.pause, x, y)) { this.pending.pause = true; return; }
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.pending.reload = true;
      return;
    }

    // --- Doigt ---
    this.touchMode = true;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }

    if (this.uiMode) { this.taps.push({ x, y }); this.hold = { x, y, time: performance.now() }; return; }

    // Boutons d'abord
    const b = this.buttons;
    if (this.hitButton(b.pause, x, y)) { this.pending.pause = true; return; }
    if (this.hitButton(b.reload, x, y)) { this.pending.reload = true; return; }
    if (this.hitButton(b.swap, x, y)) { this.pending.switchWeapon = true; return; }

    // Une moitié de l'écran = déplacement, l'autre = visée/tir
    // (gauche/droite inversés en mode gaucher).
    // Joystick flottant : il apparaît là où le doigt se pose.
    // Joystick fixe : son centre ne bouge pas, le doigt peut se poser n'importe
    // où dans sa moitié d'écran.
    const moveSide = (x < this.w / 2) !== this.leftHanded;
    const which = moveSide ? 'move' : 'aim';
    const c = this.fixedSticks ? this.fixedStickCenter(which) : { x, y };
    const stick = { id: e.pointerId, ox: c.x, oy: c.y, x, y };
    if (moveSide) {
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
        // Joystick flottant : si le doigt va trop loin, le centre le suit
        const R = this.stickRadius();
        const dx = s.x - s.ox, dy = s.y - s.oy;
        const d = Math.hypot(dx, dy);
        if (!this.fixedSticks && d > R * 1.6) {
          s.ox = s.x - (dx / d) * R * 1.6;
          s.oy = s.y - (dy / d) * R * 1.6;
        }
      }
    }
  }

  onUp(e) {
    this.hold = null;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.mouse.down = false;
      return;
    }
    if (this.leftStick && this.leftStick.id === e.pointerId) this.leftStick = null;
    if (this.rightStick && this.rightStick.id === e.pointerId) this.rightStick = null;
  }

  releaseAll() {
    this.hold = null;
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

  // Construit la commande du joueur pour cette mise à jour (dt en secondes).
  // (px, py) = position du joueur à l'écran, pour viser à la souris.
  // L'objet renvoyé est réutilisé d'une fois sur l'autre (pas d'allocation).
  getCommand(px, py, dt) {
    const k = this.keys;
    const cmd = this.cmd || (this.cmd = {});
    cmd.moveX = 0; cmd.up = false; cmd.aimX = this.lastAim.x; cmd.aimY = this.lastAim.y;
    cmd.fire = false; cmd.switchWeapon = false; cmd.reload = false;

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
      // La visée tourne vers la direction du pouce à une vitesse limitée
      // (option "sensibilité") : plus doux et plus précis au doigt
      const target = Math.atan2(Rv.y, Rv.x);
      let diff = Math.atan2(Math.sin(target - this.aimAngle), Math.cos(target - this.aimAngle));
      const maxStep = this.aimSpeed * dt;
      if (Math.abs(diff) > maxStep) diff = Math.sign(diff) * maxStep;
      // premier contact : on part directement de la nouvelle direction si elle est loin
      if (!this.aiming) diff = target - this.aimAngle;
      this.aimAngle += diff;
      cmd.aimX = Math.cos(this.aimAngle); cmd.aimY = Math.sin(this.aimAngle);
      cmd.fire = Rv.mag > CONFIG.touch.fireThreshold;
      this.aiming = true;
    } else if (!this.touchMode && this.mouse.used) {
      // Souris : on vise le curseur
      const dx = this.mouse.x - px, dy = this.mouse.y - py;
      const d = Math.hypot(dx, dy);
      if (d > 1) { cmd.aimX = dx / d; cmd.aimY = dy / d; }
      cmd.fire = this.mouse.down;
    }
    if (Rv.mag === 0) {
      this.aiming = false;
      this.aimAngle = Math.atan2(cmd.aimY, cmd.aimX);
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
