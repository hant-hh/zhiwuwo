#!/usr/bin/env bash
# 停止并移除置物窝开发环境容器（数据卷 /data 仍保留）
set -e
for c in web api minio redis postgres; do
  docker rm -f "$c" 2>/dev/null || true
done
echo "已停止并移除容器（数据卷 /data 仍保留）"
