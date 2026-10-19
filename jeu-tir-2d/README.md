# Jet Arena — prototype de jeu de tir 2D (v0.2)

*(« Jet Arena » est un nom provisoire.)*

Un prototype jouable **dans le navigateur du téléphone** : un personnage avec
jetpack, du tir dans toutes les directions, des parties de 3 minutes contre
des bots, sur 3 cartes, en chacun pour soi, en équipes ou en « Roi de la
colline », avec de la progression (niveaux, missions du jour, styles). Pas de multijoueur pour l'instant : le but est de savoir si le jeu est
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
python3 -m http.server 3400 --bind 0.0.0.0
```

ou, si tu as Node.js installé :

```bash
npx serve -l 3400
```

(Sur Windows, si `python3` n'est pas reconnu, essaie `python` ou `py` à la place.)

Laisse ce terminal ouvert pendant que tu joues. Pour arrêter : `Ctrl + C`.

Le port **3400** a été choisi pour ne pas gêner tes autres projets (3000, 3001,
3100, 3200 et 3300).

Sur l'ordinateur lui-même, tu peux tester en ouvrant : <http://localhost:3400>

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
   `http://ADRESSE-IP:3400` — par exemple `http://192.168.1.23:3400`
3. Tourne le téléphone **en paysage** et touche **JOUER**.

