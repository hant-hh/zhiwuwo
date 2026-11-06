import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/auth/AuthContext'
import BootScreen from '@/components/BootScreen'

export default function AuthLayout() {
  const { status } = useAuth()

  if (status === 'loading') return <BootScreen label="正在恢复登录状态…" />
  if (status === 'signedIn') return <Redirect href="/" />

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  )
}
