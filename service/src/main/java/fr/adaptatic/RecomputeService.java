package fr.adaptatic;

import fr.adaptatic.engine.*;
import fr.adaptatic.engine.EventSpread.CalorieEvent;
import fr.adaptatic.supabase.TargetsStore;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Orchestration : lit les données, appelle le moteur pur, persiste ou projette le résultat. */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecomputeService {

    /** Historique de pesées lu pour le calcul. */
    static final int WEIGHT_HISTORY_DAYS = 60;

    private final TargetsStore store;
    private final Clock clock;

    private record Inputs(Profile profile, List<WeightEntry> weights, AdaptiveState state,
                           List<CalorieEvent> events, LocalDate today) { }

    public record ForecastDay(LocalDate date, Targets targets) { }

    /** Charge tout ce dont le moteur a besoin, ou vide si le profil ou les pesées manquent. */
    private Optional<Inputs> loadInputs(UUID userId) {
        Optional<Profile> profile = store.findProfile(userId);
        if (profile.isEmpty()) {
            log.info("Lecture ignorée pour {} (profil absent)", userId);
            return Optional.empty();
        }
        Profile p = profile.get();
        // « Aujourd'hui » = la date locale de l'utilisateur, pas celle du serveur (UTC).
        LocalDate today = LocalDate.now(clock.withZone(p.timezone()));
        List<WeightEntry> weights = store.recentWeights(userId, today.minusDays(WEIGHT_HISTORY_DAYS));
        if (weights.isEmpty()) {
            log.info("Lecture ignorée pour {} (pesée absente)", userId);
            return Optional.empty();
        }
        List<CalorieEvent> events = store.recentEvents(userId, today.minusDays(EventSpread.MAX_SPREAD_DAYS));

        // Si l'utilisateur change d'objectif ou de rythme, l'ancienne correction n'a plus de sens.
        AdaptiveState state = store.findState(userId)
                .filter(s -> s.goal() == p.goal() && Math.abs(s.weeklyRatePct() - p.weeklyRatePct()) < 1e-9)
                .map(TargetsStore.StoredState::state)
                .orElseGet(() -> AdaptiveState.fresh(today));

        return Optional.of(new Inputs(p, weights, state, events, today));
    }

    /** @return true si des objectifs ont été écrits (false : profil ou pesée manquants). */
    public boolean recompute(UUID userId) {
        Optional<Inputs> loaded = loadInputs(userId);
        if (loaded.isEmpty()) return false;
        Inputs in = loaded.get();

        Targets t = MetabolicEngine.compute(in.profile(), in.weights(), in.state(), in.today(), in.events());
        store.saveTargets(userId, t, in.profile().goal(), in.profile().weeklyRatePct());
        log.info("Objectifs mis à jour pour {} : {} kcal (offset {})", userId, t.caloriesKcal(), t.state().offsetKcal());
        return true;
    }

    /**
     * Projection jour par jour (pour la vue "Programme"), sans rien écrire en base. Chaque jour est
     * calculé indépendamment à partir des mêmes pesées et du même état adaptatif qu'aujourd'hui (on
     * n'a pas de pesées futures) : seul l'effet d'un imprévu actif varie réellement jour après jour.
     * Vide si le profil ou les pesées manquent.
     */
    public Optional<List<ForecastDay>> forecast(UUID userId, int days) {
        Optional<Inputs> loaded = loadInputs(userId);
        if (loaded.isEmpty()) return Optional.empty();
        Inputs in = loaded.get();

        List<ForecastDay> out = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate date = in.today().plusDays(i);
            out.add(new ForecastDay(date, MetabolicEngine.compute(in.profile(), in.weights(), in.state(), date, in.events())));
        }
        return Optional.of(out);
    }
}
