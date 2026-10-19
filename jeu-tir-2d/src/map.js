// =====================================================================
// map.js — Les cartes : plateformes, murs, obstacles, collisions, décor.
// Chaque élément solide est un rectangle {x, y, w, h}.
// L'axe y descend (y = 0 en haut, comme sur un écran).
// Pour créer une carte : copier une fiche de MAPS et changer les nombres.
// =====================================================================

// Raccourcis pour écrire les fiches
const R = (x, y, w, h) => ({ x, y, w, h });
const S = (x, y) => ({ x, y });                     // point d'apparition
const P = (x, y, type) => ({ x, y, type });         // objet à ramasser
// Pour S et P : x = centre, y = surface du sol juste en dessous

// Couleurs et décor de chaque ambiance
const THEMES = {
  nuit: {
    skyTop: '#0b1024', skyBottom: '#1f2a4f', far: '#121a33', mid: 'rgba(255,255,255,0.035)',
    solid: '#3a4a6b', top: '#5c7cad', dark: '#29354f', glow: '255,60,90',
    skyline: 'city', stars: true,
  },
  coucher: {
    skyTop: '#2b1d3a', skyBottom: '#f0915f', far: '#5c2f40', mid: 'rgba(60,20,30,0.18)',
    solid: '#8a5a3c', top: '#d39563', dark: '#5e3b28', glow: '255,110,40',
    skyline: 'mountains', stars: false,
  },
  jour: {
    skyTop: '#3d8fe0', skyBottom: '#cfe8ff', far: '#9cc2e3', mid: 'rgba(255,255,255,0.25)',
    solid: '#5f6b7a', top: '#a4b1c2', dark: '#3f4955', glow: '30,70,140',
    skyline: 'spires', stars: false,
  },
};

export const MAPS = [
  {
    id: 'entrepot',
    name: 'Entrepôt',
    theme: 'nuit',
    width: 3200, height: 1400,
    solids: [
      R(0, 0, 40, 1400), R(3160, 0, 40, 1400), R(0, 0, 3200, 40),   // bords
      // Sol, avec deux trous qui donnent sur le vide
      R(40, 1200, 860, 200), R(1100, 1200, 1000, 200), R(2300, 1200, 860, 200),
      // Plateformes basses (dont deux marchepieds au-dessus des trous)
      R(250, 1010, 300, 24), R(940, 1020, 120, 24), R(1300, 960, 260, 24),
      R(1740, 960, 260, 24), R(2140, 1020, 120, 24), R(2650, 1010, 300, 24),
      // Plateformes moyennes
      R(640, 840, 240, 24), R(1480, 770, 240, 24), R(2320, 840, 240, 24),
      R(280, 650, 240, 24), R(2680, 650, 240, 24),
      // Plateformes hautes
      R(1180, 590, 200, 24), R(1820, 590, 200, 24), R(700, 440, 220, 24),
      R(2280, 440, 220, 24), R(1450, 380, 300, 24),
      // Obstacles / couverts et murets verticaux
      R(560, 1110, 60, 90), R(1560, 1090, 80, 110), R(2580, 1110, 60, 90),
      R(1090, 680, 30, 190), R(2080, 680, 30, 190),
    ],
    spawns: [
      S(150, 1200), S(3050, 1200), S(400, 1010), S(2800, 1010), S(1600, 770),
      S(1300, 1200), S(1900, 1200), S(760, 840), S(2440, 840), S(1600, 380),
    ],
    pickups: [
      P(1600, 1090, 'health'), P(400, 1010, 'health'), P(2800, 1010, 'health'),
      P(1600, 380, 'shield'),
      P(760, 840, 'weapon'), P(2440, 840, 'weapon'), P(1280, 590, 'weapon'), P(1920, 590, 'weapon'),
    ],
  },
  {
    id: 'canyon',
    name: 'Canyon',
    theme: 'coucher',
    width: 3600, height: 1500,
    solids: [
      R(0, 0, 40, 1500), R(3560, 0, 40, 1500), R(0, 0, 3600, 40),   // bords
      // Quatre îlots séparés par trois gouffres
      R(40, 1300, 660, 200), R(950, 1300, 700, 200), R(1950, 1300, 700, 200), R(2900, 1300, 660, 200),
      // Mesas (grands blocs pour se cacher)
      R(380, 1080, 140, 220), R(1220, 1050, 160, 250), R(2220, 1050, 160, 250), R(3080, 1080, 140, 220),
      // Rochers flottants au-dessus des gouffres
      R(760, 1100, 130, 28), R(1720, 1060, 160, 28), R(2710, 1100, 130, 28),
      // Corniches
      R(450, 880, 220, 28), R(2930, 880, 220, 28), R(950, 780, 220, 28), R(2430, 780, 220, 28),
      R(1350, 880, 200, 28), R(2050, 880, 200, 28), R(1700, 700, 200, 28),
      R(650, 560, 200, 28), R(2750, 560, 200, 28), R(1250, 500, 200, 28), R(2150, 500, 200, 28),
      R(1650, 330, 300, 28),
    ],
    spawns: [
      S(200, 1300), S(3400, 1300), S(1050, 1300), S(2550, 1300), S(450, 1080),
      S(3150, 1080), S(1300, 1050), S(2300, 1050), S(1800, 700), S(1800, 330),
    ],
    pickups: [
      P(450, 1080, 'health'), P(3150, 1080, 'health'), P(1800, 700, 'health'),
      P(1800, 330, 'shield'),
      P(1060, 780, 'weapon'), P(2540, 780, 'weapon'), P(750, 560, 'weapon'), P(2850, 560, 'weapon'),
    ],
  },
  {
    id: 'tours',
    name: 'Tours',
    theme: 'jour',
    width: 2400, height: 2000,
    solids: [
      R(0, 0, 40, 2000), R(2360, 0, 40, 2000), R(0, 0, 2400, 40),   // bords
      // Sol avec un grand gouffre au milieu et deux marchepieds
      R(40, 1800, 860, 200), R(1500, 1800, 860, 200),
      R(1000, 1640, 140, 28), R(1260, 1640, 140, 28),
      // Tour de gauche : un pilier (on peut passer dessous) et des étages autour
      R(260, 900, 80, 500),
      R(100, 1550, 160, 24), R(340, 1400, 200, 24), R(100, 1250, 160, 24),
      R(340, 1100, 200, 24), R(100, 950, 160, 24), R(340, 800, 200, 24),
      // Tour de droite (symétrique)
      R(2060, 900, 80, 500),
      R(2140, 1550, 160, 24), R(1860, 1400, 200, 24), R(2140, 1250, 160, 24),
      R(1860, 1100, 200, 24), R(2140, 950, 160, 24), R(1860, 800, 200, 24),
      // Structure centrale flottante
      R(1000, 1350, 400, 28), R(1000, 1300, 30, 50), R(1370, 1300, 30, 50),
      R(1100, 1050, 200, 28), R(850, 850, 200, 28), R(1350, 850, 200, 28),
      R(1050, 600, 300, 28),
      // Passerelles hautes
      R(560, 500, 250, 24), R(1590, 500, 250, 24),
    ],
    spawns: [
      S(150, 1800), S(2250, 1800), S(600, 1800), S(1800, 1800), S(440, 1400),
      S(1960, 1400), S(1200, 1350), S(440, 800), S(1960, 800), S(1200, 600),
    ],
    pickups: [
      P(180, 1250, 'health'), P(2220, 1250, 'health'), P(1200, 1350, 'health'),
      P(1200, 1050, 'shield'),
      P(685, 500, 'weapon'), P(1715, 500, 'weapon'), P(950, 850, 'weapon'), P(1450, 850, 'weapon'),
    ],
  },
];

