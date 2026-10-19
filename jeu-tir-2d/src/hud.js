// =====================================================================
// hud.js — Interface à l'écran : barres, munitions, chrono, score,
// joysticks, boutons, menus (accueil, pause, fin de partie).
// Tout est dessiné en pixels CSS (repère écran, pas monde).
// =====================================================================

import { CONFIG } from './config.js';
import { MAPS } from './map.js';

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

// Total des éliminations de chaque équipe : [équipe 0, équipe 1]
export function teamScores(fighters) {
  const sc = [0, 0];
  for (const f of fighters) sc[f.team] += f.kills;
  return sc;
}

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

// ---------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------

// Lignes de réglage du menu principal
const SETTING_ROWS = [
  { key: 'map', label: 'Carte' },
  { key: 'mode', label: 'Mode' },
  { key: 'difficulty', label: 'Difficulté' },
  { key: 'bots', label: 'Bots' },
];

function settingValue(key, settings) {
  if (key === 'map') return MAPS[settings.map].name;
  if (key === 'mode') return settings.mode === 'teams' ? 'Équipes' : 'Chacun pour soi';
  if (key === 'difficulty') return CONFIG.difficulties[settings.difficulty].label;
  return String(settings.bots);
}

// Position des boutons de chaque menu (sert au dessin ET aux clics)
export function menuButtons(state, view, game) {
  const u = unit(view);
  const bw = 200 * u, bh = 44 * u, gap = 12 * u;
  const cx = view.w / 2 - bw / 2;
  const btn = (id, label, y) => ({ id, label, x: cx, y, w: bw, h: bh });
  if (state === 'menu') {
    // Chaque réglage : [◀] [valeur (touche = suivant)] [▶]
    const list = [];
    const rh = Math.min(40 * u, view.h * 0.105), rgap = rh * 0.2;
    const rw = Math.min(view.w - 40, 330 * u), aw = rh * 1.1;
    const x0 = view.w / 2 - rw / 2;
    let y = view.h * 0.27;
    for (const row of SETTING_ROWS) {
      list.push({ id: `${row.key}:-1`, label: '◀', x: x0, y, w: aw, h: rh, small: true });
      list.push({ id: `${row.key}:1`, label: settingValue(row.key, game.settings), caption: row.label,
                  x: x0 + aw + 4, y, w: rw - 2 * aw - 8, h: rh, setting: true });
      list.push({ id: `${row.key}:1`, label: '▶', x: x0 + rw - aw, y, w: aw, h: rh, small: true });
      y += rh + rgap;
    }
    list.push({ ...btn('play', 'JOUER', y + rgap), h: Math.min(bh, view.h * 0.12) });
    return list;
  }
  if (state === 'paused') {
    const h2 = Math.min(bh, view.h * 0.115), g2 = h2 * 0.25;
    const y0 = view.h * 0.27;
    const b2 = (id, label, i) => ({ id, label, x: cx, y: y0 + i * (h2 + g2), w: bw, h: h2 });
    return [
      b2('resume', 'Reprendre', 0),
      b2('restart', 'Recommencer', 1),
      b2('sound', game.sound.muted ? 'Son : coupé' : 'Son : activé', 2),
      b2('mainmenu', 'Menu principal', 3),
    ];
  }
  if (state === 'over') {
    const w2 = bw * 0.9;
    return [
      { id: 'replay', label: 'Rejouer', x: view.w / 2 - w2 - 6 * u, y: view.h - bh - 12 * u, w: w2, h: bh },
      { id: 'mainmenu', label: 'Menu', x: view.w / 2 + 6 * u, y: view.h - bh - 12 * u, w: w2, h: bh },
    ];
  }
  return [];
}

// Renvoie l'id du bouton touché, ou null
export function hitMenu(buttons, tap) {
  // Touche Entrée / Espace = premier bouton
  if (tap.key) {
    const main = buttons.find((b) => ['play', 'resume', 'replay'].includes(b.id));
    return main ? main.id : null;
  }
  for (const b of buttons) {
    if (tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h) return b.id;
  }
  return null;
}

function drawButtons(ctx, buttons, u) {
  for (const b of buttons) {
    if (b.setting || b.small) {
      ctx.fillStyle = b.small ? 'rgba(255,255,255,0.10)' : 'rgba(20,28,52,0.85)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 8 * u) : ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
      ctx.textBaseline = 'middle';
      if (b.setting) {
        ctx.font = font(10 * u, false);
        ctx.fillStyle = '#aab4d4';
        ctx.textAlign = 'left';
        ctx.fillText(b.caption, b.x + 10 * u, b.y + b.h / 2);
        ctx.font = font(15 * u);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2 + 20 * u, b.y + b.h / 2 + 1);
      } else {
        ctx.font = font(14 * u);
        ctx.fillStyle = '#ffb347';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      }
      continue;
    }
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
    ctx.font = font(Math.min(40 * u, view.h * 0.11));
    ctx.fillText('JET ARENA', cx, view.h * 0.11);
    ctx.fillStyle = '#aab4d4';
    ctx.font = font(11 * u, false);
    ctx.fillText('Pouce gauche : bouger / voler   ·   Pouce droit : viser / tirer   ·   ' +
                 'Clavier : ZQSD + souris', cx, view.h * 0.205);
  }

  if (state === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = font(28 * u);
    ctx.fillText('Pause', cx, view.h * 0.15);
  }

  if (state === 'over') {
    ctx.fillStyle = '#ffb347';
    ctx.font = font(28 * u);
    const [first, second] = ranking(game.fighters);
    let title = 'Fin de la partie';
    let rows = ranking(game.fighters);
    if (game.teams) {
      const [s0, s1] = teamScores(game.fighters);
      const T = CONFIG.teams;
      title = s0 === s1 ? 'Égalité !' : (s0 > s1 ? `Victoire des ${T.names[0]} !` : `Victoire des ${T.names[1]}…`);
      ctx.fillStyle = s0 === s1 ? '#fff' : T.colors[s0 > s1 ? 0 : 1];
      // classement regroupé par équipe
      rows = [...rows].sort((a, b) => a.team - b.team);
    } else if (first === game.player) {
      title = second && second.kills === first.kills ? 'Égalité en tête !' : 'Victoire !';
    }
    ctx.fillText(title, cx, 26 * u);
    if (game.teams) {
      const [s0, s1] = teamScores(game.fighters);
      ctx.font = font(13 * u, false);
      ctx.fillStyle = '#dfe6ff';
      ctx.fillText(`${CONFIG.teams.names[0]} ${s0}  —  ${s1} ${CONFIG.teams.names[1]}`, cx, 48 * u);
    }

    // Tableau du classement
    const top = game.teams ? 70 * u : 60 * u;
    const rowH = Math.min(26 * u, (view.h - top - 70 * u) / (rows.length + 1));
    const tw = Math.min(view.w - 40, 420 * u);
    const x0 = cx - tw / 2;
    let y = top;
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
      ctx.fillStyle = game.teams ? CONFIG.teams.colors[f.team] : f.color;
      ctx.fillText(f.name, x0 + 40 * u, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(f.kills), x0 + tw - 90 * u, y);
      ctx.fillText(String(f.deaths), x0 + tw - 8, y);
    });
  }

  drawButtons(ctx, menuButtons(state, view, game), u);
}
