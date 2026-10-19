// =====================================================================
// map.js — Les cartes : plateformes, murs, obstacles, collisions.
// (Le dessin des décors est dans scenery.js.)
// Chaque élément solide est un rectangle {x, y, w, h}.
// L'axe y descend (y = 0 en haut, comme sur un écran).
// Pour créer une carte : copier une fiche de MAPS et changer les nombres.
// =====================================================================

// Raccourcis pour écrire les fiches
const R = (x, y, w, h) => ({ x, y, w, h });
const S = (x, y) => ({ x, y });                     // point d'apparition
const P = (x, y, type) => ({ x, y, type });         // objet à ramasser
// Cachette (buisson, herbes hautes…) : x = bord gauche, y = surface du sol,
// w = largeur, h = hauteur, kind = 0 ou 1 (les 2 sortes de cachettes du décor)
// On la traverse librement ; dedans, on est invisible tant qu'on ne tire pas.
const H = (x, y, w, h, kind = 0) => ({ x, y: y - h, w, h, kind });
// Pour S et P : x = centre, y = surface du sol juste en dessous

export const MAPS = [
  {
    id: 'entrepot',
    name: 'Docks Néon',
    theme: 'nuit',              // ambiance (voir scenery.js)
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
      P(700, 1200, 'ammo'), P(2500, 1200, 'ammo'),
    ],
    hides: [
      H(260, 1200, 150, 58, 0), H(2790, 1200, 150, 58, 0),
      H(1380, 1200, 140, 58, 1), H(1680, 1200, 140, 58, 1),
      H(300, 650, 110, 56, 0), H(2790, 650, 110, 56, 0),
    ],
    // Zone du mode Roi de la colline : au-dessus de la plateforme centrale
    hill: R(1440, 640, 320, 130),
  },
  {
    id: 'canyon',
    name: 'Canyon Ardent',
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
      P(1100, 1300, 'ammo'), P(2500, 1300, 'ammo'),
    ],
    hides: [
      H(530, 1300, 130, 60, 0), H(2940, 1300, 130, 60, 0),
      H(1410, 1300, 160, 60, 1), H(2030, 1300, 160, 60, 1),
      H(1360, 880, 100, 56, 0), H(2140, 880, 100, 56, 0),
    ],
    // Zone de colline : le rocher flottant du milieu, au-dessus du gouffre
    // (atteignable d'un seul vol depuis les îlots voisins)
    hill: R(1690, 930, 220, 130),
  },
  {
    id: 'tours',
    name: 'Cité des Nuées',
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
      P(700, 1800, 'ammo'), P(1700, 1800, 'ammo'),
    ],
    hides: [
      H(280, 1800, 160, 60, 0), H(1960, 1800, 160, 60, 0),
      H(750, 1800, 130, 58, 1), H(1520, 1800, 130, 58, 1),
      H(360, 1100, 110, 56, 0), H(1930, 1100, 110, 56, 0),
    ],
    // Zone de colline : la structure centrale flottante
    hill: R(1030, 1210, 340, 140),
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
    this.hill = def.hill;             // zone du mode Roi de la colline
    // cachettes (copiées : chacune garde son état d'animation pendant la partie)
    this.hides = (def.hides || []).map((h) => ({ ...h, rustle: 0 }));
    this.scenery = null;              // décors (créés à l'affichage, voir scenery.js)
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
