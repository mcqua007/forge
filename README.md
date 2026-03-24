# Forge

A TDD-driven coding agent with configurable multi-model orchestration. Forge writes tests first, implements second, and proves everything with evidence. It uses adversarial multi-model review, a verification cascade, and organized commits — all with user approval before anything lands.

## Quick Start

Choose the path that matches where you want to use Forge.

| Environment                       | Minimal setup                                                                                                                                                                                                                             | What happens next                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| VS Code Copilot Chat              | `copilot plugin install mcqua007/forge`                                                                                                                                                                                                   | Reload VS Code, open Copilot Chat, and select `forge` from the agent picker.                       |
| GitHub Copilot CLI runtime helper | `git clone https://github.com/mcqua007/forge.git && cd forge && npm install && cp .forge-host.copilot.example.json .forge-host.json && npm run run-agent:config -- --agent forge-reviewer --prompt "Review the staged changes" --dry-run` | Edit `.forge-host.json` so it matches the exact Copilot CLI flags supported by your local install. |
| Claude Code CLI                   | `git clone https://github.com/mcqua007/forge.git && cd forge && mkdir -p ~/.claude/agents/forge && cp -r agents/* ~/.claude/agents/forge/ && claude --agent ~/.claude/agents/forge/forge.agent.md`                                        | Forge loads as a Claude agent bundle and can be referenced again from `CLAUDE.md`.                 |

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

### Copilot Orchestration

Forge now follows VS Code's documented coordinator-and-worker pattern for custom agents:

- `forge` is the user-facing coordinator and explicitly restricts subagent delegation to the Forge worker agents.
- Worker agents (`forge-test-writer`, `forge-implementer`, `forge-refactorer`, `forge-reviewer`, `forge-committer`) are marked `user-invocable: false` in Copilot so they stay available for subagent use without cluttering the agent picker.
- Guided `handoffs` mirror the TDD flow: Red → Green → Refactor → Review → Commit organization.
- Hooks are **not enabled by default**. Copilot custom-agent hooks are still preview-only and require `chat.useCustomAgentHooks`; Forge keeps hook behavior in instructions for now instead of shipping environment-specific commands.

### Model Roles

Models are assigned by role, and every role is configurable:

| Role        | Purpose                                              | Default Model       |
| ----------- | ---------------------------------------------------- | ------------------- |
| `reasoning` | Deep thinking — test design, planning, deep review   | `claude-opus-4-6`   |
| `execution` | Code writing — implementation, refactoring           | `gpt-5-4`           |
| `review`    | Bug finding — adversarial code review                | `gpt-5-4`           |
| `standard`  | Routine tasks — commit organization, simple analysis | `claude-sonnet-4-6` |
| `fast`      | Cheap & quick — simple formulaic tasks               | `claude-haiku-4-5`  |

### Verification Ledger

Every verification step is recorded in a SQL ledger (`forge_checks` table). The evidence bundle is generated from a `SELECT`, not from memory — preventing hallucinated verification. Gate checks block progress until required rows exist.

## Installation

### VS Code Copilot Chat

Use this path when you want Forge to show up in the Copilot Chat agent picker inside VS Code.

1. Install GitHub Copilot and GitHub Copilot Chat in VS Code.
2. Install Forge as a Copilot plugin:

```bash
copilot plugin install mcqua007/forge
```

3. Restart VS Code or reload the window.
4. Open Copilot Chat and choose `forge` from the agent picker.

If you prefer a local checkout instead of plugin install, clone the repo into your workspace or extensions directory:

```bash
# Workspace-local
git clone https://github.com/mcqua007/forge.git .forge-agent

# Or under your VS Code extensions directory
git clone https://github.com/mcqua007/forge.git ~/.vscode/extensions/forge-agent
```

VS Code will detect the `.agent.md` files in `agents/`. The `forge` coordinator is the user-facing agent. The worker agents stay hidden for orchestration because they are marked `user-invocable: false`.

