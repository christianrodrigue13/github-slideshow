// =====================================================================
// config.js — TOUTES les valeurs d'équilibrage du jeu sont ici.
// Modifie un nombre, enregistre, recharge la page : c'est tout.
// Unités : distances en pixels du monde, temps en secondes,
// vitesses en pixels/seconde, accélérations en pixels/seconde².
// =====================================================================

export const CONFIG = {
  // --- Boucle de jeu ---
  updatesPerSecond: 60,      // pas de temps fixe : 60 mises à jour par seconde
  maxStepsPerFrame: 5,       // évite la "spirale de la mort" si l'appareil rame

  // --- Caméra / affichage ---
  view: {
    minVisibleWidth: 900,    // largeur minimale du monde visible à l'écran
    minVisibleHeight: 560,   // hauteur minimale du monde visible à l'écran
    followSpeed: 8,          // réactivité de la caméra (plus grand = plus collée)
    lookAhead: 90,           // la caméra regarde un peu vers où on vise (en px)
    sniperLookAhead: 260,    // … et beaucoup plus avec le sniper
    sniperZoom: 0.8,         // le sniper dézoome pour voir plus loin (1 = pas de zoom)
    maxPixelRatio: 2,        // limite la netteté sur écrans très denses (perf.)
  },

  // --- Physique générale ---
  gravity: 1500,
  maxFallSpeed: 950,

  // --- Personnage (joueur ET bots utilisent les mêmes valeurs) ---
  fighter: {
    width: 26,
    height: 44,
    maxHealth: 100,
    runSpeed: 270,           // vitesse max au sol
    groundAccel: 2600,       // accélération au sol
    airAccel: 1300,          // contrôle en l'air
    friction: 2200,          // freinage au sol quand on lâche
    jumpSpeed: 520,          // impulsion du saut
  },

  // --- Jetpack ---
  jetpack: {
    thrust: 2700,            // poussée vers le haut (doit dépasser la gravité)
    maxRiseSpeed: 430,       // vitesse de montée maximale
    maxFuel: 100,
    burnPerSecond: 42,       // consommation quand on vole
    regenPerSecond: 38,      // recharge quand on est au sol
    regenDelay: 0.35,        // délai au sol avant que la recharge commence
  },

  // --- Armes ---
  // Chaque personnage porte 2 armes : la principale (toujours le fusil auto)
  // et une secondaire, que l'on remplace en ramassant une caisse d'arme.
  // kind : 'bullet' = balles, 'rocket' = roquette qui explose à l'impact,
  //        'grenade' = projectile qui rebondit puis explose après "fuse" secondes
  // magazine = balles par chargeur, reserve = munitions de réserve (Infinity = illimité)
  // pellets = plombs par tir ; knockback = force de projection des explosions
  // botRange : distances [min, max] où les bots aiment utiliser l'arme
  loadout: { primary: 'rifle', secondary: 'shotgun' },
  weapons: [
    {
      id: 'rifle',
      short: 'AUTO',          // abréviation (caisses d'armes)
      name: 'Fusil auto',
      kind: 'bullet',
      damage: 9,
      fireRate: 9,           // tirs par seconde
      magazine: 30,
      reserve: 120,
      reloadTime: 1.6,
      spread: 0.045,         // dispersion en radians
      pellets: 1,
      bulletSpeed: 1700,
      range: 950,
      recoil: 45,            // petite poussée en arrière à chaque tir
      color: '#ffe066',
      botRange: [0, 900],
    },
    {
      id: 'smg',
      short: 'PM',          // abréviation (caisses d'armes)
      name: 'Pistolet-mitrailleur',
      kind: 'bullet',
      damage: 6,
      fireRate: 14,
      magazine: 36,
      reserve: 144,
      reloadTime: 1.3,
      spread: 0.09,
      pellets: 1,
      bulletSpeed: 1500,
      range: 620,
      recoil: 22,
      color: '#a9e34b',
      botRange: [0, 450],
    },
    {
      id: 'shotgun',
      short: 'POM',          // abréviation (caisses d'armes)
      name: 'Fusil à pompe',
      kind: 'bullet',
      damage: 8,             // par plomb
      fireRate: 1.2,
      magazine: 6,
      reserve: 18,
      reloadTime: 2.0,
      spread: 0.28,
      pellets: 7,
      bulletSpeed: 1350,
      range: 480,
      recoil: 190,
      color: '#ff9f43',
      botRange: [0, 240],
    },
    {
      id: 'sniper',
      short: 'PRÉ',          // abréviation (caisses d'armes)
      name: 'Fusil de précision',
      kind: 'bullet',
      damage: 70,
      fireRate: 0.8,
      magazine: 4,
      reserve: 12,
      reloadTime: 2.4,
      spread: 0.003,
      pellets: 1,
      bulletSpeed: 3400,
      range: 1900,
      recoil: 130,
      color: '#7df9ff',
      botRange: [350, 1800],
    },
    {
      id: 'rocket',
      short: 'ROQ',          // abréviation (caisses d'armes)
      name: 'Lance-roquettes',
      kind: 'rocket',
      damage: 95,            // dégâts au centre de l'explosion
      blastRadius: 115,      // rayon de l'explosion
      knockback: 950,        // forte projection
      fireRate: 0.7,
      magazine: 1,
      reserve: 5,
      reloadTime: 2.0,
      spread: 0.01,
      pellets: 1,
      bulletSpeed: 950,
      range: 1500,
      recoil: 170,
      color: '#ff8787',
      botRange: [180, 900],
    },
    {
      id: 'grenade',
      short: 'GRE',          // abréviation (caisses d'armes)
      name: 'Grenades',
      kind: 'grenade',
      damage: 90,
      blastRadius: 135,
      knockback: 700,
      fuse: 1.8,             // explosion retardée (secondes après le lancer)
      fireRate: 1.2,
      magazine: 1,           // une grenade en main…
      reserve: 4,            // … et 4 dans la poche
      reloadTime: 0.5,       // temps pour prendre la grenade suivante
      spread: 0.02,
      pellets: 1,
      bulletSpeed: 680,      // vitesse de lancer
      range: 600,
      recoil: 0,
      color: '#b2f2bb',
      botRange: [120, 550],
    },
  ],

  // --- Objets à ramasser ---
  pickups: {
    healthAmount: 50,        // PV rendus par une trousse de soin
    shieldAmount: 50,        // points de bouclier (absorbent les dégâts avant la vie)
    healthRespawn: 15,       // secondes avant qu'une trousse réapparaisse
    shieldRespawn: 20,
    weaponRespawn: 12,
    ammoRespawn: 12,         // une caisse de munitions remplit la réserve des 2 armes
    crateWeapons: ['smg', 'shotgun', 'sniper', 'rocket', 'grenade'],  // contenu possible des caisses
  },

  // --- Mode Roi de la colline ---
  hill: {
    pointsPerSecond: 1,      // points gagnés par seconde seul dans la zone
    target: 60,              // le premier à ce score gagne (sinon : le meilleur à la fin du temps)
  },

  // --- Bots ---
  bots: {
    count: 4,                // nombre de bots par défaut (modifiable dans le menu : 3 à 7)
    // (la précision et le temps de réaction dépendent de la difficulté, plus bas)
    sightRange: 900,         // distance à laquelle ils te repèrent
    burstTime: 1.0,          // durée d'une rafale
    // (distance préférée et pause entre rafales : voir les personnalités)
    playerPreference: 1.3,   // >1 : les bots s'en prennent un peu plus à toi
    names: ['Rouille', 'Cobalt', 'Mangue', 'Pixel', 'Orage', 'Brique', 'Néon'],
    colors: ['#ff6b6b', '#4dabf7', '#ffa94d', '#b197fc', '#69db7c', '#f783ac', '#ffd43b'],
  },

  // --- Personnalités des bots (réparties entre les bots de chaque partie) ---
  // preferredDistance : distance qu'il cherche à garder avec sa cible
  // secondary : arme secondaire de départ ; likes : armes qu'il va chercher dans les caisses
  // burstPause : pause entre deux rafales (plus court = plus agressif)
  // healthSeek : en dessous de ces PV, il va chercher un soin
  // retreatHealth : en dessous de ces PV, il fuit sa cible (0 = jamais)
  // tooClose : il recule si l'ennemi est plus près que ça (0 = jamais)
  personalities: {
    agressif: { label: 'Agressif', tag: '⚔', preferredDistance: 140, secondary: 'shotgun',
                likes: ['shotgun', 'smg'], burstPause: 0.25, healthSeek: 25, retreatHealth: 0, tooClose: 0 },
    tireur:   { label: 'Tireur', tag: '◎', preferredDistance: 620, secondary: 'sniper',
                likes: ['sniper', 'rocket'], burstPause: 0.6, healthSeek: 45, retreatHealth: 0, tooClose: 280 },
    prudent:  { label: 'Prudent', tag: '✚', preferredDistance: 380, secondary: 'smg',
                likes: ['smg', 'grenade', 'rocket'], burstPause: 0.7, healthSeek: 70, retreatHealth: 40, tooClose: 0 },
  },

  // --- Difficulté (choisie dans le menu) ---
  // aimError : erreur de visée des bots en radians (0 = parfait)
  // reactionTime : temps avant qu'un bot tire sur une cible qu'il vient de voir
  // damage : multiplicateur des dégâts infligés par les bots
  // aggression : agressivité (raccourcit les pauses entre rafales, réduit les replis)
  difficulties: {
    facile:    { label: 'Facile',    aimError: 0.28, reactionTime: 0.8,  damage: 0.7,  aggression: 0.7 },
    normal:    { label: 'Normal',    aimError: 0.16, reactionTime: 0.45, damage: 1,    aggression: 1 },
    difficile: { label: 'Difficile', aimError: 0.08, reactionTime: 0.25, damage: 1.15, aggression: 1.35 },
  },

  // --- Mode équipes ---
  teams: {
    names: ['Bleus', 'Rouges'],
    colors: ['#4dabf7', '#ff6b6b'],          // couleur de chaque équipe
    // nuances pour distinguer les bots d'une même équipe
    shades: [['#4dabf7', '#3bc9db', '#748ffc', '#66d9e8'],
             ['#ff6b6b', '#ffa94d', '#f783ac', '#ff8787']],
  },

  // --- Règles de la partie ---
  rules: {
    matchDuration: 180,      // 3 minutes
    respawnDelay: 3,
    spawnProtection: 1.2,    // invincibilité après réapparition
    killCreditTime: 5,       // si on tombe dans le vide, l'élimination revient
                             // au dernier tireur dans ces X secondes
  },

  // --- Contrôles tactiles ---
  touch: {
    stickRadius: 0.11,       // rayon du joystick (fraction de la hauteur d'écran)
    buttonRadius: 0.085,     // rayon des boutons tactiles (fraction de la hauteur d'écran)
    fixedStickY: 0.72,       // hauteur des joysticks fixes (fraction de la hauteur d'écran)
    deadZone: 0.18,          // zone morte du joystick (0 à 1)
    jetThreshold: 0.45,      // pousser le joystick gauche au-delà = jetpack
    fireThreshold: 0.35,     // pousser le joystick droit au-delà = tir
    aimAssist: {             // aide à la visée (téléphone seulement ; force : voir options)
      angle: 0.14,           // agit si un ennemi est à moins de ~8° du viseur (radians)
    },
  },

  // --- Options du joueur (écran Options) : valeurs proposées ---
  options: {
    // vitesse à laquelle la visée suit le joystick droit (radians/seconde)
    sensitivity: { basse: 7, moyenne: 14, haute: 60 },
    // force de l'aide à la visée (0 = aucune, 1 = verrouillée)
    aimAssist: { off: 0, faible: 0.35, moyenne: 0.6 },
    // tremblement d'écran (multiplicateur)
    shake: { off: 0, faible: 0.5, normal: 1 },
    volumes: [0, 0.25, 0.5, 0.75, 1],
    autoFireAngle: 0.1,      // tir auto : l'ennemi doit être à moins de ~6° du viseur
    // réglages au premier lancement
    defaults: {
      sensitivity: 'moyenne', aimAssist: 'faible', autoFire: false, vibration: true,
      volume: 0.5, shake: 'normal', leftHanded: false, fixedSticks: false,
    },
  },

  // --- Sensations de jeu ---
  feel: {
    shakeShootFactor: 0.02,  // tremblement au tir = recul de l'arme × ce facteur
    shakeHurt: 5,            // tremblement quand le joueur est touché (plus fort)
    shakeDeath: 9,           // … quand le joueur est éliminé
    shakeExplosion: 14,      // … pour une explosion toute proche
    maxShake: 18,            // tremblement maximal
    slowmoDuration: 0.15,    // ralenti quand le joueur élimine quelqu'un (secondes réelles)
    slowmoScale: 0.3,        // vitesse du jeu pendant le ralenti (0.3 = 30 %)
    hitMarkerTime: 0.18,     // durée d'affichage du marqueur de touche
  },

  // --- Retour sensoriel ---
  feedback: {
    pitchVariation: 0.08,    // variation aléatoire de hauteur des sons (± 8 %)
    vibrateOnShoot: 8,       // durée de vibration en ms (0 = désactivé)
    vibrateOnHit: 45,
  },

  // --- Effets visuels ---
  effects: {
    maxParticles: 350,       // réserve de particules réutilisées (moins = plus fluide)
  },

  // Gravité appliquée aux grenades
  grenadeGravity: 1300,

  // --- Minicarte ---
  minimap: {
    radarTime: 2.5,          // un ennemi apparaît sur la minicarte s'il a tiré récemment
  },

  player: {
    name: 'Toi',
    color: '#ffffff',
  },
};

// Retrouve la définition d'une arme par son identifiant
export function weaponDef(id) {
  return CONFIG.weapons.find((w) => w.id === id);
}
