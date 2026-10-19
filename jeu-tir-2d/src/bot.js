// =====================================================================
// bot.js — Le "cerveau" d'un bot. Il observe la partie et fabrique la
// même commande qu'un joueur humain ({ moveX, up, aimX, aimY, fire… }).
// Le personnage lui-même (player.js) est identique pour tout le monde.
// =====================================================================

import { CONFIG, weaponDef } from './config.js';

export class BotBrain {
  // skill = { aimError, reactionTime, aggression } : vient de la difficulté choisie
  // pers = sa personnalité (agressif, tireur, prudent : voir config.js)
  constructor(fighter, skill, pers) {
    this.f = fighter;
    this.skill = skill;
    this.pers = pers;
    this.target = null;
    this.retargetTimer = 0;
    this.seeTimer = 0;          // depuis combien de temps il voit sa cible
    this.wanderDir = Math.random() < 0.5 ? -1 : 1;
    this.wanderTimer = 0;
    this.flying = false;        // phase de vol au jetpack en cours
    this.aimOffset = 0;         // erreur de visée actuelle
    this.aimTimer = 0;
    this.burstTimer = Math.random();
    this.switchCooldown = 0;
    this.stuckTimer = 0;
    this.lastX = 0;
    this.aim = { x: 1, y: 0 };
    this.crossing = false;      // en train de traverser un trou en volant
    this.crossDir = 1;
    this.climbTimer = 0;        // vol forcé pour passer un obstacle
    this.lastSeen = -99;        // dernier moment où la cible était visible
    this.ignoreGoalsUntil = 0;  // objets ignorés jusqu'à ce moment
    this.grenadeTimer = 2 + Math.random() * 4;   // délai avant la prochaine grenade
    this.ceilDir = 1;           // côté choisi pour contourner un plafond
    this.ceilRect = null;
    this.ceilTimer = 0;
  }

  // Appelée à chaque réapparition
  reset() {
    this.target = null;
    this.seeTimer = 0;
    this.flying = false;
  }

  think(dt, game) {
    const me = this.f;
    const B = CONFIG.bots;
    const map = game.map;
    const cmd = { moveX: 0, up: false, aimX: this.aim.x, aimY: this.aim.y,
                  fire: false, switchWeapon: false, reload: false, throwGrenade: false };
    if (!me.alive) return cmd;

    // ---------- 1. Choisir une cible ----------
    this.retargetTimer -= dt;
    if (this.retargetTimer <= 0 || !this.target || !this.target.alive) {
      this.target = this.pickTarget(game);
      this.retargetTimer = 0.5 + Math.random() * 0.5;
    }
    const t = this.target;
    let visible = false, dx = 0, dy = 0, dist = Infinity;
    if (t) {
      dx = t.cx - me.cx;
      dy = t.cy - me.cy;
      dist = Math.hypot(dx, dy);
      visible = dist < B.sightRange &&
                map.lineOfSight(me.shoulderX, me.shoulderY, t.cx, t.cy);
    }
    // Mémoire courte : perdre la cible de vue un instant (elle passe derrière
    // un rebord) ne remet pas tout à zéro, sinon le bot hésite sans jamais tirer
    if (visible) this.lastSeen = game.time;
    this.seeTimer = visible ? this.seeTimer + dt : Math.max(0, this.seeTimer - dt);
    const engaged = visible || game.time - this.lastSeen < 0.8;

    // ---------- 2. Se déplacer ----------
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderDir = Math.random() < 0.5 ? -1 : 1;
      this.wanderTimer = 0.8 + Math.random() * 1.5;
    }
    let dir = this.wanderDir;
    let wantUp = false;
    const P = this.pers;
    // Repli quand la vie est basse (prudent ; moins souvent si la difficulté est élevée)
    const fleeing = P.retreatHealth > 0 && visible && me.health < P.retreatHealth / this.skill.aggression;
    if (t) {
      const adx = Math.abs(dx);
      if (fleeing) {
        dir = -Math.sign(dx) || dir;                 // s'éloigner de la menace
      } else if (!engaged) {
        // aller la chercher ; si elle est juste en dessous, on garde un sens
        // pour descendre par un bord (sinon on oscille au-dessus d'elle)
        dir = Math.abs(dx) < 160 && dy > 60 ? this.wanderDir : (Math.sign(dx) || dir);
        if (dy < -80) wantUp = true;                 // elle est plus haut
      } else if (P.tooClose && dist < P.tooClose) {
        dir = -Math.sign(dx) || dir;                 // tireur : trop près, il recule
      } else if (adx > P.preferredDistance) {
        dir = Math.sign(dx);                         // se rapprocher
      } else if (adx < P.preferredDistance * 0.45) {
        dir = -Math.sign(dx) || dir;                 // reculer un peu
      }                                              // sinon : on "danse"
      // (l'agressif colle aussi en hauteur : il vole vers une cible un peu plus haute)
      if (dy < -120 || (P.preferredDistance < 200 && engaged && dy < -50)) wantUp = true;
    }

