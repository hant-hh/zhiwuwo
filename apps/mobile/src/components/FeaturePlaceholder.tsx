import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '@/theme'

export default function FeaturePlaceholder({
  title,
  description,
  badge = '即将上线',
}: {
  title: string
  description: string
  badge?: string
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
  },
  description: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
})
