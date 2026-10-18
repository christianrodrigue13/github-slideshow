// =====================================================================
// main.js — Point d'entrée : canvas, boucle de jeu, caméra.
// =====================================================================

import { CONFIG } from './config.js';
import { GameMap } from './map.js';
import { Fighter } from './player.js';
import { Input } from './input.js';
import { drawTouchControls } from './hud.js';
import { Particle } from './bullet.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);

// Taille de l'écran en pixels CSS, et facteur de zoom monde → écran
const screen = { w: 0, h: 0, dpr: 1, scale: 1 };
const cam = { x: 0, y: 0 };

const map = new GameMap();
const player = new Fighter({ name: CONFIG.player.name, color: CONFIG.player.color });
player.placeAt(map.spawns[0].x, map.spawns[0].y);
input.uiMode = false;

// L'état partagé de la partie, transmis aux personnages et aux balles
const game = {
  map,
  fighters: [player],
  bullets: [],
  particles: [],
  // Une balle touche quelqu'un
  onBulletHit(target, bullet) {
    game.sparks(bullet.x, bullet.y, target.color, 6);
  },
  // Petites étincelles
  sparks(x, y, color, n) {
    for (let i = 0; i < n; i++) game.particles.push(new Particle(x, y, color));
  },
  // Événements des personnages (tir, rechargement…) : sons plus tard
  onFighterEvent(fighter, name) {},
};

// ---------------------------------------------------------------------
// Adaptation à la taille de l'écran (et netteté sur écrans haute densité)
// ---------------------------------------------------------------------
function resize() {
  screen.w = window.innerWidth;
  screen.h = window.innerHeight;
  screen.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxPixelRatio);
  // Le canvas a plus de pixels réels que de pixels CSS → rendu net
  canvas.width = Math.round(screen.w * screen.dpr);
  canvas.height = Math.round(screen.h * screen.dpr);
  // Zoom : on garantit une surface minimale de monde visible
  screen.scale = Math.min(screen.w / CONFIG.view.minVisibleWidth,
                          screen.h / CONFIG.view.minVisibleHeight);
  input.resize(screen.w, screen.h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------------------------------------------------------------------
// Caméra : suit le joueur en douceur, sans sortir de la carte
// ---------------------------------------------------------------------
function updateCamera(dt, snap = false) {
  const viewW = screen.w / screen.scale;
  const viewH = screen.h / screen.scale;
  let tx = player.cx - viewW / 2;
  let ty = player.cy - viewH / 2;
  tx = Math.max(0, Math.min(map.width - viewW, tx));
  ty = Math.max(0, Math.min(map.height + 100 - viewH, ty));
  if (viewW > map.width) tx = (map.width - viewW) / 2;
  const k = snap ? 1 : 1 - Math.exp(-CONFIG.view.followSpeed * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

// Position du joueur à l'écran (pour viser à la souris)
function worldToScreen(x, y) {
  return { x: (x - cam.x) * screen.scale, y: (y - cam.y) * screen.scale };
}

// ---------------------------------------------------------------------
// Une mise à jour de la logique (toujours 1/60 s)
// ---------------------------------------------------------------------
function update(dt) {
  const p = worldToScreen(player.cx, player.cy);
  const cmd = input.getCommand(p.x, p.y);
  player.update(cmd, dt, game);
  for (const b of game.bullets) b.update(dt, game);
  game.bullets = game.bullets.filter((b) => !b.dead);
  for (const pa of game.particles) pa.update(dt);
  game.particles = game.particles.filter((pa) => pa.life > 0);
  if (player.y > map.killY) player.placeAt(map.spawns[0].x, map.spawns[0].y);
  updateCamera(dt);
}

// ---------------------------------------------------------------------
// Dessin
// ---------------------------------------------------------------------
function render() {
  // Repère écran (pixels CSS) avec prise en compte de la densité
  ctx.setTransform(screen.dpr, 0, 0, screen.dpr, 0, 0);
  ctx.fillStyle = '#151b2e';
  ctx.fillRect(0, 0, screen.w, screen.h);

  // Repère monde : zoom + décalage caméra
  ctx.save();
  ctx.scale(screen.scale, screen.scale);
  ctx.translate(-cam.x, -cam.y);
  map.draw(ctx, cam);
  player.draw(ctx);
  for (const b of game.bullets) b.draw(ctx);
  for (const pa of game.particles) pa.draw(ctx);
  ctx.restore();

  drawTouchControls(ctx, input);
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

updateCamera(0, true);
requestAnimationFrame(frame);
