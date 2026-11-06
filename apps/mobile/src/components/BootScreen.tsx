import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '@/theme'

export default function BootScreen({ label = '正在准备…' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  label: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 14,
  },
})
