import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { MODE_META, modeTip } from '@zhiwuwo/shared'
import type { ChatMode } from '@zhiwuwo/shared'
import { colors, radius, spacing } from '@/theme'

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  busy: boolean
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  onVoice: () => void
  onCamera: () => void
}

export default function Composer({
  value,
  onChange,
  onSend,
  busy,
  mode,
  onModeChange,
  onVoice,
  onCamera,
}: ComposerProps) {
  const disabled = busy || value.trim().length === 0

  return (
    <View style={styles.wrapper}>
      <View style={styles.modeRow}>
        {MODE_META.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onModeChange(item.key)}
            style={[styles.chip, mode === item.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, mode === item.key && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
        <Text numberOfLines={1} style={styles.tip}>
          {modeTip(mode)}
        </Text>
      </View>

      <View style={styles.inputRow}>
        <Pressable onPress={onVoice} style={styles.extraButton}>
          <Text style={styles.extraButtonText}>语音</Text>
        </Pressable>
        <Pressable onPress={onCamera} style={styles.extraButton}>
          <Text style={styles.extraButtonText}>拍照</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSend}
          placeholder="问我东西放哪儿，或告诉我放在哪…"
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          multiline
          maxLength={300}
          editable={!busy}
        />
        <Pressable
          onPress={onSend}
          disabled={disabled}
          style={({ pressed }) => [
            styles.sendButton,
            disabled && styles.sendButtonDisabled,
            pressed && !disabled && styles.sendButtonPressed,
          ]}
        >
          <Text style={styles.sendButtonText}>{busy ? '…' : '发送'}</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>语音 / 拍照将在 M4.2 接入，当前版本仅支持文字</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  tip: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  extraButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  extraButtonText: {
    color: colors.muted,
    fontSize: 12,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  sendButton: {
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    height: 40,
    justifyContent: 'center',
  },
  sendButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  footnote: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: 11,
  },
})
