#!/usr/bin/env bash
# 生成自签「占位证书」，保证 nginx 443 在正式证书签发前也能启动。
# 正式证书请用 ./deploy/issue-cert.sh（Let's Encrypt）。
set -e
cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-zhiwuwo.com}"
LIVE_DIR="deploy/certs/live/${DOMAIN}"
FULLCHAIN="${LIVE_DIR}/fullchain.pem"
PRIVKEY="${LIVE_DIR}/privkey.pem"

if [ -f "$FULLCHAIN" ] && [ -f "$PRIVKEY" ]; then
  echo "[certs] 已有证书 ${LIVE_DIR}，跳过生成"
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "[certs] 缺少 openssl，请先执行：apt install -y openssl" >&2
  exit 1
fi

mkdir -p "$LIVE_DIR" deploy/certbot/www deploy/certbot/work deploy/certbot/logs
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$PRIVKEY" \
  -out "$FULLCHAIN" \
  -subj "/CN=${DOMAIN}" \
  -addext "subjectAltName=DNS:${DOMAIN},DNS:www.${DOMAIN}" >/dev/null 2>&1
chmod 600 "$PRIVKEY"

echo "[certs] 已生成自签占位证书（浏览器会提示不受信任，仅用于启动 nginx）"
echo "[certs] 域名解析生效后执行 ./deploy/issue-cert.sh 换成正式证书"
