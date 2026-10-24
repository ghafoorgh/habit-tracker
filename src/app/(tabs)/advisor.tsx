import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, fontFor } from '../../components/Text';
import { askAdvisor, MAX_MESSAGE_LENGTH, type ChatMessage } from '../../lib/advisor';
import { useHabits } from '../../lib/store';
import { useTheme } from '../../lib/theme';

const SUGGESTIONS = [
  'امروز روی کدام عادت تمرکز کنم؟',
  'چرا زنجیره‌هایم قطع می‌شود؟',
  'یک برنامهٔ ساده برای هفتهٔ آینده بده',
];

export default function AdvisorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { habits } = useHabits();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    setError(null);
    setSending(true);
    try {
      const reply = await askAdvisor(next, habits);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ارتباط با مشاور');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // The tab header sits above this view: status bar + 44pt bar on iOS.
      keyboardVerticalOffset={insets.top + 44}
    >
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.bigEmoji}>🧭</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>مشاور عادت‌ها</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              دربارهٔ عادت‌هایت بپرس. مشاور زنجیره‌ها و آمارت را می‌بیند و پیشنهاد عملی می‌دهد.
            </Text>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s)}
                style={[styles.suggestion, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Text style={[styles.suggestionText, { color: theme.primary }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <View
              style={[
                styles.bubble,
                mine
                  ? { alignSelf: 'flex-start', backgroundColor: theme.primary }
                  : { alignSelf: 'flex-end', backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text selectable style={[styles.bubbleText, { color: mine ? '#fff' : theme.text }]}>
                {item.content}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <>
            {sending && <ActivityIndicator style={styles.footer} color={theme.primary} />}
            {!!error && <Text style={[styles.footer, styles.error, { color: theme.danger }]}>{error}</Text>}
          </>
        }
      />

      <View style={[styles.composer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="سؤالت را بنویس…"
          placeholderTextColor={theme.muted}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
        />
        <Pressable
          disabled={!draft.trim() || sending}
          onPress={() => send(draft)}
          accessibilityLabel="ارسال"
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: theme.primary, opacity: !draft.trim() || sending ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.sendText}>ارسال</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24 },
  bigEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 8, paddingHorizontal: 16 },
  suggestion: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: { fontSize: 14, fontWeight: '500' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  bubbleText: { fontSize: 15, lineHeight: 24, writingDirection: 'rtl' },
  footer: { marginTop: 4 },
  error: { fontSize: 14, textAlign: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    fontFamily: fontFor('400'),
    fontSize: 16,
    writingDirection: 'rtl',
    textAlign: 'right',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  send: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  sendText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
