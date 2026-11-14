package fr.adaptatic.engine;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Données statiques de l'utilisateur. weeklyRatePct = % du poids corporel visé par semaine.
 * timezone : fuseau de l'utilisateur, qui définit ce qu'est « aujourd'hui » pour lui.
 */
public record Profile(Sex sex, LocalDate birthDate, double heightCm,
                      ActivityLevel activity, Goal goal, double weeklyRatePct, ZoneId timezone) {

    /** Fuseau UTC par défaut (profils créés avant l'ajout du fuseau). */
    public Profile(Sex sex, LocalDate birthDate, double heightCm,
                   ActivityLevel activity, Goal goal, double weeklyRatePct) {
        this(sex, birthDate, heightCm, activity, goal, weeklyRatePct, ZoneOffset.UTC);
    }
}
