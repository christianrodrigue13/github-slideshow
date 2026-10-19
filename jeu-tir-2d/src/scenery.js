// =====================================================================
// scenery.js — Les décors de l'Archipel : ciel, plans lointains en
// parallaxe, plateformes texturées, objets de décor, météo, lumières,
// brume. Tout est dessiné par le code (aucune image externe).
//
// Pour rester fluide sur téléphone, presque tout est dessiné UNE fois
// dans des images en mémoire (canvas hors écran), puis simplement
// recopié à chaque image. La qualité (0 = basse, 1 = moyenne, 2 = haute)
// retire les effets les plus coûteux.
// =====================================================================

// ---------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Hasard reproductible (même décor à chaque partie)
function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Halo lumineux (dégradé radial) dans une couleur, mis en cache
const glowCache = new Map();
function glowSprite(color) {
  let c = glowCache.get(color);
  if (!c) {
    c = makeCanvas(64, 64);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color.replace(/[\d.]+\)$/, (a) => `${parseFloat(a) * 0.45})`));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
  }
  return c;
}

// Nuage moelleux (grappe de cercles), dessiné une fois
function cloudSprite(w, h, top, shade, r) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    blobs.push({ x: w * (0.15 + r() * 0.7), y: h * (0.45 + r() * 0.25), rad: h * (0.22 + r() * 0.2) });
  }
  g.fillStyle = shade;
  for (const b of blobs) { g.beginPath(); g.arc(b.x, b.y + h * 0.06, b.rad, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = top;
  for (const b of blobs) { g.beginPath(); g.arc(b.x, b.y, b.rad * 0.92, 0, Math.PI * 2); g.fill(); }
  return c;
}

// ---------------------------------------------------------------------
// Les trois univers
// Chaque univers fournit :
//   sky(g, w, h, r)          ciel (dessiné une fois, à la taille de l'écran)
//   layers[]                 plans lointains { p (parallaxe), paint(g, w, h, r) }
//   tile(g, n, r)            texture des plateformes (carreau n × n répété)
//   trim(g, s, w, h, pad, r) finitions d'une plateforme (bord, mousse, rochers…)
//   props[]                  objets de décor posés sur les plateformes
//   weather                  'pluie' | 'poussiere' | 'petales'
//   voidStyle                'eau' | 'lave' | 'nuages'
// ---------------------------------------------------------------------
const THEMES = {};

// ===== Docks Néon : port futuriste, nuit, pluie, néons =====
THEMES.nuit = {
  name: 'Docks Néon',
  weather: 'pluie',
  voidStyle: 'eau',
  grade: 'rgba(70,20,110,0.05)',
  neon: ['rgba(61,245,255,1)', 'rgba(255,79,216,1)', 'rgba(255,200,60,1)'],
  sky(g, w, h, r) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#04050d');
    grad.addColorStop(0.55, '#170f30');
    grad.addColorStop(1, '#3d1748');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {           // étoiles
      g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
      const s = r() * 1.6 + 0.4;
      g.fillRect(r() * w, r() * h * 0.6, s, s);
    }
    // Lune et son halo
    const mx = w * 0.78, my = h * 0.2, mr = h * 0.07;
    const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 7);
    halo.addColorStop(0, 'rgba(190,200,255,0.35)');
    halo.addColorStop(1, 'rgba(190,200,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#eef0ff';
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(150,160,200,0.35)';
    for (let i = 0; i < 6; i++) {
      g.beginPath(); g.arc(mx + (r() - 0.5) * mr * 1.2, my + (r() - 0.5) * mr * 1.2, mr * (0.1 + r() * 0.15), 0, Math.PI * 2); g.fill();
    }
    // Bandes de nuages violets
    for (let i = 0; i < 7; i++) {
      g.fillStyle = `rgba(120,70,160,${0.05 + r() * 0.06})`;
      g.beginPath();
      g.ellipse(r() * w, h * (0.25 + r() * 0.4), w * (0.15 + r() * 0.25), h * 0.02 + r() * h * 0.02, 0, 0, Math.PI * 2);
      g.fill();
    }
  },
  layers: [
    { p: 0.06, hf: 0.5, paint(g, w, h, r) { cityLayer(g, w, h, r, '#191331', 0.24, 0.84, 0.25, false); } },
    { p: 0.16, hf: 0.66, paint(g, w, h, r) { cityLayer(g, w, h, r, '#221a3c', 0.33, 0.9, 0.45, true); } },
    { p: 0.32, hf: 0.7, paint(g, w, h, r) { harbourLayer(g, w, h, r); } },
    { p: 0.55, mid: true, paint(g, w, h, r) { pillarLayer(g, w, h, r, '#0b0816', 'pipes'); } },
  ],
  tile(g, n, r) {
    g.fillStyle = '#323d5e';
    g.fillRect(0, 0, n, n);
    const half = n / 2;
    for (let py = 0; py < 2; py++) {
      for (let px = 0; px < 2; px++) {
        const x = px * half, y = py * half;
        // chaque plaque : un léger dégradé (reflet métallique en haut à gauche)
        const pg = g.createLinearGradient(x, y, x + half, y + half);
        pg.addColorStop(0, `rgba(190,210,255,${0.10 + r() * 0.06})`);
        pg.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = pg;
        g.fillRect(x + 2, y + 2, half - 4, half - 4);
        g.fillStyle = 'rgba(0,0,0,0.35)';             // joints entre les plaques
        g.fillRect(x, y, half, 2); g.fillRect(x, y, 2, half);
        g.fillStyle = 'rgba(160,190,255,0.25)';       // rivets
        for (const [rx, ry] of [[6, 6], [half - 8, 6], [6, half - 8], [half - 8, half - 8]]) g.fillRect(x + rx, y + ry, 2, 2);
      }
    }
    for (let i = 0; i < 18; i++) {                    // rayures
      g.strokeStyle = `rgba(255,255,255,${0.03 + r() * 0.04})`;
      g.beginPath();
      const x = r() * n, y = r() * n;
      g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 20, y + (r() - 0.5) * 6);
      g.stroke();
    }
  },
  trim(g, s, w, h, pad, r) {
    const top = pad;
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(0, top, w, 5);
    if (h <= 40) {                                    // fines plateformes : bandes de danger
      g.save();
      g.beginPath(); g.rect(0, top + h - 7, w, 7); g.clip();
      for (let x = -10; x < w + 10; x += 14) {
        g.fillStyle = '#f5c518';
        g.beginPath(); g.moveTo(x, top + h); g.lineTo(x + 7, top + h - 7); g.lineTo(x + 14, top + h - 7); g.lineTo(x + 7, top + h); g.fill();
      }
      g.restore();
    }
    g.fillStyle = '#3df5ff';                          // bande néon sur le dessus
    g.fillRect(0, top, w, 2);
  },
  props: ['caisse', 'baril', 'lampadaire', 'plot', 'caisse'],
};

