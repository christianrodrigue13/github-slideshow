// =====================================================================
// main.js — Point d'entrée : canvas, boucle de jeu, caméra, règles de
// la partie (éliminations, réapparition, chrono) et menus.
// =====================================================================

import { CONFIG } from './config.js';
import { GameMap } from './map.js';
import { Fighter } from './player.js';
import { BotBrain } from './bot.js';
import { Input } from './input.js';
import { Particle } from './bullet.js';
import { Sound, vibrate } from './audio.js';
import { drawHUD, drawTouchControls, drawPauseButton, drawMenu,
         menuButtons, hitMenu } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sound = new Sound();

// Taille de l'écran (pixels CSS), zoom monde → écran, marges des encoches
const view = { w: 0, h: 0, dpr: 1, scale: 1, safeL: 0, safeR: 0 };
const cam = { x: 0, y: 0 };

// 'menu' | 'playing' | 'paused' | 'over'
let state = 'menu';

// L'état partagé de la partie, transmis aux personnages et aux balles
const game = {
  map: new GameMap(),
  fighters: [],
  bots: [],             // { fighter, brain }
  player: null,
  bullets: [],
  particles: [],
  feed: [],             // fil des éliminations
  time: 0,
  timeLeft: CONFIG.rules.matchDuration,
  sound,

  // Une balle touche quelqu'un
  onBulletHit(target, bullet) {
    game.sparks(bullet.x, bullet.y, target.color, 6);
    if (target.protectTimer > 0) return;          // invincible après réapparition
    target.health -= bullet.damage;
    target.hitFlash = 0.12;
    target.lastAttacker = bullet.owner;
    target.lastAttackTime = game.time;
    target.vx += bullet.vx * 0.02;                // petit recul sur la cible
    if (target === game.player) {
      sound.play('hurt');
      vibrate(CONFIG.feedback.vibrateOnHit);
    } else if (bullet.owner === game.player) {
      sound.play('hitmark');
    }
    if (target.health <= 0) killFighter(target, bullet.owner);
  },

  // Petites étincelles
  sparks(x, y, color, n) {
    for (let i = 0; i < n; i++) game.particles.push(new Particle(x, y, color));
  },

  // Événements des personnages → sons et vibrations
  onFighterEvent(f, name) {
    const vol = hearingVolume(f);
    if (name === 'fire') {
      sound.play(f.weapon.def.pellets > 1 ? 'shotgun' : 'rifle', vol);
      if (f === game.player) vibrate(CONFIG.feedback.vibrateOnShoot);
    } else if (f === game.player) {
      sound.play(name);                            // 'reload', 'switch'
    }
  },
};

// Plus un personnage est loin du joueur, moins on l'entend
function hearingVolume(f) {
  const p = game.player;
  const d = Math.hypot(f.cx - p.cx, f.cy - p.cy);
  return Math.max(0, 1 - d / 1100);
}

// Élément invisible dont le CSS donne la taille des encoches
const safeProbe = document.createElement('div');
safeProbe.id = 'safe-probe';
document.body.appendChild(safeProbe);

// ---------------------------------------------------------------------
// Adaptation à la taille de l'écran (et netteté sur écrans haute densité)
// ---------------------------------------------------------------------
function resize() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxPixelRatio);
  // Le canvas a plus de pixels réels que de pixels CSS → rendu net
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  // Zoom : on garantit une surface minimale de monde visible
  view.scale = Math.min(view.w / CONFIG.view.minVisibleWidth,
                        view.h / CONFIG.view.minVisibleHeight);
  // Marges des encoches (iPhone en paysage…), lues depuis le CSS
  const cs = getComputedStyle(safeProbe);
  view.safeL = parseFloat(cs.paddingLeft) || 0;
  view.safeR = parseFloat(cs.paddingRight) || 0;
  input.resize(view.w, view.h, view.safeR);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// ---------------------------------------------------------------------
