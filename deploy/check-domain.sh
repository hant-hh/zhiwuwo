#!/usr/bin/env bash
# 检查域名解析、主入口 HTTPS 连通性与证书状态；签发正式证书前先跑这个。
cd "$(dirname "$0")/.." || exit 1

DOMAIN="${DOMAIN:-zhiwuwo.com}"
WEB_PORT="${WEB_PORT:-18080}"
WEB_HTTPS_PORT="${WEB_HTTPS_PORT:-18443}"

echo "===== 1. 域名解析（应指向本机公网 IP）====="
getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u || echo "解析失败"

echo "===== 2. 本机网卡 IP（供对比）====="
ip -4 -o addr show scope global 2>/dev/null | awk '{print $2, $4}' || true

echo "===== 3. 对外入口连通性 ====="
http_code=$(curl -s -o /dev/null -w '%{http_code}' -m 8 "http://${DOMAIN}:${WEB_PORT}/" 2>/dev/null || echo "000")
echo "GET http://${DOMAIN}:${WEB_PORT}/ -> ${http_code}"
https_code=$(curl -sk -o /dev/null -w '%{http_code}' -m 8 "https://${DOMAIN}:${WEB_HTTPS_PORT}/" 2>/dev/null || echo "000")
echo "GET https://${DOMAIN}:${WEB_HTTPS_PORT}/ -> ${https_code}"

echo "===== 4. 公网 80（仅签发证书时需要）====="
echo "平时 80 不开放；./deploy/issue-cert.sh 会临时占用并自动回收。"
echo "请确认安全组在签发期间放行公网 80，且没有被其他进程占用。"

echo "===== 5. 当前证书 ====="
LIVE="deploy/certs/live/${DOMAIN}/fullchain.pem"
if [ -f "$LIVE" ]; then
  openssl x509 -in "$LIVE" -noout -subject -issuer -dates 2>/dev/null || true
else
  echo "无证书，请先执行 ./deploy/start.sh"
fi

echo
echo "解析正确且第 3 步返回 200 后，执行 ./deploy/issue-cert.sh"