export class GameMap {
  constructor(def = MAPS[0]) {
    this.def = def;
    this.name = def.name;
    this.width = def.width;
    this.height = def.height;
    this.killY = this.height + 150;   // en dessous : tombé dans le vide
    this.solids = def.solids;
    this.spawns = def.spawns;
    this.pickupSpots = def.pickups;
    this.theme = THEMES[def.theme];

    // Décor généré une fois (purement visuel) ; graine fixe → même décor à chaque partie
    let seed = def.width * 7 + def.height;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.decor = [];
    for (let i = 0; i < 40; i++) {
      this.decor.push({ x: rnd() * this.width, y: 100 + rnd() * (this.height - 500),
                        w: 60 + rnd() * 200, h: 100 + rnd() * 500 });
    }
    // Silhouettes lointaines (immeubles, montagnes ou flèches), répétées en boucle
    this.skyline = [];
    for (let x = 0; x < 2000;) {
      const w = 60 + rnd() * 140;
      this.skyline.push({ x, w, h: 0.15 + rnd() * 0.35 });
      x += w * (this.theme.skyline === 'mountains' ? 0.7 : 1);
    }
    this.stars = [];
    for (let i = 0; i < 70; i++) this.stars.push({ x: rnd(), y: rnd() * 0.7, r: rnd() * 1.4 + 0.3 });
  }

  // Le rectangle donné chevauche-t-il un élément solide ?
  // Renvoie le premier solide touché, ou null.
  overlap(box) {
    for (const s of this.solids) {
      if (box.x < s.x + s.w && box.x + box.w > s.x &&
          box.y < s.y + s.h && box.y + box.h > s.y) {
        return s;
      }
    }
    return null;
  }

  // Lance un rayon de (x0,y0) à (x1,y1).
  // Renvoie la fraction (0 à 1) du trajet où il touche un mur, ou null.
  raycast(x0, y0, x1, y1) {
    let best = null;
    for (const s of this.solids) {
      const t = segmentVsRect(x0, y0, x1, y1, s);
      if (t !== null && (best === null || t < best)) best = t;
    }
    return best;
  }

  // Vrai si rien ne bloque la vue entre deux points
  lineOfSight(x0, y0, x1, y1) {
    return this.raycast(x0, y0, x1, y1) === null;
  }

