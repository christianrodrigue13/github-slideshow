// =====================================================================
// character.js — Le dessin d'un personnage (une vraie petite personne) :
// visage (peau, yeux, nez, bouche), coiffure, veste, pantalon, bottes,
// jambes articulées (genoux) qui marchent, jetpack sur le dos.
// L'arme et les bras sont dessinés par weaponart.js.
// Les listes de peaux, coiffures, couleurs… sont dans config.js.
// =====================================================================

import { CONFIG } from './config.js';

const COS = CONFIG.cosmetics;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Apparence au hasard (pour les bots)
export function randomLook() {
  return {
    skin: pick(COS.skins).color,
    hair: pick(COS.hairs).id,
    hairColor: pick(COS.hairColors.filter((c) => c.level <= 1)).color,
    face: Math.random() < 0.35 ? pick(['barbe', 'moustache', 'lunettes']) : 'aucun',
    pants: pick(CONFIG.characters.pants),
  };
}

// Apparence choisie par le joueur (écran Style)
export function lookFromCosmetics(c) {
  const find = (list, id) => list.find((x) => x.id === id) || list[0];
  return {
    skin: find(COS.skins, c.skin).color,
    hair: find(COS.hairs, c.hair).id,
    hairColor: find(COS.hairColors, c.hairColor).color,
    face: find(COS.faces, c.face).id,
    pants: CONFIG.characters.playerPants,
  };
}

// Éclaircit (k > 0) ou assombrit (k < 0) une couleur "#rrggbb"
function shade(hex, k) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const OUTLINE = 'rgba(10,12,25,0.75)';

// Angles des jambes [cuisse, tibia] (0 = vers le bas, positif = vers l'avant)
function legPose(f, front) {
  if (f.grounded) {
    const speed = Math.min(1, Math.abs(f.vx) / CONFIG.fighter.runSpeed);
    if (speed < 0.05) return front ? [0.1, 0.02] : [-0.08, -0.12];
    // (le sens de la marche suit la direction du regard : reculer = marcher à l'envers)
    const p = f.walkPhase * f.facing + (front ? 0 : Math.PI);
    const thigh = Math.sin(p) * 0.7 * speed;
    const bend = (0.15 + 0.85 * Math.max(0, Math.cos(p))) * speed;   // genou plié quand la jambe avance
    return [thigh, thigh - bend];
  }
  if (f.jetting) return front ? [0.25, -0.1] : [-0.1, -0.4];          // jambes pendantes en vol
  return front ? [0.75, -0.25] : [0.15, -0.7];                       // jambes repliées en l'air
}

// Une jambe : cuisse + tibia (pantalon) et une botte qui pointe vers l'avant
function drawLeg(ctx, hipX, [a1, a2], pants, boots) {
  const kx = hipX + Math.sin(a1) * 7.5, ky = 30 + Math.cos(a1) * 7.5;
  const fx = kx + Math.sin(a2) * 6.5, fy = ky + Math.cos(a2) * 6.5;
  ctx.strokeStyle = pants;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(hipX, 30);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(a2 * 0.6);
  ctx.fillStyle = boots;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-2.6, -2, 7.2, 3.4, 1.4); else ctx.rect(-2.6, -2, 7.2, 3.4);
  ctx.fill();
  ctx.restore();
}

// Contour du buste (veste) : épaules plus larges que la taille
function torsoPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-5.5, 16.2);
  ctx.quadraticCurveTo(0, 15.2, 5.5, 16.2);
  ctx.quadraticCurveTo(7.3, 17, 7, 21);
  ctx.lineTo(6, 31);
  ctx.lineTo(-6, 31);
  ctx.lineTo(-7, 21);
  ctx.quadraticCurveTo(-7.3, 17, -5.5, 16.2);
  ctx.closePath();
}

// Cheveux qui couvrent le haut et l'arrière de la tête (base de plusieurs coiffures)
function hairCap(ctx) {
  ctx.beginPath();
  ctx.arc(1, 7.5, 7.1, Math.PI * 0.93, Math.PI * 1.88);
  ctx.quadraticCurveTo(4, 2.6, 0.5, 4.8);
  ctx.lineTo(-2.2, 6.4);
  ctx.lineTo(-2.8, 9.8);
  ctx.closePath();
  ctx.fill();
}