// Silhouettes d'immeubles avec fenêtres (et enseignes néon si "signs")
function cityLayer(g, w, h, r, color, minH, maxH, windowRate, signs) {
  let x = -20;
  while (x < w + 20) {
    const bw = 40 + r() * 90, bh = h * (minH + r() * (maxH - minH));
    const y = h - bh;
    g.fillStyle = color;
    g.fillRect(x, y, bw, bh);
    if (r() < 0.4) {                                  // antenne + feu rouge
      g.fillRect(x + bw * 0.5, y - 18, 2, 18);
      g.fillStyle = 'rgba(255,60,60,0.9)';
      g.fillRect(x + bw * 0.5 - 1, y - 20, 4, 3);
    }
    if (signs) {                                      // reflet néon sur un bord
      g.fillStyle = r() < 0.5 ? 'rgba(61,245,255,0.10)' : 'rgba(255,79,216,0.10)';
      g.fillRect(x, y, 3, bh);
    }
    for (let wy = y + 6; wy < h - 6; wy += 9) {       // fenêtres allumées
      for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
        if (r() < windowRate) {
          g.fillStyle = r() < 0.7 ? `rgba(255,214,130,${0.25 + r() * 0.5})` : `rgba(140,210,255,${0.25 + r() * 0.5})`;
          g.fillRect(wx, wy, 3, 4);
        }
      }
    }
    if (signs && r() < 0.35) {                        // enseigne verticale lumineuse
      const words = ['NÉO', 'BAR', '24H', 'KAÏ', 'ZÉN', 'RÉO', 'OPEN'];
      const word = words[Math.floor(r() * words.length)];
      const col = r() < 0.5 ? '#ff4fd8' : '#3df5ff';
      const sx = x + bw - 14, sy = y + 14;
      g.save();
      g.shadowColor = col;
      g.shadowBlur = 12;
      g.fillStyle = 'rgba(10,6,20,0.8)';
      g.fillRect(sx - 2, sy - 2, 14, word.length * 12 + 6);
      g.fillStyle = col;
      g.font = 'bold 10px system-ui, sans-serif';
      g.textAlign = 'center';
      for (let i = 0; i < word.length; i++) g.fillText(word[i], sx + 5, sy + 10 + i * 12);
      g.restore();
    }
    x += bw + 2 + r() * 10;
  }
}

// Grues et piles de conteneurs du port (plan le plus proche)
function harbourLayer(g, w, h, r) {
  g.fillStyle = '#100b1f';
  let x = 0;
  while (x < w) {
    if (r() < 0.35) {                                 // grue
      const cx = x + 30, top = h * (0.25 + r() * 0.15);
      g.fillRect(cx, top, 8, h - top);
      g.fillRect(cx - 60, top, 180, 7);
      g.beginPath(); g.moveTo(cx + 4, top - 30); g.lineTo(cx - 60, top); g.lineTo(cx + 120, top); g.closePath(); g.fill();
      g.fillRect(cx + 90, top + 7, 2, 60 + r() * 60);
      g.fillStyle = 'rgba(255,80,80,0.9)';
      g.fillRect(cx + 2, top - 32, 4, 3);
      g.fillStyle = '#100b1f';
      x += 200;
    } else {                                          // conteneurs empilés
      const stacks = 1 + Math.floor(r() * 3);
      for (let i = 0; i < stacks; i++) {
        const cw = 70 + r() * 30, ch = 26;
        g.fillRect(x, h - (i + 1) * ch, cw, ch - 2);
        g.fillStyle = 'rgba(255,255,255,0.04)';
        for (let k = 4; k < cw; k += 6) g.fillRect(x + k, h - (i + 1) * ch + 3, 2, ch - 8);
        g.fillStyle = '#100b1f';
      }
      x += 90 + r() * 40;
    }
  }
}

