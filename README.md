# 拾光内容库

跨平台内容库 Monorepo。目前包含 iOS `0.0.2` 基线和正在开发的微信小程序 `0.0.1`。两个客户端复用平台无关的 TypeScript 领域模型与应用服务，并分别实现 UI、路由、媒体和持久化适配。

当前发布策略是优先让微信小程序达到生产可用，随后扩展多端；长期会再过渡到 iOS 优先。客户端版本独立演进，跨端完成度以 `docs/capability-matrix.md` 为准。

## iOS 0.0.2

- 短文 / 长文章：按正文长度自动分类，也支持标题、正文与标签搜索
- 图片 / 多图 / 视频：从 iOS 相册多选，复制到 App 文档目录持久化
- 音频 / 文件：从系统文件选择器导入并持久化
- 内容流：类型筛选、收藏筛选、关键词搜索、创建时间倒序
- 内容详情：图片预览、原生视频控件、音频播放、文件信息
- 本地优先：SQLite 元数据 + App Documents 附件，卸载前不依赖网络
- 完整删除：删除内容时同步删除其本地附件
- 平台无关核心：Zod 校验、Immer 状态更新、RxJS 数据流、i18next 文案

## 环境要求

- Node.js `22.22.2`
- pnpm `11.10.0` 或兼容版本
- macOS + Xcode（运行 iOS Simulator）

```bash
nvm use
pnpm install
pnpm test
pnpm typecheck
pnpm ios
pnpm dev:mini
pnpm build:mini
pnpm build:api
pnpm check:release
```

第一次运行会由 Expo 启动 iOS Simulator。需要生成原生工程或使用自定义原生构建时，可以在 `apps/ios` 中执行 `pnpm exec expo prebuild --platform ios`。

## 仓库结构

```text
apps/
  ios/                 Expo SDK 56 iOS 适配层
  miniprogram/         Taro 4.2 微信小程序适配层
  api/                 NestJS 11 + Prisma 7 API
packages/
  core/                纯 TypeScript 领域与应用逻辑
  contracts/           跨端 API Zod 契约
  api-client/          平台无关 API Client
  sync-engine/         平台无关同步编排与队列边界
docs/
  architecture.md      架构决策与后续平台路线
  capability-matrix.md 跨端功能完成度
  miniprogram-roadmap.md 小程序生产路线
  api.md               API 配置、端点与运行方式
```

`@atlas/core` 不导入 React Native、Expo、DOM 或 Node.js 平台 API。后续 Android、Taro 小程序与 Next.js Web 都复用同一内容模型、校验规则、查询逻辑和应用服务，只替换路由、UI、文件选择器及持久化 Repository。

## 版本说明

项目选择需求中的 Expo SDK 56 分支。当前稳定版 Expo SDK 56 的官方兼容组合是 React Native `0.85.3` + React `19.2.3`；这与另一条“裸 React Native 0.84.1”候选路线不能混装。共享核心使用 TypeScript `6.0.3`，根目录将最低 Node 版本锁定为 `22.22.2`。

小程序当前已经具备本地内容流、搜索筛选、图文/视频/文件发布、详情、点赞与收藏，并已接通微信会话、离线队列、跨设备同步、用户关注、团队项目、内容版本、个人合集、评论回复和微信分享落地页。RC 代码侧已经补齐隐私授权入口、请求追踪、限流、生产配置约束、微信文本内容安全和严格发布自检；真实 PostgreSQL、微信凭证、对象存储、媒体安全及双端微信真机验收仍需在部署环境完成。完整门槛见 `docs/miniprogram-release-checklist.md`。
