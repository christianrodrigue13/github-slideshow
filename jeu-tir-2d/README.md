# Jet Arena — prototype de jeu de tir 2D

*(« Jet Arena » est un nom provisoire.)*

Un prototype jouable **dans le navigateur du téléphone** : un personnage avec
jetpack, du tir dans toutes les directions, des parties de 3 minutes contre
des bots, sur 3 cartes, en chacun pour soi ou en équipes. Pas de multijoueur pour l'instant : le but est de savoir si le jeu est
amusant avant d'investir dans des serveurs ou l'App Store.

Les graphismes et les sons sont **provisoires** : des formes colorées et des
sons générés par le code. Rien ne vient d'un autre jeu.

---

## 1. Jouer sur ton téléphone avec ton ordinateur (même Wi-Fi)

Ton ordinateur sert les fichiers du jeu, et ton téléphone les ouvre par le Wi-Fi.

### Étape 1 — Récupérer le dossier sur ton ordinateur

Il te faut le dossier `jeu-tir-2d` sur ton ordinateur. Deux façons :

- **Sans rien installer** : sur GitHub, ouvre le dépôt
  `christianrodrigue13/github-slideshow`, choisis la branche
  `claude/jeu-tir-2d-prototype-5r1yq0` dans le menu des branches, puis
  **Code → Download ZIP**. Dézippe, le dossier `jeu-tir-2d` est dedans.
- **Avec git** :
  `git clone -b claude/jeu-tir-2d-prototype-5r1yq0 https://github.com/christianrodrigue13/github-slideshow.git`

### Étape 2 — Lancer le petit serveur

Ouvre un terminal **dans le dossier `jeu-tir-2d`**, puis tape **une** de ces
commandes :

```bash
python3 -m http.server 3200 --bind 0.0.0.0
```

ou, si tu as Node.js installé :

```bash
npx serve -l 3200
```

