import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSession } from '../lib/session';
import { Button, Card, Field, Screen, Text, colors, styles } from '../lib/theme';
import { Exercise, WorkoutTemplate, WorkoutTemplateExercise } from '../lib/types';
import { BackHeader } from '../lib/ui';
import {
  createTemplate, deleteTemplate, fetchTemplateExercises, fetchTemplates,
  searchExercises, updateTemplateExerciseTarget,
} from '../lib/workout';

interface DraftExercise { exerciseId: string | null; name: string; targetSets: string; targetReps: string }

function parseTarget(s: string): number | null {
  const n = Math.round(Number(s));
  return s.trim() && Number.isFinite(n) ? n : null;
}

export default function Templates() {
  const { session } = useSession();
  const uid = session?.user.id;

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [expanded, setExpanded] = useState<Record<string, WorkoutTemplateExercise[] | undefined>>({});
  const [editing, setEditing] = useState<string | null>(null); // id d'un WorkoutTemplateExercise
  const [editSets, setEditSets] = useState('');
  const [editReps, setEditReps] = useState('');
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
    setExpanded((p) => ({ ...p, [t.id]: exos }));
  }

  function startEdit(te: WorkoutTemplateExercise) {
    setEditing(te.id);
    setEditSets(te.target_sets != null ? String(te.target_sets) : '');
    setEditReps(te.target_reps != null ? String(te.target_reps) : '');
  }

  async function saveEdit(templateId: string) {
    if (!editing) return;
    try {
      await updateTemplateExerciseTarget(editing, parseTarget(editSets), parseTarget(editReps));
      const exos = await fetchTemplateExercises(templateId);
      setExpanded((p) => ({ ...p, [templateId]: exos }));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour impossible');
    }
  }

  function addToDraft(name: string, exerciseId: string | null) {
    setDraft((prev) => [...prev, { exerciseId, name, targetSets: '', targetReps: '' }]);
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
      await createTemplate(uid, {
        name: name.trim(),
        exercises: draft.map((d) => ({
          exerciseId: d.exerciseId, name: d.name,
          targetSets: parseTarget(d.targetSets), targetReps: parseTarget(d.targetReps),
        })),
      });
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
            <View key={i} style={{ paddingVertical: 6, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
              <View style={[styles.row, { alignItems: 'center' }]}>
                <Text style={{ flex: 1 }}>{i + 1}. {d.name}</Text>
                <Pressable onPress={() => setDraft((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Text style={{ color: colors.muted }}>✕</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Séries (optionnel)" value={d.targetSets} keyboardType="numeric"
                    onChangeText={(v) => setDraft((prev) => prev.map((x, idx) => idx === i ? { ...x, targetSets: v } : x))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Répétitions (optionnel)" value={d.targetReps} keyboardType="numeric"
                    onChangeText={(v) => setDraft((prev) => prev.map((x, idx) => idx === i ? { ...x, targetReps: v } : x))} />
                </View>
              </View>
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
        Crée tes séances types (liste d'exercices, objectif séries/répétitions optionnel) à l'avance,
        tu n'as plus qu'à les sélectionner le jour venu.
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
              {expanded[t.id]!.map((te, i) => (
                <View key={te.id}>
                  <Pressable onPress={() => (editing === te.id ? setEditing(null) : startEdit(te))}
                    style={[styles.row, { paddingVertical: 4 }]}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>{i + 1}. {te.exercise_name}</Text>
                    <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: '600' }}>
                      {te.target_sets && te.target_reps ? `${te.target_sets}×${te.target_reps}` : 'Définir'}
                    </Text>
                  </Pressable>
                  {editing === te.id && (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}><Field label="Séries" value={editSets} onChangeText={setEditSets} keyboardType="numeric" /></View>
                      <View style={{ flex: 1 }}><Field label="Répétitions" value={editReps} onChangeText={setEditReps} keyboardType="numeric" /></View>
                      <Pressable onPress={() => saveEdit(t.id)} style={{ paddingBottom: 14 }}>
                        <Text style={{ color: colors.primary, fontWeight: '700' }}>OK</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </Card>
      ))}

      <Button title="Créer une séance" onPress={() => setCreating(true)} />
    </Screen>
  );
}