// ===== Canyon Ardent : coucher de soleil, roche, lave =====
THEMES.coucher = {
  name: 'Canyon Ardent',
  weather: 'poussiere',
  voidStyle: 'lave',
  grade: 'rgba(255,120,40,0.07)',
  sunPos: [0.3, 0.68],
  sky(g, w, h, r) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1c0f2e');
    grad.addColorStop(0.35, '#6b2c52');
    grad.addColorStop(0.68, '#e5743f');
    grad.addColorStop(1, '#ffd38a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const [sx, sy] = [w * this.sunPos[0], h * this.sunPos[1]];
    const sr = h * 0.11;
    const glow = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, h * 0.75);
    glow.addColorStop(0, 'rgba(255,215,140,0.65)');
    glow.addColorStop(1, 'rgba(255,140,80,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff3cf';
    g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    // Nuages effilés éclairés par-dessous
    for (let i = 0; i < 9; i++) {
      const cy = h * (0.12 + r() * 0.45), cw = w * (0.12 + r() * 0.22), cx = r() * w;
      g.fillStyle = `rgba(90,30,60,${0.25 + r() * 0.2})`;
      g.beginPath(); g.ellipse(cx, cy, cw, h * 0.012 + r() * h * 0.01, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,170,110,0.35)';
      g.beginPath(); g.ellipse(cx, cy + h * 0.008, cw * 0.85, h * 0.005, 0, 0, Math.PI * 2); g.fill();
    }
  },
  layers: [
    { p: 0.05, hf: 0.4, paint(g, w, h, r) { mesaLayer(g, w, h, r, 'rgba(196,106,96,0.75)', 0.45, 0.8, false); } },
    { p: 0.13, hf: 0.5, paint(g, w, h, r) { mesaLayer(g, w, h, r, '#8a3d48', 0.44, 0.84, true); } },
    { p: 0.28, hf: 0.5, paint(g, w, h, r) { rockLayer(g, w, h, r); } },
    { p: 0.55, mid: true, paint(g, w, h, r) { pillarLayer(g, w, h, r, 'rgba(48,18,30,0.92)', 'roche'); } },
  ],
  tile(g, n, r) {
    g.fillStyle = '#a5623e';
    g.fillRect(0, 0, n, n);
    // Strates horizontales ondulées
    const bands = ['#b8744a', '#9a5a38', '#c58456', '#8f5134', '#b06c43'];
    let y = 0;
    while (y < n) {
      const bh = 6 + r() * 12;
      g.fillStyle = bands[Math.floor(r() * bands.length)];
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= n; x += 16) g.lineTo(x, y + Math.sin(x / n * Math.PI * 2) * 2);
      g.lineTo(n, y + bh); g.lineTo(0, y + bh);
      g.fill();
      y += bh;
    }
    for (let i = 0; i < 60; i++) {                    // grains
      g.fillStyle = `rgba(${r() < 0.5 ? '255,230,190' : '60,25,10'},${0.08 + r() * 0.1})`;
      g.fillRect(r() * n, r() * n, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(60,25,10,0.35)';            // fissures
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      let x = r() * n, yy = r() * n;
      g.moveTo(x, yy);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 14; yy += r() * 10; g.lineTo(x, yy); }
      g.stroke();
    }
  },
  trim(g, s, w, h, pad, r) {
    const top = pad;
    g.fillStyle = '#e8b07a';                          // sable clair sur le dessus
    g.fillRect(0, top, w, 4);
    g.fillStyle = 'rgba(255,240,210,0.5)';
    g.fillRect(0, top, w, 1.5);
    if (h <= 40) {                                    // corniches : dessous déchiqueté
      g.fillStyle = '#8f5134';
      g.beginPath();
      g.moveTo(0, top + h);
      for (let x = 0; x <= w; x += 10 + r() * 14) g.lineTo(x, top + h + 3 + r() * 12);
      g.lineTo(w, top + h);
      g.fill();
    }
  },
  props: ['cactus', 'rocher', 'buisson', 'poteau', 'fleur'],
};

// Plateaux (mesas) lointains, avec strates claires si "strata"
function mesaLayer(g, w, h, r, color, minH, maxH, strata) {
  let x = -40;
  while (x < w + 40) {
    const mw = 120 + r() * 220, mh = h * (minH + r() * (maxH - minH));
    const top = h - mh, slope = 20 + r() * 30;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + slope, top + 6);
    g.lineTo(x + slope + 8, top);
    g.lineTo(x + mw - slope - 8, top);
    g.lineTo(x + mw - slope, top + 6);
    g.lineTo(x + mw, h);
    g.fill();
    if (strata) {
      g.fillStyle = 'rgba(255,190,140,0.10)';
      for (let k = 1; k < 5; k++) g.fillRect(x + slope * 0.6, top + mh * k / 6, mw - slope * 1.2, 3);
    }
    x += mw * (0.55 + r() * 0.4);
  }
}

// Plan proche : cheminées de fée, arches, cactus en silhouette
function rockLayer(g, w, h, r) {
  g.fillStyle = '#3f1c2a';
  let x = 0;
  while (x < w) {
    const k = r();
    if (k < 0.3) {                                    // arche
      const aw = 160, ah = h * 0.35;
      g.beginPath();
      g.moveTo(x, h); g.lineTo(x + 10, h - ah); g.quadraticCurveTo(x + aw / 2, h - ah - 50, x + aw - 10, h - ah);
      g.lineTo(x + aw, h); g.lineTo(x + aw - 28, h);
      g.quadraticCurveTo(x + aw / 2, h - ah + 40, x + 28, h);
      g.fill();
      x += aw + 30;
    } else if (k < 0.7) {                             // cheminée de fée
      const pw = 24 + r() * 20, ph = h * (0.15 + r() * 0.25);
      g.fillRect(x, h - ph, pw, ph);
      g.beginPath(); g.ellipse(x + pw / 2, h - ph, pw * 0.9, 9, 0, 0, Math.PI * 2); g.fill();
      x += pw + 40 + r() * 60;
    } else {                                          // cactus
      g.fillRect(x, h - 50, 8, 50);
      g.fillRect(x - 10, h - 38, 10, 5); g.fillRect(x - 10, h - 50, 5, 14);
      g.fillRect(x + 8, h - 30, 10, 5); g.fillRect(x + 13, h - 44, 5, 16);
      x += 60 + r() * 60;
    }
  }
}

