package fr.adaptatic.engine;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MetabolicEngineTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 14);

    private static Profile profile(Goal goal, double pct) {
        return new Profile(Sex.MALE, LocalDate.of(2000, 3, 1), 180, ActivityLevel.MODERATE, goal, pct);
    }

    /** n pesées quotidiennes finissant aujourd'hui, avec une pente en kg/semaine. */
    private static List<WeightEntry> series(int days, double endKg, double slopePerWeek) {
        List<WeightEntry> l = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            l.add(new WeightEntry(TODAY.minusDays(i), endKg - slopePerWeek / 7.0 * i));
        }
        return l;
    }

    @Test
    void bmrMatchesMifflinStJeorReferenceValues() {
        assertEquals(1780.0, MetabolicEngine.bmr(Sex.MALE, 80, 180, 30), 1e-9);
        assertEquals(1345.25, MetabolicEngine.bmr(Sex.FEMALE, 60, 165, 25), 1e-9);
    }

    @Test
    void tdeeAppliesActivityMultiplier() {
        assertEquals(1780 * 1.55, MetabolicEngine.tdee(1780, ActivityLevel.MODERATE), 1e-9);
    }

    @Test
    void cutGivesDeficitAndMaintainGivesTdee() {
        List<WeightEntry> w = series(1, 80, 0);
        Targets maintain = MetabolicEngine.compute(profile(Goal.MAINTAIN, 0), w, AdaptiveState.fresh(TODAY), TODAY);
        Targets cut = MetabolicEngine.compute(profile(Goal.CUT, 0.5), w, AdaptiveState.fresh(TODAY), TODAY);
        assertEquals(maintain.tdeeKcal(), maintain.caloriesKcal(), 3);
        // 0,5 % de 80 kg = 0,4 kg/sem -> 0,4*7700/7 = 440 kcal/jour
        assertEquals(maintain.caloriesKcal() - 440, cut.caloriesKcal(), 5);
    }

    @Test
    void weeklyRateIsCappedForSafety() {
        List<WeightEntry> w = series(1, 80, 0);
        Targets aggressive = MetabolicEngine.compute(profile(Goal.CUT, 5.0), w, AdaptiveState.fresh(TODAY), TODAY);
        Targets max = MetabolicEngine.compute(profile(Goal.CUT, 1.0), w, AdaptiveState.fresh(TODAY), TODAY);
        assertEquals(max.caloriesKcal(), aggressive.caloriesKcal());
    }

    @Test
    void caloriesNeverGoBelowFloor() {
        Profile tiny = new Profile(Sex.FEMALE, LocalDate.of(1960, 1, 1), 150, ActivityLevel.SEDENTARY, Goal.CUT, 1.0);
        Targets t = MetabolicEngine.compute(tiny, series(1, 45, 0), AdaptiveState.fresh(TODAY), TODAY);
        assertTrue(t.caloriesKcal() >= 1200);
    }

    @Test
    void macrosAddUpToCalories() {
        Targets t = MetabolicEngine.compute(profile(Goal.CUT, 0.5), series(1, 80, 0), AdaptiveState.fresh(TODAY), TODAY);
        int total = t.proteinG() * 4 + t.carbsG() * 4 + t.fatG() * 9;
        assertEquals(t.caloriesKcal(), total, 12);
        assertEquals(160, t.proteinG(), 1); // 2,0 g/kg en sèche
    }

    @Test
    void noAdjustmentDuringWarmup() {
        AdaptiveState s = new AdaptiveState(0, null, TODAY.minusDays(5));
        Targets t = MetabolicEngine.compute(profile(Goal.CUT, 0.5), series(14, 80, -0.0), s, TODAY);
        assertEquals(0, t.state().offsetKcal());
    }

    @Test
    void reducesCaloriesWhenLosingTooLittle() {
        // cible -0,4 kg/sem, observé 0 -> erreur -> moins de calories
        AdaptiveState s = new AdaptiveState(0, null, TODAY.minusDays(30));
        Targets t = MetabolicEngine.compute(profile(Goal.CUT, 0.5), series(14, 80, 0.0), s, TODAY);
        assertTrue(t.state().offsetKcal() < 0);
        assertEquals(TODAY, t.state().lastAdjustedOn());
    }

    @Test
    void increasesCaloriesWhenLosingTooFast() {
        AdaptiveState s = new AdaptiveState(0, null, TODAY.minusDays(30));
        Targets t = MetabolicEngine.compute(profile(Goal.CUT, 0.5), series(14, 80, -1.2), s, TODAY);
        assertTrue(t.state().offsetKcal() > 0);
    }

    @Test
    void doesNothingInsideDeadband() {
        AdaptiveState s = new AdaptiveState(0, null, TODAY.minusDays(30));
        Targets t = MetabolicEngine.compute(profile(Goal.CUT, 0.5), series(14, 80, -0.38), s, TODAY);
        assertEquals(0, t.state().offsetKcal());
    }

    @Test
    void cooldownBlocksSecondAdjustment() {
        AdaptiveState s = new AdaptiveState(-100, TODAY.minusDays(3), TODAY.minusDays(30));
        Targets t = MetabolicEngine.compute(profile(Goal.CUT, 0.5), series(14, 80, 0.0), s, TODAY);
        assertEquals(-100, t.state().offsetKcal());
    }

    @Test
    void adjustmentStepAndTotalOffsetAreBounded() {
        AdaptiveState s = new AdaptiveState(-450, TODAY.minusDays(10), TODAY.minusDays(60));
        Targets t = MetabolicEngine.compute(profile(Goal.CUT, 1.0), series(14, 80, 2.0), s, TODAY);
        assertTrue(t.state().offsetKcal() >= -500);
        assertTrue(Math.abs(t.state().offsetKcal() - (-450)) <= 250);
    }

    @Test
    void emptyWeightListIsRejected() {
        assertThrows(IllegalArgumentException.class, () ->
                MetabolicEngine.compute(profile(Goal.CUT, 0.5), List.of(), AdaptiveState.fresh(TODAY), TODAY));
    }
}
