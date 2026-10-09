# LifeOS + External LLM Workflow

LifeOS intentionally has no AI integration. The user controls which external LLM receives their plan context and review data. A fresh installation opens in English; use the top-bar language switch to choose Chinese if needed.

## 1. Generate a daily plan

Copy this prompt into ChatGPT, Claude, Gemini, or another JSON-capable model and replace the values in the context section:

```text
You are a daily planning assistant for LifeOS.

Return only one JSON object. Do not use Markdown fences. Do not add an explanation.
The object must validate against LifeOS daily-plan.schema.json:
- schema_version: "1.0"
- type: "daily_plan"
- plan_id is unique
- every task id is unique
- times use HH:mm
- every end_time is after start_time
- tasks do not overlap
- schedule tasks only inside the available time window

Context:
- Date: 2026-10-09
- Available time: 13:00-17:00
- Goals: Finish a small deliverable and review the result
- Constraints: Include one short recovery break
- Previous daily_review JSON:
  {paste the previous exported review here}
```

Save the returned JSON as a reference if desired, then paste it into LifeOS's import page. LifeOS validates and previews the plan before writing it locally.

## 2. Execute locally

Use the Today page to check tasks off, change status, edit times, add tasks, or skip tasks. All changes stay in the local SQLite database in the desktop build.

## 3. Export feedback

At the end of the day, fill in the Daily Review and click **Export review JSON**. The exported object uses this shape:

```json
{
  "schema_version": "1.0",
  "type": "daily_review",
  "date": "2026-10-09",
  "completion_status": "partial",
  "efficiency": 4,
  "cognitive_gains": "What I learned",
  "exploration": "What I tried",
  "autonomy": 5,
  "reflection": "What to keep or change tomorrow"
}
```

Give that JSON to the LLM with a follow-up instruction such as:

```text
Use this LifeOS daily_review JSON as feedback. Generate tomorrow's plan.
Keep what worked, adjust what failed, and return only a valid LifeOS daily_plan JSON object.
```

## 4. If validation fails

Ask the LLM to repair the JSON without changing the intent:

```text
Repair this JSON so it validates against LifeOS daily-plan.schema.json.
Return only JSON. Ensure unique task ids, HH:mm times, end_time after start_time,
and no overlapping tasks.
```
