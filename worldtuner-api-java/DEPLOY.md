# worldtuner-api-java 服务器部署文档

从一台初始化的 Debian/Ubuntu 服务器 + 已有域名开始，把 Java API 部署上线。

## 目标架构

```
客户端（Web / App）
      │  HTTPS
      ▼
Caddy（反向代理 + 自动 HTTPS 证书）
      │  HTTP
      ▼
worldtuner-api-java（Spring Boot，端口 8787）
      ├── 目录库  worldtuner-v2.sqlite（只读）
      └── 统计库  metrics.sqlite（WAL）
```

- 单一 Java 进程承载 App / Web / 后台管理三端（通过 URL 前缀区分）。
- SQLite 不需要独立数据库进程，Java 进程是唯一常驻内存大户。

## 前置条件

- 一台服务器（推荐 Debian 12 / Ubuntu 22.04+），2.5GB 内存即可。
- 域名已把 A/AAAA 记录解析到服务器公网 IP（例如 `api.example.com`）。
- 服务器能出网（安装依赖 + 自动申请证书需要）。

---

## 一、安装 JDK 21

```bash
sudo apt update
sudo apt install -y openjdk-21-jre-headless
java -version   # 确认是 21
```

> 只需要 JRE 即可运行；如果服务器上要编译，再加 `openjdk-21-jdk`。

## 二、准备目录与文件

```bash
# 建专用运行用户（不推荐用 root 跑）
sudo useradd -r -s /usr/sbin/nologin worldtuner

# 部署目录
sudo mkdir -p /opt/worldtuner
sudo chown worldtuner:worldtuner /opt/worldtuner
```

需要上传两个东西：

1. **可执行 jar**：`worldtuner-bootstrap-0.1.0-SNAPSHOT.jar`
2. **目录库**：`worldtuner-v2.sqlite`

从本机打包并上传：

```bash
# 本机打包（离线模式，依赖已缓存）
cd /Users/lin/Documents/www/lin/worldtuner/worldtuner-api-java
export JAVA_HOME=/Users/lin/Library/Java/JavaVirtualMachines/corretto-21.0.11/Contents/Home
/Users/lin/.workbuddy/binaries/maven/apache-maven-3.9.9/bin/mvn -o -DskipTests package

# 上传 jar
    
scp -P 2222 /Users/lin/Documents/www/lin/worldtuner/worldtuner-api-java/worldtuner-bootstrap/target/worldtuner-bootstrap-0.1.0-SNAPSHOT.jar \
    worldtuner@192.129.235.122:/opt/worldtuner/

# 上传目录库
scp -P 2222 /Users/lin/Documents/www/lin/worldtuner/worldTuner-data/v2/data/worldtuner-v2.sqlite \
    worldtuner@192.129.235.122:/opt/worldtuner/
```

## 三、准备配置文件

项目里已提供部署配置模板 `deploy/application.yml`，上传到服务器即可：

```bash
# 本机上传配置模板
scp deploy/application.yml worldtuner@服务器IP:/opt/worldtuner/application.yml
scp -P 2222 /Users/lin/Documents/www/lin/worldtuner/worldtuner-api-java/deploy/application.yml \
    worldtuner@192.129.235.122:/opt/worldtuner/
```

上传后在服务器上改两个占位符：

1. `allowed-origins` → 你的 Web 前端真实域名（HTTPS）
2. `admin-token` → 用 `openssl rand -hex 32` 生成强随机串

```bash
# 生成强随机 token
openssl rand -hex 32

# 改配置
sudo nano /opt/worldtuner/application.yml
```

> 说明：
> - `catalog-db-path` / `metrics-db-path` 已用**绝对路径** `/opt/worldtuner/...`，与上传目录一致。
> - 不要用 jar 内置的默认配置（它指向本地开发路径 `../worldTuner-data/...`），服务器必须用这份外部配置覆盖。

