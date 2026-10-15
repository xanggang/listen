#!/usr/bin/env bash
# WorldTuner Java API 服务器端一键部署脚本
# 在服务器上以 root 执行：bash deploy-server.sh
# 前提：运行用户和部署目录已准备好。
# 作用：配置并启用 systemd 服务，检查部署文件是否就绪。
set -euo pipefail

# ===== 可配置项（按需修改）=====
APP_USER="worldtuner"
APP_DIR="/opt/worldtuner"
JAVA_BIN="/opt/jdk-21.0.12.1+1-jre/bin/java"
JAR_NAME="worldtuner-bootstrap-0.1.0-SNAPSHOT.jar"
# ==============================

echo "==> [1/3] 写入 systemd 服务"
cat > /etc/systemd/system/worldtuner.service <<EOF
[Unit]
Description=WorldTuner API Java
After=network.target

[Service]
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${JAVA_BIN} -Xms256m -Xmx512m -jar ${APP_DIR}/${JAR_NAME}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
echo "    systemd 服务已写入 /etc/systemd/system/worldtuner.service"

echo "==> [2/3] 加载并启用服务"
systemctl daemon-reload
systemctl enable worldtuner
echo "    服务已 enable（启动需先上传 jar，见下一步）"

echo "==> [3/3] 检查文件是否就绪"
if [ -f "${APP_DIR}/${JAR_NAME}" ]; then
  echo "    jar 已存在，可直接启动：systemctl start worldtuner"
else
  echo "    !!! 尚未检测到 ${APP_DIR}/${JAR_NAME}"
  echo "    !!! 请先在 Mac 本机执行 deploy-local.sh 上传文件，再 systemctl start worldtuner"
fi

echo ""
echo "部署脚本执行完成。"
echo "后续命令："
echo "  启动：   systemctl start worldtuner"
echo "  查看日志：journalctl -u worldtuner -f"
echo "  验证：   curl http://127.0.0.1:8787/api/health"