    // Objet intéressant à aller chercher (soin si blessé, meilleure arme…)
    const goal = this.pickGoal(game, visible);
    let flyTargetY = t ? t.cy : null;
    // (dans la zone de colline, on ne fonce plus vers son centre : on se bat sur place)
    const inHill = goal && goal.type === 'hill' && this.insideHill(game.hill);
    if (goal && !inHill) {
      const gdx = goal.x - me.cx;
      // objectif juste en dessous (on est sur une plateforme au-dessus) :
      // on garde un sens pour descendre par un bord, sinon on oscille
      if (goal.y > me.y + me.h + 40 && Math.abs(gdx) < 160) dir = this.wanderDir;
      else if (Math.abs(gdx) > 6) dir = Math.sign(gdx);
      wantUp = goal.y < me.y + me.h - 30;
      flyTargetY = goal.y;
    }

    // Un plafond au-dessus ? Inutile de monter tout droit : on le contourne
    // par le bord situé du côté de l'objectif (ou le plus proche si
    // l'objectif est juste au-dessus du plafond)
    // Le côté choisi est gardé un moment (sinon on hésite au milieu), et en
    // l'air on garde son altitude pendant le contournement au lieu de tomber.
    let hover = false;
    if (this.ceilTimer > 0) this.ceilTimer -= dt;
    if (wantUp) {
      const ceil = map.ceilingAbove(me, 220);
      if (ceil) {
        if (this.ceilTimer <= 0 || this.ceilRect !== ceil) {
          const aimX = goal && !inHill ? goal.x : (t ? t.cx : me.cx);
          if (aimX < ceil.x) this.ceilDir = -1;
          else if (aimX > ceil.x + ceil.w) this.ceilDir = 1;
          else this.ceilDir = (me.cx - ceil.x) < (ceil.x + ceil.w - me.cx) ? -1 : 1;
          this.ceilRect = ceil;
          this.ceilTimer = 1.2;
        }
        dir = this.ceilDir;
        wantUp = false;
        hover = !me.grounded && me.fuel > 15;
      }
    }

    // Phases de vol : on décolle avec assez de carburant, on arrête
    // quand on est à bonne hauteur ou presque à sec
    // (en l'air, on peut relancer le jetpack même avec peu de carburant : mieux
    //  vaut finir le vol que tomber dans le vide)
    if (wantUp && !this.flying && me.fuel > (me.grounded ? 40 : 12)) this.flying = true;
    if (this.flying && (me.fuel < 8 || !wantUp ||
        (flyTargetY !== null && me.cy < flyTargetY - 30))) this.flying = false;

    // Bloqué contre un mur ? On saute / vole par-dessus
    if (Math.abs(me.x - this.lastX) < 0.5) this.stuckTimer += dt;
    else this.stuckTimer = 0;
    this.lastX = me.x;
    // (on vole alors un petit moment, quelle que soit la hauteur de la cible)
    // (sans carburant, inutile de sauter contre un grand mur : on attend au sol
    //  que le jetpack se recharge, sinon on ne recharge jamais)
    if (this.stuckTimer > 0.2 && (me.fuel > 25 || !me.grounded)) this.climbTimer = 0.5;
    if (this.stuckTimer > 2) { this.wanderDir = -dir; dir = -dir; this.stuckTimer = 0; }
    if (this.climbTimer > 0) this.climbTimer -= dt;
    // retombé au sol sans carburant : on annule la tentative (sinon il ressaute
    // aussitôt, en boucle, sans jamais laisser le jetpack se recharger)
    if (me.grounded && me.fuel <= 25) this.climbTimer = 0;

