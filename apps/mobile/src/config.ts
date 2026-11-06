/** 内测真机一律走 HTTPS 域名；非标准端口必须显式写出。本地开发可用 .env.local 覆盖。 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://zhiwuwo.com:18443'

export const APP_VERSION = '0.1.0'
export const IOS_MIN_VERSION = 'iOS 16.4+'
export const ANDROID_MIN_VERSION = 'Android 10+（API 29）'
