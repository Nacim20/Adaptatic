package fr.adaptatic.engine;

import java.time.LocalDate;
import java.util.List;

/**
 * Lissage d'un imprévu (écart calorique déclaré par l'utilisateur) sur les
 * jours suivants, plutôt qu'une correction d'un seul jour. L'écart est
 * l'estimation de l'utilisateur, jamais une valeur inventée par l'app.
 * Détails et sources : docs/algorithm.md.
 */
public final class EventSpread {

    /** Plafond de compensation par jour, toutes contributions cumulées. */
    static final int MAX_DAILY_KCAL = 300;
    /** Jamais tout reporté sur un seul jour : au moins ce nombre de jours. */
    static final int MIN_SPREAD_DAYS = 3;
    /** Fenêtre maximale ; au-delà, on accepte de ne pas tout compenser plutôt que de dépasser le plafond. */
    public static final int MAX_SPREAD_DAYS = 10;

    private EventSpread() { }

    public record CalorieEvent(LocalDate eventDate, int excessKcal) { }

    /** Nombre de jours sur lesquels un écart est réparti. */
    static int spreadDays(int excessKcal) {
        int days = (int) Math.ceil(excessKcal / (double) MAX_DAILY_KCAL);
        return Math.min(Math.max(days, MIN_SPREAD_DAYS), MAX_SPREAD_DAYS);
    }

    /**
     * Déficit (négatif) à appliquer le jour donné, somme de tous les événements
     * encore actifs, plafonné à MAX_DAILY_KCAL même si ça laisse une partie
     * d'un très gros écart non compensée : on ne dépasse jamais la borne de
     * sécurité, on le dit plutôt (voir MetabolicEngine.compute, note).
     */
    public static int offsetForDate(List<CalorieEvent> events, LocalDate today) {
        double total = 0;
        for (CalorieEvent e : events) {
            int days = spreadDays(e.excessKcal());
            LocalDate start = e.eventDate().plusDays(1); // on ne touche pas le jour de l'écart lui-même
            LocalDate end = e.eventDate().plusDays(days);
            if (today.isBefore(start) || today.isAfter(end)) continue;
            total += e.excessKcal() / (double) days;
        }
        if (total <= 0) return 0;
        int capped = (int) (Math.round(Math.min(total, MAX_DAILY_KCAL) / 5.0) * 5);
        return -capped;
    }
}
