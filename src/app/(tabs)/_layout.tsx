import { Link, Tabs } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatsIcon, TodayIcon } from '../../components/TabIcons';
import { Text } from '../../components/Text';
import { useTheme } from '../../lib/theme';

function AddButton() {
  const theme = useTheme();
  return (
    <Link href="/habit/new" asChild>
      <Pressable hitSlop={12} style={styles.add} accessibilityLabel="افزودن عادت">
        <Text style={[styles.addText, { color: theme.primary }]}>＋</Text>
      </Pressable>
    </Link>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        // Vazirmatn is taller than the system font, so the default 49pt bar clips the labels.
        tabBarStyle: { height: 60 + insets.bottom },
        tabBarLabelStyle: styles.tabLabel,
        headerRight: () => <AddButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'امروز', tabBarIcon: ({ color }) => <TodayIcon color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'آمار', tabBarIcon: ({ color }) => <StatsIcon color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  add: { paddingHorizontal: 16 },
  addText: { fontSize: 26, fontWeight: '500' },
  tabLabel: { fontSize: 12, lineHeight: 18 },
});
