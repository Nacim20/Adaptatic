package fr.adaptatic;

import static org.junit.jupiter.api.Assertions.*;

import fr.adaptatic.engine.*;
import fr.adaptatic.supabase.TargetsStore;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class RecomputeServiceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-14T10:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 14);

    /** Faux magasin en mémoire. */
    static class FakeStore implements TargetsStore {
        Optional<Profile> profile = Optional.empty();
        List<WeightEntry> weights = List.of();
        Optional<StoredState> state = Optional.empty();
        Targets saved;
        LocalDate lastSince;

        public Optional<Profile> findProfile(UUID u) { return profile; }
        public List<WeightEntry> recentWeights(UUID u, LocalDate since) { lastSince = since; return weights; }
        public Optional<StoredState> findState(UUID u) { return state; }
        public void saveTargets(UUID u, Targets t, Goal g, double pct) { saved = t; }
    }

    private static Profile cut() {
        return new Profile(Sex.MALE, LocalDate.of(2000, 1, 1), 180, ActivityLevel.MODERATE, Goal.CUT, 0.5);
    }

    @Test
    void skipsWhenNoProfile() {
        FakeStore s = new FakeStore();
        s.weights = List.of(new WeightEntry(TODAY, 80));
        assertFalse(new RecomputeService(s, CLOCK).recompute(UUID.randomUUID()));
        assertNull(s.saved);
    }

    @Test
    void skipsWhenNoWeight() {
        FakeStore s = new FakeStore();
        s.profile = Optional.of(cut());
        assertFalse(new RecomputeService(s, CLOCK).recompute(UUID.randomUUID()));
    }

    @Test
    void savesTargetsWhenDataPresent() {
        FakeStore s = new FakeStore();
        s.profile = Optional.of(cut());
        s.weights = List.of(new WeightEntry(TODAY, 80));
        assertTrue(new RecomputeService(s, CLOCK).recompute(UUID.randomUUID()));
        assertNotNull(s.saved);
        assertEquals(0, s.saved.state().offsetKcal());
    }

    @Test
    void goalChangeResetsAdaptiveState() {
        FakeStore s = new FakeStore();
        s.profile = Optional.of(cut());
        s.weights = List.of(new WeightEntry(TODAY, 80));
        // ancien état calculé pour un autre objectif : l'offset -300 doit être abandonné
        s.state = Optional.of(new TargetsStore.StoredState(
                new AdaptiveState(-300, TODAY.minusDays(10), TODAY.minusDays(60)), Goal.BULK, 0.25));
        new RecomputeService(s, CLOCK).recompute(UUID.randomUUID());
        assertEquals(0, s.saved.state().offsetKcal());
        assertEquals(TODAY, s.saved.state().trackingSince());
    }

    @Test
    void todayIsTheUsersLocalDateNotUtc() {
        // 16:00 UTC le 14/11 = 01:00 le 15/11 à Séoul : pour lui, on est déjà le 15.
        Clock utcAfternoon = Clock.fixed(Instant.parse("2026-11-14T16:00:00Z"), ZoneOffset.UTC);
        Profile seoul = new Profile(Sex.MALE, LocalDate.of(2000, 1, 1), 180, ActivityLevel.MODERATE,
                Goal.CUT, 0.5, ZoneId.of("Asia/Seoul"));
        FakeStore s = new FakeStore();
        s.profile = Optional.of(seoul);
        s.weights = List.of(new WeightEntry(LocalDate.of(2026, 11, 15), 80));

        assertTrue(new RecomputeService(s, utcAfternoon).recompute(UUID.randomUUID()));

        assertEquals(LocalDate.of(2026, 11, 15), s.saved.state().trackingSince());
        assertEquals(LocalDate.of(2026, 11, 15).minusDays(60), s.lastSince);
    }

    @Test
    void utcProfileKeepsTheUtcDate() {
        Clock utcAfternoon = Clock.fixed(Instant.parse("2026-11-14T16:00:00Z"), ZoneOffset.UTC);
        FakeStore s = new FakeStore();
        s.profile = Optional.of(cut());
        s.weights = List.of(new WeightEntry(TODAY, 80));

        new RecomputeService(s, utcAfternoon).recompute(UUID.randomUUID());

        assertEquals(TODAY, s.saved.state().trackingSince());
    }
}
