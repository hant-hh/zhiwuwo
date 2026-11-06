import { ApiError } from './client'
import type { ChatMode, RecordResponse } from './types'

/** 只取日期部分，后端返回的是 ISO 字符串（可能带时分秒/时区）。 */
export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : value
}

export function formatConfidence(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${Math.round(safe * 100)}%`
}

export function describeRecord(record: RecordResponse): string {
  return [record.item ?? '未命名物品', record.location ?? '位置待补充', formatDate(record.placed_at)]
    .filter(Boolean)
    .join(' · ')
}

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) return '网络不可用，请检查手机网络，或确认服务器地址可访问'
    if (error.isUnauthorized) return '登录已过期，请重新登录'
    if (error.status >= 500) return `服务器暂时不可用（${error.status}），请稍后再试`
    return error.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}

export const EXAMPLE_PROMPTS: readonly string[] = [
  '我的护照在哪里',
  '书房里有什么',
  '把雨伞放阳台',
]

export const MODE_META: ReadonlyArray<{
  key: ChatMode
  label: string
  tip: string
}> = [
  { key: 'auto', label: '智能', tip: '自动判断你是要记东西还是找东西，直接说就行' },
  { key: 'record', label: '录入', tip: '强制按录入处理：把什么放在哪' },
  { key: 'query', label: '查询', tip: '强制按查询处理：问某样东西在哪' },
]

export function modeTip(mode: ChatMode): string {
  return MODE_META.find((item) => item.key === mode)?.tip ?? MODE_META[0].tip
}
