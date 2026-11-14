import { Screen } from '../../lib/theme';
import { ComingSoon, ScreenHeader } from '../../lib/ui';

export default function Nutrition() {
  return (
    <Screen>
      <ScreenHeader title="Nutrition" />
      <ComingSoon
        headline="Journal alimentaire"
        description="Repas, calories et macros, scan de code-barres, favoris et suivi de l'eau."
      />
    </Screen>
  );
}