// Coiffures (repère local : tête centrée en (1, 7.5), regard vers la droite)
const HAIR = {
  court(ctx) { hairCap(ctx); },
  rase(ctx) {
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.arc(1, 7.5, 6.9, Math.PI * 0.95, Math.PI * 1.8);
    ctx.lineTo(-2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha /= 0.55;
  },
  herisse(ctx) {
    hairCap(ctx);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = -5 + i * 2.6;
      ctx.moveTo(x - 1.6, 2.5 + Math.abs(i - 2) * 0.6);
      ctx.lineTo(x + 0.8, -1.8 + Math.abs(i - 2) * 0.9);
      ctx.lineTo(x + 2, 2.5 + Math.abs(i - 2) * 0.6);
    }
    ctx.fill();
  },
  queue(ctx) {
    hairCap(ctx);
    ctx.beginPath();
    ctx.moveTo(-5, 4.5);
    ctx.quadraticCurveTo(-11.5, 6, -10, 15);
    ctx.quadraticCurveTo(-8, 10, -5.2, 8);
    ctx.closePath();
    ctx.fill();
  },
  longs(ctx) {
    ctx.beginPath();
    ctx.moveTo(-1, 2);
    ctx.quadraticCurveTo(-8.5, 3, -7.8, 17);
    ctx.lineTo(-2, 17.5);
    ctx.lineTo(-1.5, 9);
    ctx.closePath();
    ctx.fill();
    hairCap(ctx);
  },
  chignon(ctx) {
    hairCap(ctx);
    ctx.beginPath();
    ctx.arc(-4.8, 2.4, 3, 0, Math.PI * 2);
    ctx.fill();
  },
  casquette(ctx, look, cap) {
    hairCap(ctx);
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.arc(1, 7, 7.2, Math.PI * 1.02, Math.PI * 1.98);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(5, 4.6, 7, 2, 1); else ctx.rect(5, 4.6, 7, 2);
    ctx.fill();
  },
  bonnet(ctx, look, cap) {
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.arc(1, 6.6, 7.3, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-6.4, 4.6, 14.8, 2.8);
    ctx.beginPath();
    ctx.arc(1, -1.2, 2.1, 0, Math.PI * 2);
    ctx.fill();
  },
};

