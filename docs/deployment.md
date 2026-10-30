# 拾光内容库部署指南

本文档适用于当前 `v0.0.2`。项目是一个 pnpm monorepo，包含 NestJS API、PostgreSQL/Prisma 数据层、微信小程序和 iOS 客户端。

## 1. 部署结构

```text
微信小程序 / iOS
        ↓ HTTPS
反向代理或网关
        ↓
NestJS API
   ↓          ↓
PostgreSQL   S3 兼容对象存储
```

API 应部署在具备 HTTPS 的服务上；对象存储负责保存图片、视频、音频和文件，数据库只保存元数据和对象地址。

## 2. 环境要求

- Node.js `>=22.22.2`
- pnpm `11.10.0`
- PostgreSQL
- S3 兼容对象存储（S3、R2、COS 等）
- 已备案并配置 TLS 证书的 API、上传和下载域名
- 已注册并配置真实 AppID 的微信小程序

建议至少区分 `staging` 和 `production` 两套数据库、对象存储 bucket、微信配置和密钥。

## 3. 获取代码和安装依赖

```bash
git clone https://github.com/laogaoyuai/imemory.git
cd imemory
git checkout v0.0.2
corepack enable
pnpm install --frozen-lockfile
```

## 4. 配置 API

```bash
cp apps/api/.env.example apps/api/.env
```

生产环境至少配置以下变量：

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
JWT_SECRET=至少32位的随机密钥
WECHAT_AUTH_MODE=live
WECHAT_APP_ID=真实小程序AppID
WECHAT_APP_SECRET=真实小程序AppSecret
CONTENT_SECURITY_MODE=wechat
STORAGE_MODE=s3
STORAGE_REGION=auto
STORAGE_BUCKET=生产bucket
STORAGE_ENDPOINT=https://对象存储endpoint
STORAGE_ACCESS_KEY_ID=对象存储AccessKey
STORAGE_SECRET_ACCESS_KEY=对象存储SecretKey
STORAGE_PUBLIC_BASE_URL=https://静态资源域名
```

不要把 `.env`、数据库密码、JWT 密钥、微信 Secret 或对象存储凭证提交到 Git。

## 5. 初始化或升级数据库

生产环境只执行已提交的前向 migration：

```bash
pnpm db:generate
pnpm db:migrate:deploy
```

不要在生产环境使用 `prisma migrate dev` 或 `prisma db push`。执行 migration 前应确认数据库有可恢复备份；升级大版本前建议先在 staging 数据库完成恢复演练。

## 6. 构建和启动 API

```bash
pnpm build:api
pnpm --filter @atlas/api start
```

反向代理需要将 HTTPS 请求转发到 API，并保留 `X-Request-Id`。部署完成后检查：

```bash
curl https://你的API域名/api/v1/health
```

预期返回 `status: "ok"` 和 `version: "0.0.2"`。

小程序后台需要配置以下合法域名：

- API 请求域名
- 预签名上传域名
- 对象存储公开下载域名

## 7. 构建微信小程序

复制线上配置模板：

```bash
cp apps/miniprogram/.env.online.example apps/miniprogram/.env
```

将 `apps/miniprogram/.env` 中的地址改为真实 HTTPS API：

```env
TARO_APP_ENV=production
TARO_APP_RELEASE_VERSION=0.0.2
TARO_APP_API_BASE_URL=https://你的API域名/api/v1
TARO_APP_PRIVACY_CONTACT=真实隐私联系人
```

构建和检查：

```bash
pnpm build:mini

TARO_APP_ENV=production \
TARO_APP_RELEASE_VERSION=0.0.2 \
TARO_APP_API_BASE_URL=https://你的API域名/api/v1 \
TARO_APP_PRIVACY_CONTACT=真实隐私联系人 \
NODE_ENV=production \
pnpm check:release:strict
```

然后使用微信开发者工具导入项目，项目目录为仓库中的 `apps/miniprogram`，其 `project.config.json` 已将构建产物目录设置为 `dist/`。先上传体验版，使用至少两个微信账号验证登录、发布、评论、点赞、项目成员权限和跨设备同步，再提交审核。

## 8. 后续版本发布

推荐顺序如下：

1. 备份 PostgreSQL 和对象存储。
2. 在 staging 执行 migration 和回归测试。
3. 发布 API 代码，确保旧客户端仍可正常访问。
4. 执行 `pnpm db:migrate:deploy`。
5. 重启或滚动更新 API。
6. 运行 health 检查和双账号冒烟测试。
7. 构建新的小程序版本并上传体验版。

数据库变更应遵循“先新增、再回填、再切换、最后删除”的前向兼容原则。删除内容使用同步墓碑，不要直接物理删除仍可能被其他客户端同步的数据。

## 9. 备份和安全要求

- PostgreSQL 开启自动备份、PITR/WAL，并定期验证恢复。
- 对象存储开启版本控制和生命周期策略。
- 生产 API 使用真实微信登录和微信内容安全检查。
- 上传对象在公开访问前完成对象存在性、MIME/魔数、病毒和媒体安全检查。
- 单实例限流不能代替多实例共享限流；多实例部署时使用网关或 Redis。
- 日志不得记录正文、access token、refresh token 或对象存储密钥。

当前 API 端点、同步协议和权限规则见 [API 文档](api.md)，小程序上线前检查项见 [小程序发布清单](miniprogram-release-checklist.md)。
