package fr.adaptatic.engine;

import java.time.LocalDate;

/** Données statiques de l'utilisateur. weeklyRatePct = % du poids corporel visé par semaine. */
public record Profile(Sex sex, LocalDate birthDate, double heightCm,
                      ActivityLevel activity, Goal goal, double weeklyRatePct) { }
