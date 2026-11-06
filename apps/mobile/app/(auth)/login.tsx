import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { friendlyError } from '@zhiwuwo/shared'
import { API_BASE_URL, api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { colors, radius, shadow, spacing } from '@/theme'

type Mode = 'login' | 'register'

export default function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const insets = useSafeAreaInsets()

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverState, setServerState] = useState('未检测')

  async function submit() {
    const name = username.trim()
    if (!name || !password) {
      setError('请输入用户名和密码')
      return
    }
    if (mode === 'register' && name.length < 3) {
      setError('用户名至少 3 个字符')
      return
    }
    setError(null)
    setBusy(true)
    try {
      // 登录成功后 AuthProvider 会切换状态，(auth)/_layout.tsx 自动跳转到对话页
      if (mode === 'login') await signIn(name, password)
      else await signUp(name, password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function checkServer() {
    setServerState('检测中…')
    try {
      await api.health()
      setServerState('连接正常')
    } catch (err) {
      setServerState(friendlyError(err))
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>置物窝</Text>
        <Text style={styles.slogan}>东西放哪儿，说一句就记住；找不着，问一句就回答。</Text>

        <View style={styles.card}>
          <View style={styles.tabs}>
            {(['login', 'register'] as Mode[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setMode(item)
                  setError(null)
                }}
                style={[styles.tab, mode === item && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === item && styles.tabTextActive]}>
                  {item === 'login' ? '登录' : '注册'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>用户名</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="请输入用户名"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="请输入密码"
            placeholderTextColor={colors.muted}
            onSubmitEditing={submit}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              busy && styles.primaryButtonDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? '登录' : '注册并登录'}
              </Text>
            )}
          </Pressable>

          <View style={styles.serverRow}>
            <Text numberOfLines={1} style={styles.serverLabel}>服务器：{API_BASE_URL}</Text>
            <Pressable onPress={checkServer}>
              <Text style={styles.link}>测试连接</Text>
            </Pressable>
          </View>
          <Text style={styles.serverState}>状态：{serverState}</Text>
        </View>

        <Text style={styles.note}>
          内测版仅支持文字对话；请确认服务器已配置 HTTPS 与有效证书。
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
  },
  slogan: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadow,
  },
  tabText: {
    color: colors.muted,
    fontSize: 14,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    color: colors.text,
    fontSize: 15,
  },
  error: {
    marginBottom: spacing.md,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  serverLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
  },
  link: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  serverState: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: 12,
  },
  note: {
    marginTop: spacing.xl,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
})
