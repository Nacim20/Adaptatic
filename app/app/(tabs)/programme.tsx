import { Screen } from '../../lib/theme';
import { ComingSoon, ScreenHeader } from '../../lib/ui';

export default function Programme() {
  return (
    <Screen>
      <ScreenHeader title="Programme" />
      <ComingSoon
        headline="Ton plan de la semaine"
        description="Tes calories et tes macros jour par jour, réorganisés automatiquement quand un imprévu se présente."
      />
    </Screen>
  );
}
