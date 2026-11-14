import { Screen } from '../../lib/theme';
import { ComingSoon, ScreenHeader } from '../../lib/ui';

export default function Imprevu() {
  return (
    <Screen>
      <ScreenHeader title="Imprévu" />
      <ComingSoon
        headline="Signaler un imprévu"
        description="Restaurant, écart, voyage, semaine chargée… Tu le déclares ici et ton plan des prochains jours s'ajuste, avec l'explication de chaque décision. Sans culpabilité, sans double effort le lendemain."
      />
    </Screen>
  );
}
