import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Card, Field, styles } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const { error, data } = mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else if (mode === 'up' && !data.session) setMessage('Compte créé : confirme ton e-mail puis connecte-toi.');
    } catch {
      setMessage('Connexion impossible. Vérifie ta connexion internet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Adaptatic</Text>
        <Text style={styles.subtitle}>Une nutrition qui s'adapte à ta progression réelle.</Text>
        <Card>
          <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none"
            keyboardType="email-address" autoComplete="email" />
          <Field label="Mot de passe (8 caractères min.)" value={password} onChangeText={setPassword}
            secureTextEntry autoComplete="password" />
          {message && <Text style={styles.error}>{message}</Text>}
          <Button title={mode === 'in' ? 'Se connecter' : 'Créer mon compte'} onPress={submit}
            disabled={busy || !email || password.length < 8} />
          <Button secondary title={mode === 'in' ? "Pas de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
            onPress={() => setMode(mode === 'in' ? 'up' : 'in')} />
        </Card>
      </View>
    </ScrollView>
  );
}
