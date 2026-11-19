# Algorithme

Tout est implémenté dans `service/src/main/java/fr/adaptatic/engine/` (fonctions pures).

## 1. Poids lissé (tendance)

Le poids brut varie de ±1 kg d'un jour à l'autre sans rapport avec la masse grasse. On utilise une moyenne exponentielle tenant compte des jours manquants :

`α = 1 − exp(−Δjours / τ)` avec τ = 5 jours, `tendance ← tendance + α·(pesée − tendance)`.

C'est cette tendance, et non la pesée brute, qui alimente les calculs.

## 2. Métabolisme de base et dépense

Équation de **Mifflin-St Jeor** (Mifflin et al., *Am J Clin Nutr*, 1990), identifiée comme la plus fiable des équations de prédiction courantes (Frankenfield et al., *J Am Diet Assoc*, 2005) :

- Homme : `BMR = 10·kg + 6,25·cm − 5·âge + 5`
- Femme : `BMR = 10·kg + 6,25·cm − 5·âge − 161`

`TDEE = BMR × facteur d'activité` : 1,2 · 1,375 · 1,55 · 1,725 · 1,9 (sédentaire → extrêmement actif).

Vérifié par test : homme 80 kg, 180 cm, 30 ans → 1780 kcal ; femme 60 kg, 165 cm, 25 ans → 1345,25 kcal.

## 3. Objectif de départ

Rythme visé en % du poids de corps par semaine (sèche : max 1 %, prise : max 0,5 %). Avec l'approximation classique de **7 700 kcal par kg** de masse corporelle :

`calories = TDEE + (rythme kg/sem × 7700 / 7)`, avec un plancher de 1 500 kcal (homme) / 1 200 kcal (femme).

Limite connue : le 7 700 kcal/kg est une moyenne ; la composition réelle du poids perdu varie (Hall, *Am J Clin Nutr*, 2008). C'est pourquoi l'étape 4 existe : on ne se fie pas à la formule seule, on la **corrige avec les mesures**.

## 4. Correction adaptative

Une fois la période d'observation passée (14 jours) :

1. **Vitesse observée** : régression linéaire des pesées des 14 derniers jours (min. 5 pesées étalées sur ≥ 7 jours), en kg/semaine.
2. **Erreur** = rythme visé − rythme observé.
3. Si `|erreur| ≤ 0,10 kg/sem` : zone morte, rien ne change (évite de réagir au bruit).
4. Sinon : `correction = 0,5 × erreur × 7700 / 7`, arrondie à 10 kcal, **bornée à ±250 kcal par ajustement**, et l'ajustement cumulé reste dans **±500 kcal**.
5. **Délai de 7 jours** entre deux ajustements : le poids met du temps à réagir.

L'ajustement est stocké (`adaptive_offset_kcal`) et réinitialisé si l'utilisateur change d'objectif ou de rythme.

## 5. Macronutriments

1. Protéines : 2,0 g/kg en sèche, 1,8 g/kg sinon (fourchette 1,6–2,2 g/kg, Morton et al., *Br J Sports Med*, 2018).
2. Lipides : max(25 % des calories, 0,6 g/kg).
3. Glucides : le reste des calories.

## 6. Quel jour est « aujourd'hui » ?

