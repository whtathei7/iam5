#!/bin/sh
set -eu

PROVIDER_URL="${1:-}"
if [ -z "$PROVIDER_URL" ]; then
  echo "用法: sh configure-openclash-codex.sh http://Windows局域网IP:8199/sub/all.yaml" >&2
  exit 2
fi
case "$PROVIDER_URL" in
  http://*|https://*) ;;
  *) echo "provider 必须是 http/https URL" >&2; exit 2 ;;
esac

BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TEMPLATE="$BASE_DIR/deploy/openclash/codex-smart.yaml.template"
TARGET="/etc/openclash/config/codex-smart.yaml"
TMP="/tmp/codex-smart.yaml.$$"
FEED_TMP="/tmp/codex-provider.yaml.$$"
PREVIOUS_FILE="/etc/openclash/codex-smart.previous-config"
CORE="/etc/openclash/clash"
trap 'rm -f "$TMP" "$FEED_TMP"' EXIT

if [ ! -r "$TEMPLATE" ]; then
  echo "缺少模板: $TEMPLATE" >&2
  exit 1
fi
if [ ! -x "$CORE" ]; then
  echo "找不到 OpenClash 内核: $CORE" >&2
  exit 1
fi

escape_sed() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

ENCODED_URL=$(escape_sed "$PROVIDER_URL")
sed "s|__PROVIDER_URL__|$ENCODED_URL|g" "$TEMPLATE" > "$TMP"

echo "检查本地筛选结果是否可访问..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL --connect-timeout 5 --max-time 15 "$PROVIDER_URL" -o "$FEED_TMP"
else
  uclient-fetch -q -T 15 -O "$FEED_TMP" "$PROVIDER_URL"
fi
if ! grep -q '^proxies:' "$FEED_TMP" || ! grep -Eq '^  - name:' "$FEED_TMP"; then
  echo "本地订阅为空或不是 Clash YAML；已停止切换。" >&2
  exit 1
fi

echo "使用实际内核校验 Codex 配置..."
"$CORE" -t -d /etc/openclash -f "$TMP"

OLD_CONFIG=$(uci -q get openclash.config.config_path || true)
OLD_ENABLE=$(uci -q get openclash.config.enable || true)
OLD_SMART=$(uci -q get openclash.config.auto_smart_switch || true)
OLD_LGBM=$(uci -q get openclash.config.smart_enable_lgbm || true)
OLD_COLLECT=$(uci -q get openclash.config.smart_collect || true)
OLD_ASN=$(uci -q get openclash.config.smart_prefer_asn || true)
OLD_TOLERANCE=$(uci -q get openclash.config.smart_tolerance || true)
OLD_TEST_URL=$(uci -q get openclash.config.urltest_address_mod || true)
OLD_TEST_INTERVAL=$(uci -q get openclash.config.urltest_interval_mod || true)
printf '%s\n' "$OLD_CONFIG" > "$PREVIOUS_FILE"
mkdir -p /etc/openclash/config
cp "$TMP" "$TARGET"
rm -f "$TMP"

# OpenClash 0.47.x 会把 url-test 自动转换为 Smart；关闭训练数据和 LightGBM，减少内存与闪存写入。
uci -q set openclash.config.auto_smart_switch='1'
uci -q set openclash.config.smart_enable_lgbm='0'
uci -q set openclash.config.smart_collect='0'
uci -q set openclash.config.smart_prefer_asn='0'
uci -q set openclash.config.smart_tolerance='100'
uci -q set openclash.config.urltest_address_mod='0'
uci -q set openclash.config.urltest_interval_mod='0'
uci -q set openclash.config.config_path="$TARGET"
uci -q set openclash.config.enable='1'
uci -q commit openclash

echo "切换配置并重启 OpenClash..."
/etc/init.d/openclash restart
sleep 2
ACTIVE_CONFIG=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if ps w | grep -F "$TARGET" | grep -v grep >/dev/null 2>&1; then
    ACTIVE_CONFIG=1
    break
  fi
  sleep 2
done

if [ "$ACTIVE_CONFIG" != 1 ]; then
  echo "OpenClash 未成功启动，恢复旧配置: $OLD_CONFIG" >&2
  restore_value() {
    key="$1"
    value="$2"
    if [ -n "$value" ]; then
      uci -q set "openclash.config.$key=$value"
    else
      uci -q delete "openclash.config.$key" || true
    fi
  }
  restore_value config_path "$OLD_CONFIG"
  restore_value enable "$OLD_ENABLE"
  restore_value auto_smart_switch "$OLD_SMART"
  restore_value smart_enable_lgbm "$OLD_LGBM"
  restore_value smart_collect "$OLD_COLLECT"
  restore_value smart_prefer_asn "$OLD_ASN"
  restore_value smart_tolerance "$OLD_TOLERANCE"
  restore_value urltest_address_mod "$OLD_TEST_URL"
  restore_value urltest_interval_mod "$OLD_TEST_INTERVAL"
  uci -q commit openclash
  if [ -n "$OLD_CONFIG" ]; then
    /etc/init.d/openclash restart || true
  fi
  exit 1
fi

echo "已启用 $TARGET"
echo "原配置记录在 $PREVIOUS_FILE"
echo "下一步: sh scripts/verify-openclash-codex.sh"
