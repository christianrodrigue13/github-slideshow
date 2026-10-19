// =====================================================================
// map.js — La carte : plateformes, murs, obstacles, collisions.
// Chaque élément solide est un rectangle {x, y, w, h}.
// L'axe y descend (y = 0 en haut, comme sur un écran).
// =====================================================================

// Raccourci pour écrire les rectangles
const R = (x, y, w, h) => ({ x, y, w, h });

export class GameMap {
  constructor() {
    this.width = 3200;
    this.height = 1400;
    // En dessous de cette hauteur, on est tombé dans le vide
    this.killY = this.height + 150;

    this.solids = [
      // Bords de la carte
      R(0, 0, 40, 1400),          // mur gauche
      R(3160, 0, 40, 1400),       // mur droit
      R(0, 0, 3200, 40),          // plafond

      // Sol, avec deux trous qui donnent sur le vide
      R(40, 1200, 860, 200),
      R(1100, 1200, 1000, 200),
      R(2300, 1200, 860, 200),

      // Plateformes basses
      R(250, 1010, 300, 24),
      R(940, 1020, 120, 24),      // marchepied au-dessus du 1er trou
      R(1300, 960, 260, 24),
      R(1740, 960, 260, 24),
      R(2140, 1020, 120, 24),     // marchepied au-dessus du 2e trou
      R(2650, 1010, 300, 24),

      // Plateformes moyennes
      R(640, 840, 240, 24),
      R(1480, 770, 240, 24),
      R(2320, 840, 240, 24),
      R(280, 650, 240, 24),
      R(2680, 650, 240, 24),

      // Plateformes hautes
      R(1180, 590, 200, 24),
      R(1820, 590, 200, 24),
      R(700, 440, 220, 24),
      R(2280, 440, 220, 24),
      R(1450, 380, 300, 24),

      // Obstacles / couverts
      R(560, 1110, 60, 90),
      R(1560, 1090, 80, 110),
      R(2580, 1110, 60, 90),
      R(1090, 680, 30, 190),      // murets verticaux
      R(2080, 680, 30, 190),
    ];

    // Points d'apparition : x = centre, y = surface du sol sous les pieds
    this.spawns = [
      { x: 150, y: 1200 }, { x: 3050, y: 1200 },
      { x: 400, y: 1010 }, { x: 2800, y: 1010 },
      { x: 1600, y: 770 }, { x: 1300, y: 1200 },
      { x: 1900, y: 1200 }, { x: 760, y: 840 },
      { x: 2440, y: 840 }, { x: 1600, y: 380 },
    ];

    // Objets à ramasser : x = centre, y = surface du sol sous l'objet
    this.pickupSpots = [
      { x: 1600, y: 1090, type: 'health' },   // sur le bloc central
      { x: 400, y: 1010, type: 'health' },
      { x: 2800, y: 1010, type: 'health' },
      { x: 1600, y: 380, type: 'shield' },    // tout en haut
      { x: 760, y: 840, type: 'weapon' },
      { x: 2440, y: 840, type: 'weapon' },
      { x: 1280, y: 590, type: 'weapon' },
      { x: 1920, y: 590, type: 'weapon' },
    ];

    // Petits décors d'arrière-plan (purement visuels, générés une fois)
    this.decor = [];
    for (let i = 0; i < 40; i++) {
      this.decor.push({
        x: Math.random() * this.width,
        y: 100 + Math.random() * 900,
        w: 60 + Math.random() * 200,
        h: 100 + Math.random() * 500,
      });
    }
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
  draw(ctx, cam) {
    // Décor lointain : se déplace moins vite que la caméra (effet de profondeur)
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (const d of this.decor) {
      // parallaxe : le décor suit à moitié la caméra
      ctx.fillRect(d.x + cam.x * 0.5, d.y + cam.y * 0.4, d.w, d.h);
    }

    // Lueur du vide en bas de la carte
    const g = ctx.createLinearGradient(0, this.height - 80, 0, this.killY);
    g.addColorStop(0, 'rgba(255,60,90,0)');
    g.addColorStop(1, 'rgba(255,60,90,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, this.height - 80, this.width, this.killY - this.height + 80);

    // Éléments solides
    for (const s of this.solids) {
      ctx.fillStyle = '#3a4a6b';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#5c7cad';            // liseré clair sur le dessus
      ctx.fillRect(s.x, s.y, s.w, Math.min(5, s.h));
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
