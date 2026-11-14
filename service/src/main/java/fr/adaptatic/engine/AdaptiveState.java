package fr.adaptatic.engine;

import java.time.LocalDate;

/** État persisté de la correction adaptative. lastAdjustedOn peut être null. */
public record AdaptiveState(int offsetKcal, LocalDate lastAdjustedOn, LocalDate trackingSince) {

    public static AdaptiveState fresh(LocalDate today) {
        return new AdaptiveState(0, null, today);
    }
}
