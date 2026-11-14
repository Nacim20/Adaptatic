package fr.adaptatic.engine;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.OptionalDouble;

/** Lissage et pente du poids : le poids brut fluctue de ±1 kg/jour (eau, sel, transit). */
public final class WeightTrend {

    /** Constante de temps du lissage exponentiel, en jours. */
    static final double TAU_DAYS = 5.0;
    /** Fenêtre de la régression, en jours. */
    public static final int WINDOW_DAYS = 14;
    /** Nombre minimal de pesées dans la fenêtre pour estimer une pente. */
    public static final int MIN_POINTS = 5;

    private WeightTrend() { }

    /** Moyenne exponentielle tenant compte des jours manquants. Liste non vide requise. */
    public static double ema(List<WeightEntry> entries) {
        List<WeightEntry> sorted = entries.stream().sorted(Comparator.comparing(WeightEntry::date)).toList();
        double value = sorted.get(0).kg();
        for (int i = 1; i < sorted.size(); i++) {
            long dt = ChronoUnit.DAYS.between(sorted.get(i - 1).date(), sorted.get(i).date());
            double alpha = 1 - Math.exp(-Math.max(dt, 1) / TAU_DAYS);
            value += alpha * (sorted.get(i).kg() - value);
        }
        return value;
    }

    /** Pente (kg/semaine) par régression linéaire sur les 14 derniers jours jusqu'à today. */
    public static OptionalDouble weeklyRateKg(List<WeightEntry> entries, LocalDate today) {
        LocalDate from = today.minusDays(WINDOW_DAYS - 1L);
        List<WeightEntry> w = entries.stream()
                .filter(e -> !e.date().isBefore(from) && !e.date().isAfter(today)).toList();
        if (w.size() < MIN_POINTS) return OptionalDouble.empty();
        long span = ChronoUnit.DAYS.between(
                w.stream().map(WeightEntry::date).min(Comparator.naturalOrder()).get(),
                w.stream().map(WeightEntry::date).max(Comparator.naturalOrder()).get());
        if (span < 7) return OptionalDouble.empty();

        double n = w.size(), sx = 0, sy = 0, sxy = 0, sxx = 0;
        for (WeightEntry e : w) {
            double x = ChronoUnit.DAYS.between(from, e.date());
            sx += x; sy += e.kg(); sxy += x * e.kg(); sxx += x * x;
        }
        double denom = n * sxx - sx * sx;
        if (denom == 0) return OptionalDouble.empty();
        return OptionalDouble.of((n * sxy - sx * sy) / denom * 7.0);
    }
}
