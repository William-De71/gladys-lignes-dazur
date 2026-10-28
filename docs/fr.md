# Lignes d'Azur Nice

## Présentation

Cette intégration amène **Lignes d’Azur**, les trams et bus de la Métropole Nice Côte d’Azur, dans Gladys. Elle donne les **prochains départs, corrigés en temps réel, avec leur retard**, aux arrêts de votre choix (trois dans le formulaire, jusqu’à 10 de plus avec un bouton), filtrés par ligne et par direction. Chaque arrêt devient un appareil à afficher sur un tableau de bord et à utiliser dans les scènes, et les **courses supprimées** sont signalées.

Les données viennent de l’**open data officiel de Lignes d’Azur**, publié sur `transport.data.gouv.fr` sous Licence Ouverte 2.0 (Etalab) : ni compte, ni clé. Les **horaires** (GTFS) sont téléchargés une fois par jour s’ils ont changé, et gardés par l’intégration. Le **temps réel** (GTFS-RT) de tout le réseau est lu en **une seule requête pour tous les arrêts suivis**, toutes les minutes par défaut (toutes les 10 minutes tant qu’aucun arrêt n’annonce rien dans la demi-heure, la nuit).

Un départ est **suivi en temps réel** un peu avant de quitter son terminus : son heure estimée et son retard sont donnés. Avant, ce sont les **horaires**, marqués « (théorique) ». Les trams circulent à la fréquence : le temps réel les annonce souvent quelques minutes avant l’horaire, et ne donne alors pas de retard.

Lignes d’Azur ne publie **aucune info trafic** en open data (pas d’alerte dans le GTFS-RT, aucune dans son flux SIRI) : l’intégration n’affiche pas le trafic des lignes.

C’est une intégration **cloud** : elle contacte `chouette.enroute.mobi` (horaires) et `ara-api.enroute.mobi` (temps réel), les serveurs open data du réseau. Rien d’autre ne quitte votre réseau.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Rien d’autre : l’open data de Lignes d’Azur ne demande ni compte ni clé.

## Configuration

| Champ                 | Quoi saisir                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Arrêt 1, 2, 3         | Le nom de l’arrêt tel qu’écrit dessus (« Masséna », « Gare Thiers / Poste ») ou le code d’un quai (« MASSE2 »).         |
| Ligne                 | Seulement cette ligne : « L1 », « tram 2 », « 5 », « Exp2 ». Vide : toutes les lignes de l’arrêt.                       |
| Direction             | Seulement les destinations contenant ces mots : « Hôpital Pasteur », « Aéroport \| Port Lympia ». Vide : les deux sens. |
| Lecture du temps réel | Toutes les 30 secondes, minutes, 2 minutes ou 5 minutes.                                                                |
| Langue des textes     | Noms des appareils, résumés et sorties des scènes. Les noms d’arrêts et les destinations restent en français.           |

Un arrêt regroupe les quais d’un même nom au même endroit, trams et bus : « Jean Médecin » donne les deux sens des trams L1, L2 et L3 et les bus qui y passent. Le même nom à deux endroits (comme « Le Château » à Nice et à Cagnes-sur-Mer) fait deux arrêts : saisissez alors le code d’un de ses quais. Le bouton **Chercher un arrêt** donne les arrêts contenant quelques mots, avec les codes de leurs quais et leurs lignes (« Masséna [MASSE0, MASSE2, MASSV7] → L1, 8+, 12+, Exp3 »). Quelques mots suffisent quand un seul arrêt les contient. **Tester la connexion** redemande les horaires et lit aussitôt chaque arrêt.

Une ligne s’écrit comme sur le véhicule : « L1 », « L2 », « L3 » et « B » pour les trams (« tram 1 » ou « T1 » marchent aussi), « 5 », « 8+ », « Exp2 », « C »…

Plus d’arrêts que les trois du formulaire (maison, travail, école…) : **Ajouter un arrêt** prend les trois mêmes champs — arrêt, ligne, direction — et suit jusqu’à 10 arrêts de plus. **Lister les arrêts** montre tous les arrêts suivis, numérotés ; **Retirer un arrêt** prend ce numéro (ou le nom). Les arrêts ajoutés sont gardés dans la configuration de Gladys et suivent donc ses sauvegardes.

