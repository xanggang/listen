#!/usr/bin/env bash
# WorldTuner Java API 本机打包 + 上传脚本
# 在 Mac 本机执行：bash deploy-local.sh
# 作用：打包 jar，并把 jar / 目录库 / 配置上传到服务器
set -euo pipefail

# ===== 可配置项（按需修改）=====
SERVER_HOST="racknerd"          # 对应 ~/.ssh/config 里的 Host 别名
SERVER_DIR="/opt/worldtuner"
JAVA_HOME_DIR="/Users/lin/Library/Java/JavaVirtualMachines/corretto-21.0.11/Contents/Home"
MVN="/Users/lin/.workbuddy/binaries/maven/apache-maven-3.9.9/bin/mvn"
# 项目根目录（脚本位于 deploy/ 下，父目录即项目根）
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# ==============================

JAR_NAME="worldtuner-bootstrap-0.1.0-SNAPSHOT.jar"
JAR_PATH="${PROJECT_DIR}/worldtuner-bootstrap/target/${JAR_NAME}"
DB_PATH="/Users/lin/Documents/www/lin/worldtuner/worldTuner-data/v2/data/worldtuner-v2.sqlite"
CFG_PATH="${PROJECT_DIR}/deploy/application.yml"

echo "==> [1/3] 打包（离线模式）"
cd "${PROJECT_DIR}"
export JAVA_HOME="${JAVA_HOME_DIR}"
"${MVN}" -o -DskipTests package
echo "    打包完成：${JAR_PATH}"

echo "==> [2/3] 上传 jar"
scp "${JAR_PATH}" "${SERVER_HOST}:${SERVER_DIR}/"

echo "==> [3/3] 上传目录库与配置"
scp "${DB_PATH}" "${SERVER_HOST}:${SERVER_DIR}/"
scp "${CFG_PATH}" "${SERVER_HOST}:${SERVER_DIR}/application.yml"

echo ""
echo "上传完成。请 SSH 到服务器执行："
echo "  systemctl start worldtuner"
echo "  journalctl -u worldtuner -f"
