# LifeOS

LifeOS 是一个离线优先的 Windows 桌面日程执行工具。用户可以从外部 AI 获取标准化的 LifeOS JSON v1 计划，在本地导入、执行、打卡、复盘，再导出 JSON 反馈给下一次计划生成。

当前版本是 v0.1 MVP，技术栈为 Tauri 2 + React + TypeScript + Vite + SQLite + Zod。

## 已实现的闭环

- 今日页面：日期选择、13:00–17:00 时间轴、当前任务、完成进度。
- 计划导入：粘贴 JSON 或选择本地文件，严格 Zod 验证并在保存前预览。
- 任务管理：打卡、修改状态、修改时间、添加和删除任务。
- 本地持久化：Tauri 运行时使用 `sqlite:lifeos.db`；浏览器开发模式使用 localStorage 回退。
- 每日复盘：完成情况、效率、认知收获、探索经历、自主性、文字反思。
- 导出：导出 `daily_review` JSON，或备份全部本地数据。
- 历史：按日期查看历史计划和复盘。重复导入会创建新版本，不覆盖旧计划或执行历史。
- 桌面便栏：主窗口右上角可打开无边框、置顶、可拖动的快捷任务面板；支持透明度调节和快速打卡。主窗口默认出现在 Windows 任务栏，右键图标即可固定。
- 错误处理：错误 JSON、重复任务 ID、时间冲突、SQLite/本地存储失败都会显示在界面中。

## 本地运行

本机已经有 Node.js 时，可以先运行浏览器开发版：

```powershell
npm install
npm run dev
```

浏览器开发版可以完整体验 UI、协议验证、导入、任务修改、复盘和导出；数据存放在浏览器的 LifeOS localStorage 中。

运行前端测试：

```powershell
npm test
```

构建前端静态资源：

```powershell
npm run build
```

## 运行 Tauri Windows 桌面版

需要额外安装：

1. Rust stable（通过 rustup）。
2. Windows 端 Microsoft C++ Build Tools。
3. WebView2 Runtime（Windows 11 通常已包含）。

安装 Rust 后，在项目目录运行：

```powershell
rustup default stable
npm install
npm run tauri dev
```

完成一次构建后，可以直接双击 `src-tauri/target/release/lifeos.exe`，或双击项目根目录的 `LifeOS.vbs` 无窗口启动桌面版。`LifeOS.cmd` 适合在终端中启动，双击它时可能会短暂显示命令行窗口。

打包命令：

```powershell
npm run tauri build
```

当前 `bundle.active` 设为 `false`，方便第一次先验证桌面运行；准备发布 Windows 安装包时再补充应用图标并打开 bundle。

## JSON 协议

独立 schema 位于 `schemas/`，虚构示例位于 `examples/`。Zod 运行时还补充了 JSON Schema 不方便表达的规则：任务 ID 唯一、结束时间晚于开始时间、同一计划内任务不能重叠。

- `schemas/daily-plan.schema.json`
- `schemas/daily-review.schema.json`
- `examples/daily-plan.example.json`
- `examples/daily-review.example.json`

导入同一天的第二份计划不会覆盖原版本；预览对话框会明确提示将创建新版本。SQLite 数据库、日志和私有备份文件已加入 `.gitignore`，不要把个人数据提交到 Git。

## 目录结构

```text
src/
  App.tsx                 UI 和 MVP 工作流
  lib/date.ts             日期、时间和 ID 工具
  lib/storage.ts          SQLite / 浏览器本地存储适配层
  validation/schemas.ts   Zod 协议校验
  validation/*.test.ts    协议测试
schemas/                  可独立给 AI 或其他客户端使用的 JSON Schema
examples/                 虚构协议示例
src-tauri/                Tauri 2 + SQLite 插件配置
```

## 当前剩余问题

- 本机尚未安装 Rust/Cargo，所以暂时不能在当前环境完成 Tauri 原生编译或 Windows 安装包验证；前端构建和协议测试不依赖 Rust。
- 文件导出目前使用 WebView 的下载能力；后续可接入 Tauri 原生保存对话框，让用户选择保存目录。
- 任务时间轴当前重点覆盖 13:00–17:00 MVP 窗口，跨越窗口的任务会被限制在视图边界内显示，未来可以扩展全天视图。
- 后续可在现有 storage/validation 边界上增加分析图表、AI 接入和数据库迁移版本。