## Utilisation

### Appareils

Dans l’onglet **Découvrir**, créez les appareils voulus. **Lignes d’Azur \<arrêt\>** donne le prochain départ en texte (« L1 → Hôpital Pasteur · 3 min (+2 min de retard) »), l’attente du prochain départ et du suivant (minutes) et le retard du prochain (minutes, publié seulement s’il est suivi en temps réel ; un départ annoncé en avance compte 0).

La nuit, sans départ dans les trois heures, l’appareil montre le premier départ du matin.

### Widget du tableau de bord

![Le widget des départs Lignes d’Azur à Jean Médecin et à plusieurs arrêts (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-lignes-dazur/main/docs/assets/widgets.fr.png)

**Départs Lignes d’Azur** montre les prochains départs d’un arrêt, en compact. Une ligne par ligne et destination, avec ses prochains départs à la suite (« 2 · 17 min »). Une course supprimée est affichée (« supprimé 10:48 ») et passe la ligne en orange, comme un retard de 5 minutes ou plus. Le réglage **Trajets affichés** fixe le nombre de lignes. Choisissez un arrêt suivi, ou saisissez n’importe quel arrêt (et une ligne) dans les réglages du widget. Avec **Plusieurs arrêts**, un widget montre plusieurs appareils d’arrêt : les appareils d’un même arrêt sont fusionnés sous son nom ; pour des arrêts différents, chacun commence par une ligne à son nom.

### Scènes

Déclencheurs, une fois par changement (la première lecture sert seulement de référence) :

- **Lignes d’Azur : départ bientôt** : un départ à un arrêt suivi part dans 2, 3, 5, 10, 15 ou 20 minutes, compté sur son heure estimée en temps réel.
- **Lignes d’Azur : départ supprimé** : une course de l’heure à venir à un arrêt suivi est supprimée, ou ne dessert pas l’arrêt.

Chacun donne une phrase toute prête, `{{triggerEvent.data.summary}}`, et ses valeurs (ligne, destination, heure, retard…). L’action **Lignes d’Azur : prochains départs** renvoie le même genre de valeurs, à mettre dans un message ou à tester dans une condition.

Exemples :

- Quand le tram L1 vers Hôpital Pasteur part de Masséna dans 5 minutes → passer la lampe de l’entrée en vert.
- Quand un départ de votre arrêt est supprimé → envoyer le résumé sur votre téléphone avant de partir.
- Chaque jour de semaine à 7 h 30 → lire les prochains départs de votre arrêt et les faire annoncer par l’enceinte de la cuisine.

### Transport

Cloud uniquement : les données viennent d’internet. Les horaires une fois par jour, le temps réel de tout le réseau en une requête.

## Dépannage

- **« Inconnu ou ambigu »** : utilisez **Chercher un arrêt**, puis copiez le nom exact ou un code de quai (un nom présent à deux endroits demande un code de quai) ; pour une ligne, son nom comme sur le véhicule (« L1 », « 5 », « Exp2 »).
- **« (théorique) » pour un départ** : la course n’est pas encore suivie en temps réel (elle n’a pas quitté son terminus), ou Lignes d’Azur ne la suit pas ; l’heure est celle des horaires.
- **Un tram plus tôt que l’horaire** : les trams circulent à la fréquence, et le temps réel donne l’heure du tram qui arrive vraiment ; le retard reste alors à 0.
- **Aucun départ dans la direction saisie** : les destinations sont celles écrites sur les véhicules (« Hôpital Pasteur », « Henri Sappia », « CADAM / Centre Administratif ») ; videz la direction pour toutes les voir.
- **Pas de trafic des lignes** : Lignes d’Azur ne publie pas d’alerte trafic en open data ; voir lignesdazur.com.
- **« L’open data de Lignes d’Azur ne répond pas »** : l’intégration réessaie à chaque lecture ; en attendant, les départs viennent des horaires gardés.
- **Pour signaler un problème** : appuyez sur **Diagnostic**, puis copiez les lignes commençant par « Lignes d’Azur diagnostic » de l’onglet Journaux dans une issue GitHub ou une réponse sur le forum, avec les versions de Gladys et de l’intégration.
