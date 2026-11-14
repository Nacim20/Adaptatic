import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ColorValue } from 'react-native';
import { colors } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size} color={color as string} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="imprevu" options={{ title: 'Imprévu', tabBarIcon: icon('flash-outline') }} />
      <Tabs.Screen name="programme" options={{ title: 'Programme', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: icon('restaurant-outline') }} />
    </Tabs>
  );
}
