#!/usr/bin/env bash
# 从 pim-api 仓库拉取客户端契约并生成 TypeScript 类型。
#
# 契约来源：pim-api 仓的 contract/openapi.json（由该仓 CI 从 Test 环境实例导出并校验新鲜度）。
# 产物：client-web/src/api/generated.ts（提交进仓库，便于 diff 与门槛校验）。
#
# 用法：
#   scripts/ci/fetch-contract.sh            # 用默认分支（master）
#   PIM_CONTRACT_REF=<sha|branch> scripts/ci/fetch-contract.sh
set -euo pipefail

REPO="${PIM_CONTRACT_REPO:-2746267826/pim-api}"
REF="${PIM_CONTRACT_REF:-master}"
RAW_BASE="${PIM_CONTRACT_RAW_BASE:-https://raw.githubusercontent.com}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENT_DIR="$ROOT/client-web"
OUT="$CLIENT_DIR/src/api/generated.ts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> 拉取契约 $REPO@$REF"
if ! curl -fsSL "$RAW_BASE/$REPO/$REF/contract/openapi.json" -o "$TMP/openapi.json"; then
  echo "::error::无法拉取契约 $RAW_BASE/$REPO/$REF/contract/openapi.json" >&2
  exit 1
fi
SIZE=$(wc -c < "$TMP/openapi.json")
echo "    契约大小：$SIZE 字节"

BANNER='// 本文件由 scripts/ci/fetch-contract.sh 自动生成，请勿手工编辑。
// 来源：'"$REPO"'@'"$REF"' 的 contract/openapi.json
// 更新方式：在 pim-web 下执行 scripts/ci/fetch-contract.sh 并提交结果。
'

{
  printf '%s' "$BANNER"
  # 直接用 client-web 下已安装的 CLI（绝对路径）：
  # CI 里本步骤在仓库根执行，npx 在根目录找不到 client-web/node_modules；
  # 也不用 npx 拉最新版，避免 CI 与本地产物不一致。
  CONTRACT_CLI="$CLIENT_DIR/node_modules/.bin/openapi-typescript"
  if [ ! -x "$CONTRACT_CLI" ]; then
    echo "::error::未找到 $CONTRACT_CLI，请先在 client-web 下执行 npm ci" >&2
    exit 1
  fi
  "$CONTRACT_CLI" "$TMP/openapi.json"
} > "$OUT"

echo "==> 已写入 $OUT（$(wc -l < "$OUT") 行）"

# 同时把原始契约存进本仓 contract/，供开发时对照（不要手工编辑，见 contract/README.md）
CONTRACT_SNAPSHOT="$ROOT/contract/openapi.json"
mkdir -p "$(dirname "$CONTRACT_SNAPSHOT")"
cp "$TMP/openapi.json" "$CONTRACT_SNAPSHOT"
echo "==> 已更新契约快照 $CONTRACT_SNAPSHOT（$(wc -c < "$CONTRACT_SNAPSHOT") 字节）"
