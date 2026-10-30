# Atlas API 0.0.2

API 位于 `apps/api`，使用 NestJS 11、Prisma 7、PostgreSQL 和 S3 兼容对象存储。所有业务接口统一使用 `/api/v1` 前缀。

## 本地配置

```bash
cp apps/api/.env.example apps/api/.env
pnpm db:generate
pnpm db:migrate
pnpm dev:api
```

默认连接：

```text
postgresql://atlas:atlas@127.0.0.1:5432/atlas?schema=public
```

开发环境默认启用 `WECHAT_AUTH_MODE=mock`，可用任意非空 code 生成稳定的模拟 openid。生产环境会强制使用真实微信 code2Session，并拒绝 mock 登录。

## 接口

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/api/v1/health` | 否 | 服务健康检查 |
| POST | `/api/v1/auth/wechat` | 否 | 微信 code 登录 |
| POST | `/api/v1/auth/refresh` | refresh token | 轮换会话 |
| GET | `/api/v1/contents?since=` | Bearer JWT | 增量读取内容与墓碑 |
| POST | `/api/v1/contents/sync` | Bearer JWT | 幂等提交、删除与冲突检测 |
| GET | `/api/v1/contents/:contentId` | Bearer JWT | 按可见性读取内容或分享落地内容 |
| GET/POST | `/api/v1/contents/:contentId/comments` | Bearer JWT | 读取或发表评论/回复 |
| POST | `/api/v1/contents/:contentId/comments/:commentId/like` | Bearer JWT | 点赞或取消点赞评论 |
| POST | `/api/v1/contents/:contentId/share` | Bearer JWT | 记录一次分享并返回权威内容快照 |
| GET/POST | `/api/v1/contents/:contentId/versions` | Bearer JWT | 读取版本历史或提交新版本 |
| PATCH | `/api/v1/contents/:contentId/versions/:versionId` | Bearer JWT | 通过或驳回待审核版本 |
| POST | `/api/v1/contents/:contentId/versions/:versionId/rollback` | Bearer JWT | 回退到已通过版本 |
| GET/POST | `/api/v1/collections` | Bearer JWT | 读取或创建个人合集 |
| GET/PATCH/DELETE | `/api/v1/collections/:collectionId` | Bearer JWT | 读取、修改或删除个人合集 |
| POST | `/api/v1/uploads/presign` | Bearer JWT | 获取对象存储上传 URL |
| GET/PATCH | `/api/v1/profile` | Bearer JWT | 读取或修改当前用户资料 |
| GET | `/api/v1/users?q=` | Bearer JWT | 按显示名称搜索用户 |
| GET | `/api/v1/users/:userId` | Bearer JWT | 用户主页与关注统计 |
| POST/DELETE | `/api/v1/users/:userId/follow` | Bearer JWT | 关注或取消关注用户 |
| GET/POST | `/api/v1/projects` | Bearer JWT | 项目列表或创建项目 |
| GET/PATCH | `/api/v1/projects/:projectId` | Bearer JWT | 项目主页或修改项目设置 |
| POST/DELETE | `/api/v1/projects/:projectId/follow` | Bearer JWT | 关注或取消关注公开项目 |
| POST | `/api/v1/projects/:projectId/members` | Bearer JWT | 邀请用户成为粉丝 |
| PATCH | `/api/v1/projects/:projectId/members/:userId` | Bearer JWT | 调整角色或转让项目 |

请求与响应 Schema 由 `@atlas/contracts` 提供，客户端通过 `@atlas/api-client` 调用。401 响应会触发一次 refresh token 轮换并重试原请求。

## 同步协议

- 每条内容包含服务端 `revision`。
- 新内容以 `baseRevision: 0` 提交。
- 更新和删除必须携带客户端已知 revision。
- revision 不一致时服务端返回 `revision_conflict` 和服务器快照，不覆盖数据。
- 每个 mutation 使用 UUID `idempotencyKey`，七天内重复提交返回第一次结果。
- 删除保留 `deletedAt` 墓碑，以便其他设备增量删除本地副本。
- 客户端持久化同步游标与 mutation 队列；只有远端合并成功后才推进游标。
- 客户端先推送本地修改，再拉取增量；断网不回滚本地发布。
- 有未提交本地修改时收到更高 revision，会形成显式冲突，用户选择本地或云端版本。
- 内容同步接口拒绝本地临时附件路径，附件必须先完成对象存储上传。
- 内容正文发生变化时版本号必须大于全部已有版本；同版本互动指标同步不会修改已有版本快照。

小程序当前使用预签名 PUT 上传。为了避免微信运行时一次读取大文件造成内存压力，客户端暂时将单附件限制为 20 MB；API 保留 100 MB 上限，为后续分片上传预留空间。

## 项目权限

- 项目创建者同时写入 `OWNER` 成员记录。
- 项目主可以修改项目、任命管理员/成员/粉丝以及转让项目。
- 管理员只能在 `MEMBER` 和 `FOLLOWER` 之间调整。
- 私密项目通过用户搜索后邀请；公开项目允许用户主动关注。
- 项目内容写入 `content_projects` 关联表，内容同步时校验发布者成员身份。
- 未加入公开项目的用户只能读取其中已通过且公开的内容。

## 版本权限

- 内容创建者，以及内容所关联项目中的项目主或管理员，可以提交新版本。
- 个人内容、项目主或管理员提交的项目内容自动通过；成员或粉丝提交的项目内容进入待审核。
- 多项目内容只有在操作者是每个关联项目的项目主或管理员时才允许审核。
- 驳回当前版本会自动恢复最近的已通过快照；回退目标也必须是已通过版本。

## 个人合集

- 合集仅对创建者开放读取和管理，不作为公开项目内容容器。
- 合集只能加入创建者自己的、未关联项目且类型一致的内容。
- `contentIds` 不能重复，数组顺序会按从零开始的连续 `position` 持久化。
- 删除合集只删除合集及关联关系，不删除原始内容。
- 合集封面复用对象存储预签名上传链路，API 只接受可访问的远程 URL。

## 评论与分享

- 内容创建者始终可见自己的内容；项目成员可见所属项目内容；其他用户只能读取已通过且公开的个人内容或公开项目内容。
- 评论引用目标必须属于同一内容且尚未删除。
- 评论点赞通过 `(comment_id, user_id)` 唯一关系切换，API 返回当前用户的 `isLiked` 状态。
- 发表评论会递增内容评论数，记录分享会递增分享数，同时增加内容 revision 供其他设备增量同步。
- 分享路径中的内容 ID 只用于定位，服务端仍执行完整可见性校验。

## 生产配置要求

生产部署只执行已经提交到仓库的前向 Migration，不使用 `prisma migrate dev` 或 `prisma db push`：

```bash
pnpm build:api
pnpm db:migrate:deploy
pnpm --filter @atlas/api start
```

Migration 应在应用滚动更新前执行，并且不能在应用启动时自动修改数据库。

- `JWT_SECRET` 至少 32 字符，并通过密钥服务注入。
- 必须配置真实 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`。
- 必须设置 `STORAGE_MODE=s3` 及 bucket、region、endpoint 和凭证。
- 必须设置 `STORAGE_PUBLIC_BASE_URL`，保证跨设备能够读取已上传附件。
- 生产环境强制 `CONTENT_SECURITY_MODE=wechat`；资料、内容、评论、项目和合集文本写入会调用微信内容安全接口。
- `RATE_LIMIT_WINDOW_SECONDS`、`RATE_LIMIT_MAX` 和 `AUTH_RATE_LIMIT_MAX` 控制单实例限流；多实例部署还要在网关或 Redis 层配置共享限流。
- `TRUST_PROXY` 只能在受控反向代理后开启；API 会回传 `X-Request-Id` 并在生产环境记录结构化访问日志。
- API 域名、上传域名和下载域名需要加入微信小程序合法域名。
- 预签名上传完成后仍需增加对象存在性确认、MIME 魔数检查、内容安全审核和恶意文件扫描。
