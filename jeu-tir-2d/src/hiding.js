// =====================================================================
// hiding.js — Les cachettes : buissons, herbes hautes, haies, filets…
// Règles : on les traverse librement (les balles aussi) ; un personnage
// dedans devient INVISIBLE pour ses adversaires, sauf s'il vient de tirer
// (ou d'être blessé) ou si un ennemi est tout près. Les réglages sont
// dans config.js (bloc "hiding"). Les emplacements sont dans map.js.
// Ce fichier dessine aussi le feuillage (par-dessus les personnages).
// =====================================================================

import { CONFIG } from './config.js';

const H = CONFIG.hiding;

// ---------------------------------------------------------------------
// Règles
// ---------------------------------------------------------------------

// Cachette dans laquelle se trouve ce personnage, ou null
export function hideZoneOf(map, f) {
  for (const z of map.hides) {
    if (f.cx > z.x + 4 && f.cx < z.x + z.w - 4 &&
        f.y >= z.y - H.headMargin && f.y + f.h <= z.y + z.h + 4) return z;
  }
  return null;
}

// À chaque image : qui est caché ? (et le feuillage bouge quand on le traverse)
export function updateHiding(game, dt) {
  for (const f of game.fighters) {
    f.hideZone = f.alive ? hideZoneOf(game.map, f) : null;
    f.hidden = !!f.hideZone && f.protectTimer <= 0 &&
               game.time - f.lastShotTime > H.revealTime &&
               game.time - f.lastAttackTime > H.revealTime;
  }
  updateRustle(game, dt);
}

// Le feuillage bouge quand quelqu'un le traverse (aussi chez les invités)
export function updateRustle(game, dt) {
  for (const z of game.map.hides) z.rustle = Math.max(0, z.rustle - dt * 1.5);
  for (const f of game.fighters) {
    if (f.alive && f.hideZone && (Math.abs(f.vx) > 40 || Math.abs(f.vy) > 80)) {
      f.hideZone.rustle = Math.min(1, f.hideZone.rustle + dt * 4);
    }
  }
}

// "viewer" peut-il voir "target" ? (les murs se vérifient à part)
export function canSee(game, viewer, target) {
  if (!target.hidden || viewer === target) return true;
  if (game.teams && viewer.team === target.team) return true;   // on voit ses coéquipiers
  if (viewer.hideZone && viewer.hideZone === target.hideZone) return true;
  return Math.hypot(target.cx - viewer.cx, target.cy - viewer.cy) < H.detectDistance;
}

// Cachette la plus proche d'un point (pour les bots), ou null
export function nearestHide(map, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const z of map.hides) {
    const d = Math.hypot(z.x + z.w / 2 - x, z.y + z.h - y);
    if (d < bestD) { bestD = d; best = z; }
  }
  return best;
}

// ---------------------------------------------------------------------
// Dessin : chaque cachette est dessinée une seule fois dans une petite
// image (rapide à afficher), puis légèrement balancée quand on la traverse.
// ---------------------------------------------------------------------

// Les deux sortes de cachettes de chaque ambiance (kind 0 et 1 dans map.js)
const KINDS = {
  nuit: ['haie', 'filet'],            // Docks Néon : haies en bac, filets de camouflage
  coucher: ['broussaille', 'herbes'], // Canyon Ardent : broussailles sèches, herbes hautes
  jour: ['buisson', 'fleurs'],        // Cité des Nuées : buissons, herbes fleuries
};

const PAD = 14;          // marge autour de la cachette (le feuillage déborde)
const RES = 2;           // résolution de l'image (2 pixels par unité)
const cache = new WeakMap();

// Petit générateur pseudo-aléatoire : le même dessin à chaque fois
function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function spriteFor(z, theme) {
  let img = cache.get(z);
  if (img) return img;
  img = document.createElement('canvas');
  img.width = (z.w + PAD * 2) * RES;
  img.height = (z.h + PAD) * RES;
  const g = img.getContext('2d');
  g.scale(RES, RES);
  g.translate(PAD, PAD);                       // (0,0) = coin haut-gauche de la zone
  const kind = (KINDS[theme] || KINDS.jour)[z.kind % 2];
  PAINT[kind](g, z.w, z.h, rng(Math.round(z.x * 7 + z.y * 13)));
  cache.set(z, img);
  return img;
}

// Touffe ronde de feuilles : dégradé sombre en bas, clair en haut
function leafBall(g, x, y, r, dark, mid, light) {
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
  grad.addColorStop(0, light);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// Brins d'herbe (courbes fines)
function blades(g, w, h, r, colors, count, lean = 0) {
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const len = h * (0.6 + r() * 0.55);
    const bend = (r() - 0.5) * 18 + lean;
    g.strokeStyle = colors[Math.floor(r() * colors.length)];
    g.lineWidth = 1.2 + r() * 1.8;
    g.beginPath();
    g.moveTo(x, h);
    g.quadraticCurveTo(x + bend * 0.3, h - len * 0.6, x + bend, h - len);
    g.stroke();
  }
}