> 说明：
> - `catalog-db-path` / `metrics-db-path` 必须用**绝对路径**，否则相对 systemd 的工作目录。
> - `allowed-origins` 填你的 Web 前端真实域名（HTTPS），多个用英文逗号分隔。
> - `admin-token` 用 `openssl rand -hex 32` 生成一个强随机串，别用默认 `change-me`。

## 四、配置 systemd 服务

```bash
sudo tee /etc/systemd/system/worldtuner.service > /dev/null <<'EOF'
[Unit]
Description=WorldTuner API Java
After=network.target

[Service]
User=worldtuner
Group=worldtuner
WorkingDirectory=/opt/worldtuner
ExecStart=/usr/bin/java -Xms256m -Xmx512m -jar worldtuner-bootstrap-0.1.0-SNAPSHOT.jar
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now worldtuner
```

> `-Xmx512m` 上限 512MB 堆，配合 2.5GB 机器留足余量；流量大了再调高。

## 五、验证 Java 服务

```bash
# 看日志
sudo journalctl -u worldtuner -f

# 本机自测
curl http://127.0.0.1:8787/api/health
# 期望：{"data":{"service":"worldtuner-api","status":"ok"}}

curl "http://127.0.0.1:8787/api/stations?page=1&pageSize=2"
```

## 六、安装 Caddy 并配置 HTTPS

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

配置反向代理（`/etc/caddy/Caddyfile`）：

```caddyfile
api.example.com {
    reverse_proxy 127.0.0.1:8787
    encode gzip
}
```

> Caddy 会**自动申请并续期** Let's Encrypt 证书，只要域名已解析到本机、80/443 端口可访问。

```bash
sudo systemctl reload caddy
```

完成后，你的 API 即可通过 `https://api.example.com/api/health` 访问。

---

## 常用运维命令

```bash
# 状态 / 重启 / 日志
sudo systemctl status worldtuner
sudo systemctl restart worldtuner
sudo journalctl -u worldtuner -f

# 更新版本：上传新 jar 后重启
scp worldtuner-bootstrap-0.1.0-SNAPSHOT.jar worldtuner@服务器IP:/opt/worldtuner/
sudo systemctl restart worldtuner

# 备份 SQLite（含统计库）
sudo systemctl stop worldtuner
sudo cp /opt/worldtuner/worldtuner-v2.sqlite /opt/worldtuner/backup-v2-$(date +%F).sqlite
sudo cp /opt/worldtuner/metrics.sqlite     /opt/worldtuner/backup-metrics-$(date +%F).sqlite
sudo systemctl start worldtuner
```

## 环境变量覆盖（可选）

所有配置都能用环境变量覆盖（`systemd` 里用 `Environment=`，或 Spring 的 `SERVER__PORT` 之类映射）：

| 配置项 | 环境变量 | 说明 |
| --- | --- | --- |
| 端口 | `SERVER_PORT` | 等价 `server.port` |
| 目录库路径 | `WORLDTUNER_CATALOGDBPATH` | 等价 `worldtuner.catalog-db-path` |
| 统计库路径 | `WORLDTUNER_METRICSDBPATH` | 等价 `worldtuner.metrics-db-path` |
| admin token | `WORLDTUNER_ADMINTOKEN` | 等价 `worldtuner.admin-token` |

> 建议直接用 `application.yml` 管理，比环境变量更直观。

## 上线后要做的两件事

1. **App 端切换**：App 的 `API_BASE_URL` 是构建期注入的，指向这台服务器需要**重新打包发版**。
2. **Web 端切换**：改前端的环境变量指向 `https://api.example.com`，重新部署即可。

## 安全清单

- [ ] `admin-token` 已改成强随机值
- [ ] `allowed-origins` 只填真实域名，不含 `*`
- [ ] 用 `worldtuner` 非 root 用户运行
- [ ] 只开放 80 / 443（`ufw allow 80,443/tcp`），不直接暴露 8787
- [ ] Caddy 自动 HTTPS 已生效
