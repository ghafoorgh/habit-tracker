import { Link, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { StatsIcon, TodayIcon } from '../../components/TabIcons';
import { useTheme } from '../../lib/theme';

function AddButton() {
  const theme = useTheme();
  return (
    <Link href="/habit/new" asChild>
      <Pressable hitSlop={12} style={styles.add} accessibilityLabel="Add habit">
        <Text style={[styles.addText, { color: theme.primary }]}>＋</Text>
      </Pressable>
    </Link>
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        headerRight: () => <AddButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color }) => <TodayIcon color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: ({ color }) => <StatsIcon color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  add: { paddingHorizontal: 16 },
  addText: { fontSize: 26, fontWeight: '500' },
});