### GitHub Copilot CLI

There are two different Copilot CLI use cases:

1. Native plugin installation, so Forge is installed in the Copilot ecosystem.
2. Optional runtime-helper execution, where Forge resolves a worker and model and then expands a local Copilot CLI command template.

#### Native Plugin Install

Use this if your goal is simply to install Forge as a Copilot plugin:

1. Install the Copilot CLI on your machine.
2. Install Forge as a Copilot plugin:

```bash
copilot plugin install mcqua007/forge
```

This installs Forge as a Copilot plugin, but it does not by itself configure a local host-command template for model-aware CLI execution.

#### Optional Runtime-Helper Flow

Use this path when you want Forge’s model resolution and worker selection to drive a local Copilot CLI command.

3. Clone this repo somewhere local if you want the runtime helper scripts:

```bash
git clone https://github.com/mcqua007/forge.git
cd forge
npm install
```

4. Start from the included Copilot host template:

```bash
cp .forge-host.copilot.example.json .forge-host.json
```

5. Adjust `.forge-host.json` so the `command` and `args` match the exact Copilot CLI invocation supported by your local version.
6. Dry-run the resolved invocation:

```bash
npm run run-agent:config -- --agent forge-reviewer --prompt "Review the staged changes" --dry-run
```

If you want to use the checked-in starter directly, you can also run:

```bash
npm run run-agent:copilot -- --agent forge-reviewer --prompt "Review the staged changes" --dry-run
```

Forge will resolve the configured worker model first, then substitute `{agent}`, `{modelId}`, `{vscodeModel}`, and `{prompt}` into the Copilot CLI command template.

This runtime-helper flow is optional. It is for users who want Forge’s config cascade to drive a concrete local CLI invocation instead of only installing the plugin.

### Claude Code CLI

Use this path when you want Forge loaded as a Claude agent bundle.

1. Install Claude Code CLI.
2. Clone this repo:

```bash
git clone https://github.com/mcqua007/forge.git
cd forge
```

3. Choose either project-local or global agent installation.

Project-local:

```bash
mkdir -p .claude/agents/forge
cp -r agents/* .claude/agents/forge/
```

Global:

```bash
mkdir -p ~/.claude/agents/forge
cp -r agents/* ~/.claude/agents/forge/
```

4. Run Forge directly:

```bash
claude --agent .claude/agents/forge/forge.agent.md
```

Or, if you installed globally:

```bash
claude --agent ~/.claude/agents/forge/forge.agent.md
```

You can also reference the agent from `CLAUDE.md` so it is easy to reuse across tasks:

```markdown
## Agents

Use the forge agent defined in .claude/agents/forge/forge.agent.md
```

If you want Forge’s runtime helper to launch Claude Code with resolved worker/model values, start from the included template:

```bash
cp .forge-host.claude.example.json .forge-host.json
npm install
npm run run-agent:config -- --agent forge-reviewer-deep --prompt "Deep review the staged changes" --dry-run
```

## Model Configuration

Forge uses a cascading config system. Later sources override earlier ones:

1. `plugin.json` in the Forge repo
2. `~/.forge/config.json` for user-wide overrides
3. `.forge.json` in the target repository for repo-specific overrides
4. Runtime overrides such as "cheap mode" or `--agent-model`

### Default Role Mapping

These are the current default role assignments from `plugin.json`:

| Agent                 | Role        | Default Model       |
| --------------------- | ----------- | ------------------- |
| `forge-test-writer`   | `reasoning` | `claude-opus-4-6`   |
| `forge-implementer`   | `execution` | `gpt-5-4`           |
| `forge-refactorer`    | `execution` | `gpt-5-4`           |
| `forge-reviewer`      | `review`    | `gpt-5-4`           |
| `forge-reviewer-deep` | `reasoning` | `claude-opus-4-6`   |
| `forge-committer`     | `standard`  | `claude-sonnet-4-6` |

