// =====================================================================
// weaponart.js — Le dessin détaillé des armes : en main des personnages,
// sur les caisses d'armes et dans l'interface. Tout est dessiné par le
// code. Chaque arme est dessinée UNE fois en haute définition dans une
// image en mémoire, puis simplement recopiée (tournée) à chaque image.
//
// Repère d'une arme : l'origine (0, 0) est l'épaule du personnage, le
// canon pointe vers la droite (x positif), le bas est y positif.
// =====================================================================

const RES = 4;                       // finesse des images en mémoire

// Couleurs communes
const METAL_DARK = '#262a33';
const METAL = '#3d4452';
const METAL_LIGHT = '#6b7487';
const SHINE = '#b8c0cf';
const WOOD = '#8b5a2b';
const WOOD_DARK = '#5e3b1a';

// --- Petits outils de dessin ---
function poly(g, pts, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}

function box(g, x0, y0, x1, y1, fill) {
  g.fillStyle = fill;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// Pièce métallique avec un reflet en haut (aspect plus "réel")
function metal(g, x0, y0, x1, y1, base = METAL) {
  const grad = g.createLinearGradient(0, y0, 0, y1);
  grad.addColorStop(0, METAL_LIGHT);
  grad.addColorStop(0.35, base);
  grad.addColorStop(1, METAL_DARK);
  g.fillStyle = grad;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(x0, y0, x1 - x0, Math.min(0.8, (y1 - y0) / 3));
}

// Bois avec quelques veines
function wood(g, pts) {
  poly(g, pts, WOOD);
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(60,30,10,0.45)';
  g.lineWidth = 0.5;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
  }
  for (let y = minY + 1.2; y < maxY; y += 1.6) {
    g.beginPath();
    g.moveTo(minX, y);
    g.quadraticCurveTo((minX + maxX) / 2, y + 0.8, maxX, y - 0.3);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,220,170,0.18)';
  g.fillRect(minX, minY, maxX - minX, 0.8);
  g.restore();
}

