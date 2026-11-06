import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, shadow, spacing } from '@/theme'

export function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.userRow}>
      <View style={[styles.bubble, styles.userBubble]}>
        <Text style={styles.userText}>{text}</Text>
      </View>
    </View>
  )
}

export function BotBubble({
  text,
  error = false,
  children,
}: {
  text: string
  error?: boolean
  children?: ReactNode
}) {
  return (
    <View style={styles.botRow}>
      <View style={[styles.bubble, styles.botBubble]}>
        {text.length > 0 && (
          <Text style={[styles.botText, error && styles.errorText]}>{text}</Text>
        )}
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  botRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  userRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderBottomRightRadius: radius.sm,
  },
  botBubble: {
    backgroundColor: colors.botBubble,
    borderBottomLeftRadius: radius.sm,
    ...shadow,
  },
  userText: {
    color: colors.surface,
    fontSize: 15,
    lineHeight: 22,
  },
  botText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: colors.danger,
  },
})
