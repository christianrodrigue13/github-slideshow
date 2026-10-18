// =====================================================================
// hud.js — Interface à l'écran : barres, munitions, chrono, score,
// joysticks, boutons, menus (accueil, pause, fin de partie).
// Tout est dessiné en pixels CSS (repère écran, pas monde).
// =====================================================================

import { CONFIG } from './config.js';

// Unité de taille : s'adapte à la hauteur de l'écran
function unit(view) {
  return Math.max(0.8, Math.min(1.6, view.h / 400));
}

function font(px, bold = true) {
  return `${bold ? 'bold ' : ''}${Math.round(px)}px system-ui, -apple-system, sans-serif`;
}

// Barre horizontale avec fond
function bar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function formatTime(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Classement : plus d'éliminations d'abord, puis moins de morts
export function ranking(fighters) {
  return [...fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}

// ---------------------------------------------------------------------
// Interface pendant la partie
// ---------------------------------------------------------------------
export function drawHUD(ctx, game, view) {
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
  const rank = ranking(game.fighters).indexOf(p) + 1;
  ctx.font = font(12 * u, false);
  ctx.fillStyle = '#dfe6ff';
  ctx.fillText(`Éliminations : ${p.kills}   ·   Place : ${rank}/${game.fighters.length}`,
               cx, 42 * u);

  // Fil des éliminations (en haut à droite, sous le bouton pause)
  ctx.textAlign = 'right';
  ctx.font = font(11 * u, false);
  let fy = 70;
  for (const item of game.feed) {
    const age = game.time - item.time;
    ctx.globalAlpha = Math.max(0, Math.min(1, 4 - age));
    ctx.fillStyle = item.mine ? '#ffe066' : '#fff';
    ctx.fillText(item.text, view.w - view.safeR - 12, fy);
    fy += 16 * u;
  }
  ctx.globalAlpha = 1;

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

// ---------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------

// Position des boutons de chaque menu (sert au dessin ET aux clics)
export function menuButtons(state, view, game) {
  const u = unit(view);
  const bw = 200 * u, bh = 44 * u, gap = 12 * u;
  const cx = view.w / 2 - bw / 2;
  const btn = (id, label, y) => ({ id, label, x: cx, y, w: bw, h: bh });
  if (state === 'menu') {
    return [btn('play', 'JOUER', view.h * 0.55)];
  }
  if (state === 'paused') {
    const y0 = view.h * 0.32;
    return [
      btn('resume', 'Reprendre', y0),
      btn('restart', 'Recommencer', y0 + bh + gap),
      btn('sound', game.sound.muted ? 'Son : coupé' : 'Son : activé', y0 + 2 * (bh + gap)),
    ];
  }
  if (state === 'over') {
    return [btn('replay', 'Rejouer', view.h - bh - 16 * u)];
  }
  return [];
}

// Renvoie l'id du bouton touché, ou null
export function hitMenu(buttons, tap) {
  // Touche Entrée / Espace = premier bouton
  if (tap.key) return buttons.length ? buttons[0].id : null;
  for (const b of buttons) {
    if (tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h) return b.id;
  }
  return null;
}

function drawButtons(ctx, buttons, u) {
  for (const b of buttons) {
    ctx.fillStyle = b.id === 'play' || b.id === 'replay' || b.id === 'resume' ? '#ffb347' : '#3a4a6b';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 10 * u) : ctx.rect(b.x, b.y, b.w, b.h);
    ctx.fill();
    ctx.fillStyle = b.id === 'play' || b.id === 'replay' || b.id === 'resume' ? '#1b2440' : '#fff';
    ctx.font = font(17 * u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
}

export function drawMenu(ctx, state, view, game) {
  const u = unit(view);
  const cx = view.w / 2;
  ctx.fillStyle = 'rgba(10,14,28,0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state === 'menu') {
    ctx.fillStyle = '#ffb347';
    ctx.font = font(44 * u);
    ctx.fillText('JET ARENA', cx, view.h * 0.2);
    ctx.fillStyle = '#dfe6ff';
    ctx.font = font(14 * u, false);
    ctx.fillText(`Prototype — toi contre ${CONFIG.bots.count} bots, ` +
                 `${Math.round(CONFIG.rules.matchDuration / 60)} minutes`, cx, view.h * 0.2 + 36 * u);
    ctx.font = font(12 * u, false);
    ctx.fillStyle = '#aab4d4';
    ctx.fillText('Téléphone : pouce gauche = bouger / voler (vers le haut),  pouce droit = viser et tirer',
                 cx, view.h * 0.38);
    ctx.fillText('Ordinateur : Z Q S D ou flèches, Espace = voler, souris = viser / tirer, R = recharger, E = arme',
                 cx, view.h * 0.38 + 20 * u);
  }

  if (state === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = font(30 * u);
    ctx.fillText('Pause', cx, view.h * 0.18);
  }

  if (state === 'over') {
    ctx.fillStyle = '#ffb347';
    ctx.font = font(28 * u);
    const winner = ranking(game.fighters)[0];
    ctx.fillText(winner === game.player ? 'Victoire !' : 'Fin de la partie', cx, 26 * u);

    // Tableau du classement
    const rows = ranking(game.fighters);
    const rowH = Math.min(26 * u, (view.h - 150 * u) / (rows.length + 1));
    const tw = Math.min(view.w - 40, 420 * u);
    const x0 = cx - tw / 2;
    let y = 60 * u;
    ctx.font = font(12 * u);
    ctx.fillStyle = '#aab4d4';
    ctx.textAlign = 'left';
    ctx.fillText('#', x0 + 8, y);
    ctx.fillText('Joueur', x0 + 40 * u, y);
    ctx.textAlign = 'right';
    ctx.fillText('Éliminations', x0 + tw - 90 * u, y);
    ctx.fillText('Morts', x0 + tw - 8, y);
    rows.forEach((f, i) => {
      y += rowH;
      if (f === game.player) {
        ctx.fillStyle = 'rgba(255,179,71,0.18)';
        ctx.fillRect(x0, y - rowH / 2, tw, rowH);
      }
      ctx.font = font(14 * u, f === game.player);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(i + 1), x0 + 8, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.name, x0 + 40 * u, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(f.kills), x0 + tw - 90 * u, y);
      ctx.fillText(String(f.deaths), x0 + tw - 8, y);
    });
  }

  drawButtons(ctx, menuButtons(state, view, game), u);
}