// ---------------------------------------------------------------------
// Les armes. Pour chacune :
//   box     zone occupée [x0, y0, x1, y1] (pour l'image en mémoire)
//   muzzle  bout du canon [x, y] (éclair, laser)
//   grip    main arrière [x, y]  ·  fore  main avant [x, y]
//   draw(g, color)  dessin (color = couleur d'accent de l'arme)
// ---------------------------------------------------------------------
const ART = {
  rifle: {
    box: [-11, -8, 38, 13], muzzle: [37, -0.5], grip: [5, 6], fore: [20, 2.5],
    draw(g, color) {
      wood(g, [-10, -2.5, -1, -3, -1, 3.5, -10, 6]);           // crosse (synthétique foncée)
      poly(g, [-10, -2.5, -1, -3, -1, 3.5, -10, 6], 'rgba(30,32,40,0.6)');
      metal(g, -1, -4, 14, 3);                                  // boîtier
      poly(g, [3, 3, 8, 3, 6.5, 9.5, 2, 9.5], METAL_DARK);      // poignée
      poly(g, [9, 3, 14, 3, 16.5, 11.5, 11, 12.5], METAL);      // chargeur courbé
      box(g, 9.5, 4, 13.5, 4.8, 'rgba(255,255,255,0.15)');
      metal(g, 14, -3.2, 27, 2.2, METAL_DARK);                  // garde-main
      for (let x = 16; x < 26; x += 2.5) box(g, x, -2, x + 1.2, 1, 'rgba(0,0,0,0.55)');   // aérations
      metal(g, 27, -1.6, 34, 0.6, METAL_LIGHT);                 // canon
      metal(g, 34, -2.6, 37.5, 1.6, METAL_DARK);                // frein de bouche
      box(g, 1, -6, 13, -4, METAL_DARK);                        // rail
      box(g, 2, -7.2, 4, -6, METAL);                            // viseur arrière
      box(g, 24, -5.8, 25.3, -3.2, METAL);                      // guidon
      box(g, 1, -1.3, 13, -0.3, color);                         // liseré de couleur
      poly(g, [7, 3, 9.5, 3, 9, 5.5, 7.5, 5.5], 'rgba(0,0,0,0.6)');   // pontet
    },
  },
  smg: {
    box: [-10, -7, 26, 15], muzzle: [25.5, -0.5], grip: [4, 6], fore: [11, 8],
    draw(g, color) {
      g.strokeStyle = METAL; g.lineWidth = 1.2;                 // crosse en fil d'acier
      g.beginPath(); g.moveTo(0, -2.5); g.lineTo(-8.5, -2); g.lineTo(-8.5, 4); g.lineTo(0, 2); g.stroke();
      box(g, -9.5, -3, -7.5, 5, METAL_DARK);
      metal(g, -0.5, -4, 14, 3);                                // boîtier
      poly(g, [2.5, 3, 7, 3, 6, 9.5, 1.5, 9.5], METAL_DARK);    // poignée
      metal(g, 9, 3, 12.8, 14, METAL);                          // chargeur droit
      box(g, 9, 12.8, 12.8, 14, METAL_DARK);
      metal(g, 14, -2.6, 25.5, 1.6, METAL_DARK);                // silencieux
      for (let x = 16; x < 25; x += 3) box(g, x, -2.6, x + 0.6, 1.6, 'rgba(255,255,255,0.12)');
      box(g, 4, -5.5, 8, -4, METAL_DARK);                       // viseur
      box(g, 0.5, -1.4, 13, -0.4, color);                       // liseré
    },
  },
  shotgun: {
    box: [-11, -6, 34, 10], muzzle: [33, -1.8], grip: [3, 5], fore: [19, 3.2],
    draw(g, color) {
      wood(g, [-10.5, -2, 0, -3, 0.5, 4, -3, 4.5, -10.5, 7]);   // crosse en bois
      metal(g, 0, -3.5, 10.5, 3);                               // boîtier
      metal(g, 10, -3.2, 33, -0.4, METAL_LIGHT);                // canon
      metal(g, 10, 0.4, 28, 2.6, METAL_DARK);                   // tube magasin
      wood(g, [14.5, -0.2, 23.5, -0.2, 23.5, 4.2, 14.5, 4.2]);  // pompe en bois
      for (let x = 15.5; x < 23; x += 1.6) box(g, x, 0.2, x + 0.6, 3.9, 'rgba(40,20,5,0.5)');   // stries
      box(g, 32, -4.4, 33, -3.2, SHINE);                        // guidon (bille)
      poly(g, [3.5, 3, 6.5, 3, 6, 5.5, 4, 5.5], 'rgba(0,0,0,0.6)');   // pontet
      box(g, 0.5, -0.6, 10, 0.3, color);                        // liseré
    },
  },
  sniper: {
    box: [-13, -12, 49, 10], muzzle: [48, -0.8], grip: [4, 5.5], fore: [22, 1.6],
    draw(g, color) {
      wood(g, [-12.5, -2, -3, -3.5, 0, -3, 0, 3.5, -5, 3.5, -12.5, 8]);   // crosse
      poly(g, [-9, -2.5, -3, -4.5, -1, -3], WOOD_DARK);          // appui-joue
      metal(g, 0, -3, 15, 2.5);                                  // boîtier
      poly(g, [2.5, 2.5, 7, 2.5, 5.5, 8.5, 1, 8.5], METAL_DARK); // poignée
      metal(g, 15, -1.6, 45, 0.2, METAL_LIGHT);                  // long canon
      metal(g, 44.5, -2.6, 48.5, 1.2, METAL_DARK);               // frein de bouche
      g.strokeStyle = METAL; g.lineWidth = 0.9;                  // bipied replié
      g.beginPath(); g.moveTo(24, 0.6); g.lineTo(35, 2); g.moveTo(24, 0.6); g.lineTo(35, 1); g.stroke();
      box(g, 8.5, 3, 11.5, 4, METAL_DARK);                        // levier de culasse
      g.fillStyle = METAL_LIGHT; g.beginPath(); g.arc(12, 4.2, 1.2, 0, Math.PI * 2); g.fill();
      box(g, 5, -5.5, 7, -3, METAL_DARK);                         // montures de lunette
      box(g, 13, -5.5, 15, -3, METAL_DARK);
      metal(g, 2, -9.5, 18, -5.3);                                // lunette
      metal(g, -0.5, -10, 3, -4.8, METAL_DARK);                   // oculaire
      metal(g, 16.5, -11, 21, -3.8, METAL_DARK);                  // objectif
      g.fillStyle = 'rgba(125,249,255,0.9)';                     // reflet bleu de la lentille
      g.fillRect(20.2, -10.2, 0.9, 5.6);
      box(g, 0.5, -0.9, 14.5, 0, color);                          // liseré
    },
  },
  rocket: {
    box: [-11, -11, 38, 12], muzzle: [33, -0.5], grip: [9, 7], fore: [19, 6.5], loadedTip: true,
    draw(g, color) {
      const tube = g.createLinearGradient(0, -5, 0, 4);          // tube kaki
      tube.addColorStop(0, '#8a9a5b');
      tube.addColorStop(0.4, '#5f6b3c');
      tube.addColorStop(1, '#353d22');
      g.fillStyle = tube;
      g.fillRect(-6, -5, 35, 9);
      poly(g, [-10, -6.5, -6, -5, -6, 4, -10, 5.5], '#2b3119'); // évasement arrière
      metal(g, 28, -6, 32.5, 5, METAL_DARK);                    // bague avant
      box(g, 2, -5, 4.2, 4, color);                             // bandes de couleur
      box(g, 23, -5, 25.2, 4, color);
      poly(g, [7, 4, 11.5, 4, 10, 10.5, 6, 10.5], METAL_DARK);  // poignée
      poly(g, [17, 4, 21, 4, 20, 9.5, 16.5, 9.5], METAL_DARK);  // poignée avant
      metal(g, 11, -9.5, 17.5, -5);                             // viseur
      box(g, 16.8, -8.8, 17.5, -6, 'rgba(255,90,90,0.9)');
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(-6, -4, 35, 1);
    },
  },
  grenade: {
    box: [2, -10, 17, 8], muzzle: [12, 0], grip: [10, 1], fore: null,
    draw(g, color) {
      const body = g.createRadialGradient(9, -1, 0.5, 10, 1, 6);  // corps
      body.addColorStop(0, '#9ccf86');
      body.addColorStop(1, '#3f6b33');
      g.fillStyle = body;
      g.beginPath(); g.ellipse(10, 1.5, 4.6, 5.4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,40,15,0.6)'; g.lineWidth = 0.6;   // rainures
      for (const y of [-1, 1.5, 4]) { g.beginPath(); g.moveTo(5.6, y); g.lineTo(14.4, y); g.stroke(); }
      g.beginPath(); g.moveTo(10, -3.8); g.lineTo(10, 6.8); g.stroke();
      metal(g, 8, -6, 12, -3.6);                                  // tête
      poly(g, [12, -5.5, 14.5, -4.5, 13.5, 3, 12.5, 3], METAL_LIGHT);   // levier
      g.strokeStyle = SHINE; g.lineWidth = 0.8;                    // goupille et anneau
      g.beginPath(); g.arc(6.5, -7, 2, 0, Math.PI * 2); g.stroke();
      box(g, 7.5, -5.4, 8.5, -4.6, SHINE);
      box(g, 6, 0.8, 14, 1.6, color);
    },
  },
};

