# Changelog

English · [中文](CHANGELOG.zh-CN.md)

## Unreleased — fixes after v0.1.0

- Plan imports: enable SQLite WAL and a busy timeout, retry lock contention, and execute each plan import transaction through one pooled connection.
- Daily timeline: replace overlapping, stretched task blocks with a compact agenda, a time rail, and cards ordered by start time. Long titles and descriptions wrap; task actions and inline time editing have dedicated space.
- Desktop quick panel: scroll the content area when tasks exceed the window height. The drag header and settings remain fixed, with resizing still available.
- Notifications: display dismissible floating messages without shifting the page; success messages disappear automatically.
- Refresh: keep the current page mounted during saves, check-ins, and reloads to avoid jumping to the top and losing input focus. Do not show success when the subsequent data reload fails.

### Validation

- `npm test`: 8 tests passed, including a regression test that keeps the review field mounted and focused during a pending reload.
- `npm run build`: passed.
- `npm run tauri build`: passed; Windows executable generated locally.

These changes are in `main`. The existing v0.1.0 release archives predate these fixes; build from source to use them until a new release is published.
