# LifeOS

LifeOS is an offline-first Windows desktop app for turning AI-generated daily plans into local, executable work. Import a standard plan, complete tasks, write a daily review, and export feedback JSON for the next plan.

Current version: **v0.1.0 MVP**

[中文 README](README.md) · [Download Windows portable build](https://github.com/Strelitzia7/LifeOS/releases/tag/v0.1.0) · [JSON Schemas](schemas/)

## Download and run

Download `LifeOS-v0.1.0-windows-x64.zip` from [GitHub Releases](https://github.com/Strelitzia7/LifeOS/releases), extract it, and double-click `LifeOS.exe`.

This is a portable build. It does not require an installer, account, cloud service, or network connection. Windows 10/11 requires WebView2 Runtime; it is normally included with Windows 11.

## Features

- Today view with a 13:00–17:00 timeline, current task, and progress.
- Strict LifeOS JSON v1 import from pasted text or a local file, with preview before saving.
- Task check-in, status changes, time editing, task creation, and deletion.
- Daily review for completion, efficiency, cognitive gains, exploration, autonomy, and reflection.
- `daily_review` JSON export and full local backup export.
- History for previous plans and reviews.
- Desktop quick panel with always-on-top, drag, resize, opacity, font-size controls, and quick check-in.
- Dark mode and Windows-friendly desktop interactions.

Importing another plan for the same date creates a new version and never silently overwrites execution history.

## Using LifeOS with another LLM

LifeOS does not call an AI service. You can use ChatGPT, Claude, Gemini, or any LLM that can return JSON:

1. Give the LLM the prompt in [`docs/llm-workflow.md`](docs/llm-workflow.md), together with your goals, available time, and constraints.
2. Ask for only one valid `daily_plan` JSON object. Do not allow Markdown fences or explanation text.
3. Paste the JSON into LifeOS, validate it, preview the changes, and save it.
4. Execute tasks and complete the daily review.
5. Export `daily_review` JSON and provide it to the LLM to generate the next day’s plan.

Minimal prompt:

```text
You are a LifeOS daily planner. Return only one valid JSON object.
It must use schema_version "1.0", type "daily_plan", unique task ids,
valid HH:mm times, no overlapping tasks, and the structure in
schemas/daily-plan.schema.json.
Plan the following goals for 13:00-17:00:
- Goals: ...
- Constraints: ...
- Previous daily_review JSON: ...
```

## JSON examples

- [`examples/daily-plan.example.json`](examples/daily-plan.example.json)
- [`examples/daily-review.example.json`](examples/daily-review.example.json)
- [`schemas/daily-plan.schema.json`](schemas/daily-plan.schema.json)
- [`schemas/daily-review.schema.json`](schemas/daily-review.schema.json)

## Privacy and storage

- Personal data stays on the local machine by default.
- The Tauri desktop build uses a local SQLite database.
- No login, external API calls, telemetry, or cloud sync.
- Databases, logs, build output, and personal backups are ignored by Git.

## Development

Requirements: Node.js 24+, Rust stable with the MSVC toolchain, Windows C++ Build Tools, and WebView2 Runtime.

```powershell
npm install
npm test
npm run build
npm run tauri dev
npm run tauri build
```

The native executable is generated at `src-tauri/target/release/lifeos.exe`.

## Branches and releases

- `main` stays runnable and release-ready.
- Use `feature/*` branches for new features and larger changes.
- Releases use version tags such as `v0.1.0` and attach a Windows portable archive.

## License

[MIT](LICENSE)
