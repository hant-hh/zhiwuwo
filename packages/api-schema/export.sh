#!/usr/bin/env bash
# 从运行中的 FastAPI 导出 OpenAPI 契约（唯一事实源）。
# 用法：./packages/api-schema/export.sh [API_BASE_URL]
set -e
cd "$(dirname "$0")"

API_BASE="${1:-http://127.0.0.1:8000}"
OUT_JSON="openapi.json"
OUT_YAML="openapi.yaml"

echo "[schema] 从 ${API_BASE}/openapi.json 拉取契约"
curl -fsS --max-time 10 "${API_BASE}/openapi.json" -o "$OUT_JSON"

python3 - "$OUT_JSON" "$OUT_YAML" <<'PY'
import json
import sys

src, dst = sys.argv[1], sys.argv[2]
with open(src, encoding="utf-8") as f:
    spec = json.load(f)

try:
    import yaml  # PyYAML 可选
    with open(dst, "w", encoding="utf-8") as f:
        yaml.safe_dump(spec, f, allow_unicode=True, sort_keys=False)
    print("[schema] 已写出 openapi.yaml（PyYAML）")
except ImportError:
    # JSON 是 YAML 1.2 的合法子集，直接复用即可被所有 YAML 解析器读取
    with open(dst, "w", encoding="utf-8") as f:
        f.write(json.dumps(spec, ensure_ascii=False, indent=2))
    print("[schema] 未装 PyYAML，openapi.yaml 以 JSON 兼容格式写出")
PY

echo "[schema] 路径数：$(python3 -c "import json;print(len(json.load(open('$OUT_JSON'))['paths']))")"
echo "[schema] 完成：$OUT_JSON / $OUT_YAML"
