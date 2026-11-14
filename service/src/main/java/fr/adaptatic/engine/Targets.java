package fr.adaptatic.engine;

import java.time.LocalDate;

/** Résultat d'un calcul. weeklyRateKg est null tant que les données sont insuffisantes. */
public record Targets(int tdeeKcal, int caloriesKcal, int proteinG, int carbsG, int fatG,
                      double trendWeightKg, Double observedWeeklyRateKg,
                      AdaptiveState state, String note) {

    public LocalDate lastAdjustedOn() { return state.lastAdjustedOn(); }
}