**Ça ne charge pas ?**
- Vérifie que le terminal du serveur est toujours ouvert.
- Vérifie que tu as bien écrit `http://` (pas `https://`) et `:3400`.
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
| **Pouce gauche** sur la moitié gauche | joystick de déplacement |
| Pousser le joystick gauche **vers le haut** | sauter (au sol), puis **jetpack** en maintenant |
| **Pouce droit** sur la moitié droite | joystick de visée |
| Pousser le joystick droit **assez loin** | **tirer** (tant qu'on pousse) |
| Bouton **⇄** | changer d'arme |
| Bouton **R** | recharger |
| Bouton **II** (en haut à droite) | pause |
| Bouton **retour** du téléphone | met en pause (ne quitte pas le jeu) |

Tout se règle dans **Options** (menu principal ou pause) : mode gaucher (côtés
inversés), joysticks fixes ou flottants, sensibilité, aide à la visée, tir automatique.

### Sur ordinateur

| Touche | Action |
|---|---|
| **Q / D** (ou A / D en QWERTY) ou **← →** | se déplacer |
| **Z** (ou W en QWERTY), **↑** ou **Espace** | sauter, puis jetpack en maintenant |
| **Souris** | viser |
| **Clic gauche** maintenu | tirer |
| **R** ou clic droit | recharger |
| **E**, **1**, **2** ou molette | changer d'arme |
| **Échap** ou **P** | pause / retour |

---

## 4. Le menu principal

| Bouton | Ce qu'il fait |
|---|---|
| **Carte** | Entrepôt (nuit), Canyon (grands gouffres), Tours (verticale, beaucoup de vol) |
| **Mode** | Chacun pour soi · Équipes (Bleus contre Rouges, 2 c. 2 ou 3 c. 3 selon le nombre de bots) · Roi de la colline |
| **Difficulté** | Facile, Normal, Difficile : précision, réflexes et agressivité des bots |
| **Bots** | de 3 à 7 |
| **Missions** | les 3 missions du jour et leur avancement |
| **Style** | couleurs, motifs et traînées de jetpack débloqués |
| **Stats** | tes statistiques + la sauvegarde de secours |
| **Options** | tous les réglages (voir plus bas) |

En haut à gauche : ton **niveau** et ta barre d'XP. Tous tes choix sont mémorisés.

---

## 5. Les règles

- **Chacun pour soi** : tout le monde se tire dessus. Classement aux éliminations.
- **Équipes** : les balles traversent tes coéquipiers (pas de tir ami) ; l'équipe
  qui a le plus d'éliminations gagne.
- **Roi de la colline** : une zone ★ COLLINE est dessinée sur la carte. Celui qui
  y est **seul** gagne 1 point par seconde. Zone orange = disputée. Le premier à
  60 points gagne (sinon, le meilleur à la fin des 3 minutes).
- 100 PV. Le jetpack consomme du carburant, qui se recharge **au sol**.
- Tomber dans un trou = mort ; si quelqu'un t'a touché juste avant, c'est lui qui marque.
- Réapparition au bout de **3 secondes**, avec un court moment d'invincibilité.

### Armes

Tu portes **2 armes** : le **fusil auto** (toujours) et une **arme secondaire**
(au départ le fusil à pompe), remplacée en ramassant une **caisse en bois**
(l'abréviation sur la caisse dit l'arme dedans).

| Arme | Caisse | En bref |
|---|---|---|
| Fusil auto | — | rafales rapides, bonne portée |
| Pistolet-mitrailleur | PM | tire très vite, faibles dégâts, courte portée |
| Fusil à pompe | POM | 7 plombs, dévastateur de près |
| Fusil de précision | PRÉ | 70 dégâts, très longue portée, laser rouge, la caméra dézoome |
| Lance-roquettes | ROQ | explose à l'impact, dégâts de zone, forte projection |
| Grenades | GRE | lancer en arc (trajectoire affichée), explosion après 1,8 s |

Les **munitions sont limitées** : chiffre en gros = chargeur, en petit = réserve.
Une arme vide passe automatiquement à l'autre.

### Objets (réapparaissent au même endroit après quelques secondes)

- **Trousse blanche à croix rouge** : +50 PV.
- **Écusson bleu** : bouclier de 50 points (bulle bleue autour du personnage).
- **Caisse verte avec cartouches** : remplit la réserve de munitions des 2 armes.
- **Caisse en bois** : une arme.

### Les bots
Chaque bot a une **personnalité**, indiquée par un symbole devant son nom :
**⚔ Agressif** (fonce, fusil à pompe), **◎ Tireur** (garde ses distances, fusil de
précision), **✚ Prudent** (va se soigner tôt, se replie quand il est blessé).

---

## 6. Ce qui aide à jouer (sensations)

- **Aide à la visée** (téléphone) : la visée glisse un peu vers un ennemi proche du viseur.
- **Tir automatique** (option) : tu tires seul dès qu'un ennemi est dans le viseur.
- **Ligne de visée** en pointillés quand ton pouce vise.
- **Croix de touche** blanche (rouge si élimination), **chiffres de dégâts**.
- **Ralenti très court** quand tu élimines quelqu'un.
- **Flèches rouges** autour de toi : d'où viennent les tirs reçus.
- **Minicarte** : les ennemis n'y apparaissent (en rouge) que s'ils viennent de tirer.
- Tremblement d'écran, flash au canon, douilles, étincelles, sons qui varient légèrement, vibrations.

---

## 7. Options

| Option | Choix |
|---|---|
| Sensibilité visée | Basse / Moyenne / Haute (vitesse à laquelle la visée suit le pouce) |
| Aide à la visée | Désactivée / Faible / Moyenne |
| Tir automatique | Non / Oui |
| Vibrations | Non / Oui (Android ; l'iPhone ne vibre pas dans le navigateur) |
| Volume | 0 à 100 % |
| Tremblement écran | Désactivé / Faible / Normal |
| Mode gaucher | inverse les côtés des joysticks et des boutons |
| Joysticks | Flottants (apparaissent sous le pouce) ou Fixes (toujours au même endroit) |

---

## 8. Progression (pour revenir jouer)

- **XP** à chaque partie **terminée** : participation, éliminations, victoire,
  points de colline, missions. Les **niveaux** montent ; l'écran de fin montre
  la barre qui se remplit et le détail des gains.
- **Missions du jour** : 3 missions tirées au hasard, nouvelles chaque jour à minuit.
- **Style** : couleurs, motifs et traînées de jetpack se débloquent avec les
  niveaux. **Uniquement de l'apparence**, aucun avantage en jeu.
- **Stats** : parties, victoires, éliminations, morts, ratio, meilleure série,
  arme préférée, temps de jeu.
- **Sauvegarde de secours** (écran Stats) : « Exporter » affiche un texte qui
  contient toute ta progression — copie-le dans tes notes ou un e-mail.
  « Importer » le restaure (nouveau téléphone, navigateur vidé…).

Tout est enregistré **sur l'appareil** (rien n'est envoyé sur Internet). Attention :
vider les données du navigateur efface la progression — d'où la sauvegarde de secours.

---

## 9. Journal de bêta (écran caché)

Sur le menu principal, **appuie longuement (1 seconde) sur le titre « JET ARENA »**.
Tu vois, pour cet appareil : nombre de parties lancées, terminées, abandonnées
(et le pourcentage), durées moyennes, parties par mode et par carte, et les
dernières parties. Une partie dont on quitte la page en plein milieu compte comme
abandonnée. Ces chiffres restent sur le téléphone (rien n'est envoyé) ; le bouton
« Effacer » remet le journal à zéro.

---

## 10. Changer l'équilibrage

**Tout se règle dans un seul fichier : `src/config.js`**, commenté en français.
Change un nombre, enregistre, recharge la page.

| Je veux… | Dans `config.js` |
|---|---|
| des bots plus ou moins forts | `difficulties` : `aimError`, `reactionTime`, `damage`, `aggression` |
| changer les caractères des bots | `personalities` (distance préférée, armes, replis…) |
| modifier une arme | son bloc dans `weapons` (`damage`, `fireRate`, `magazine`, `reserve`…) |
| plus ou moins de munitions | `reserve` de chaque arme (`Infinity` = illimité) |
| une explosion plus grosse | `blastRadius` et `knockback` de `rocket` / `grenade` |
| plus de soin / bouclier | `pickups.healthAmount`, `pickups.shieldAmount` |
| des objets qui reviennent plus vite | `pickups.healthRespawn`, `ammoRespawn`, `weaponRespawn`… |
| la colline plus rapide | `hill.pointsPerSecond`, `hill.target` |
| plus ou moins d'XP | `progression.xp`, `levelBase`, `levelStep` |
| d'autres missions | `progression.missions` |
| d'autres styles | `cosmetics` (avec le niveau requis) |
| moins de tremblement / de ralenti | `feel` |
| les valeurs proposées dans Options | `options` |
| moins d'effets (téléphone lent) | `effects.maxParticles` |
| des parties plus courtes | `rules.matchDuration` (secondes) |

Les **cartes** sont dans `src/map.js` (liste `MAPS`) : rectangles, points
d'apparition, objets, zone de colline.

---

## 11. Organisation des fichiers (pour un développeur)

```
jeu-tir-2d/
├── index.html            page unique, balises anti-zoom, manifest, fenêtre de sauvegarde
├── style.css             plein écran, message « tourne ton téléphone »
├── manifest.webmanifest  installation sur l'écran d'accueil
├── icons/                icônes de l'application
└── src/
    ├── main.js      boucle à pas fixe (60/s), caméra, dessin, enchaînement des écrans
    ├── match.js     règles : dégâts, explosions, éliminations, chrono, colline, stats de partie
    ├── config.js    TOUTES les valeurs d'équilibrage
    ├── input.js     clavier / souris / tactile → une « commande » neutre
    ├── player.js    le personnage (physique, jetpack, armes, cosmétiques) — joueur ET bots
    ├── bot.js       IA (personnalités) : fabrique la même commande qu'un joueur
    ├── weapon.js    chargeur, réserve, cadence, rechargement
    ├── bullet.js    projectiles : balles, roquettes, grenades
    ├── pickup.js    objets à ramasser
    ├── map.js       les 3 cartes, ambiances, collisions
    ├── effects.js   particules réutilisées (aucune création pendant le jeu), explosions
    ├── hud.js       interface pendant la partie, joysticks, minicarte
    ├── menus.js     tous les écrans de menu
    ├── ui.js        petits outils de dessin partagés
    ├── options.js   options du joueur
    ├── progress.js  XP, niveaux, missions du jour, cosmétiques, statistiques
    ├── journal.js   journal local anonyme des parties
    ├── backup.js    fenêtre de sauvegarde de secours
    ├── save.js      lecture/écriture protégées sur l'appareil (localStorage)
    └── audio.js     sons Web Audio générés + vibrations
```

**Préparation du multijoueur** : le personnage ne lit jamais l'écran ni le
clavier ; il reçoit une commande `{ moveX, up, aimX, aimY, fire, switchWeapon,
reload }` venant de `input.js` (joueur) ou `bot.js` (bots). La logique tourne à
pas fixe (1/60 s), identique sur tous les appareils.

Aucune dépendance, aucune installation ; il faut juste un serveur web (les
navigateurs refusent les modules JavaScript ouverts en double-cliquant).

### Limites connues
- **iPhone** : pas de vibration ni de vrai plein écran dans le navigateur
  (passer par « Sur l'écran d'accueil »). Le geste de bord d'écran d'iOS ne peut
  pas être bloqué par une page web.
- Le son ne démarre qu'après le premier toucher (règle des navigateurs).
- Pas d'arme au corps à corps.
- L'IA des bots reste simple : sur un parcours compliqué, un bot peut hésiter
  un moment ou, rarement, tomber dans un gouffre.
