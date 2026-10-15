# WorldTuner Java API 部署

## 1. 部署前配置

服务器需要已安装 Java 21，已有 `worldtuner` 用户、同名用户组和 `/opt/worldtuner` 目录。SSH 登录账户需要能上传文件，服务用户需要能读取 JAR、配置和目录库，并能在部署目录创建统计库。

核对以下配置：

| 文件 | 配置项 |
| --- | --- |
| `deploy/deploy-local.sh` | SSH 别名 `SERVER_HOST`、部署目录 `SERVER_DIR`、本机 Java / Maven 和数据库路径 |
| `deploy/deploy-server.sh` | 服务用户 `APP_USER`、部署目录 `APP_DIR`、服务器 Java 路径 `JAVA_BIN` |
| `deploy/application.yml` | 数据库绝对路径、Web 域名 `allowed-origins`、管理密钥 `admin-token` |

两个脚本的部署目录需保持一致。`racknerd` 是本机 `~/.ssh/config` 中已配置的 SSH 别名，登录账户应能使用 `sudo`。管理密钥可通过 `openssl rand -hex 32` 生成。

## 2. 首次部署

以下命令在 **Mac 本机**执行：

```bash
cd /Users/lin/Documents/www/lin/worldtuner/worldtuner-api-java

# 离线打包并上传 JAR、目录库、配置；Maven 依赖需已缓存
bash deploy/deploy-local.sh

# 上传并执行服务器配置脚本，只配置 systemd，不创建用户或目录
scp deploy/deploy-server.sh racknerd:/tmp/
ssh racknerd 'sudo bash /tmp/deploy-server.sh'

# 启动并验证
ssh racknerd 'sudo systemctl start worldtuner'
ssh racknerd 'curl -fsS http://127.0.0.1:8787/api/health'
```

健康检查应返回 `status: "ok"`。服务从 `/opt/worldtuner/application.yml` 读取外部配置，统计库 `metrics.sqlite` 自动创建。

## 3. 日常更新

只更新代码时，在 **Mac 本机**打包并上传 JAR：

```bash
cd /Users/lin/Documents/www/lin/worldtuner/worldtuner-api-java
export JAVA_HOME=/Users/lin/Library/Java/JavaVirtualMachines/corretto-21.0.11/Contents/Home
/Users/lin/.workbuddy/binaries/maven/apache-maven-3.9.9/bin/mvn -o -DskipTests package
scp worldtuner-bootstrap/target/worldtuner-bootstrap-0.1.0-SNAPSHOT.jar racknerd:/opt/worldtuner/
ssh racknerd 'sudo systemctl restart worldtuner'
```

`deploy-local.sh` 每次都会覆盖服务器上的目录库和 `application.yml`；仅更新 JAR 时使用上面的命令。需要更新数据或配置时，先备份服务器文件再上传。脚本修改后，本节路径和命令也需同步调整。

## 4. 状态与日志

以下命令在 **服务器**执行：

```bash
sudo systemctl status worldtuner
sudo systemctl restart worldtuner
# 实时运行日志（包含错误）
tail -F /opt/worldtuner/app.log
# 仅查看 ERROR 和异常堆栈
tail -F /opt/worldtuner/error.log
# 服务启动、退出等 systemd 日志
sudo journalctl -u worldtuner -f
curl -fsS http://127.0.0.1:8787/api/health
```

日志直接写入 JAR 所在目录，不依赖启动时的工作目录。每日或单文件达到 10MB 后滚动压缩，归档保留 14 天；运行日志归档上限 1GB，错误日志归档上限 256MB。`worldtuner` 用户需要有该目录的写权限。

本次更新需重新打包、上传 JAR 并执行 `sudo systemctl restart worldtuner`。日志配置随 JAR 打包，无须重新安装 systemd 服务；原有外部 `application.yml` 可以继续使用。

## 5. 域名访问

如果使用 Caddy，在 `/etc/caddy/Caddyfile` 配置实际域名：

```caddyfile
api.example.com {
    reverse_proxy 127.0.0.1:8787
    encode gzip
}
```

域名解析到服务器并放行 80/443 后，执行 `sudo systemctl reload caddy`，验证 `https://api.example.com/api/health`。

上线后，Web 设置 `LISTEN_API_BASE_URL`，移动端构建时通过 `--dart-define=API_BASE_URL=https://api.example.com` 指向正式 API，并重新部署或打包。

国家中文展示要求目录库 `country` 表已包含 `name_en`、`name_zh`。新版 Java 接口会返回这些字段；旧库先按主项目 `docs/country-localization.md` 备份迁移，再更新 JAR 并重启。App 完整重启后会重新获取国家字典。
