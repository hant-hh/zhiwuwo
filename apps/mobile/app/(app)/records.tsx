import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { friendlyError } from '@zhiwuwo/shared'
import type { RecordResponse } from '@zhiwuwo/shared'
import { api } from '@/api/client'
import RecordCard from '@/components/RecordCard'
import { colors, spacing } from '@/theme'

export default function RecordsScreen() {
  const [records, setRecords] = useState<RecordResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.listRecords()
      setRecords(data)
      setError(null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function refresh(): Promise<void> {
    setRefreshing(true)
    await load()
  }

  async function handleConfirm(record: RecordResponse): Promise<void> {
    try {
      const updated = await api.confirmRecord(record.id, {
        item: record.item,
        location: record.location,
        placed_at: record.placed_at,
        note: record.note,
      })
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={records}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
        renderItem={({ item }) => (
          <RecordCard record={item} onConfirm={handleConfirm} />
        )}
        ListHeaderComponent={
          error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          error ? null : (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>还没有记录</Text>
              <Text style={styles.emptyText}>去「对话」里说一句「把钥匙放玄关」试试</Text>
            </View>
          )
        }
        ListFooterComponent={
          <Pressable onPress={() => void refresh()} style={styles.footer}>
            <Text style={styles.footerText}>下拉或点击这里刷新</Text>
          </Pressable>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  list: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: colors.warningBg,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.warningText,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    color: colors.muted,
    fontSize: 12,
  },
})