(Sur Windows, si `python3` n'est pas reconnu, essaie `python` ou `py` à la place.)

Laisse ce terminal ouvert pendant que tu joues. Pour arrêter : `Ctrl + C`.

Le port **3200** a été choisi pour ne pas gêner tes autres projets (3000, 3001
et 3100).

Sur l'ordinateur lui-même, tu peux tester en ouvrant : <http://localhost:3200>

### Étape 3 — Trouver l'adresse IP de ton ordinateur

C'est l'adresse de ton ordinateur sur ton réseau Wi-Fi, du genre `192.168.1.23`.

- **Windows** : touche Windows → tape `cmd` → Entrée → tape `ipconfig` → Entrée.
  Cherche la ligne **« Adresse IPv4 »** sous ta carte Wi-Fi.
- **Mac** : menu Pomme → Réglages Système → Wi-Fi → bouton « Détails… » à côté de
  ton réseau → **Adresse IP**.
  (Ou dans le Terminal : `ipconfig getifaddr en0`)
- **Linux** : dans un terminal, tape `hostname -I`. C'est la première adresse
  (souvent celle qui commence par `192.168.` ou `10.`).

### Étape 4 — Ouvrir le jeu sur le téléphone

1. Le téléphone doit être sur **le même réseau Wi-Fi** que l'ordinateur.
2. Ouvre Chrome (Android) ou Safari (iPhone) et tape :
   `http://ADRESSE-IP:3200` — par exemple `http://192.168.1.23:3200`
3. Tourne le téléphone **en paysage** et touche **JOUER**.

**Ça ne charge pas ?**
- Vérifie que le terminal du serveur est toujours ouvert.
- Vérifie que tu as bien écrit `http://` (pas `https://`) et `:3200`.
- Le pare-feu de l'ordinateur peut bloquer : sur Windows, accepte la fenêtre
  « Autoriser l'accès » qui s'affiche au lancement de Python (réseau privé).
- Certains Wi-Fi publics ou « invités » empêchent les appareils de se voir :
  utilise ton Wi-Fi de maison.

---

## 2. Jouer sans ordinateur allumé (mise en ligne gratuite)

Le jeu n'est fait que de fichiers simples : on peut le mettre en ligne
gratuitement et obtenir un lien qui marche partout.

### Option A — Netlify Drop (le plus simple, 2 minutes)

1. Sur ton ordinateur, va sur <https://app.netlify.com/drop>.
2. Crée un compte gratuit (ou connecte-toi avec GitHub).
3. **Glisse le dossier `jeu-tir-2d`** entier dans la zone de la page.
4. Netlify te donne un lien du genre `https://nom-au-hasard.netlify.app`.
   Ouvre-le sur ton téléphone, c'est tout.
5. Pour mettre à jour le jeu plus tard : dans ton site sur Netlify, onglet
   « Deploys », glisse à nouveau le dossier.

### Option B — GitHub Pages (avec le dépôt GitHub)

Le jeu est déjà dans le dépôt `christianrodrigue13/github-slideshow`.

1. Fusionne la branche du jeu dans `master` (sur GitHub : ouvre une
   « Pull request » depuis la branche `claude/jeu-tir-2d-prototype-5r1yq0`
   puis « Merge »).
2. Sur la page du dépôt : **Settings → Pages**.
3. Dans « Build and deployment », choisis **Source : Deploy from a branch**,
   branche **master**, dossier **/ (root)**, puis **Save**.
4. Attends 1 à 2 minutes. Le jeu sera à l'adresse :
   `https://christianrodrigue13.github.io/github-slideshow/jeu-tir-2d/`

(Si le dépôt est privé, GitHub Pages peut demander un abonnement payant :
dans ce cas, prends l'option A.)

### Ajouter le jeu à l'écran d'accueil (comme une appli)

Une fois le jeu ouvert depuis un lien :
- **Android (Chrome)** : menu ⋮ → **« Ajouter à l'écran d'accueil »** (ou « Installer l'application »).
- **iPhone (Safari)** : bouton Partager □↑ → **« Sur l'écran d'accueil »**.

Le jeu s'ouvrira alors en plein écran, sans la barre d'adresse.

---

## 3. Les contrôles

### Sur téléphone

| Geste | Action |
|---|---|
| **Pouce gauche** posé n'importe où sur la moitié gauche | joystick de déplacement |
| Pousser le joystick gauche **vers le haut** | sauter (au sol), puis **jetpack** en maintenant |
| **Pouce droit** posé n'importe où sur la moitié droite | joystick de visée |
| Pousser le joystick droit **assez loin** | **tirer** (tant qu'on pousse) |
| Bouton **⇄** | changer d'arme |
| Bouton **R** | recharger |
| Bouton **II** (en haut à droite) | pause |

Les joysticks apparaissent là où tu poses le doigt.

### Sur ordinateur

| Touche | Action |
|---|---|
| **Q / D** (ou A / D en QWERTY) ou **← →** | se déplacer |
| **Z** (ou W en QWERTY), **↑** ou **Espace** | sauter, puis jetpack en maintenant |
| **Souris** | viser |
| **Clic gauche** maintenu | tirer |
| **R** ou clic droit | recharger |
| **E**, **1**, **2** ou molette | changer d'arme |
| **Échap** ou **P** | pause |

---

## 4. Le menu et les règles

### Le menu d'accueil
Touche **◀ / ▶** (ou la valeur elle-même) pour changer chaque réglage, puis **JOUER**.
Tes choix sont mémorisés pour la prochaine fois.

| Réglage | Choix |
|---|---|
| **Carte** | Entrepôt (nuit), Canyon (coucher de soleil, grands gouffres), Tours (verticale, beaucoup de vol) |
| **Mode** | Chacun pour soi, ou Équipes (Bleus contre Rouges, toi chez les Bleus) |
| **Difficulté** | Facile, Normal, Difficile (précision et réflexes des bots, dégâts qu'ils font) |
| **Bots** | de 3 à 7 |

### Les règles
- **Chacun pour soi** : tout le monde se tire dessus. **Équipes** : les balles
  traversent tes coéquipiers (pas de tir ami), on gagne au total d'éliminations de l'équipe.
- 100 points de vie. Le jetpack consomme du carburant, qui se recharge **au sol**.
- Tomber dans un trou = mort. Si quelqu'un t'a touché juste avant, c'est lui
  qui marque le point. Ta propre grenade peut te blesser (à moitié).
- Après une mort, on réapparaît au bout de **3 secondes**, avec un court moment
  d'invincibilité (le personnage clignote ; tirer l'annule).
- Une partie dure **3 minutes**.

### Armes et objets
Tu portes **2 armes** : le **fusil auto** (toujours) et une **arme secondaire**
(au départ le fusil à pompe). Le bouton **⇄** passe de l'une à l'autre.

| Arme | En bref |
|---|---|
| Fusil auto | rafales rapides, bonne portée |
| Fusil à pompe | 7 plombs, dévastateur de près |
| Sniper | 70 dégâts par tir, très longue portée, laser de visée, la caméra dézoome |
| Lance-grenades | grenades qui rebondissent et explosent (dégâts de zone + souffle), trajectoire affichée |

À ramasser en passant dessus (ils réapparaissent après quelques secondes) :
- **Caisse en bois** (lettre = l'arme dedans) : remplace ton arme secondaire.
- **Trousse blanche à croix rouge** : +50 PV.
- **Écusson bleu** : bouclier de 50 points qui encaisse les dégâts avant ta vie
  (bulle bleue autour du personnage).

### Ce qui aide à jouer
- **Aide à la visée** (téléphone) : si un ennemi est presque dans ton viseur, la visée glisse un peu vers lui.
- **Pointillés de visée** quand ton pouce droit vise.
- **Chiffres jaunes** au-dessus des ennemis touchés (bleus si leur bouclier a encaissé).
- **Flèches rouges** autour de toi : d'où viennent les tirs que tu reçois.
- **Minicarte** en haut à droite : les ennemis n'y apparaissent (en rouge) que s'ils viennent de tirer.

---

## 5. Changer l'équilibrage (vitesse, dégâts, bots…)

**Tout se règle dans un seul fichier : `src/config.js`.**
Chaque valeur est commentée en français. Change un nombre, enregistre,
puis recharge la page du jeu.

Exemples :

| Je veux… | Je modifie dans `config.js` |
|---|---|
| des bots plus ou moins forts | `difficulties` : `aimError` (plus grand = plus maladroits), `reactionTime`, `damage` |
| changer le nombre de bots par défaut | `bots.count` (et dans le menu) |
| voler plus longtemps | `jetpack.maxFuel` ou `jetpack.burnPerSecond` |
| un perso plus rapide | `fighter.runSpeed` |
| sauter plus haut | `fighter.jumpSpeed` |
| modifier une arme | son bloc dans `weapons` (`damage`, `fireRate`, `magazine`, `range`…) |
| une explosion plus grosse | `weapons` → `launcher` → `blastRadius` |
| plus de soin / de bouclier | `pickups.healthAmount`, `pickups.shieldAmount` |
| des objets qui reviennent plus vite | `pickups.healthRespawn`, `shieldRespawn`, `weaponRespawn` |
| plus ou moins d'aide à la visée | `touch.aimAssist.strength` (0 = aucune) |
| des parties plus courtes | `rules.matchDuration` (en secondes) |
| des joysticks plus grands | `touch.stickRadius` |
| plus / moins de vibrations | `feedback.vibrateOnShoot`, `feedback.vibrateOnHit` (0 = coupé) |

Les **cartes** sont dans `src/map.js` (liste `MAPS`) : chaque carte est une
liste de rectangles, de points d'apparition et d'emplacements d'objets.

---

## 6. Organisation des fichiers (pour un développeur)

```
jeu-tir-2d/
├── index.html            page unique, balises anti-zoom, manifest
├── style.css             plein écran, message « tourne ton téléphone »
├── manifest.webmanifest  installation sur l'écran d'accueil
├── icons/                icônes de l'application
└── src/
    ├── main.js     boucle à pas fixe (60 mises à jour/s), caméra, règles, menus
    ├── config.js   TOUTES les valeurs d'équilibrage
    ├── input.js    clavier / souris / tactile → une « commande » neutre
    ├── player.js   le personnage (physique, jetpack, armes) — joueur ET bots
    ├── bot.js      IA : fabrique la même commande qu'un joueur
    ├── weapon.js   chargeur, cadence, rechargement
    ├── bullet.js   balles (sans traversée des murs), grenades, particules, explosions
    ├── pickup.js   objets à ramasser (soin, bouclier, caisses d'armes)
    ├── map.js      les 3 cartes, leurs ambiances, collisions, lancer de rayon
    ├── hud.js      interface, joysticks, menus
    └── audio.js    sons Web Audio générés + vibrations
```

**Préparation du multijoueur** : le personnage (`player.js`) ne lit jamais le
clavier ni l'écran. Il reçoit une « commande » `{ moveX, up, aimX, aimY, fire,
switchWeapon, reload }`, fabriquée par `input.js` pour le joueur et par
`bot.js` pour les bots. En ligne, cette même commande pourra être envoyée au
serveur. La logique tourne à pas de temps fixe (1/60 s), ce qui donne le même
comportement sur tous les appareils.

Aucune dépendance, aucune installation : du HTML, du CSS et du JavaScript
(modules ES). Il faut juste un serveur web, parce que les navigateurs refusent
de charger les modules JavaScript depuis un fichier ouvert en double-cliquant
(`file://`).

### Limites connues du prototype

- **iPhone** : pas de vibration (Safari ne la permet pas) ni de vrai plein
  écran dans le navigateur. Passe par « Sur l'écran d'accueil » pour jouer sans
  la barre d'adresse.
- Le son ne démarre qu'après le premier toucher (règle des navigateurs).
- Munitions de réserve illimitées : seul le chargeur compte.
- Pas d'arme au corps à corps.
- L'IA des bots est simple : sur des cartes nouvelles, ils peuvent parfois
  hésiter devant un obstacle compliqué.
