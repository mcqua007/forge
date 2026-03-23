# Forge

A TDD-driven coding agent with configurable multi-model orchestration. Forge writes tests first, implements second, and proves everything with evidence. It uses adversarial multi-model review, a verification cascade, and organized commits — all with user approval before anything lands.

## How It Works

Forge follows a strict loop for every non-trivial task:

```
Phase 0  Triage — classify task size (S/M/L), pick testing strategy
Phase 1  Baseline — capture git state, build/test results before changes
Phase 2  Plan — survey codebase, identify patterns and blast radius
Phase 3  TDD Red — write failing tests that define acceptance criteria
Phase 4  TDD Green — implement minimal code to make tests pass
Phase 5  Refactor — improve quality while keeping tests green
Phase 6  Adversarial Review — independent model(s) hunt for real bugs
Phase 7  Verification Cascade — build, typecheck, lint, test, smoke test
Phase 8  Evidence Bundle — SQL-backed proof that everything passed
Phase 9  Commit Organization — logical, atomic commits matching repo style
Phase 10 User Approval — you review and approve before anything is committed
```

Small tasks (typos, config tweaks, one-liners) skip the full loop and use a fast path: implement → quick verify → ask to commit.

### Subagents

Forge delegates phases to specialized subagents, each assigned a model role:

| Agent               | Role      | Purpose                                                 |
| ------------------- | --------- | ------------------------------------------------------- |
| `forge-test-writer` | reasoning | Writes failing tests (TDD Red phase)                    |
| `forge-implementer` | execution | Implements minimal code to pass tests (TDD Green phase) |
| `forge-refactorer`  | execution | Improves code quality without changing behavior         |
| `forge-reviewer`    | review    | Adversarial code review — finds bugs, security issues   |
| `forge-committer`   | standard  | Organizes changes into logical commits                  |

### Model Roles

Models are assigned by role, and every role is configurable:

| Role        | Purpose                                              | Default Model       |
| ----------- | ---------------------------------------------------- | ------------------- |
| `reasoning` | Deep thinking — test design, planning, deep review   | `claude-opus-4-6`   |
| `execution` | Code writing — implementation, refactoring           | `claude-sonnet-4-6` |
| `review`    | Bug finding — adversarial code review                | `claude-sonnet-4-6` |
| `standard`  | Routine tasks — commit organization, simple analysis | `claude-sonnet-4-6` |
| `fast`      | Cheap & quick — simple formulaic tasks               | `claude-haiku-4-5`  |

### Verification Ledger

Every verification step is recorded in a SQL ledger (`forge_checks` table). The evidence bundle is generated from a `SELECT`, not from memory — preventing hallucinated verification. Gate checks block progress until required rows exist.

## Installation

### GitHub Copilot (VS Code / CLI)

**Option 1 — Install the plugin (recommended):**

```bash
copilot plugin install mcqua007/forge
```

**Option 2 — Clone into your extensions directory:**

```bash
git clone https://github.com/mcqua007/forge.git ~/.vscode/extensions/forge-agent
```

Then restart VS Code. Forge agents will appear in the Copilot agent picker.

**Option 3 — Add as a workspace agent:**

Clone or copy the repo into your project:

```bash
# From your project root
git clone https://github.com/mcqua007/forge.git .forge-agent
```

Or add it as a git submodule:

```bash
git submodule add https://github.com/mcqua007/forge.git .forge-agent
```

VS Code will detect the `.agent.md` files and make them available in Copilot Chat.

### Claude Code CLI

Copy the `agents/` folder into your project or into `~/.claude/agents/` for global access:

```bash
# Per-project
git clone https://github.com/mcqua007/forge.git .forge-agent
cp -r .forge-agent/agents/ .claude/agents/forge/

# Global (available in all projects)
mkdir -p ~/.claude/agents
git clone https://github.com/mcqua007/forge.git /tmp/forge
cp -r /tmp/forge/agents/ ~/.claude/agents/forge/
```

Then invoke directly:

```bash
claude --agent .claude/agents/forge/forge.agent.md
```

Or add to your `CLAUDE.md` to always load Forge:

```markdown
## Agents

Use the forge agent defined in .claude/agents/forge/forge.agent.md
```

## Configuration

Forge uses a cascading config system. Later sources override earlier ones:

1. **Plugin defaults** — `plugin.json` in the Forge repo (ships with sensible defaults)
2. **User config** — `~/.forge/config.json` (applies to all your projects)
3. **Repo config** — `.forge.json` in your project root (checked into version control)
4. **Runtime overrides** — say "cheap mode", "thorough mode", or "use gpt-5-4 for everything" in your prompt

### How Resolution Works

When Forge starts a task, it resolves each subagent's model in order:

```
plugin.json (defaults)
  ↓ deep-merge
~/.forge/config.json (user overrides)
  ↓ deep-merge
.forge.json (repo overrides)
  ↓
runtime prompt ("cheap mode", "use gpt-5-4 for everything", etc.)
  ↓
final model assignments
```

For each agent, the value in `models.agents` is checked:

