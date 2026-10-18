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
  // auto : true = tir continu tant qu'on vise ; pellets = plombs par tir
  weapons: [
    {
      id: 'rifle',
      name: 'Fusil auto',
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
    },
    {
      id: 'shotgun',
      name: 'Fusil à pompe',
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
    },
  ],

  // --- Bots ---
  bots: {
    count: 4,                // nombre d'ennemis (3 à 5 conseillé)
    aimError: 0.16,          // erreur de visée en radians (0 = parfait, 0.3 = maladroit)
    reactionTime: 0.45,      // temps avant de tirer sur une nouvelle cible
    sightRange: 900,         // distance à laquelle ils te repèrent
    preferredDistance: 320,  // distance qu'ils essaient de garder
    shotgunDistance: 220,    // en dessous, ils sortent le fusil à pompe
    burstTime: 1.0,          // durée d'une rafale
    burstPause: 0.55,        // pause entre deux rafales
    names: ['Rouille', 'Cobalt', 'Mangue', 'Pixel', 'Orage'],
    colors: ['#ff6b6b', '#4dabf7', '#ffa94d', '#b197fc', '#69db7c'],
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
  },

  // --- Retour sensoriel ---
  feedback: {
    vibrateOnShoot: 8,       // durée de vibration en ms (0 = désactivé)
    vibrateOnHit: 45,
    volume: 0.5,             // volume général (0 à 1)
  },

  player: {
    name: 'Toi',
    color: '#ffffff',
  },
};