const PAINT = {
  // Buisson bien vert, avec quelques baies
  buisson(g, w, h, r) {
    for (let i = 0; i < w / 9; i++) {
      const x = 6 + r() * (w - 12), y = h * 0.35 + r() * h * 0.6;
      leafBall(g, x, y, 12 + r() * 10, '#1f5b2a', '#3f9142', '#86d36a');
    }
    for (let i = 0; i < w / 14; i++) {
      const x = 10 + r() * (w - 20), y = 6 + r() * h * 0.4;
      leafBall(g, x, y, 10 + r() * 8, '#2a6d31', '#4fa84a', '#a2e27c');
    }
    g.fillStyle = '#e8404f';
    for (let i = 0; i < w / 25; i++) {
      g.beginPath(); g.arc(8 + r() * (w - 16), 8 + r() * (h - 16), 1.8, 0, Math.PI * 2); g.fill();
    }
  },
  // Herbes hautes avec de petites fleurs
  fleurs(g, w, h, r) {
    blades(g, w, h, r, ['#2f7a35', '#3f9142', '#5cb84f', '#8fd46b'], Math.round(w * 1.6));
    const petals = ['#fff3bf', '#ffc9de', '#d0bfff', '#ffffff'];
    for (let i = 0; i < w / 8; i++) {
      g.fillStyle = petals[Math.floor(r() * petals.length)];
      g.beginPath(); g.arc(r() * w, r() * h * 0.5, 2 + r() * 1.5, 0, Math.PI * 2); g.fill();
    }
  },
  // Broussaille sèche du canyon : branches et touffes brun-orangé
  broussaille(g, w, h, r) {
    g.lineCap = 'round';
    for (let i = 0; i < w / 4; i++) {
      const x = r() * w;
      g.strokeStyle = r() < 0.5 ? '#5a3418' : '#7a4a22';
      g.lineWidth = 1 + r() * 1.5;
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + (r() - 0.5) * 30, h - h * (0.5 + r() * 0.6));
      g.stroke();
    }
    for (let i = 0; i < w / 8; i++) {
      leafBall(g, 6 + r() * (w - 12), h * 0.2 + r() * h * 0.75, 9 + r() * 9, '#5b3b16', '#a0662a', '#e0a050');
    }
  },
  // Herbes hautes dorées (comme du blé sauvage)
  herbes(g, w, h, r) {
    blades(g, w, h, r, ['#8a5a1e', '#b07a2c', '#d9a441', '#f0c766'], Math.round(w * 1.8), 4);
    g.fillStyle = '#f5d77a';
    for (let i = 0; i < w / 6; i++) {
      g.beginPath(); g.ellipse(r() * w, r() * h * 0.35, 1.5, 4, 0.3, 0, Math.PI * 2); g.fill();
    }
  },
  // Haie taillée dans un bac en béton (avec une bande néon)
  haie(g, w, h, r) {
    const bac = 14;
    for (let i = 0; i < w / 6; i++) {
      leafBall(g, 6 + r() * (w - 12), 8 + r() * (h - bac - 8), 9 + r() * 6, '#1d4a3c', '#2f7d62', '#62c99c');
    }
    g.fillStyle = '#3b4250';
    g.fillRect(-4, h - bac, w + 8, bac);
    g.fillStyle = '#525a6b';
    g.fillRect(-4, h - bac, w + 8, 3);
    g.fillStyle = 'rgba(61,245,255,0.9)';
    g.fillRect(0, h - bac + 7, w, 2);
  },
  // Filet de camouflage tendu sur deux piquets, avec des lambeaux de tissu
  filet(g, w, h, r) {
    g.fillStyle = '#2c3038';
    g.fillRect(2, -6, 4, h + 6);
    g.fillRect(w - 6, -6, 4, h + 6);
    const colors = ['#2f3d2b', '#3d4f33', '#4d5e3a', '#5d6644', '#26302a'];
    for (let i = 0; i < w * 0.9; i++) {
      g.fillStyle = colors[Math.floor(r() * colors.length)];
      const x = r() * w, y = r() * h * 0.92;
      g.beginPath();
      g.ellipse(x, y, 4 + r() * 6, 3 + r() * 4, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(15,18,20,0.6)';
    g.lineWidth = 0.8;
    for (let x = 0; x < w; x += 8) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, h * 0.9); g.stroke();
    }
  },
};

// Dessine toutes les cachettes visibles (repère monde, par-dessus les personnages).
// player : celui qui regarde ; le buisson où il se cache devient translucide.
export function drawHides(ctx, game, time, viewRect) {
  const map = game.map;
  const theme = map.def.theme;
  const me = game.player;
  for (const z of map.hides) {
    if (z.x + z.w + PAD < viewRect.x || z.x - PAD > viewRect.x + viewRect.w ||
        z.y + z.h < viewRect.y || z.y - PAD > viewRect.y + viewRect.h) continue;
    const img = spriteFor(z, theme);
    // Balancement : léger avec le vent, plus fort quand quelqu'un passe dedans
    const sway = Math.sin(time * 1.3 + z.x) * 0.02 + Math.sin(time * 14) * 0.09 * z.rustle;
    ctx.save();
    ctx.translate(z.x, z.y + z.h);
    ctx.transform(1, 0, sway, 1, 0, 0);
    ctx.globalAlpha = me && me.alive && me.hideZone === z ? H.playerAlpha : 1;
    ctx.drawImage(img, -PAD, -z.h - PAD, z.w + PAD * 2, z.h + PAD);
    ctx.restore();
  }
}