Use role overrides when you want to change a whole class of work, such as all reviewers or all execution agents. Use agent overrides when you want to pin one specific worker.

### Change a Role Model

To change the model used for a role such as reviewers, test writers, or implementers, create either `~/.forge/config.json` or `.forge.json` and override `models.roles`.

Example: change all `review` work to Claude Opus and all `execution` work to Claude Sonnet:

```json
{
  "models": {
    "roles": {
      "review": {
        "default": "claude-opus-4-6"
      },
      "execution": {
        "default": "claude-sonnet-4-6"
      }
    }
  }
}
```

That changes:

- `forge-reviewer` because it points at the `review` role
- `forge-implementer` and `forge-refactorer` because they point at the `execution` role

### Change One Specific Agent

To pin only one worker without changing the whole role, override `models.agents`.

Example: keep the normal reviewer on the `review` role, but pin the test writer and deep reviewer to specific literal models:

```json
{
  "models": {
    "agents": {
      "forge-test-writer": "claude-opus-4-6",
      "forge-reviewer-deep": "gemini-2-5-pro"
    }
  }
}
```

If an entry in `models.agents` matches a role name such as `review` or `execution`, Forge resolves that role through `models.roles`. If it does not match a role name, Forge treats it as a literal model ID.

### Preview and Apply Model Changes

After changing models, inspect what Forge now resolves:

```bash
npm run resolve-models
```

Check for drift or invalid mappings:

```bash
npm run doctor-models
```

If you use Forge inside VS Code Copilot Chat, sync the resolved model names into the worker agent frontmatter:

```bash
npm run sync-models -- --write
```

VS Code custom agents do not read Forge’s JSON cascade directly. The sync step writes the resolved `model:` value into the worker `.agent.md` files so VS Code uses the same assignments.

Fail CI when config and checked-in worker frontmatter diverge:

```bash
npm run check-models
```

### Runtime Overrides

You can also override models for a single run without editing config files.

Examples:

```bash
npm run sync-models -- --write --mode thorough
npm run sync-models -- --write --all-model gpt-5-4
npm run sync-models -- --write --agent-model forge-reviewer=claude-opus-4-6
```

Or in a prompt:

- "cheap mode" or "fast mode" makes all roles resolve to the `fast` model
- "thorough mode" makes all roles resolve to the `reasoning` model
- "use gpt-5-4 for everything" makes all agents resolve to that literal model ID

### Host Templates and Command Shape

Forge can resolve which model a worker should use, but it still needs to know how your local CLI should be invoked.

That command shape includes:

- which binary to run, such as `claude` or `copilot`
- whether the CLI expects `chat`, `run`, or another subcommand
- whether the prompt is positional or passed with `--prompt`
- whether model selection is supported directly and, if so, which flag it expects

Starter templates are included in:

- `.forge-host.example.json`
- `.forge-host.claude.example.json`
- `.forge-host.copilot.example.json`

Use `--dry-run` first, then edit the template to match your installed CLI version.

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
- Leaves `execution`, `standard`, and `fast` roles at their plugin defaults

Resolved assignments:

| Agent                 | Config Value                  | Resolved Model    |
| --------------------- | ----------------------------- | ----------------- |
| `forge-test-writer`   | `"claude-opus-4-6"` (literal) | claude-opus-4-6   |
| `forge-implementer`   | `"execution"` (role)          | gpt-5-4           |
| `forge-refactorer`    | `"execution"` (role)          | gpt-5-4           |
| `forge-reviewer`      | `"review"` (role)             | gpt-5-4           |
| `forge-reviewer-deep` | `"gemini-2-5-pro"` (literal)  | gemini-2-5-pro    |
| `forge-committer`     | `"standard"` (role)           | claude-sonnet-4-6 |

> **Note:** `forge-reviewer-deep` is a separate worker agent file and defaults to the `reasoning` role. Use it when you want a stronger deep-review pass than the standard reviewer.

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