// Dessine le personnage f (sans l'arme). opts : { look, jacket, flash }
export function drawCharacter(ctx, f, look, jacket, flash) {
  const white = '#ffffff';
  const skin = flash ? white : look.skin;
  const hair = flash ? white : look.hairColor;
  const pants = flash ? white : look.pants;
  const boots = flash ? white : CONFIG.characters.boots;
  const coat = flash ? white : jacket;
  const coatDark = shade(coat, -0.3);

  ctx.save();
  ctx.translate(f.cx, f.y);
  ctx.scale(f.facing, 1);                     // tout est dessiné "regard vers la droite"

  // --- Flamme du jetpack ---
  if (f.jetting) {
    const len = 14 + Math.random() * 14;
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    ctx.moveTo(-11, 32); ctx.lineTo(-6, 32); ctx.lineTo(-8.5, 32 + len);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(-9.8, 32); ctx.lineTo(-7.2, 32); ctx.lineTo(-8.5, 32 + len * 0.55);
    ctx.fill();
  }

  // --- Jambes : celle de derrière plus sombre ---
  drawLeg(ctx, -1.5, legPose(f, false), shade(pants, -0.3), shade(boots, -0.2));
  drawLeg(ctx, 1.5, legPose(f, true), pants, boots);

  // --- Jetpack sur le dos ---
  ctx.fillStyle = '#6c7489';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-12, 16, 6.5, 15, 2); else ctx.rect(-12, 16, 6.5, 15);
  ctx.fill();
  ctx.fillStyle = '#8a93a8';
  ctx.fillRect(-11, 18, 1.5, 10);             // reflet
  ctx.fillStyle = '#495063';
  ctx.fillRect(-11, 30, 4.5, 3);              // tuyère

  // --- Cou ---
  ctx.fillStyle = shade(skin, -0.15);
  ctx.fillRect(-1.2, 13, 4, 4.5);

  // --- Buste : veste (couleur choisie), motif, col, fermeture, sangle ---
  ctx.fillStyle = coat;
  torsoPath(ctx);
  ctx.fill();
  if (f.pattern && f.pattern !== 'uni' && !flash) {
    ctx.save();
    torsoPath(ctx);
    ctx.clip();
    drawPattern(ctx, f.pattern, -7.5, 15, 15, 16, shade(coat, -0.3));
    ctx.restore();
  }
  // ombre sur le côté arrière (donne du volume)
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(-7, 17, 3, 14);
  ctx.strokeStyle = coatDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(3.6, 19.5); ctx.lineTo(3.2, 29);  // fermeture éclair
  ctx.stroke();
  ctx.fillStyle = coatDark;                    // col
  ctx.beginPath();
  ctx.moveTo(-1.8, 15.8); ctx.lineTo(1.8, 19.5); ctx.lineTo(4.8, 15.8);
  ctx.lineTo(3, 15.4); ctx.lineTo(1.8, 17); ctx.lineTo(0, 15.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = flash ? white : '#2c2f3a';  // sangle du jetpack
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(-5.5, 17); ctx.lineTo(4.5, 28);
  ctx.stroke();
  ctx.fillStyle = flash ? white : '#2a2420';    // ceinture et boucle
  ctx.fillRect(-6, 28.3, 12, 2.6);
  ctx.fillStyle = flash ? white : '#c9a64b';
  ctx.fillRect(2.4, 28.3, 2.2, 2.6);
  ctx.strokeStyle = OUTLINE;                   // contour : lisible sur tous les décors
  ctx.lineWidth = 1.2;
  torsoPath(ctx);
  ctx.stroke();

  // --- Tête ---
  if (look.hair === 'longs' || look.hair === 'queue') {
    ctx.fillStyle = hair;                      // (cheveux de derrière, sous la tête)
    HAIR[look.hair](ctx, look, coatDark);
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(1, 7.5, 6.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // nez
  ctx.beginPath();
  ctx.moveTo(7.2, 6.8); ctx.lineTo(8.9, 9.3); ctx.lineTo(7, 9.7);
  ctx.closePath();
  ctx.fill();
  // oreille
  ctx.fillStyle = shade(skin, -0.12);
  ctx.beginPath();
  ctx.arc(-1.2, 8.3, 1.7, 0, Math.PI * 2);
  ctx.fill();
  // œil (blanc + pupille) et sourcil
  if (!flash) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(4.4, 7, 1.6, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(5, 7.1, 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, 5); ctx.lineTo(6.2, 4.6);
    ctx.stroke();
    // bouche
    ctx.strokeStyle = shade(skin, -0.4);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(4.6, 11.2); ctx.lineTo(6.6, 11);
    ctx.stroke();
  }
  // détails du visage
  ctx.fillStyle = hair;
  if (look.face === 'barbe') {
    ctx.beginPath();
    ctx.moveTo(7.5, 9.6);
    ctx.arc(1, 7.5, 6.8, 0.3, 2.3);
    ctx.lineTo(0.5, 10);
    ctx.quadraticCurveTo(4, 12.2, 7.5, 9.6);
    ctx.fill();
    if (!flash) {
      ctx.strokeStyle = shade(skin, -0.4);
      ctx.beginPath(); ctx.moveTo(4.6, 11.2); ctx.lineTo(6.6, 11); ctx.stroke();
    }
  } else if (look.face === 'moustache') {
    ctx.fillRect(4.3, 9.9, 3.2, 1.2);
  } else if (look.face === 'lunettes' && !flash) {
    ctx.fillStyle = '#1b1f2a';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(2.8, 5.6, 4.6, 2.9, 1); else ctx.rect(2.8, 5.6, 4.6, 2.9);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.7)';
    ctx.fillRect(5.6, 6.1, 1, 1);
    ctx.strokeStyle = '#1b1f2a';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(2.8, 6.6); ctx.lineTo(-1, 7); ctx.stroke();
  }
  // coiffure (par-dessus la tête)
  ctx.fillStyle = hair;
  if (look.hair !== 'longs' && look.hair !== 'queue') HAIR[look.hair](ctx, look, flash ? white : coatDark);
  else hairCap(ctx);

  ctx.restore();
}

// Motif cosmétique dessiné sur la veste (rayures, pois, damier, éclair)
function drawPattern(ctx, pattern, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (pattern === 'rayures') {
    for (let yy = y + 2; yy < y + h; yy += 5) ctx.fillRect(x, yy, w, 2);
  } else if (pattern === 'pois') {
    for (let yy = y + 3; yy < y + h; yy += 5) {
      for (let xx = x + 2 + ((yy - y) % 10 ? 2.5 : 0); xx < x + w; xx += 5) {
        ctx.beginPath();
        ctx.arc(xx, yy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'damier') {
    for (let yy = y, r = 0; yy < y + h; yy += 3.5, r++) {
      for (let xx = x + (r % 2) * 3.5; xx < x + w; xx += 7) ctx.fillRect(xx, yy, 3.5, 3.5);
    }
  } else if (pattern === 'eclair') {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.6, y);
    ctx.lineTo(x + w * 0.35, y + h * 0.5);
    ctx.lineTo(x + w * 0.65, y + h * 0.5);
    ctx.lineTo(x + w * 0.4, y + h);
    ctx.stroke();
  }
}
