package fr.adaptatic;

import fr.adaptatic.engine.*;
import fr.adaptatic.supabase.TargetsStore;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Orchestration : lit les données, appelle le moteur pur, persiste le résultat. */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecomputeService {

    private final TargetsStore store;
    private final Clock clock;

    /** @return true si des objectifs ont été écrits (false : profil ou pesée manquants). */
    public boolean recompute(UUID userId) {
        LocalDate today = LocalDate.now(clock);
        Optional<Profile> profile = store.findProfile(userId);
        List<WeightEntry> weights = store.recentWeights(userId);
        if (profile.isEmpty() || weights.isEmpty()) {
            log.info("Recalcul ignoré pour {} (profil ou pesée absents)", userId);
            return false;
        }
        Profile p = profile.get();

        // Si l'utilisateur change d'objectif ou de rythme, l'ancienne correction n'a plus de sens.
        AdaptiveState state = store.findState(userId)
                .filter(s -> s.goal() == p.goal() && Math.abs(s.weeklyRatePct() - p.weeklyRatePct()) < 1e-9)
                .map(TargetsStore.StoredState::state)
                .orElseGet(() -> AdaptiveState.fresh(today));

        Targets t = MetabolicEngine.compute(p, weights, state, today);
        store.saveTargets(userId, t, p.goal(), p.weeklyRatePct());
        log.info("Objectifs mis à jour pour {} : {} kcal (offset {})", userId, t.caloriesKcal(), t.state().offsetKcal());
        return true;
    }
}