// Image en mémoire de chaque arme (créée à la première utilisation)
const cache = new Map();
function sprite(id, color) {
  const key = id + color;
  let c = cache.get(key);
  if (!c) {
    const a = ART[id];
    const [x0, y0, x1, y1] = a.box;
    c = document.createElement('canvas');
    c.width = Math.ceil((x1 - x0) * RES);
    c.height = Math.ceil((y1 - y0) * RES);
    const g = c.getContext('2d');
    g.scale(RES, RES);
    g.translate(-x0, -y0);
    a.draw(g, color);
    // fin contour sombre : l'arme se détache sur tous les décors
    const outline = document.createElement('canvas');
    outline.width = c.width + 2 * RES; outline.height = c.height + 2 * RES;
    const og = outline.getContext('2d');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) og.drawImage(c, RES + dx * RES * 0.35, RES + dy * RES * 0.35);
    og.globalCompositeOperation = 'source-in';
    og.fillStyle = 'rgba(8,10,20,0.85)';
    og.fillRect(0, 0, outline.width, outline.height);
    og.globalCompositeOperation = 'source-over';
    og.drawImage(c, RES, RES);
    c = outline;
    cache.set(key, c);
  }
  return c;
}

export function hasArt(id) {
  return !!ART[id];
}

// Bout du canon dans le repère de l'arme
export function muzzleOf(id) {
  return (ART[id] || ART.rifle).muzzle;
}

