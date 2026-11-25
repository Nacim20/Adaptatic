import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { searchExercises } from '../lib/workout';
import { useSession } from '../lib/session';
import { Button, Card, Field, Screen, Text, colors, styles } from '../lib/theme';
import { Exercise, WorkoutTemplate } from '../lib/types';
import { BackHeader } from '../lib/ui';
import { createTemplate, deleteTemplate, fetchTemplateExercises, fetchTemplates } from '../lib/workout';

interface DraftExercise { exerciseId: string | null; name: string }

export default function Templates() {
  const { session } = useSession();
  const uid = session?.user.id;

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [expanded, setExpanded] = useState<Record<string, Exercise[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<DraftExercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    if (!uid) return;
    fetchTemplates(uid).then(setTemplates).catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'));
  }
  useEffect(load, [uid]);

  useEffect(() => {
    if (!uid) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      searchExercises(uid, q).then(setResults).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [query, uid]);

  async function toggleExpand(t: WorkoutTemplate) {
    if (expanded[t.id]) { setExpanded((p) => ({ ...p, [t.id]: undefined })); return; }
    const exos = await fetchTemplateExercises(t.id);
    setExpanded((p) => ({ ...p, [t.id]: exos.map((e) => ({ id: e.exercise_id ?? '', owner_id: '', name: e.exercise_name })) }));
  }

  function addToDraft(name: string, exerciseId: string | null) {
    setDraft((prev) => [...prev, { exerciseId, name }]);
    setQuery('');
    setResults([]);
  }

  async function save() {
    if (!uid || busy) return;
    if (!name.trim()) return setError('Donne un nom à la séance');
    if (draft.length === 0) return setError('Ajoute au moins un exercice');
    setBusy(true);
    setError(null);
    try {
      await createTemplate(uid, { name: name.trim(), exercises: draft.map((d) => ({ exerciseId: d.exerciseId, name: d.name })) });
      setName(''); setDraft([]); setCreating(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteTemplate(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  }

  if (creating) {
    return (
      <Screen>
        <BackHeader title="Nouvelle séance" />
        <Card>
          <Field label="Nom de la séance (ex. Push Day)" value={name} onChangeText={setName} />

          {draft.map((d, i) => (
            <View key={i} style={[styles.row, { alignItems: 'center', paddingVertical: 6 }]}>
              <Text style={{ flex: 1 }}>{i + 1}. {d.name}</Text>
              <Pressable onPress={() => setDraft((prev) => prev.filter((_, idx) => idx !== i))}>
                <Text style={{ color: colors.muted }}>✕</Text>
              </Pressable>
            </View>
          ))}

          <Field label="Ajouter un exercice (2 lettres minimum)" value={query} onChangeText={setQuery} autoCapitalize="none" />
          {query.trim().length >= 2 && results.length === 0 && (
            <Pressable onPress={() => addToDraft(query.trim(), null)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Créer "{query.trim()}"</Text>
            </Pressable>
          )}
          {results.map((ex) => (
            <Pressable key={ex.id} onPress={() => addToDraft(ex.name, ex.id)}
              style={{ backgroundColor: colors.cardAlt, borderRadius: 12, padding: 10, marginBottom: 6 }}>
              <Text>{ex.name}</Text>
            </Pressable>
          ))}

          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Créer la séance" onPress={save} disabled={busy} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title="Tes séances" />
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 14 }}>
        Crée tes séances types (liste d'exercices) à l'avance, tu n'as plus qu'à les sélectionner le jour venu.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {templates.map((t) => (
        <Card key={t.id}>
          <Pressable onPress={() => toggleExpand(t)} style={[styles.row, { alignItems: 'center' }]}>
            <Text style={{ fontWeight: '700', fontSize: 15 }}>{t.name}</Text>
            <Pressable onPress={() => remove(t.id)} hitSlop={10}>
              <Text style={{ color: colors.muted }}>Supprimer</Text>
            </Pressable>
          </Pressable>
          {expanded[t.id] && (
            <View style={{ marginTop: 8 }}>
              {expanded[t.id]!.map((e, i) => (
                <Text key={i} style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{i + 1}. {e.name}</Text>
              ))}
            </View>
          )}
        </Card>
      ))}

      <Button title="Créer une séance" onPress={() => setCreating(true)} />
    </Screen>
  );
}
