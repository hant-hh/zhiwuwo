import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatConfidence, formatDate } from '@zhiwuwo/shared'
import type { RecordResponse } from '@zhiwuwo/shared'
import { colors, radius, spacing } from '@/theme'

export default function RecordCard({
  record,
  onConfirm,
}: {
  record: RecordResponse
  onConfirm?: (record: RecordResponse) => void
}) {
  const rows: Array<[string, string]> = [
    ['物品', record.item ?? '—'],
    ['位置', record.location ?? '—'],
    ['存放日期', formatDate(record.placed_at)],
    ['备注', record.note ?? '—'],
    ['置信度', formatConfidence(record.confidence)],
  ]

  return (
    <View style={styles.card}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}

      {record.needs_confirm && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>低置信度，建议确认一下</Text>
        </View>
      )}

      {record.needs_confirm && onConfirm && (
        <Pressable
          onPress={() => onConfirm(record)}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>确认这条记录</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
  value: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  warning: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
  },
  warningText: {
    color: colors.warningText,
    fontSize: 13,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
})
