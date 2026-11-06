// Expo monorepo 配置：packages/shared 在 apps/mobile 之外，
// 必须把仓库根加入 watchFolders，Metro 才能打包该目录下的 TS 源码。
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// 保持层级查找：npm 会把 expo-asset 等依赖装到 expo/node_modules 下，
// 关掉层级查找会导致 Metro 无法解析这些嵌套依赖。

module.exports = config
