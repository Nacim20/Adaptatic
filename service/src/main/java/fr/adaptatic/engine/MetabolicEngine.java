package fr.adaptatic.engine;

import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.OptionalDouble;

/**
 * Calcul des objectifs nutritionnels. Fonctions pures, sans dépendance Spring :
 * l'horloge (today) est passée en paramètre pour que tout soit testable.
 * Détails et sources : docs/algorithm.md.
 */
public final class MetabolicEngine {

    /** Énergie d'un kg de masse corporelle perdue/gagnée (approximation classique). */
    static final double KCAL_PER_KG = 7700.0;
    static final double MAX_CUT_PCT = 1.0;
    static final double MAX_BULK_PCT = 0.5;
    static final int MIN_KCAL_MALE = 1500;
    static final int MIN_KCAL_FEMALE = 1200;

    /** Réglage adaptatif. */
    static final double DEADBAND_KG_PER_WEEK = 0.10;
    static final double CORRECTION_GAIN = 0.5;
    static final int MAX_STEP_KCAL = 250;
    static final int MAX_OFFSET_KCAL = 500;
    static final int COOLDOWN_DAYS = 7;
    static final int WARMUP_DAYS = 14;

    private MetabolicEngine() { }

    /** Mifflin-St Jeor (1990). */
    public static double bmr(Sex sex, double weightKg, double heightCm, int ageYears) {
        double base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
        return sex == Sex.MALE ? base + 5 : base - 161;
    }

    public static double tdee(double bmr, ActivityLevel level) {
        return bmr * level.multiplier();
    }

    /** Taux visé en kg/semaine (négatif en sèche), après bornes de sécurité. */
    static double targetWeeklyRateKg(Profile p, double weightKg) {
        return switch (p.goal()) {
            case MAINTAIN -> 0.0;
            case CUT -> -Math.min(Math.max(p.weeklyRatePct(), 0), MAX_CUT_PCT) / 100.0 * weightKg;
            case BULK -> Math.min(Math.max(p.weeklyRatePct(), 0), MAX_BULK_PCT) / 100.0 * weightKg;
        };
    }

    public static Targets compute(Profile p, List<WeightEntry> entries, AdaptiveState previous, LocalDate today) {
        if (entries.isEmpty()) throw new IllegalArgumentException("Au moins une pesée est requise");

        double trend = WeightTrend.ema(entries);
        int age = Period.between(p.birthDate(), today).getYears();
        double tdee = tdee(bmr(p.sex(), trend, p.heightCm(), age), p.activity());

        double targetRate = targetWeeklyRateKg(p, trend);
        double baseKcal = tdee + targetRate * KCAL_PER_KG / 7.0;

        // --- Correction adaptative ---
        AdaptiveState state = previous;
        OptionalDouble observed = WeightTrend.weeklyRateKg(entries, today);
        String note = "Objectifs calculés à partir de ton profil et de ton poids lissé.";

        boolean warmedUp = !today.isBefore(state.trackingSince().plusDays(WARMUP_DAYS));
        boolean cooledDown = state.lastAdjustedOn() == null
                || !today.isBefore(state.lastAdjustedOn().plusDays(COOLDOWN_DAYS));

        if (observed.isEmpty()) {
            note = "Pas assez de pesées récentes (5 sur 14 jours, étalées sur 7 jours) pour ajuster.";
        } else if (!warmedUp) {
            note = "Période d'observation : l'ajustement automatique démarre après 14 jours de suivi.";
        } else if (!cooledDown) {
            note = "Ajustement récent : on laisse le temps au poids de réagir.";
        } else {
            double error = targetRate - observed.getAsDouble(); // >0 : on perd trop / gagne trop peu
            if (Math.abs(error) > DEADBAND_KG_PER_WEEK) {
                int step = (int) Math.round(error * KCAL_PER_KG / 7.0 * CORRECTION_GAIN / 10.0) * 10;
                step = Math.max(-MAX_STEP_KCAL, Math.min(MAX_STEP_KCAL, step));
                int offset = Math.max(-MAX_OFFSET_KCAL, Math.min(MAX_OFFSET_KCAL, state.offsetKcal() + step));
                if (offset != state.offsetKcal()) {
                    state = new AdaptiveState(offset, today, state.trackingSince());
                    note = String.format("Ajustement de %+d kcal : tendance observée %.2f kg/sem pour %.2f visés.",
                            offset - previous.offsetKcal(), observed.getAsDouble(), targetRate);
                } else {
                    note = "Limite d'ajustement atteinte : vérifie la régularité de tes pesées et de ton suivi.";
                }
            } else {
                note = "Tu es sur la bonne trajectoire : aucun ajustement nécessaire.";
            }
        }

        int floor = p.sex() == Sex.MALE ? MIN_KCAL_MALE : MIN_KCAL_FEMALE;
        int calories = (int) Math.max(floor, Math.round((baseKcal + state.offsetKcal()) / 5.0) * 5);

        // --- Macros : protéines et lipides d'abord, glucides = reste ---
        double proteinPerKg = p.goal() == Goal.CUT ? 2.0 : 1.8;
        int protein = (int) Math.round(proteinPerKg * trend);
        int fat = (int) Math.round(Math.max(0.25 * calories / 9.0, 0.6 * trend));
        int carbs = (int) Math.max(0, Math.round((calories - protein * 4.0 - fat * 9.0) / 4.0));

        return new Targets((int) Math.round(tdee), calories, protein, carbs, fat, trend,
                observed.isPresent() ? observed.getAsDouble() : null, state, note);
    }
}
