import { Link, Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '@/theme'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '页面不存在' }} />
      <View style={styles.container}>
        <Text style={styles.title}>没有这个页面</Text>
        <Link href="/" style={styles.link}>
          回到对话
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    marginTop: spacing.md,
    color: colors.primary,
    fontSize: 15,
  },
})