Toutes les dates (pesées, période d'observation, délai entre ajustements) sont des **dates locales de l'utilisateur**. L'app envoie la date locale de l'appareil et mémorise son fuseau IANA (`profiles.timezone`) ; le service l'utilise pour calculer « aujourd'hui ». Sans cela, un utilisateur en Asie ou tard le soir en Europe verrait ses pesées rangées au mauvais jour (date UTC). Fuseau absent ou invalide : UTC.

## 7. Journal alimentaire

- **Aliments pour 100 g** : toutes les valeurs sont stockées pour 100 g, la quantité est en grammes. Une « portion » n'est qu'un raccourci vers un nombre de grammes.
- **Copie à l'enregistrement** : chaque entrée de repas garde le nom et les kcal/macros calculés au moment de l'ajout (`kcal = kcal_100 × grammes / 100`, arrondi à 0,1). Modifier ou supprimer un aliment ne réécrit donc jamais l'historique. Le calcul est fait **par la base** (trigger), pas par le client : une valeur envoyée par l'app est ignorée.
- **Cohérence des données saisies** : pour 100 g, protéines + glucides + lipides ≤ 101 g (tolérance d'arrondi des étiquettes), kcal entre 0 et 900. Aucune valeur n'est inventée : en v1 l'utilisateur recopie son étiquette (le catalogue partagé, Open Food Facts et Ciqual, arrive avec le scan de code-barres).
- **Eau** : objectif par défaut 2 000 ml de boissons, modifiable. Repère : l'EFSA (2010) juge adéquats 2,0 L (femmes) et 2,5 L (hommes) d'eau **totale** par jour, aliments compris ; c'est une valeur de population, pas une prescription individuelle.
- **Jour au-dessus de la cible** : l'app l'indique sans alerte ni couleur d'avertissement. Le moteur adaptatif travaille sur la pente du poids sur 14 jours ; un écart isolé est lissé et ne déclenche aucun ajustement (zone morte, §4).
- **Repas proposé à l'ajout rapide** : heuristique d'ergonomie fondée sur l'heure locale (avant 11 h petit-déjeuner, 11-15 h déjeuner, 15-18 h collation, sinon dîner), sans valeur nutritionnelle.

## 8. Scan de code-barres (Open Food Facts)

Un code scanné est d'abord cherché dans le catalogue partagé (cache par code-barres), sinon dans l'API Open Food Facts (OFF) via le service (le navigateur ne peut pas fixer le User-Agent exigé par OFF ; le service applique aussi une limite de 20 requêtes/min par utilisateur). Le produit est ensuite enregistré dans le catalogue partagé.

Règles de conversion (`OffProductMapper`) :
- Les valeurs OFF sont par 100 g. Énergie : `energy-kcal_100g`, sinon kJ ÷ 4,184.
- Protéines, glucides et lipides sont obligatoires ; sinon le produit est refusé (« incomplet »).
- Valeurs refusées comme incohérentes : kcal hors 0–900, macros hors 0–100 g, somme des macros > 101 g.
- Portion : utilisée seulement si 0 < quantité ≤ 5000 ; on suppose 1 ml ≈ 1 g (approximation pour les boissons).

Limites : OFF est une base collaborative, les valeurs peuvent être fausses même si cohérentes ; l'app le rappelle et cite la licence ODbL. Tous les codes n'existent pas dans OFF. La clé de contrôle GS1 est vérifiée côté app avant tout appel. Vérifié en conditions réelles (saisie manuelle sur web et scan caméra sur téléphone, voir README).

## 9. Imprévu

Quand un écart calorique est prévisible (restaurant, voyage, semaine chargée), l'utilisateur le déclare plutôt que de se le voir imposer d'un coup le lendemain.

- **L'écart est l'estimation de l'utilisateur, pas une valeur calculée ou sourcée.** L'app ne propose aucun préréglage du type « un restaurant = +X kcal » : ce serait inventer une statistique sans base. L'utilisateur entre le nombre de kcal qu'il estime lui-même.
- **Lissage, pas correction d'un jour** : la compensation ne s'applique jamais le jour de l'écart lui-même, seulement à partir du lendemain, sur `jours = bornes(⌈écart / 300⌉, 3, 10)` jours (entre 3 et 10 jours, jamais tout sur un seul jour).
- **Plafond de 300 kcal/jour**, quel que soit le nombre d'imprévus actifs cumulés. Un écart énorme (ex. 5 000 kcal) n'est donc pas entièrement compensé dans la fenêtre de 10 jours : l'app l'indique plutôt que de dépasser la borne de sécurité.
- **Un seul imprévu actif à la fois** (v1) : plus simple à comprendre, et la base l'impose (voir `supabase/migrations/20261119000000_calorie_events.sql`).
- Le plancher calorique (§3) reste la protection ultime : même avec un imprévu actif, les calories ne descendent jamais sous 1 500 (homme) / 1 200 (femme).
- Implémenté dans `service/.../engine/EventSpread.java` (fonctions pures, testées indépendamment de l'orchestration).

Limite connue : la fenêtre « un seul à la fois » côté base est une vérification large (10 jours), pas le calcul exact (qui dépend du montant de chaque écart) — volontairement simple plutôt que de dupliquer la formule du moteur en SQL.

Vérifié en conditions réelles (déclaration, règle "un seul actif", annulation, effet sur `nutrition_targets`, contre le vrai Supabase). Non vérifié : le déclenchement *automatique* par le trigger Supabase (webhook via `pg_net` + tunnel public) — simulé manuellement (appel direct à `/webhooks/supabase`) faute de tunnel configuré sur cette machine.

## Limites assumées

- Les estimations dépendent de la régularité des pesées ; peu de données = pas d'ajustement (et l'app le dit).
- Les équations de prédiction ont une erreur individuelle de l'ordre de ±10 % : d'où la correction par les données.
- Pas de gestion de la rétention d'eau cyclique, de la grossesse ou des pathologies.
- Les valeurs nutritionnelles saisies à la main valent ce que vaut l'étiquette recopiée ; les étiquettes ont elles-mêmes une tolérance réglementaire.