- If it matches a **role name** (e.g. `"reasoning"`) → resolved through `models.roles` to get the model ID
- Otherwise → treated as a **literal model ID** from any vendor (`gpt-5-4`, `gemini-2-5-pro`, etc.)

### Override Examples

Create `~/.forge/config.json` (user-global) or `.forge.json` (per-repo). Only include the fields you want to override — everything else keeps the plugin defaults.

**Example 1 — Mix vendors for best-of-breed:**

```json
{
  "models": {
    "roles": {
      "reasoning": {
        "default": "gemini-2-5-pro"
      },
      "review": {
        "default": "gpt-5-4"
      }
    },
    "agents": {
      "forge-test-writer": "claude-opus-4-6",
      "forge-reviewer-deep": "gemini-2-5-pro"
    }
  }
}
```

This config:

- Uses **Gemini 2.5 Pro** for all `reasoning` tasks (planning, deep review)
- Uses **GPT-5-4** for all `review` tasks (adversarial code review)
- Pins `forge-test-writer` to **Claude Opus** directly (bypasses the `reasoning` role)
- Pins the deep reviewer to **Gemini 2.5 Pro** directly
- Leaves `execution`, `standard`, and `fast` roles at their Claude defaults

Resolved assignments:

| Agent                 | Config Value                  | Resolved Model    |
| --------------------- | ----------------------------- | ----------------- |
| `forge-test-writer`   | `"claude-opus-4-6"` (literal) | claude-opus-4-6   |
| `forge-implementer`   | `"execution"` (role)          | claude-sonnet-4-6 |
| `forge-refactorer`    | `"execution"` (role)          | claude-sonnet-4-6 |
| `forge-reviewer`      | `"review"` (role)             | gpt-5-4           |
| `forge-reviewer-deep` | `"gemini-2-5-pro"` (literal)  | gemini-2-5-pro    |
| `forge-committer`     | `"standard"` (role)           | claude-sonnet-4-6 |

> **Note:** `forge-reviewer-deep` is not a separate agent file — it reuses the `forge-reviewer` agent but is invoked with a stronger model. It only runs during Large tasks or tasks touching high-risk (🔴) files, where two reviewers run in parallel. It exists as a config key so its model can be overridden independently.

**Example 2 — Budget-friendly for a side project:**

```json
{
  "models": {
    "roles": {
      "reasoning": {
        "default": "claude-sonnet-4-6"
      },
      "standard": {
        "default": "claude-haiku-4-5"
      },
      "fast": {
        "default": "claude-haiku-4-5"
      }
    }
  }
}
```

Downgrades reasoning from Opus to Sonnet and uses Haiku for routine tasks — significantly cheaper while still getting adversarial review on Sonnet.

**Example 3 — Per-repo override for a payments service:**

```json
{
  "models": {
    "roles": {
      "review": {
        "default": "claude-opus-4-6"
      }
    },
    "agents": {
      "forge-reviewer-deep": "gemini-2-5-pro"
    }
  }
}
```

Upgrades review to Opus and the deep reviewer to Gemini 2.5 Pro — stronger security review for critical code. Check this `.forge.json` into the repo so the team shares the same config.

### Shortcut Overrides

Say these in your prompt to override for the current session:

| Prompt                              | Effect                                      |
| ----------------------------------- | ------------------------------------------- |
| **"cheap mode"** or **"fast mode"** | All roles resolve to the `fast` model       |
| **"thorough mode"**                 | All roles resolve to the `reasoning` model  |
| **"use gpt-5-4 for everything"**    | All agents resolve to that literal model ID |

These are session-only — they don't modify any config files.

## Usage

### In VS Code (Copilot Chat)

Open Copilot Chat and select the **forge** agent, then describe your task:

```
@forge Add a rate limiter to the /api/login endpoint — max 5 attempts per IP per minute
```

Forge will triage the task, run the full TDD loop, and present an evidence bundle with proposed commits for your approval.

### In Claude Code CLI

```bash
claude "Add a rate limiter to the /api/login endpoint — max 5 attempts per IP per minute"
```

With Forge loaded as your agent, it orchestrates the full loop automatically.

### Task Examples

```
# Bug fix (Medium — full TDD loop)
@forge Fix the off-by-one error in pagination when filtering by date

# New feature (Large — TDD + 2 adversarial reviewers + plan approval)
@forge Add JWT authentication to the API with refresh token rotation

# Small fix (Fast path — no TDD overhead)
@forge Fix the typo in the error message on line 42 of src/auth.ts

# Cost-conscious mode
@forge cheap mode — add input validation to the signup form

# Thorough mode for critical code
@forge thorough mode — refactor the payment processing pipeline
```

### What to Expect

1. **Forge announces its config** — which models are assigned to which roles
2. **Pushback** — if the request has issues, Forge will flag concerns before starting
3. **TDD cycle** — tests written and failing → implementation → tests passing → refactor
4. **Adversarial review** — independent model reviews your changes for real bugs
5. **Evidence bundle** — SQL-backed proof of every verification step
6. **Commit proposal** — logical, atomic commits matching your repo's style
7. **Your approval** — nothing is committed until you say so

## License

MIT