  // Solide juste au-dessus de la tête de ce personnage (dans "range" px), ou null
  ceilingAbove(f, range) {
    let best = null;
    for (const s of this.solids) {
      const bottom = s.y + s.h;
      if (f.x + f.w > s.x && f.x < s.x + s.w && bottom <= f.y + 1 && bottom > f.y - range) {
        if (!best || bottom > best.y + best.h) best = s;
      }
    }
    return best;
  }

  // Distance jusqu'au premier sol sous le point (x, y). Infinity = le vide.
  groundBelow(x, y) {
    let best = Infinity;
    for (const s of this.solids) {
      if (x >= s.x && x <= s.x + s.w && s.y >= y) {
        best = Math.min(best, s.y - y);
      }
    }
    return best;
  }

  // ----------------------------- Dessin -----------------------------

  // Fond d'écran (ciel, étoiles, silhouettes) — en pixels écran
  drawBackground(ctx, cam, view) {
    const T = this.theme;
    const g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, T.skyTop);
    g.addColorStop(1, T.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);

    if (T.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const st of this.stars) {
        const sx = ((st.x * view.w - cam.x * 0.05 * view.scale) % view.w + view.w) % view.w;
        ctx.fillRect(sx, st.y * view.h, st.r, st.r);
      }
    }

    // Silhouettes : défilent à 20 % de la vitesse de la caméra
    ctx.fillStyle = T.far;
    const k = view.scale;
    const base = view.h * 0.95 - cam.y * 0.08 * k;
    const tile = 2000 * k;
    const off = ((-cam.x * 0.2 * k) % tile + tile) % tile - tile;
    for (let t = off; t < view.w; t += tile) {
      for (const b of this.skyline) {
        const x = t + b.x * k, w = b.w * k, h = b.h * view.h;
        if (x > view.w || x + w < 0) continue;
        if (T.skyline === 'mountains') {
          ctx.beginPath();
          ctx.moveTo(x - w * 0.4, base);
          ctx.lineTo(x + w / 2, base - h * 1.2);
          ctx.lineTo(x + w * 1.4, base);
          ctx.fill();
        } else if (T.skyline === 'spires') {
          ctx.fillRect(x + w * 0.3, base - h, w * 0.4, h);
          ctx.beginPath();
          ctx.moveTo(x + w * 0.3, base - h);
          ctx.lineTo(x + w / 2, base - h - 40 * k);
          ctx.lineTo(x + w * 0.7, base - h);
          ctx.fill();
        } else {
          ctx.fillRect(x, base - h, w - 6 * k, h);
        }
      }
    }
    ctx.fillRect(0, base, view.w, view.h - base);
  }

  // Décor proche, vide et éléments solides — en coordonnées monde
  draw(ctx, cam) {
    const T = this.theme;
    // Décor intermédiaire : suit à moitié la caméra (effet de profondeur)
    ctx.fillStyle = T.mid;
    for (const d of this.decor) {
      ctx.fillRect(d.x + cam.x * 0.5, d.y + cam.y * 0.4, d.w, d.h);
    }

    // Lueur du vide en bas de la carte
    const g = ctx.createLinearGradient(0, this.height - 120, 0, this.killY);
    g.addColorStop(0, `rgba(${T.glow},0)`);
    g.addColorStop(1, `rgba(${T.glow},0.45)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, this.height - 120, this.width, this.killY - this.height + 120);

    // Éléments solides : corps, liseré clair dessus, ombre dessous, rivets
    for (const s of this.solids) {
      ctx.fillStyle = T.solid;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      if (s.h > 30) {
        ctx.fillStyle = T.dark;
        ctx.fillRect(s.x, s.y + s.h - 6, s.w, 6);
      }
      ctx.fillStyle = T.top;
      ctx.fillRect(s.x, s.y, s.w, Math.min(5, s.h));
      if (s.w > 100 && s.h < 40) {
        ctx.fillStyle = T.dark;
        for (let rx = s.x + 14; rx < s.x + s.w - 10; rx += 40) ctx.fillRect(rx, s.y + s.h - 8, 4, 4);
      }
    }
  }
}

// Intersection segment / rectangle (méthode des "slabs").
// Renvoie t entre 0 et 1, ou null s'il n'y a pas de contact.
export function segmentVsRect(x0, y0, x1, y1, r) {
  const dx = x1 - x0, dy = y1 - y0;
  let tMin = 0, tMax = 1;
  // Axe X
  if (Math.abs(dx) < 1e-9) {
    if (x0 < r.x || x0 > r.x + r.w) return null;
  } else {
    let t1 = (r.x - x0) / dx, t2 = (r.x + r.w - x0) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  // Axe Y
  if (Math.abs(dy) < 1e-9) {
    if (y0 < r.y || y0 > r.y + r.h) return null;
  } else {
    let t1 = (r.y - y0) / dy, t2 = (r.y + r.h - y0) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}