    // ---------- 3. Éviter le vide ----------
    const feet = me.y + me.h;
    const aheadX = me.cx + dir * (me.w / 2 + 30);
    if (me.grounded) this.crossing = false;
    if (me.grounded && map.groundBelow(aheadX, feet - 4) === Infinity) {
      const towardGoal = goal && Math.sign(goal.x - me.cx) === dir;
      const towardTarget = t && Math.sign(dx) === dir;
      if ((towardGoal || towardTarget) && me.fuel > 60) {
        this.crossing = true;                        // la cible ou l'objet est de l'autre
        this.crossDir = dir;                         // côté : on traverse en volant
      } else {
        dir = -dir;                                  // sinon : demi-tour
        this.wanderDir = dir;
        // (pas assez de carburant pour aller chercher l'objet : on l'oublie un moment,
        //  sinon on fait des allers-retours au bord du trou)
        if (towardGoal) this.ignoreGoalsUntil = game.time + 3;
      }
    }
    // Vol volontaire vers un objectif plus haut (ex. la colline au-dessus d'un
    // gouffre) : tant qu'il reste du carburant, on ne l'interrompt pas
    // (de même si l'objectif est juste en dessous et tout proche : en descendant
    //  vers lui on atterrira dessus, pas dans le vide)
    const goalAbove = goal && goal.y < feet - 30 && me.fuel > 25;
    const goalJustBelow = goal && feet <= goal.y + 15 && Math.abs(goal.x - me.cx) < 450 && me.fuel > 10;
    const flyingToGoal = goal && !inHill && (goalAbove || goalJustBelow);
    // En l'air : ne pas s'avancer au-dessus d'un trou (sauf traversée voulue).
    // On regarde deux points devant : une fente étroite se survole sans risque.
    if (!me.grounded && !this.crossing && !flyingToGoal && map.groundBelow(aheadX, feet) === Infinity &&
        map.groundBelow(aheadX + dir * 70, feet) === Infinity) {
      dir = this.nearestGroundDir(map, me.cx, feet) || -dir;
    }
    if (!me.grounded && !flyingToGoal && map.groundBelow(me.cx, feet) === Infinity) {
      if (this.crossing && me.fuel > 15) {
        dir = this.crossDir;                         // on continue la traversée
        cmd.up = me.vy > -50;                        // en gardant l'altitude
      } else {
        // Au-dessus du vide : on remonte et on file vers le sol le plus proche
        dir = this.nearestGroundDir(map, me.cx, feet) || dir;
        cmd.up = me.fuel > 0;
        this.crossing = false;
      }
      this.flying = false;
    }

    cmd.moveX = dir;
    // (au sol, on ne saute vers une cible en hauteur qu'avec assez de carburant
    //  pour voler ensuite, sinon on rebondit sur place sans jamais recharger)
    if (this.flying || this.climbTimer > 0 ||
        (me.grounded && ((wantUp && me.fuel > (goal ? 60 : 40)) || this.crossing))) cmd.up = true;
    if (hover && me.vy > -20) cmd.up = true;          // garder l'altitude sous un plafond

    // ---------- 4. Viser ----------
    this.aimTimer -= dt;
    if (this.aimTimer <= 0) {
      // L'erreur de visée change régulièrement → précision réglable
      this.aimOffset = (Math.random() * 2 - 1) * this.skill.aimError;
      this.aimTimer = 0.25 + Math.random() * 0.25;
    }
    if (t && visible) {
      const def = me.weapon.def;
      let ty = t.cy;
      if (def.kind === 'grenade') {
        // Grenade : on vise plus haut pour compenser la chute
        const flight = dist / def.bulletSpeed;
        ty -= 0.5 * CONFIG.grenadeGravity * flight * flight;
      }
      const precision = def.id === 'sniper' ? 0.5 : 1;   // le sniper vise plus juste
      const a = Math.atan2(ty - me.shoulderY, t.cx - me.shoulderX) + this.aimOffset * precision;
      this.aim.x = Math.cos(a); this.aim.y = Math.sin(a);
    } else if (dir) {
      this.aim.x = dir; this.aim.y = 0;
    }
    cmd.aimX = this.aim.x; cmd.aimY = this.aim.y;

    // ---------- 4 bis. Grenade (de temps en temps, cible visible à bonne distance) ----------
    this.grenadeTimer -= dt;
    if (visible && me.grenades > 0 && this.grenadeTimer <= 0 && dist > 150 && dist < 560 &&
        this.seeTimer >= this.skill.reactionTime) {
      const gdef = weaponDef('grenade');
      const flight = dist / gdef.bulletSpeed;
      const ty = t.cy - 0.5 * CONFIG.grenadeGravity * flight * flight;   // on vise plus haut (chute)
      const a = Math.atan2(ty - me.shoulderY, t.cx - me.shoulderX) + this.aimOffset;
      cmd.aimX = Math.cos(a); cmd.aimY = Math.sin(a);
      cmd.throwGrenade = true;
      const [lo, hi] = CONFIG.grenades.botInterval;
      this.grenadeTimer = lo + Math.random() * (hi - lo);
    }

