import { Redirect, Slot, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { isConfigured } from '../lib/supabase';
import { SessionProvider, useSession } from '../lib/session';

function Guard() {
  const { session, loading } = useSession();
  const path = usePathname();

  if (!isConfigured) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Configuration manquante</Text>
        <Text>Renseigne EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (voir app/.env.example).</Text>
      </View>
    );
  }
  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!session && path !== '/login') return <Redirect href="/login" />;
  if (session && path === '/login') return <Redirect href="/" />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Guard />
    </SessionProvider>
  );
}
