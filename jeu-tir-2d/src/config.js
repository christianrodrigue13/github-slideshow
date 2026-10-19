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
  // kind : 'bullet' = balles, 'grenade' = projectile qui rebondit et explose
  // auto : tir continu tant qu'on vise ; pellets = plombs par tir
  // botRange : distances [min, max] où les bots aiment utiliser l'arme
  loadout: { primary: 'rifle', secondary: 'shotgun' },
  weapons: [
    {
      id: 'rifle',
      name: 'Fusil auto',
      kind: 'bullet',
      damage: 9,
      fireRate: 9,           // tirs par seconde
      magazine: 30,
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
      id: 'shotgun',
      name: 'Fusil à pompe',
      kind: 'bullet',
      damage: 8,             // par plomb
      fireRate: 1.2,
      magazine: 6,
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
      name: 'Sniper',
      kind: 'bullet',
      damage: 70,
      fireRate: 0.9,
      magazine: 4,
      reloadTime: 2.2,
      spread: 0.004,
      pellets: 1,
      bulletSpeed: 3400,
      range: 1900,
      recoil: 130,
      color: '#7df9ff',
      botRange: [350, 1800],
    },
    {
      id: 'launcher',
      name: 'Lance-grenades',
      kind: 'grenade',
      damage: 85,            // dégâts au centre de l'explosion
      blastRadius: 125,      // rayon de l'explosion
      fuse: 1.3,             // secondes avant d'exploser (ou au contact d'un ennemi)
      fireRate: 1.0,
      magazine: 3,
      reloadTime: 2.4,
      spread: 0.02,
      pellets: 1,
      bulletSpeed: 780,      // vitesse de lancer
      range: 700,
      recoil: 150,
      color: '#b2f2bb',
      botRange: [150, 650],
    },
  ],

  // --- Objets à ramasser ---
  pickups: {
    healthAmount: 50,        // PV rendus par une trousse de soin
    shieldAmount: 50,        // points de bouclier (absorbent les dégâts avant la vie)
    healthRespawn: 15,       // secondes avant qu'une trousse réapparaisse
    shieldRespawn: 20,
    weaponRespawn: 12,
    crateWeapons: ['sniper', 'launcher', 'shotgun'],  // contenu possible des caisses
  },

  // --- Bots ---
  bots: {
    count: 4,                // nombre de bots par défaut (modifiable dans le menu : 3 à 7)
    // (la précision et le temps de réaction dépendent de la difficulté, plus bas)
    sightRange: 900,         // distance à laquelle ils te repèrent
    preferredDistance: 320,  // distance qu'ils essaient de garder
    burstTime: 1.0,          // durée d'une rafale
    burstPause: 0.55,        // pause entre deux rafales
    playerPreference: 1.3,   // >1 : les bots s'en prennent un peu plus à toi
    names: ['Rouille', 'Cobalt', 'Mangue', 'Pixel', 'Orage', 'Brique', 'Néon'],
    colors: ['#ff6b6b', '#4dabf7', '#ffa94d', '#b197fc', '#69db7c', '#f783ac', '#ffd43b'],
  },

  // --- Difficulté (choisie dans le menu) ---
  // aimError : erreur de visée des bots en radians (0 = parfait)
  // reactionTime : temps avant qu'un bot tire sur une cible qu'il vient de voir
  // damage : multiplicateur des dégâts infligés par les bots
  difficulties: {
    facile:    { label: 'Facile',    aimError: 0.28, reactionTime: 0.8,  damage: 0.7 },
    normal:    { label: 'Normal',    aimError: 0.16, reactionTime: 0.45, damage: 1 },
    difficile: { label: 'Difficile', aimError: 0.08, reactionTime: 0.25, damage: 1.15 },
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
    deadZone: 0.18,          // zone morte du joystick (0 à 1)
    jetThreshold: 0.45,      // pousser le joystick gauche au-delà = jetpack
    fireThreshold: 0.35,     // pousser le joystick droit au-delà = tir
    aimAssist: {             // aide à la visée (téléphone seulement)
      angle: 0.14,           // agit si un ennemi est à moins de ~8° du viseur (radians)
      strength: 0.6,         // 0 = aucune aide, 1 = visée verrouillée sur l'ennemi
    },
  },

  // --- Retour sensoriel ---
  feedback: {
    vibrateOnShoot: 8,       // durée de vibration en ms (0 = désactivé)
    vibrateOnHit: 45,
    volume: 0.5,             // volume général (0 à 1)
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