    // ---------- 5. Choisir l'arme ----------
    this.switchCooldown -= dt;
    // On prend l'arme secondaire si la distance lui convient, sinon le fusil auto
    // (et jamais une arme vide si l'autre a encore des munitions)
    if (this.switchCooldown <= 0 && visible) {
      const [lo, hi] = me.weapons[1].def.botRange;
      let want = dist >= lo && dist <= hi ? 1 : 0;
      if (me.weapons[want].empty && !me.weapons[1 - want].empty) want = 1 - want;
      if (want !== me.weaponIndex) {
        cmd.switchWeapon = true;
        this.switchCooldown = 1.5;
      }
    }

    // ---------- 6. Tirer (par rafales) ----------
    this.burstTimer += dt;
    const cycle = B.burstTime + P.burstPause / this.skill.aggression;
    if (this.burstTimer > cycle) this.burstTimer -= cycle;
    const inBurst = this.burstTimer < B.burstTime;
    const tooCloseForBlast = me.weapon.def.kind !== 'bullet' && dist < 130;   // explosifs : pas à bout portant
    if (visible && this.seeTimer >= this.skill.reactionTime && inBurst && !tooCloseForBlast &&
        dist < me.weapon.def.range * 0.9) {
      cmd.fire = true;
    }
    // Recharge au calme
    if (!visible && me.weapon.ammo < me.weapon.def.magazine * 0.4) cmd.reload = true;
    // Arme vide : on passe à l'autre
    if (me.weapon.empty && !me.weapons[1 - me.weaponIndex].empty && this.switchCooldown <= 0) {
      cmd.switchWeapon = true;
      this.switchCooldown = 0.5;
    }

    this.lastCmd = cmd;         // (gardée pour le débogage)
    return cmd;
  }

  // Objet à aller chercher, ou null
  pickGoal(game, targetVisible) {
    const me = this.f;
    if (game.time < this.ignoreGoalsUntil) return null;
    const lowAmmo = me.weapons[0].ammoRatio < 0.3 && me.weapons[1].ammoRatio < 0.3;
    const P = this.pers;
    let wanted = null, maxDist = 0;
    if (me.health < P.healthSeek) { wanted = ['health', 'shield']; maxDist = 1200; }
    else if (lowAmmo) { wanted = ['ammo']; maxDist = 1500; }
    else if (game.hill) return this.hillGoal(game.hill);        // Roi de la colline : la zone d'abord
    else if (!targetVisible && !P.likes.includes(me.weapons[1].def.id)) { wanted = ['weapon']; maxDist = 900; }
    else if (!targetVisible && me.shield === 0) { wanted = ['shield']; maxDist = 700; }
    if (!wanted) return null;
    let best = null, bestD = maxDist;
    for (const p of game.pickups) {
      if (!p.active || !wanted.includes(p.type) || !p.usefulFor(me)) continue;
      if (p.type === 'weapon' && !P.likes.includes(p.weaponId)) continue;   // seulement ses armes préférées
      const d = Math.hypot(p.x - me.cx, p.y - me.cy);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // Objectif "colline" : le milieu du bas de la zone (là où l'on se tient)
  hillGoal(z) {
    const g = this.hillTarget || (this.hillTarget = { type: 'hill', x: 0, y: 0 });
    g.x = z.x + z.w / 2;
    g.y = z.y + z.h - 10;
    return g;
  }

  insideHill(z) {
    const me = this.f;
    return z && me.cx > z.x + 20 && me.cx < z.x + z.w - 20 && me.y < z.y + z.h && me.y + me.h > z.y;
  }

  // Ennemi le plus proche (le joueur humain compte un peu plus "près")
  pickTarget(game) {
    const me = this.f;
    let best = null, bestScore = Infinity;
    for (const o of game.fighters) {
      if (o === me || !o.alive || !game.canHit(me, o)) continue;
      let d = Math.hypot(o.cx - me.cx, o.cy - me.cy);
      if (!o.isBot) d /= CONFIG.bots.playerPreference;
      if (d < bestScore) { bestScore = d; best = o; }
    }
    return best;
  }

  // Direction (-1 ou 1) du sol le plus proche, 0 si aucun trouvé
  nearestGroundDir(map, x, y) {
    for (let step = 40; step <= 600; step += 40) {
      if (map.groundBelow(x - step, y) !== Infinity) return -1;
      if (map.groundBelow(x + step, y) !== Infinity) return 1;
    }
    return 0;
  }
}
