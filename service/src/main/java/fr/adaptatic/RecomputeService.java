package fr.adaptatic;

import fr.adaptatic.engine.*;
import fr.adaptatic.engine.EventSpread.CalorieEvent;
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

    /** Historique de pesées lu pour le calcul. */
    static final int WEIGHT_HISTORY_DAYS = 60;

    private final TargetsStore store;
    private final Clock clock;

    /** @return true si des objectifs ont été écrits (false : profil ou pesée manquants). */
    public boolean recompute(UUID userId) {
        Optional<Profile> profile = store.findProfile(userId);
        if (profile.isEmpty()) {
            log.info("Recalcul ignoré pour {} (profil absent)", userId);
            return false;
        }
        Profile p = profile.get();
        // « Aujourd'hui » = la date locale de l'utilisateur, pas celle du serveur (UTC).
        LocalDate today = LocalDate.now(clock.withZone(p.timezone()));
        List<WeightEntry> weights = store.recentWeights(userId, today.minusDays(WEIGHT_HISTORY_DAYS));
        if (weights.isEmpty()) {
            log.info("Recalcul ignoré pour {} (pesée absente)", userId);
            return false;
        }
        List<CalorieEvent> events = store.recentEvents(userId, today.minusDays(EventSpread.MAX_SPREAD_DAYS));

        // Si l'utilisateur change d'objectif ou de rythme, l'ancienne correction n'a plus de sens.
        AdaptiveState state = store.findState(userId)
                .filter(s -> s.goal() == p.goal() && Math.abs(s.weeklyRatePct() - p.weeklyRatePct()) < 1e-9)
                .map(TargetsStore.StoredState::state)
                .orElseGet(() -> AdaptiveState.fresh(today));

        Targets t = MetabolicEngine.compute(p, weights, state, today, events);
        store.saveTargets(userId, t, p.goal(), p.weeklyRatePct());
        log.info("Objectifs mis à jour pour {} : {} kcal (offset {})", userId, t.caloriesKcal(), t.state().offsetKcal());
        return true;
    }
}
