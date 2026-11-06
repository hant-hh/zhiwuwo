import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { EXAMPLE_PROMPTS, friendlyError } from '@zhiwuwo/shared'
import type { ChatMode, RecordResponse } from '@zhiwuwo/shared'
import { api } from '@/api/client'
import { BotBubble, UserBubble } from '@/components/ChatBubble'
import Composer from '@/components/Composer'
import RecordCard from '@/components/RecordCard'
import { colors, radius, spacing } from '@/theme'

interface ChatMessage {
  id: string
  role: 'user' | 'bot'
  text: string
  error?: boolean
  record?: RecordResponse | null
  records?: RecordResponse[]
}

let sequence = 0
function nextId(): string {
  sequence += 1
  return `m${sequence}`
}

function comingSoon(feature: string): void {
  Alert.alert(
    '即将上线',
    `${feature}将在 M4.2 接入；权限说明已写入 app.config.ts，当前版本请先用文字录入。`,
  )
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<ChatMode>('auto')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<FlatList<ChatMessage>>(null)

  useEffect(() => {
    if (messages.length === 0) return
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    return () => clearTimeout(timer)
  }, [messages])

  function appendBot(text: string, error = false): void {
    setMessages((prev) => [...prev, { id: nextId(), role: 'bot', text, error }])
  }

  async function send(preset?: string): Promise<void> {
    const text = (preset ?? input).trim()
    if (!text || busy) return

    setInput('')
    const id = nextId()
    setMessages((prev) => [...prev, { id, role: 'user', text }])
    setBusy(true)
    try {
      const res = await api.sendChat(text, mode)
      setMessages((prev) => [
        ...prev,
        {
          id: `${id}-bot`,
          role: 'bot',
          text: res.answer,
          record: res.record,
          records: res.records,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: `${id}-bot`, role: 'bot', text: friendlyError(err), error: true },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm(record: RecordResponse): Promise<void> {
    try {
      const updated = await api.confirmRecord(record.id, {
        item: record.item,
        location: record.location,
        placed_at: record.placed_at,
        note: record.note,
      })
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          record: msg.record?.id === updated.id ? updated : msg.record,
          records: msg.records?.map((r) => (r.id === updated.id ? updated : r)),
        })),
      )
    } catch (err) {
      appendBot(`确认失败：${friendlyError(err)}`, true)
    }
  }

  function renderItem({ item }: { item: ChatMessage }) {
    if (item.role === 'user') return <UserBubble text={item.text} />
    return (
      <BotBubble text={item.text} error={item.error}>
        {item.record && <RecordCard record={item.record} onConfirm={handleConfirm} />}
        {item.records?.map((record) => (
          <RecordCard key={record.id} record={record} onConfirm={handleConfirm} />
        ))}
      </BotBubble>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>直接说话就行</Text>
            <Text style={styles.emptyText}>
              「把护照放在书房抽屉」记一条，或「我的护照在哪里」找东西。不用切换模式。
            </Text>
            <View style={styles.chips}>
              {EXAMPLE_PROMPTS.map((example) => (
                <Pressable
                  key={example}
                  onPress={() => void send(example)}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                >
                  <Text style={styles.chipText}>{example}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
      />
      <Composer
        value={input}
        onChange={setInput}
        onSend={() => void send()}
        busy={busy}
        mode={mode}
        onModeChange={setMode}
        onVoice={() => comingSoon('语音录入')}
        onCamera={() => comingSoon('拍照录入')}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  chips: {
    marginTop: spacing.xl,
    width: '100%',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  chipPressed: {
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    color: colors.primary,
    fontSize: 14,
  },
})
