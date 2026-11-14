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

## Limites assumées

- Les estimations dépendent de la régularité des pesées ; peu de données = pas d'ajustement (et l'app le dit).
- Les équations de prédiction ont une erreur individuelle de l'ordre de ±10 % : d'où la correction par les données.
- Pas de gestion de la rétention d'eau cyclique, de la grossesse ou des pathologies.
