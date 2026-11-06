import { Redirect, Tabs } from 'expo-router'
import { useAuth } from '@/auth/AuthContext'
import BootScreen from '@/components/BootScreen'
import { colors } from '@/theme'

export default function AppLayout() {
  const { status } = useAuth()

  if (status === 'loading') return <BootScreen label="正在恢复登录状态…" />
  if (status === 'signedOut') return <Redirect href="/login" />

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerTintColor: colors.primary,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '对话' }} />
      <Tabs.Screen name="records" options={{ title: '记录' }} />
      <Tabs.Screen name="settings" options={{ title: '设置' }} />
    </Tabs>
  )
}