// Caméra : suit le joueur en douceur, sans sortir de la carte
// ---------------------------------------------------------------------
function updateCamera(dt, snap = false) {
  const p = game.player;
  const viewW = view.w / view.scale;
  const viewH = view.h / view.scale;
  let tx = p.cx - viewW / 2;
  let ty = p.cy - viewH / 2;
  tx = Math.max(0, Math.min(game.map.width - viewW, tx));
  ty = Math.max(0, Math.min(game.map.height + 100 - viewH, ty));
  if (viewW > game.map.width) tx = (game.map.width - viewW) / 2;
  const k = snap ? 1 : 1 - Math.exp(-CONFIG.view.followSpeed * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

function worldToScreen(x, y) {
  return { x: (x - cam.x) * view.scale, y: (y - cam.y) * view.scale };
}

// ---------------------------------------------------------------------
// Règles de la partie
// ---------------------------------------------------------------------
function startMatch() {
  game.player = new Fighter({ name: CONFIG.player.name, color: CONFIG.player.color });
  game.fighters = [game.player];
  game.bots = [];
  const B = CONFIG.bots;
  for (let i = 0; i < B.count; i++) {
    const f = new Fighter({ name: B.names[i % B.names.length],
                            color: B.colors[i % B.colors.length], isBot: true });
    game.fighters.push(f);
    game.bots.push({ fighter: f, brain: new BotBrain(f) });
  }
  // Chacun sur un point d'apparition différent
  const spawns = [...game.map.spawns].sort(() => Math.random() - 0.5);
  game.fighters.forEach((f, i) => {
    f.respawn(spawns[i % spawns.length]);
    f.protectTimer = 0;
  });
  game.bullets = [];
  game.particles = [];
  game.feed = [];
  game.time = 0;
  game.timeLeft = CONFIG.rules.matchDuration;
  updateCamera(0, true);
  setState('playing');
}

function setState(s) {
  state = s;
  input.uiMode = s !== 'playing';
  input.taps.length = 0;
  if (s !== 'playing') {
    input.releaseAll();
    sound.setJet(0);
  }
}

// Point d'apparition le plus éloigné des adversaires vivants
// (on tire au sort parmi les 3 meilleurs pour varier)
function chooseSpawn(f) {
  const others = game.fighters.filter((o) => o !== f && o.alive);
  const scored = game.map.spawns.map((s) => {
    let d = Infinity;
    for (const o of others) d = Math.min(d, Math.hypot(o.cx - s.x, o.cy - s.y));
    return { s, d };
  }).sort((a, b) => b.d - a.d);
  return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
}

function killFighter(victim, killer) {
  if (!victim.alive) return;
  victim.alive = false;
  victim.health = 0;
  victim.deaths++;
  victim.jetting = false;
  victim.respawnTimer = CONFIG.rules.respawnDelay;
  game.sparks(victim.cx, victim.cy, victim.color, 26);

  if (killer && killer !== victim) {
    killer.kills++;
    addFeed(`${killer.name}  ✕  ${victim.name}`,
            killer === game.player || victim === game.player);
  } else {
    addFeed(`${victim.name} est tombé dans le vide`, victim === game.player);
  }
  if (victim === game.player) sound.play('death');
  else if (killer === game.player) sound.play('kill');
  else sound.play('death', hearingVolume(victim) * 0.5);
}

function addFeed(text, mine) {
  game.feed.unshift({ text, mine, time: game.time });
  if (game.feed.length > 4) game.feed.pop();
}

// ---------------------------------------------------------------------
// Une mise à jour de la logique (toujours 1/60 s)
// ---------------------------------------------------------------------
function update(dt) {
  // Téléphone tenu en portrait pendant la partie → pause automatique
  if (state === 'playing' && input.touchMode && view.h > view.w) setState('paused');

  if (state !== 'playing') {
    handleMenuTaps();
    // Échap / bouton pause : reprend depuis la pause, ignoré dans les autres menus
    if (input.takePause() && state === 'paused') setState('playing');
    return;
  }
  if (input.takePause()) { setState('paused'); return; }

  game.time += dt;
  game.timeLeft -= dt;
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    setState('over');
    return;
  }

  // 1. Commandes : le joueur (entrées) et les bots (IA) produisent la même chose
  const p = game.player;
  const ps = worldToScreen(p.shoulderX, p.shoulderY);
  const playerCmd = input.getCommand(ps.x, ps.y);
  const cmds = new Map([[p, playerCmd]]);
  for (const b of game.bots) cmds.set(b.fighter, b.brain.think(dt, game));

  // 2. Les personnages appliquent leur commande
  for (const f of game.fighters) {
    if (f.alive) {
      f.update(cmds.get(f), dt, game);
      if (f.y > game.map.killY) {
        // Tombé dans le vide : l'élimination revient au dernier tireur récent
        const recent = game.time - f.lastAttackTime < CONFIG.rules.killCreditTime;
        killFighter(f, recent ? f.lastAttacker : null);
      }
    } else {
      f.respawnTimer -= dt;
      if (f.respawnTimer <= 0) {
        f.respawn(chooseSpawn(f));
        const brain = game.bots.find((b) => b.fighter === f);
        if (brain) brain.brain.reset();
        if (f === p) sound.play('spawn');
      }
    }
  }

  // 3. Balles et particules
  for (const b of game.bullets) b.update(dt, game);
  game.bullets = game.bullets.filter((b) => !b.dead);
  for (const pa of game.particles) pa.update(dt);
  game.particles = game.particles.filter((pa) => pa.life > 0);

  sound.setJet(p.alive && p.jetting ? 1 : 0);
  updateCamera(dt);
}

// Clics / touchers sur les boutons des menus
function handleMenuTaps() {
  let tap;
  while ((tap = input.takeTap())) {
    const id = hitMenu(menuButtons(state, view, game), tap);
    if (id === 'play') {
      goFullscreen();
      startMatch();
    } else if (id === 'replay' || id === 'restart') {
      startMatch();
    } else if (id === 'resume') {
      setState('playing');
    } else if (id === 'sound') {
      sound.toggleMute();
    }
  }
}

// Plein écran + verrouillage paysage (Android ; ignoré ailleurs)
function goFullscreen() {
  if (!input.touchMode) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  try {
    const pr = req.call(el, { navigationUI: 'hide' });
    if (pr && pr.then) {
      pr.then(() => screen.orientation && screen.orientation.lock &&
                    screen.orientation.lock('landscape').catch(() => {}))
        .catch(() => {});
    }
  } catch (_) { /* pas grave : on joue sans plein écran */ }
}

// ---------------------------------------------------------------------
// Dessin
// ---------------------------------------------------------------------
function render() {
  // Repère écran (pixels CSS) avec prise en compte de la densité
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#151b2e';
  ctx.fillRect(0, 0, view.w, view.h);

  if (game.player) {
    // Repère monde : zoom + décalage caméra
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(-cam.x, -cam.y);
    game.map.draw(ctx, cam);
    for (const f of game.fighters) if (f !== game.player) f.draw(ctx);
    game.player.draw(ctx);                       // le joueur par-dessus
    for (const b of game.bullets) b.draw(ctx);
    for (const pa of game.particles) pa.draw(ctx);
    ctx.restore();

    drawHUD(ctx, game, view);
  } else {
    // Écran d'accueil : la carte en fond
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(-cam.x, -cam.y);
    game.map.draw(ctx, cam);
    ctx.restore();
  }

  if (state === 'playing') {
    drawTouchControls(ctx, input);
    drawPauseButton(ctx, input);
  } else {
    drawMenu(ctx, state, view, game);
  }
}

// ---------------------------------------------------------------------
// Boucle à pas de temps fixe : la logique tourne exactement 60 fois par
// seconde quel que soit l'appareil ; l'affichage suit l'écran.
// ---------------------------------------------------------------------
const STEP = 1 / CONFIG.updatesPerSecond;
let accumulator = 0;
let last = performance.now();

function frame(now) {
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;   // onglet en arrière-plan, gros ralentissement…
  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= STEP && steps < CONFIG.maxStepsPerFrame) {
    update(STEP);
    accumulator -= STEP;
    steps++;
  }
  if (steps === CONFIG.maxStepsPerFrame) accumulator = 0;
  render();
  requestAnimationFrame(frame);
}

// Le son ne peut démarrer qu'après un premier geste (règle des navigateurs)
input.onFirstGesture = () => sound.unlock();
// Sur iPhone, le son peut se "rendormir" : on le relance à chaque toucher
window.addEventListener('pointerdown', () => sound.unlock());

// Si on quitte l'application pendant la partie → pause
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') setState('paused');
});

// Petit accès de débogage pour les tests automatiques
window.__debug = () => ({
  state,
  feed: game.feed.map((f) => f.text),
  timeLeft: game.timeLeft,
  fighters: game.fighters.map((f) => ({ name: f.name, alive: f.alive, hp: Math.round(f.health),
    kills: f.kills, deaths: f.deaths, x: Math.round(f.x), y: Math.round(f.y) })),
});

cam.x = 1000; cam.y = 600;
requestAnimationFrame(frame);
