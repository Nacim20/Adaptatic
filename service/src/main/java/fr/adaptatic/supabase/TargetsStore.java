package fr.adaptatic.supabase;

import fr.adaptatic.engine.AdaptiveState;
import fr.adaptatic.engine.Goal;
import fr.adaptatic.engine.Profile;
import fr.adaptatic.engine.Targets;
import fr.adaptatic.engine.WeightEntry;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Accès aux données. Interface pour pouvoir tester RecomputeService sans réseau. */
public interface TargetsStore {

    Optional<Profile> findProfile(UUID userId);

    /** Pesées les plus récentes (60 jours max), ordre indifférent. */
    List<WeightEntry> recentWeights(UUID userId);

    /** État adaptatif précédent et objectif/rythme avec lesquels il a été calculé. */
    Optional<StoredState> findState(UUID userId);

    void saveTargets(UUID userId, Targets targets, Goal goal, double weeklyRatePct);

    record StoredState(AdaptiveState state, Goal goal, double weeklyRatePct) { }
}
