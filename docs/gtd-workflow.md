# GTD Workflow Guide

How the Toodledo MCP server maps to the Getting Things Done methodology, and recommended workflows for using the GTD tools.

## Toodledo-to-GTD Mapping

### Folders = Projects

Toodledo folders represent GTD projects — multi-step outcomes you're working toward. They can also serve as long-term collections.

**Examples:** "Website Redesign", "Q3 Planning", "Books to Read", "Ideas"

### Contexts = @-Contexts

Toodledo contexts map to GTD @-contexts — the place, tool, or situation you need to do the work. Use them for batching similar actions together.

**Examples:** "@home", "@office", "@phone", "@errands", "@gemba"

### Status = Action States

The Toodledo status field maps to GTD action lifecycle states:

| Status | Value | GTD Meaning |
|--------|-------|-------------|
| None | 0 | Unprocessed — needs to be clarified and organized |
| Next Action | 1 | The very next physical action to move something forward |
| Active | 2 | Currently in progress |
| Planning | 3 | Project in the planning phase |
| Delegated | 4 | Assigned to someone else — track for follow-up |
| Waiting | 5 | Waiting for external input or a response |
| Hold | 6 | Paused temporarily |
| Postponed | 7 | Deferred to a later date |
| Someday | 8 | Someday/Maybe list — interesting but not committed |
| Canceled | 9 | No longer relevant |
| Reference | 10 | Reference material, not an action |

### Priority Levels

| Priority | Value | Use For |
|----------|-------|---------|
| Negative | -1 | Deprioritized items |
| Low | 0 | Normal priority |
| Medium | 1 | Above-average importance |
| High | 2 | Important and time-sensitive |
| Top | 3 | Critical — do first |

### Goals = Horizons of Focus

Toodledo goals map to GTD's horizons of focus at three levels:

| Level | GTD Horizon | Examples |
|-------|-------------|---------|
| Lifetime | Purpose and principles | "Build a sustainable business" |
| Long-term | 3-5 year vision | "Launch product line in APAC" |
| Short-term | 1-2 year goals | "Complete AWS certification" |

Goals can have parent-child relationships (`contributes_to`) to connect short-term goals to long-term goals and lifetime goals.

## The Inbox Pattern

The `.inbox` context serves as the GTD inbox — the single capture point for new ideas, tasks, and commitments before they are processed into the system.

### Capturing

When you have a quick thought or task to capture, add it with just a title. It goes to the inbox automatically via the `.inbox` context:

> "Add a task: Call dentist about appointment"

### Processing

Once a day, process the inbox by reviewing each item and deciding:
1. **What is it?** — Is it actionable?
2. **What's the next action?** — Define the concrete next step
3. **Organize it** — Assign a folder (project), context, status, and priority

Use `toodledo_gtd_review` to see your inbox items as part of the weekly review.

### How Inbox is Detected

The weekly review tool identifies inbox items as tasks with **no folder AND no context** — these are unprocessed captures that haven't been organized into the GTD system yet.

## Recommended Workflows

### Morning Routine: What Should I Do Now?

Use `toodledo_gtd_next_actions` to see all tasks with "Next Action" status. Filter by your current context to see only what's relevant:

> "Show me my next actions for @office"

Tasks are sorted by priority (highest first), then by due date (earliest first).

### Quick Capture: Brain Dump

When you need to capture something quickly without stopping to organize it:

> "Add a task: Research competitor pricing for Q4 proposal"

The task goes to your inbox for later processing.

### Weekly Review

Use `toodledo_gtd_review` to run through the GTD weekly review checklist:

1. **Inbox** — Process any uncaptured items
2. **Overdue** — Reschedule or complete overdue tasks
3. **Stalled Projects** — Folders with tasks but no defined next action need attention
4. **Waiting For** — Follow up on anything you're waiting on
5. **Someday/Maybe** — Review for anything ready to activate

> "Run my GTD weekly review"

### Dashboard Check

Use `toodledo_gtd_dashboard` for a quick health check of your system:

- Total incomplete tasks
- Overdue and due-today counts
- Breakdown by status, priority, folder, and context
- Today's due tasks listed individually

> "Show me my task dashboard"

This is useful for spotting imbalances (too many tasks in one status, a context growing out of control) and getting a quick pulse on workload.