// ===== Cité des Nuées : marbre, or, îles flottantes, mer de nuages =====
THEMES.jour = {
  name: 'Cité des Nuées',
  weather: 'petales',
  voidStyle: 'nuages',
  grade: 'rgba(255,240,200,0.05)',
  sky(g, w, h, r) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a74d0');
    grad.addColorStop(0.55, '#6db2ef');
    grad.addColorStop(1, '#d4ecff');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const sx = w * 0.82, sy = h * 0.13;
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.6);
    glow.addColorStop(0, 'rgba(255,252,230,0.95)');
    glow.addColorStop(0.08, 'rgba(255,248,215,0.6)');
    glow.addColorStop(1, 'rgba(255,248,215,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {                     // nuages hauts
      const c = cloudSprite(160 + r() * 200, 60 + r() * 40, 'rgba(255,255,255,0.75)', 'rgba(170,200,235,0.6)', r);
      g.drawImage(c, r() * w - 80, h * (0.08 + r() * 0.4));
    }
  },
  layers: [
    { p: 0.05, hf: 0.9, paint(g, w, h, r) { islandLayer(g, w, h, r, 'rgba(150,185,225,0.8)', 0.5, false); } },
    { p: 0.14, hf: 0.9, paint(g, w, h, r) { islandLayer(g, w, h, r, 'rgba(140,175,215,0.6)', 0.8, true); } },
    { p: 0.3, hf: 0.35, paint(g, w, h, r) { cloudBankLayer(g, w, h, r); } },
    { p: 0.55, mid: true, paint(g, w, h, r) { pillarLayer(g, w, h, r, 'rgba(200,215,235,0.55)', 'colonnes'); } },
  ],
  tile(g, n, r) {
    g.fillStyle = '#e8e3d8';
    g.fillRect(0, 0, n, n);
    const bh = n / 4;
    for (let row = 0; row < 4; row++) {               // blocs de marbre décalés
      const off = row % 2 ? n / 4 : 0;
      for (let x = -off; x < n; x += n / 2) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '200,190,175'},${0.15 + r() * 0.2})`;
        g.fillRect(x + 1, row * bh + 1, n / 2 - 2, bh - 2);
        g.fillStyle = 'rgba(120,110,95,0.35)';
        g.fillRect(x, row * bh, 1.5, bh);
      }
      g.fillRect(0, row * bh, n, 1.5);
    }
    g.strokeStyle = 'rgba(150,140,130,0.25)';         // veines
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      let x = r() * n, y = r() * n;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.3) * 16; y += (r() - 0.5) * 10; g.lineTo(x, y); }
      g.stroke();
    }
  },
  trim(g, s, w, h, pad, r) {
    const top = pad;
    g.fillStyle = '#d9b24a';                          // liseré doré
    g.fillRect(0, top + 5, w, 3);
    g.fillStyle = '#6cbf5f';                          // herbe
    g.fillRect(0, top, w, 5);
    g.fillStyle = '#8fdc7c';
    for (let x = 2; x < w - 2; x += 4 + r() * 6) {    // touffes
      const th = 3 + r() * 6;
      g.beginPath(); g.moveTo(x, top + 1); g.lineTo(x + 1.5, top - th); g.lineTo(x + 3, top + 1); g.fill();
    }
    if (w > 60) {                                     // lianes qui pendent dessous
      g.strokeStyle = 'rgba(80,150,70,0.85)';
      g.lineWidth = 2;
      for (let x = 10; x < w - 10; x += 26 + r() * 50) {
        const len = 8 + r() * (pad - 10);
        g.beginPath(); g.moveTo(x, top + h); g.quadraticCurveTo(x + 4, top + h + len / 2, x - 2, top + h + len); g.stroke();
        g.fillStyle = '#7fcf6c';
        g.beginPath(); g.arc(x - 2, top + h + len, 2.5, 0, Math.PI * 2); g.fill();
      }
    }
  },
  props: ['fleurs', 'buisson', 'banniere', 'lanterne', 'fleurs'],
};

// Îles flottantes avec cascades, et tours blanches à coupole dorée si "towers"
function islandLayer(g, w, h, r, color, scale, towers) {
  let x = 0;
  while (x < w) {
    const iw = (80 + r() * 140) * scale, top = h * (0.25 + r() * 0.45), ih = iw * 0.6;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x + iw, top);
    g.lineTo(x + iw * 0.6, top + ih);
    g.lineTo(x + iw * 0.45, top + ih * 1.2);
    g.lineTo(x + iw * 0.3, top + ih * 0.8);
    g.closePath();
    g.fill();
    g.fillStyle = towers ? 'rgba(120,190,120,0.7)' : 'rgba(170,215,170,0.5)';
    g.fillRect(x, top - 3, iw, 4);
    g.fillStyle = 'rgba(255,255,255,0.55)';          // cascade
    g.fillRect(x + iw * 0.15, top, 2, ih * 1.4);
    if (towers && r() < 0.8) {
      const tx = x + iw * (0.3 + r() * 0.4), th = 30 + r() * 50;
      g.fillStyle = 'rgba(245,245,250,0.9)';
      g.fillRect(tx, top - th, 12, th);
      g.fillStyle = 'rgba(230,190,90,0.95)';
      g.beginPath(); g.arc(tx + 6, top - th, 8, Math.PI, 0); g.fill();
      g.fillRect(tx + 5, top - th - 18, 2, 10);
    }
    x += iw + 40 + r() * 90;
  }
}

// Plan intermédiaire (juste derrière l'arène) : grands éléments sombres ou
// voilés qui donnent de la profondeur. style : 'pipes' | 'roche' | 'colonnes'
function pillarLayer(g, w, h, r, color, style) {
  let x = 40 + r() * 100;
  while (x < w) {
    const pw = 40 + r() * 50;
    g.fillStyle = color;
    if (style === 'pipes') {                          // piliers d'acier, tuyaux, lampes suspendues
      g.fillRect(x, 0, pw, h);
      g.fillRect(x - 30, h * (0.2 + r() * 0.5), pw + 60, 10);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(x + 4, 0, 3, h);
      g.fillStyle = 'rgba(255,200,120,0.5)';
      g.fillRect(x + pw / 2 - 3, h * (0.1 + r() * 0.3), 6, 4);
    } else if (style === 'roche') {                   // grandes aiguilles de roche
      g.beginPath();
      g.moveTo(x - pw * 0.3, h);
      g.lineTo(x + pw * 0.2, h * (0.1 + r() * 0.3));
      g.lineTo(x + pw * 0.7, h * (0.05 + r() * 0.25));
      g.lineTo(x + pw * 1.3, h);
      g.fill();
    } else {                                          // colonnes de marbre avec chapiteau
      g.fillRect(x, h * 0.18, pw * 0.7, h);
      g.fillRect(x - 8, h * 0.18 - 12, pw * 0.7 + 16, 12);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (let k = 6; k < pw * 0.7 - 4; k += 9) g.fillRect(x + k, h * 0.18, 2, h);
    }
    x += pw + 260 + r() * 340;
  }
}

// Banc de nuages bas (plan le plus proche)
function cloudBankLayer(g, w, h, r) {
  for (let x = -60; x < w + 60; x += 70 + r() * 60) {
    const c = cloudSprite(180 + r() * 120, 90 + r() * 40, 'rgba(240,247,255,0.75)', 'rgba(170,198,232,0.75)', r);
    g.drawImage(c, x, h - c.height * (0.55 + r() * 0.3));
  }
}

// ---------------------------------------------------------------------
// Objets de décor (sprites dessinés une fois). Purement visuels :
// ils ne bloquent rien et restent petits pour ne pas cacher l'action.
// ---------------------------------------------------------------------
const PROPS = {
  caisse: { w: 30, h: 26, draw(g, w, h) {
    g.fillStyle = '#3d4a6b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#56658c'; g.fillRect(2, 2, w - 4, 4);
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.strokeRect(3, 8, w - 6, h - 11);
    g.fillStyle = '#f5c518'; g.font = 'bold 8px sans-serif'; g.fillText('A-7', 7, h - 6);
  } },
  baril: { w: 18, h: 24, draw(g, w, h) {
    g.fillStyle = '#b8323a'; g.fillRect(0, 2, w, h - 4);
    g.fillStyle = '#7a1f26'; g.fillRect(0, 7, w, 2); g.fillRect(0, h - 9, w, 2);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(3, 2, 3, h - 4);
  } },
  lampadaire: { w: 22, h: 70, light: { dx: 17, dy: 6, color: 'rgba(255,214,140,0.55)', r: 70 }, draw(g, w, h) {
    g.fillStyle = '#2b2f45'; g.fillRect(4, 6, 3, h - 6); g.fillRect(4, 4, 14, 3);
    g.fillStyle = '#ffe3a3'; g.fillRect(13, 7, 8, 3);
    g.fillStyle = '#2b2f45'; g.fillRect(0, h - 4, 11, 4);
  } },
  plot: { w: 12, h: 16, draw(g, w, h) {
    g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w, h - 2); g.lineTo(0, h - 2); g.fill();
    g.fillStyle = '#fff'; g.fillRect(3, 7, w - 6, 2);
    g.fillStyle = '#222'; g.fillRect(0, h - 2, w, 2);
  } },
  cactus: { w: 26, h: 44, draw(g, w, h) {
    g.fillStyle = '#3f7a3a';
    g.fillRect(10, 2, 7, h - 2); g.beginPath(); g.arc(13.5, 3, 3.5, 0, Math.PI * 2); g.fill();
    g.fillRect(2, 16, 8, 5); g.fillRect(2, 8, 5, 12);
    g.fillRect(17, 22, 7, 5); g.fillRect(20, 12, 5, 14);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(11, 4, 2, h - 6);
  } },
  rocher: { w: 30, h: 16, draw(g, w, h) {
    g.fillStyle = '#7d4a30';
    g.beginPath(); g.moveTo(0, h); g.lineTo(4, 5); g.lineTo(13, 0); g.lineTo(24, 3); g.lineTo(w, h); g.fill();
    g.fillStyle = 'rgba(255,220,180,0.25)';
    g.beginPath(); g.moveTo(4, 5); g.lineTo(13, 0); g.lineTo(16, 4); g.fill();
  } },
  buisson: { w: 28, h: 14, draw(g, w, h) {
    g.fillStyle = '#5a7d34';
    for (const [x, y, rr] of [[7, 9, 6], [14, 6, 7], [21, 9, 6]]) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.arc(13, 4, 3, 0, Math.PI * 2); g.fill();
  } },
  poteau: { w: 10, h: 34, draw(g, w, h) {
    g.fillStyle = '#6b4a2b'; g.fillRect(3, 0, 4, h);
    g.strokeStyle = '#c9a36b'; g.beginPath(); g.moveTo(5, 8); g.quadraticCurveTo(14, 14, 10, 22); g.stroke();
  } },
  fleur: { w: 12, h: 14, draw(g, w, h) {
    g.strokeStyle = '#4c7d34'; g.beginPath(); g.moveTo(6, h); g.lineTo(6, 5); g.stroke();
    g.fillStyle = '#ff6fa8'; g.beginPath(); g.arc(6, 4, 3.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe066'; g.fillRect(5, 3, 2, 2);
  } },
  fleurs: { w: 30, h: 12, draw(g, w, h) {
    const cols = ['#ff6fa8', '#ffd43b', '#9775fa', '#ffffff', '#ff8787'];
    for (let i = 0; i < 7; i++) {
      const x = 3 + i * 4, y = 3 + (i % 3) * 2;
      g.strokeStyle = '#4c9a3a'; g.beginPath(); g.moveTo(x, h); g.lineTo(x, y); g.stroke();
      g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
    }
  } },
  banniere: { w: 22, h: 56, draw(g, w, h) {
    g.fillStyle = '#c9a23c'; g.fillRect(2, 0, 3, h); g.beginPath(); g.arc(3.5, 0, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b7cfa';
    g.beginPath(); g.moveTo(5, 4); g.lineTo(w, 8); g.lineTo(5, 24); g.fill();
    g.fillStyle = '#fff'; g.fillRect(8, 10, 5, 2);
  } },
  lanterne: { w: 14, h: 30, light: { dx: 7, dy: 18, color: 'rgba(255,200,120,0.45)', r: 45 }, draw(g, w, h) {
    g.fillStyle = '#5c4630'; g.fillRect(6, 0, 2, 12);
    g.fillStyle = '#c9a23c'; g.fillRect(2, 11, 10, 3); g.fillRect(2, 24, 10, 3);
    g.fillStyle = '#ffd98a'; g.fillRect(3, 14, 8, 10);
  } },
};

// ---------------------------------------------------------------------
// La classe principale
// ---------------------------------------------------------------------
export class Scenery {
  constructor(map) {
    this.map = map;
    this.T = THEMES[map.def.theme] || THEMES.nuit;
    this.seed = map.width * 13 + map.height * 7;
    this.quality = 2;            // 0 basse, 1 moyenne, 2 haute
    this.key = '';               // taille d'écran pour laquelle les images sont prêtes
    this.time = 0;
    this.flash = 0;              // éclair (Docks Néon)
    this.nextFlash = 6;
    this.particles = [];         // pluie / poussière / pétales (repère écran)
    this.embers = [];            // braises de lave (repère monde)
    this.placeProps();
  }

  // Objets de décor sur les plateformes (loin des points d'apparition et des objets)
  placeProps() {
    const r = rng(this.seed + 99);
    const m = this.map;
    const busy = [...m.spawns, ...m.pickupSpots];
    this.props = [];
    this.staticLights = [];
    for (const s of m.solids) {
      if (s.w < 90 || s.w > 1400 || s.y < 60) continue;           // pas sur les bords de la carte
      for (let x = s.x + 30 + r() * 80; x < s.x + s.w - 40; x += 110 + r() * 200) {
        if (busy.some((b) => Math.abs(b.x - x) < 60 && Math.abs(b.y - s.y) < 10)) continue;
        if (m.solids.some((o) => o !== s && x > o.x - 20 && x < o.x + o.w + 20 && o.y < s.y && o.y + o.h > s.y - 70)) continue;
        const type = this.T.props[Math.floor(r() * this.T.props.length)];
        const P = PROPS[type];
        const prop = { type, x: x - P.w / 2, y: s.y - P.h, flip: r() < 0.5 };
        this.props.push(prop);
        if (P.light) this.staticLights.push({ x: prop.x + P.light.dx, y: prop.y + P.light.dy, color: P.light.color, r: P.light.r });
      }
    }
    // Docks Néon : chaque fine plateforme a une bande néon lumineuse
    if (this.T.neon) {
      for (const s of m.solids) {
        if (s.h <= 40 && s.w < 1400) this.staticLights.push({ strip: s, color: 'rgba(61,245,255,0.55)' });
      }
    }
  }

  setQuality(q) {
    if (q !== this.quality) {
      this.quality = q;
      this.key = '';
    }
  }

  // (Re)fabrique les images en mémoire si l'écran a changé de taille
  prepare(view) {
    const res = Math.min(2, Math.max(0.75, view.scale * view.dpr));   // finesse des plateformes
    const key = `${view.w}x${view.h}@${res.toFixed(2)}q${this.quality}`;
    if (key === this.key) return;
    this.key = key;
    const r = rng(this.seed);
    const W = view.w, H = view.h;
    // Ciel
    this.sky = makeCanvas(W, H);
    const sg = this.sky.getContext('2d');
    this.T.sky.call(this.T, sg, W, H, r);
    sg.fillStyle = this.T.grade;                      // étalonnage intégré au ciel
    sg.fillRect(0, 0, W, H);
    // Plans lointains (dessinés en pixels CSS : légèrement flous, comme une profondeur de champ)
    const nLayers = this.quality === 0 ? 1 : this.quality === 1 ? 2 : 4;
    this.layers = this.T.layers.slice(0, nLayers).map((L, i) => {
      const tw = Math.ceil(Math.max(W, 900) * 1.4);
      // (seulement la hauteur utile : moins de pixels transparents à recopier)
      const c = makeCanvas(tw, L.mid ? H * 1.2 : H * (L.hf || 0.9));
      const lg = c.getContext('2d');
      L.paint(lg, tw, c.height, rng(this.seed + i * 31));
      // l'étalonnage des couleurs est appliqué une fois ici plutôt qu'à chaque image
      lg.globalCompositeOperation = 'source-atop';
      lg.fillStyle = this.T.grade;
      lg.fillRect(0, 0, tw, c.height);
      return { p: L.p, c, mid: L.mid };
    });
    // Texture des plateformes
    this.res = res;
    const n = 128;
    const tile = makeCanvas(n, n);
    this.T.tile(tile.getContext('2d'), n, rng(this.seed + 7));
    // Chaque plateforme est dessinée une fois (texture + ombrage + finitions)
    const pad = 24;
    this.solidImgs = this.map.solids.map((s, i) => {
      const c = makeCanvas(s.w * res, (s.h + pad * 2) * res);
      const g = c.getContext('2d');
      g.scale(res, res);
      g.save();
      g.translate(-s.x, pad - s.y);                  // la texture suit les coordonnées du monde
      g.fillStyle = g.createPattern(tile, 'repeat');
      g.fillRect(s.x, s.y, s.w, s.h);
      g.restore();
      // ombrage : haut éclairé, bas dans l'ombre
      const sh = g.createLinearGradient(0, pad, 0, pad + s.h);
      sh.addColorStop(0, 'rgba(255,255,255,0.10)');
      sh.addColorStop(Math.min(0.5, 30 / s.h), 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.38)');
      g.fillStyle = sh;
      g.fillRect(0, pad, s.w, s.h);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1;
      g.strokeRect(0.5, pad + 0.5, s.w - 1, s.h - 1);
      this.T.trim(g, s, s.w, s.h, pad, rng(this.seed + i * 17));
      return { c, x: s.x, y: s.y - pad, w: s.w, h: s.h + pad * 2 };
    });
    // Objets de décor
    this.propImgs = {};
    for (const type of new Set(this.props.map((p) => p.type))) {
      const P = PROPS[type];
      const c = makeCanvas(P.w * res, P.h * res);
      const g = c.getContext('2d');
      g.scale(res, res);
      P.draw(g, P.w, P.h);
      this.propImgs[type] = c;
    }
    // Vignette (bords assombris, comme une caméra de cinéma)
    this.vignette = makeCanvas(W, H);
    const vg = this.vignette.getContext('2d');
    const rad = vg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    rad.addColorStop(0, 'rgba(0,0,0,0)');
    rad.addColorStop(1, 'rgba(0,0,0,0.45)');
    vg.fillStyle = rad;
    vg.fillRect(0, 0, W, H);
    // Météo
    const count = [0, 35, 70][this.quality];
    this.particles = [];
    for (let i = 0; i < count; i++) this.particles.push(this.newParticle(W, H, true));
    this.foreClouds = [];
    if (this.T.voidStyle === 'nuages' && this.quality === 2) {
      for (let i = 0; i < 3; i++) {
        this.foreClouds.push({ c: cloudSprite(260, 110, 'rgba(255,255,255,0.35)', 'rgba(220,235,255,0.25)', r),
                               x: r() * W, y: H * (0.3 + r() * 0.6), v: 8 + r() * 10 });
      }
    }
  }

  newParticle(W, H, anywhere) {
    const w = this.T.weather;
    const p = { x: Math.random() * W, y: anywhere ? Math.random() * H : -20 };
    if (w === 'pluie') { p.vx = -160; p.vy = 900 + Math.random() * 300; p.len = 12 + Math.random() * 12; }
    else if (w === 'poussiere') { p.vx = 20 + Math.random() * 30; p.vy = (Math.random() - 0.5) * 10; p.size = 1 + Math.random() * 2; }
    else { p.vx = 15 + Math.random() * 20; p.vy = 25 + Math.random() * 25; p.size = 2 + Math.random() * 2; p.rot = Math.random() * 6; }
    return p;
  }

  update(dt, view) {
    this.time += dt;
    const W = view.w, H = view.h;
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += dt * 2;
      if (p.y > H + 20 || p.x < -30 || p.x > W + 30) Object.assign(p, this.newParticle(W, H, this.T.weather === 'poussiere'));
    }
    // Éclairs sur les Docks
    if (this.T.weather === 'pluie' && this.quality > 0) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) { this.flash = 1; this.nextFlash = 7 + Math.random() * 10; }
      this.flash = Math.max(0, this.flash - dt * 4);
    }
    // Braises qui montent de la lave
    if (this.T.voidStyle === 'lave' && this.quality > 0) {
      if (this.embers.length < 40 && Math.random() < 0.5) {
        this.embers.push({ x: Math.random() * this.map.width, y: this.map.height + 40,
                           vy: -60 - Math.random() * 80, life: 2 + Math.random() * 2 });
      }
      for (const e of this.embers) { e.y += e.vy * dt; e.x += Math.sin(this.time * 2 + e.y * 0.02) * 20 * dt; e.life -= dt; }
      this.embers = this.embers.filter((e) => e.life > 0);
    }
    for (const c of this.foreClouds || []) {
      c.x += c.v * dt;
      if (c.x > W + 20) c.x = -c.c.width;
    }
  }

  // ----- Fond : ciel + plans lointains (repère écran) -----
  drawBackground(ctx, cam, view) {
    this.prepare(view);
    ctx.drawImage(this.sky, 0, 0, view.w, view.h);
    if (this.flash > 0) {                               // éclair : le ciel s'illumine
      ctx.fillStyle = `rgba(200,210,255,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (this.T.sunPos && this.quality === 2) this.drawGodRays(ctx, view);
    if (this.T.neon && this.quality === 2) this.drawSearchlights(ctx, view);
    const camMaxY = Math.max(0, this.map.height + 100 - view.h / view.scale);
    for (const L of this.layers) {
      const tw = L.c.width;
      const off = -(((cam.x * L.p * view.scale) % tw) + tw) % tw;
      const dy = Math.min(view.h * 0.3, Math.max(0, (camMaxY - cam.y) * L.p * view.scale));
      const y = L.mid ? (view.h - L.c.height) * 0.5 + dy * 0.5 : view.h - L.c.height + dy;
      ctx.drawImage(L.c, off, y);
      if (off + tw < view.w) ctx.drawImage(L.c, off + tw, y);
    }
  }

  // Rayons de soleil (Canyon Ardent)
  drawGodRays(ctx, view) {
    const sx = view.w * this.T.sunPos[0], sy = view.h * this.T.sunPos[1];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.4 + Math.sin(this.time * 0.2 + i) * 0.05;
      const len = view.h * 1.3, spread = 0.07;
      ctx.fillStyle = `rgba(255,200,130,${0.035 + (i % 2) * 0.02})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - spread) * len, sy + Math.sin(a - spread) * len);
      ctx.lineTo(sx + Math.cos(a + spread) * len, sy + Math.sin(a + spread) * len);
      ctx.fill();
    }
    ctx.restore();
  }

  // Projecteurs qui balaient le ciel (Docks Néon)
  drawSearchlights(ctx, view) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const bx = view.w * (0.25 + i * 0.5), by = view.h;
      const a = -Math.PI / 2 + Math.sin(this.time * 0.35 + i * 2) * 0.5;
      const len = view.h * 1.2;
      ctx.fillStyle = 'rgba(160,190,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a - 0.06) * len, by + Math.sin(a - 0.06) * len);
      ctx.lineTo(bx + Math.cos(a + 0.06) * len, by + Math.sin(a + 0.06) * len);
      ctx.fill();
    }
    ctx.restore();
  }

  // ----- Le vide (eau, lave ou nuages) + plateformes + objets (repère monde) -----
  drawWorld(ctx) {
    const m = this.map, t = this.time;
    const top = m.height - 120, bottom = m.killY + 200;
    // Le vide : visible à travers les trous du sol
    if (this.T.voidStyle === 'lave') {
      const g = ctx.createLinearGradient(0, top, 0, m.height + 60);
      g.addColorStop(0, 'rgba(255,90,20,0)');
      g.addColorStop(1, 'rgba(255,110,30,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, m.width, m.height + 60 - top);
      ctx.fillStyle = '#c2280f';
      ctx.fillRect(0, m.height + 50, m.width, bottom - m.height);
      ctx.fillStyle = '#ff8a1f';
      for (let x = 0; x < m.width; x += 40) {          // vagues de lave
        const y = m.height + 50 + Math.sin(t * 2 + x * 0.05) * 5;
        ctx.fillRect(x, y - 3, 30, 5);
      }
      ctx.fillStyle = '#ffd23f';
      for (const e of this.embers) ctx.fillRect(e.x, e.y, 3, 3);
    } else if (this.T.voidStyle === 'eau') {
      const g = ctx.createLinearGradient(0, top, 0, m.height + 80);
      g.addColorStop(0, 'rgba(255,60,200,0)');
      g.addColorStop(1, 'rgba(255,60,200,0.30)');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, m.width, m.height + 80 - top);
      ctx.fillStyle = '#0b0a1c';
      ctx.fillRect(0, m.height + 70, m.width, bottom - m.height);
      ctx.fillStyle = 'rgba(61,245,255,0.35)';          // reflets néon sur l'eau
      for (let x = 0; x < m.width; x += 55) {
        const w = 18 + Math.sin(t * 1.5 + x) * 10;
        ctx.fillRect(x + Math.sin(t + x * 0.1) * 6, m.height + 76 + (x % 3) * 9, w, 2);
      }
    } else {
      const g = ctx.createLinearGradient(0, top, 0, m.height + 100);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, m.width, m.height + 100 - top);
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(0, m.height + 100, m.width, bottom - m.height);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';         // moutonnements de la mer de nuages
      for (let x = 0; x < m.width; x += 70) {
        ctx.beginPath();
        ctx.arc(x + Math.sin(t * 0.3 + x) * 10, m.height + 100 + Math.sin(x) * 8, 40, Math.PI, 0);
        ctx.fill();
      }
    }
    // Plateformes
    for (const im of this.solidImgs) ctx.drawImage(im.c, im.x, im.y, im.w, im.h);
    // Objets de décor
    for (const p of this.props) {
      const P = PROPS[p.type];
      ctx.drawImage(this.propImgs[p.type], p.x, p.y, P.w, P.h);
    }
  }

  // Ombres douces sous les personnages (sur le sol en dessous d'eux)
  drawShadows(ctx, fighters) {
    if (this.quality === 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const f of fighters) {
      if (!f.alive) continue;
      const feet = f.y + f.h;
      const d = this.map.groundBelow(f.cx, feet - 2);
      if (d > 260) continue;
      const k = 1 - d / 260;
      ctx.globalAlpha = k;
      ctx.beginPath();
      ctx.ellipse(f.cx, feet + d, f.w * (0.5 + 0.4 * k), 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ----- Lumières (repère monde, mode additif : elles "éclairent") -----
  drawLights(ctx, game) {
    if (this.quality === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, color, a = 1) => {
      ctx.globalAlpha = a;
      ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    };
    const flicker = 0.85 + Math.sin(this.time * 13) * 0.08 + Math.sin(this.time * 7.3) * 0.07;
    for (const L of this.staticLights) {
      if (L.strip) {                                    // bande néon : halo étiré le long du bord
        ctx.globalAlpha = 0.7 * flicker;
        ctx.drawImage(glowSprite(L.color), L.strip.x - 20, L.strip.y - 22, L.strip.w + 40, 44);
      } else {
        glow(L.x, L.y, L.r, L.color, flicker);
      }
    }
    for (const f of game.fighters) {
      if (!f.alive) continue;
      if (f.muzzleFlash > 0) {
        glow(f.shoulderX + Math.cos(f.aimAngle) * 34, f.shoulderY + Math.sin(f.aimAngle) * 34, 70, 'rgba(255,220,140,0.9)');
      }
      if (f.jetting) glow(f.facing === 1 ? f.x - 2 : f.x + f.w + 2, f.y + 38, 34, 'rgba(255,150,60,0.7)');
    }
    for (const b of game.bullets) {
      if (b.def && (b.def.kind === 'rocket')) glow(b.x, b.y, 50, 'rgba(255,140,60,0.8)');
      else if (b.def && b.def.kind === 'grenade' && b.fuse < 0.4) glow(b.x, b.y, 22, 'rgba(255,60,60,0.8)');
    }
    for (const bl of game.effects.blasts) {
      if (bl.life > 0) glow(bl.x, bl.y, bl.radius * 2.6, 'rgba(255,170,80,0.9)', bl.life / bl.maxLife);
    }
    for (const pk of game.pickups) {
      if (!pk.active) continue;
      const col = pk.type === 'health' ? 'rgba(255,80,80,0.5)' : pk.type === 'shield' ? 'rgba(80,170,255,0.5)'
        : pk.type === 'ammo' ? 'rgba(140,233,154,0.4)' : 'rgba(255,210,120,0.4)';
      glow(pk.x, pk.y, 40, col, 0.8);
    }
    ctx.restore();
  }

  // ----- Premier plan : météo, brume, couleur, vignette (repère écran) -----
  drawForeground(ctx, view) {
    const q = this.quality;
    if (this.particles.length) {
      const w = this.T.weather;
      if (w === 'pluie') {
        ctx.strokeStyle = 'rgba(170,190,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const p of this.particles) {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.018, p.y + p.len);
        }
        ctx.stroke();
      } else if (w === 'poussiere') {
        ctx.fillStyle = 'rgba(255,220,170,0.45)';
        for (const p of this.particles) ctx.fillRect(p.x, p.y + Math.sin(this.time + p.x) * 6, p.size, p.size);
      } else {
        // pétales : la rotation est imitée en faisant varier la largeur (bien moins coûteux)
        ctx.fillStyle = 'rgba(255,170,205,0.75)';
        for (const p of this.particles) {
          const w = p.size * 2 * Math.abs(Math.cos(p.rot)) + 1;
          ctx.fillRect(p.x + Math.sin(this.time * 2 + p.y * 0.05) * 8 - w / 2, p.y, w, p.size);
        }
      }
    }
    for (const c of this.foreClouds || []) ctx.drawImage(c.c, c.x, c.y);
    if (q === 2) ctx.drawImage(this.vignette, 0, 0, view.w, view.h);   // vignette : haute qualité
    if (this.flash > 0) {                               // éclair : toute la scène s'illumine un instant
      ctx.fillStyle = `rgba(220,225,255,${this.flash * 0.18})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }
}
