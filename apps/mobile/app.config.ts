import type { ExpoConfig } from 'expo/config';

// 内测阶段权限说明先声明好，M4.2 接录音/拍照时无需再改配置。
const config: ExpoConfig = {
  name: '置物窝',
  slug: 'zhiwuwo',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  // Expo SDK 56 / RN 0.85 默认启用新架构，无需再声明 newArchEnabled。
  scheme: 'zhiwuwo',

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.zhiwuwo.app',
    infoPlist: {
      NSMicrophoneUsageDescription: '用于语音录入物品存放位置（M4.2 启用）',
      NSCameraUsageDescription: '用于拍照记录物品存放位置（M4.2 启用）',
      NSPhotoLibraryUsageDescription: '用于从相册选择物品照片（M4.2 启用）',
    },
  },

  android: {
    package: 'com.zhiwuwo.app',
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.READ_MEDIA_IMAGES',
    ],
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        ios: { deploymentTarget: '16.4' },
        android: {
          minSdkVersion: 29, // Android 10+
          compileSdkVersion: 36,
          targetSdkVersion: 36, // Google Play 2026-08-31 起强制 API 36
        },
      },
    ],
  ],

  extra: {
    // 由 EXPO_PUBLIC_API_BASE_URL 覆盖；非标准 HTTPS 端口需显式写出
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://zhiwuwo.com:18443',
  },

  experiments: { typedRoutes: true },
};

export default config;
