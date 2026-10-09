# LifeOS + 外部 LLM 使用流程

LifeOS 有意不内置 AI 接口。用户可以自行选择外部 LLM，并决定哪些计划上下文和复盘数据要交给它。

## 1. 生成每日计划

把下面的提示词复制到 ChatGPT、Claude、Gemini、通义千问或其他支持 JSON 的模型中，再替换上下文内容：

```text
你是 LifeOS 的每日计划助手。

只返回一个 JSON 对象。不要使用 Markdown 代码围栏，不要添加解释。
JSON 必须符合 LifeOS daily-plan.schema.json：
- schema_version 必须是 "1.0"
- type 必须是 "daily_plan"
- plan_id 唯一
- 每个任务的 id 唯一
- 时间使用 HH:mm
- 每个 end_time 晚于 start_time
- 任务之间不能重叠
- 任务只能安排在可用时间内

上下文：
- 日期：2026-10-09
- 可用时间：13:00-17:00
- 目标：完成一个小交付物并整理结果
- 约束：安排一次短暂恢复时间
- 上一天的 daily_review JSON：
  {在这里粘贴上一次导出的复盘 JSON}
```

把模型返回的 JSON 粘贴到 LifeOS 的导入页面。LifeOS 会在写入本地数据库前验证并预览计划变化。

## 2. 在 LifeOS 中执行

在今日页面打卡、修改任务状态、调整时间、添加任务或跳过任务。桌面版的所有执行记录都保存在本地 SQLite 中。

## 3. 导出反馈

完成当天任务后填写每日复盘，点击“导出复盘 JSON”。把导出的 JSON 交给 LLM，并附上：

```text
请根据这个 LifeOS daily_review JSON 生成明天的计划。
保留有效安排，调整未完成或低效率的部分，只返回有效的 LifeOS daily_plan JSON。
```

## 4. 验证失败时修复

如果模型输出的 JSON 无法导入，可以要求它只修复结构，不改变计划意图：

```text
请修复下面的 JSON，使其符合 LifeOS daily-plan.schema.json。
只返回 JSON。确保任务 id 唯一、时间是 HH:mm、end_time 晚于 start_time，且任务不重叠。
```
