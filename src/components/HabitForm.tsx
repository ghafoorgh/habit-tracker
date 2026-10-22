import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Habit } from '../lib/habits';
import { HABIT_COLORS, HABIT_EMOJIS, useTheme } from '../lib/theme';

type Values = Pick<Habit, 'name' | 'emoji' | 'color'>;

type Props = {
  initial?: Values;
  submitLabel: string;
  onSubmit: (values: Values) => void;
  onDelete?: () => void;
};

export function HabitForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const theme = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? HABIT_EMOJIS[0]);
  const [color, setColor] = useState(initial?.color ?? HABIT_COLORS[0]);
  const trimmed = name.trim();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.preview}>
          <View style={[styles.previewEmoji, { backgroundColor: color + '22' }]}>
            <Text style={styles.previewEmojiText}>{emoji}</Text>
          </View>
        </View>

        <Text style={[styles.label, { color: theme.muted }]}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Drink 8 glasses of water"
          placeholderTextColor={theme.muted}
          autoFocus={!initial}
          maxLength={60}
          returnKeyType="done"
          style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
        />

        <Text style={[styles.label, { color: theme.muted }]}>ICON</Text>
        <View style={[styles.grid, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {HABIT_EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={[styles.emojiOption, e === emoji && { backgroundColor: color + '33' }]}
              accessibilityLabel={`Icon ${e}`}
              accessibilityState={{ selected: e === emoji }}
            >
              <Text style={styles.emojiOptionText}>{e}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.muted }]}>COLOR</Text>
        <View style={[styles.grid, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {HABIT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.colorRing, c === color && { borderColor: c }]}
              accessibilityLabel={`Color ${c}`}
              accessibilityState={{ selected: c === color }}
            >
              <View style={[styles.colorDot, { backgroundColor: c }]} />
            </Pressable>
          ))}
        </View>

        <Pressable
          disabled={!trimmed}
          onPress={() => onSubmit({ name: trimmed, emoji, color })}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: !trimmed ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.buttonText}>{submitLabel}</Text>
        </Pressable>

        {onDelete && (
          <Pressable onPress={onDelete} style={styles.delete}>
            <Text style={[styles.deleteText, { color: theme.danger }]}>Delete habit</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  preview: { alignItems: 'center', marginVertical: 8 },
  previewEmoji: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  previewEmojiText: { fontSize: 36 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  input: {
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emojiOption: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emojiOptionText: { fontSize: 24 },
  colorRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  button: { marginTop: 28, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  delete: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  deleteText: { fontSize: 16, fontWeight: '600' },
});
