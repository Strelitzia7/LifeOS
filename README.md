# LifeOS

LifeOS 是一个离线优先的 Windows 桌面应用：从外部 AI 导入标准化日程，在本地执行任务、记录完成情况和每日复盘，再导出 JSON 反馈给下一次计划生成。

当前版本：**v0.1.0 MVP**

[下载 Windows 便携版](https://github.com/Strelitzia7/LifeOS/releases/tag/v0.1.0) · [查看 JSON Schema](schemas/) · [提交 Issue](https://github.com/Strelitzia7/LifeOS/issues)

## 下载和运行

从 [Releases](https://github.com/Strelitzia7/LifeOS/releases) 下载 `LifeOS-v0.1.0-windows-x64.zip`，解压后双击 `LifeOS.exe` 即可运行。

这是一个便携版，不需要安装器，不需要登录，也不需要网络服务。Windows 10/11 需要 WebView2 Runtime；Windows 11 通常已经自带。

## v0.1.0 功能

- 今日页面：日期选择、13:00–17:00 时间轴、当前任务和完成进度。
- 计划导入：粘贴 JSON 或选择本地文件，严格验证 LifeOS JSON v1，并在保存前预览变化。
- 任务管理：打卡、修改状态、调整时间、添加和删除任务。
- 每日复盘：完成情况、效率、认知收获、探索经历、自主性和文字反思。
- 数据导出：导出 `daily_review` JSON，或备份全部个人数据。
- 历史记录：查看以前的计划版本和复盘。
- 桌面便栏：无边框、置顶、可拖动、可调整大小和透明度，支持快速打卡。
- 深色模式和 Windows 桌面友好的交互。

重复导入同一天的计划会创建新版本，不会悄悄覆盖旧计划或执行历史。任务 ID、时间顺序、时间冲突、JSON 格式和存储错误都会被检查并显示。

## 隐私和数据

- 所有个人数据默认只保存在本机。
- Tauri 桌面版使用本地 SQLite 数据库 `lifeos.db`。
- 不需要账号，不调用外部 API，没有遥测，没有云同步。
- 复盘、数据库、日志、构建目录和备份文件不会提交到 Git。

## 技术栈

- Tauri 2
- React + TypeScript + Vite
- SQLite（`tauri-plugin-sql`）
- Zod 运行时验证
- Windows 原生发布目标

## 从源码运行

### 环境要求

- Node.js 24+ 和 npm
- Rust stable（MSVC toolchain）
- Windows C++ Build Tools
- WebView2 Runtime

### 前端开发模式

```powershell
npm install
npm run dev
```

浏览器开发模式使用 localStorage 作为存储回退，可以体验 UI、协议验证、任务、复盘和导出；原生桌面版使用 SQLite。

### 测试和构建

```powershell
npm test
npm run build
npm run tauri dev
npm run tauri build
```

原生构建产物位于 `src-tauri/target/release/lifeos.exe`。

## JSON 协议

协议文件和虚构示例位于：

- [`schemas/daily-plan.schema.json`](schemas/daily-plan.schema.json)
- [`schemas/daily-review.schema.json`](schemas/daily-review.schema.json)
- [`examples/daily-plan.example.json`](examples/daily-plan.example.json)
- [`examples/daily-review.example.json`](examples/daily-review.example.json)

协议版本使用 `schema_version: "1.0"`。Zod 运行时还补充验证了 JSON Schema 不方便表达的规则：任务 ID 唯一、结束时间晚于开始时间、同一计划内任务不能重叠。

## 项目结构

```text
src/
  App.tsx                 React 页面、任务管理和桌面便栏
  lib/storage.ts          SQLite / localStorage 存储适配层
  lib/date.ts             日期、时间和 ID 工具
  validation/             Zod schema 和测试
schemas/                  可独立使用的 JSON Schema
examples/                 虚构协议示例
src-tauri/                Tauri 2、SQLite、权限和 Windows 配置
```

## 分支和发布策略

- `main`：始终保持可以运行和发布，当前 MVP 已在这里。
- `feature/*`：新功能和较大修改使用功能分支开发，完成后合并到 `main`。
- 发布使用版本标签，例如 `v0.1.0`，并在 GitHub Releases 附带 Windows 便携包。

## 当前限制

- v0.1 重点覆盖 13:00–17:00 时间窗口，全天时间轴和统计图表留到后续版本。
- 当前发布是便携版，还没有 MSI/NSIS 安装器。
- AI 接入、云同步、账号和遥测不在 MVP 范围内。

## License

[MIT](LICENSE)