// Arme tenue en main. opts : { color, kick (recul 0 à 1), reload (0 à 1),
// loaded (roquette chargée), flash, armColor (manches), handColor (mains) }
export function drawHeldWeapon(ctx, id, x, y, angle, opts) {
  const a = ART[id] || ART.rifle;
  const [x0, y0, x1, y1] = a.box;
  ctx.save();
  ctx.translate(x, y);
  // pendant le rechargement, l'arme pique un peu vers le bas
  const tilt = opts.reload > 0 ? Math.sin(opts.reload * Math.PI) * 0.55 : 0;
  const left = Math.cos(angle) < 0;
  ctx.rotate(angle + (left ? -tilt : tilt));
  if (left) ctx.scale(1, -1);                 // visée à gauche : l'arme reste à l'endroit
  ctx.translate(-opts.kick * 3.5, 0);         // recul à chaque tir
  // Bras derrière l'arme (de l'épaule vers chaque main)
  ctx.strokeStyle = opts.armColor || opts.handColor;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const h of [a.grip, a.fore]) {
    if (!h) continue;
    ctx.moveTo(-1, 1);
    ctx.lineTo(h[0], h[1]);
  }
  ctx.stroke();
  if (id !== 'grenade' || opts.loaded) {
    const img = sprite(id, opts.color);
    ctx.drawImage(img, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
  }
  if (a.loadedTip && opts.loaded) {           // roquette visible au bout du tube
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.moveTo(32.5, -3.4); ctx.lineTo(37.5, -0.5); ctx.lineTo(32.5, 2.6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(32.5, -2.4, 2, 0.8);
  }
  // Mains (gants) par-dessus l'arme : arrière sur la poignée, avant sur le garde-main
  ctx.fillStyle = opts.handColor;
  ctx.strokeStyle = 'rgba(8,10,20,0.8)';
  ctx.lineWidth = 1;
  for (const h of [a.grip, a.fore]) {
    if (!h) continue;
    ctx.beginPath(); ctx.arc(h[0], h[1], 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // Éclair au bout du canon (étoile à 4 branches + cœur clair)
  if (opts.flash && id !== 'grenade') {
    const [mx, my] = a.muzzle;
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.moveTo(mx, my - 6); ctx.lineTo(mx + 5, my - 1); ctx.lineTo(mx + 17, my);
    ctx.lineTo(mx + 5, my + 1); ctx.lineTo(mx, my + 6); ctx.lineTo(mx + 3, my);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath(); ctx.arc(mx + 3, my, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Icône d'arme (caisses, interface) : centrée en (cx, cy), largeur max maxW
export function drawWeaponIcon(ctx, id, cx, cy, maxW, color) {
  const a = ART[id];
  if (!a) return;
  const [x0, y0, x1, y1] = a.box;
  const k = Math.min(maxW / (x1 - x0), maxW * 0.6 / (y1 - y0));
  const w = (x1 - x0 + 2) * k, h = (y1 - y0 + 2) * k;
  ctx.drawImage(sprite(id, color), cx - w / 2, cy - h / 2, w, h);
}
