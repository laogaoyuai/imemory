# 拾光内容库

跨平台内容库的 `0.0.1` iOS MVP。当前版本可以在本地发布和管理短文、长文章、图片、多图、视频、音频，以及 Word、Excel、PowerPoint、PDF 等文件。

## 已实现

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
```

第一次运行会由 Expo 启动 iOS Simulator。需要生成原生工程或使用自定义原生构建时，可以在 `apps/ios` 中执行 `pnpm exec expo prebuild --platform ios`。

## 仓库结构

```text
apps/
  ios/                 Expo SDK 56 iOS 适配层
packages/
  core/                纯 TypeScript 领域与应用逻辑
docs/
  architecture.md      架构决策与后续平台路线
```

`@atlas/core` 不导入 React Native、Expo、DOM 或 Node.js 平台 API。后续 Android、Taro 小程序与 Next.js Web 都复用同一内容模型、校验规则、查询逻辑和应用服务，只替换路由、UI、文件选择器及持久化 Repository。

## 版本说明

项目选择需求中的 Expo SDK 56 分支。当前稳定版 Expo SDK 56 的官方兼容组合是 React Native `0.85.3` + React `19.2.3`；这与另一条“裸 React Native 0.84.1”候选路线不能混装。共享核心使用 TypeScript `6.0.3`，根目录将最低 Node 版本锁定为 `22.22.2`。

后端、账号同步、对象存储和跨设备发布不属于本地优先的 `0.0.1`，接口边界已经通过 `ContentRepository` 预留；详见架构文档。
