import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { friendlyError } from '@zhiwuwo/shared'
import { API_BASE_URL, api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import FeaturePlaceholder from '@/components/FeaturePlaceholder'
import {
  ANDROID_MIN_VERSION,
  APP_VERSION,
  IOS_MIN_VERSION,
} from '@/config'
import { colors, radius, spacing } from '@/theme'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
    </View>
  )
}

export default function SettingsScreen() {
  const { username, signOut } = useAuth()
  const [parser, setParser] = useState('检测中…')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let alive = true
    void api
      .parserStatus()
      .then((status) => {
        if (alive) {
          setParser(`${status.active_backend}（回退：${status.fallback}）`)
        }
      })
      .catch((err: unknown) => {
        if (alive) setParser(friendlyError(err))
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>账号与服务</Text>
      <View style={styles.group}>
        <InfoRow label="当前账号" value={username || '—'} />
        <InfoRow label="服务器" value={API_BASE_URL} />
        <InfoRow label="解析后端" value={parser} />
        <InfoRow label="App 版本" value={`${APP_VERSION}（内测）`} />
        <InfoRow label="最低系统" value={`${IOS_MIN_VERSION} / ${ANDROID_MIN_VERSION}`} />
      </View>

      <Text style={styles.sectionTitle}>后续能力</Text>
      <FeaturePlaceholder
        title="语音录入"
        description="麦克风权限说明已声明。M4.2 接入 ASR 后，说一句即可完成录入。"
      />
      <FeaturePlaceholder
        title="拍照 / 相册录入"
        description="相机与相册权限说明已声明。M4.2 接入视觉抽取后可用。"
      />
      <FeaturePlaceholder
        title="推送通知"
        description="M4.3 接入 APNs / FCM，用于家庭成员新增记录时提醒。"
        badge="规划中"
      />

      <Pressable
        onPress={async () => {
          setLoggingOut(true)
          await signOut()
        }}
        disabled={loggingOut}
        style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
      >
        <Text style={styles.logoutText}>退出登录</Text>
      </Pressable>

      <Text style={styles.footer}>
        内测分发：iOS TestFlight / Android 内测 APK。当前版本不启动正式上架流程。
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  infoValue: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 13,
    textAlign: 'right',
  },
  logout: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  logoutPressed: {
    backgroundColor: colors.warningBg,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    marginTop: spacing.xl,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
})
