// =====================================================================
// hud.js — Interface pendant la partie : barres, munitions, chrono,
// score, minicarte, joysticks et boutons tactiles.
// Tout est dessiné en pixels CSS (repère écran, pas monde).
// =====================================================================

import { CONFIG } from './config.js';
import { unit, font, bar, formatTime } from './ui.js';
import { ranking, teamScores } from './match.js';

// ---------------------------------------------------------------------
// Interface pendant la partie
// ---------------------------------------------------------------------
// pp = position du joueur à l'écran
export function drawHUD(ctx, game, view, pp) {
  const u = unit(view);
  const p = game.player;
  const x = view.safeL + 12 * u;
  let y = 12 * u;
  const bw = 150 * u, bh = 12 * u;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Vie
  const hp = p.alive ? p.health : 0;
  bar(ctx, x, y, bw, bh, hp / CONFIG.fighter.maxHealth, hp > 35 ? '#51cf66' : '#ff6b6b');
  ctx.fillStyle = '#fff';
  ctx.font = font(10 * u);
  ctx.fillText(`PV ${Math.ceil(hp)}`, x + 4 * u, y + bh / 2 + 1);
  // Bouclier : fine barre bleue par-dessus la vie
  if (p.shield > 0) {
    bar(ctx, x, y - 4 * u, bw, 4 * u, p.shield / CONFIG.pickups.shieldAmount, '#4dabf7');
  }

  // Jetpack
  y += bh + 5 * u;
  bar(ctx, x, y, bw, bh * 0.7, p.fuel / CONFIG.jetpack.maxFuel, '#4dd4ff');
  ctx.font = font(8 * u);
  ctx.fillStyle = '#fff';
  ctx.fillText('JETPACK', x + 4 * u, y + bh * 0.35 + 1);

  // Arme et munitions
  y += bh * 0.7 + 14 * u;
  const w = p.weapon;
  ctx.font = font(13 * u);
  ctx.fillStyle = w.def.color;
  ctx.fillText(w.def.name, x, y);
  // L'autre arme, en petit et grisée
  const other = p.weapons[1 - p.weaponIndex];
  const nameW = ctx.measureText(w.def.name).width;
  ctx.font = font(10 * u, false);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`⇄ ${other.def.name}`, x + nameW + 8 * u, y + 1);
  ctx.fillStyle = '#fff';
  if (w.reloading) {
    ctx.font = font(11 * u);
    ctx.fillText('Rechargement…', x, y + 16 * u);
    bar(ctx, x, y + 25 * u, bw * 0.7, 4 * u, w.reloadProgress, '#ffd43b');
  } else {
    ctx.font = font(16 * u);
    ctx.fillStyle = w.ammo === 0 ? '#ff6b6b' : '#fff';
    ctx.fillText(`${w.ammo} / ${w.def.magazine}`, x, y + 17 * u);
  }

  // Chrono + score au centre en haut
  const cx = view.w / 2;
  ctx.textAlign = 'center';
  ctx.font = font(22 * u);
  ctx.fillStyle = game.timeLeft < 30 ? '#ff8787' : '#fff';
  ctx.fillText(formatTime(game.timeLeft), cx, 20 * u);
  ctx.font = font(12 * u, false);
  ctx.fillStyle = '#dfe6ff';
  if (game.teams) {
    // Score des équipes, chacune dans sa couleur
    const [s0, s1] = teamScores(game.fighters);
    const T = CONFIG.teams;
    const left = `${T.names[0]} ${s0}`, right = `${s1} ${T.names[1]}`;
    ctx.font = font(13 * u);
    ctx.textAlign = 'right';
    ctx.fillStyle = T.colors[0];
    ctx.fillText(left, cx - 10 * u, 42 * u);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('—', cx, 42 * u);
    ctx.textAlign = 'left';
    ctx.fillStyle = T.colors[1];
    ctx.fillText(right, cx + 10 * u, 42 * u);
    ctx.textAlign = 'center';
  } else {
    const rank = ranking(game.fighters).indexOf(p) + 1;
    ctx.fillText(`Éliminations : ${p.kills}   ·   Place : ${rank}/${game.fighters.length}`,
                 cx, 42 * u);
  }

  // Minicarte (en haut à droite, à gauche du bouton pause)
  drawMinimap(ctx, game, view, u);

  // Fil des éliminations (au centre, sous le score : loin des boutons tactiles)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(11 * u, false);
  let fy = 62 * u;
  for (const item of game.feed.slice(0, 3)) {
    const age = game.time - item.time;
    ctx.globalAlpha = Math.max(0, Math.min(1, 4 - age));
    ctx.fillStyle = item.mine ? '#ffe066' : '#fff';
    ctx.fillText(item.text, cx, fy);
    fy += 14 * u;
  }
  ctx.globalAlpha = 1;

  // Flèches rouges : d'où viennent les tirs reçus
  const ring = Math.min(view.w, view.h) * 0.3;
  for (const m of game.hurtMarks) {
    const age = game.time - m.time;
    if (age > 1 || !p.alive) continue;
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(m.angle);
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.moveTo(ring + 16 * u, 0);
    ctx.lineTo(ring, -10 * u);
    ctx.lineTo(ring, 10 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Bandeau "Élimination !" (grossit puis s'efface)
  if (game.banner) {
    const age = game.time - game.banner.time;
    if (age < 1.6) {
      const pop = age < 0.15 ? 0.6 + age / 0.15 * 0.6 : 1.2 - Math.min(0.2, (age - 0.15));
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1.6 - age) * 2);
      ctx.translate(cx, view.h * 0.34);
      ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.font = font(24 * u);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(game.banner.text, 2, 2);
      ctx.fillStyle = '#ffd43b';
      ctx.fillText(game.banner.text, 0, 0);
      ctx.restore();
    }
  }

  // Écran de mort : compte à rebours
  if (!p.alive) {
    ctx.fillStyle = 'rgba(120,0,20,0.25)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = font(26 * u);
    ctx.fillText('Éliminé !', cx, view.h * 0.42);
    ctx.font = font(15 * u, false);
    ctx.fillText(`Réapparition dans ${Math.ceil(p.respawnTimer)}…`, cx, view.h * 0.42 + 30 * u);
  }

  // Petit voile rouge quand on vient d'être touché
  if (p.alive && p.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,0,40,${p.hitFlash * 2})`;
    ctx.fillRect(0, 0, view.w, view.h);
  }
}

// Minicarte : murs, objets, joueur (blanc), coéquipiers, et ennemis
// seulement s'ils ont tiré récemment (comme un radar).
function drawMinimap(ctx, game, view, u) {
  const map = game.map;
  const maxW = Math.min(150 * u, view.w * 0.2), maxH = 80 * u;
  let k = maxW / map.width;
  if (map.height * k > maxH) k = maxH / map.height;
  const w = map.width * k, h = map.height * k;
  const x0 = view.w - view.safeR - 64 - w, y0 = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
  ctx.fillStyle = 'rgba(200,210,235,0.45)';
  for (const sd of map.solids) {
    ctx.fillRect(x0 + sd.x * k, y0 + sd.y * k, Math.max(1, sd.w * k), Math.max(1, sd.h * k));
  }
  for (const pk of game.pickups) {
    if (!pk.active) continue;
    ctx.fillStyle = pk.type === 'health' ? '#ff8787' : pk.type === 'shield' ? '#74c0fc' : '#e0b44c';
    ctx.fillRect(x0 + pk.x * k - 1.5, y0 + pk.y * k - 1.5, 3, 3);
  }
  const dot = (f, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + f.cx * k, y0 + f.cy * k, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const f of game.fighters) {
    if (!f.alive || f === game.player) continue;
    const enemy = game.canHit(game.player, f);
    if (!enemy) dot(f, CONFIG.teams.colors[f.team], 2.5);
    else if (game.time - f.lastShotTime < CONFIG.minimap.radarTime) dot(f, '#ff4d4d', 2.5);
  }
  if (game.player.alive) dot(game.player, '#ffffff', 3);
}

// Bouton pause (toujours visible pendant la partie)
export function drawPauseButton(ctx, input) {
  const b = input.buttons.pause;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(b.x - 6, b.y - 8, 4, 16);
  ctx.fillRect(b.x + 2, b.y - 8, 4, 16);
}

// ---------------------------------------------------------------------
// Joysticks virtuels et boutons tactiles
// ---------------------------------------------------------------------
export function drawTouchControls(ctx, input) {
  if (!input.touchMode || input.uiMode) return;
  const R = input.stickRadius();

  for (const s of [input.leftStick, input.rightStick]) {
    if (!s) continue;
    const v = input.stickValue(s);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(s.ox + v.x * R, s.oy + v.y * R, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // Indications quand aucun doigt n'est posé
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = font(input.h * 0.035, false);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!input.leftStick) ctx.fillText('bouger / voler', input.w * 0.2, input.h * 0.82);
  if (!input.rightStick) ctx.fillText('viser / tirer', input.w * 0.75, input.h * 0.82);

  // Boutons recharger / changer d'arme
  for (const b of [input.buttons.reload, input.buttons.swap]) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = font(b.r * 0.8);
    ctx.fillText(b.label, b.x, b.y + 1);
  }
}
