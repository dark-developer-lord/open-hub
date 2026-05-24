# Open-Hub

<p align="center">
  <b>Open-source AI agent for your terminal.</b><br>
  17 providers · 24 built-in tools · MCP support · Goal-driven autonomous execution · Full system access
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sultonsho-nazarshoev/open-hub"><img src="https://img.shields.io/npm/v/%40sultonsho-nazarshoev%2Fopen-hub?color=cb3837&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@sultonsho-nazarshoev/open-hub"><img src="https://img.shields.io/npm/dm/%40sultonsho-nazarshoev%2Fopen-hub?color=cb3837" alt="npm downloads"></a>
  <a href="https://github.com/dark-developer-lord/open-hub"><img src="https://img.shields.io/github/stars/dark-developer-lord/open-hub?style=flat&color=yellow" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js"></a>
</p>

---

**Open-Hub** is a terminal AI agent that writes code, edits files, runs commands, controls your OS, and autonomously completes complex multi-step tasks — all from a single `ohagent` command.

No cloud dashboard. No subscriptions. Bring your own API key.

## Features

- **17 AI providers** out of the box — Anthropic, OpenAI, Google Gemini, Groq, Mistral, xAI, Perplexity, DeepSeek, Together AI, Fireworks, Cerebras, Cohere, Novita, Qwen, Ollama, Azure OpenAI, plus any custom OpenAI-compatible endpoint
- **Interactive model & key manager** — switch models and set API keys directly from the TUI with `/model` and `/keys`
- **MCP support** — connect any [Model Context Protocol](https://modelcontextprotocol.io) server with one command or env var
- **Goal-driven mode** — set a goal, the agent loops autonomously until it's done
- **24 built-in tools** — file system, shell, OS-level (clipboard, screenshots, notifications, AppleScript), process management
- **Session management** — save, resume, and name conversations
- **Context compaction** — automatically summarize long conversations to stay within model context limits
- **Dynamic providers** — add any OpenAI-compatible API via env vars, no code changes needed
- **Full system access** — read/write any file, run any command, control any app

## Quick Start

```bash
# Install globally
npm install -g @sultonsho-nazarshoev/open-hub

# Set an API key (pick any provider)
export ANTHROPIC_API_KEY=sk-ant-...

# Launch
ohagent
```

That's it. No config file needed on first run.

## Installation

### Prerequisites

- Node.js 18+
- npm 9+

### From npm (recommended)

```bash
npm install -g @sultonsho-nazarshoev/open-hub
```

### From source

```bash
git clone https://github.com/dark-developer-lord/open-hub.git
cd open-hub
npm install
npm run build   # TypeScript → dist/
npm link        # registers `ohagent` globally
```

## Configuration

On first run, Open-Hub creates `~/.open-hub/config.json` automatically.

### API keys via environment variables

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...
export GROQ_API_KEY=...
```

### API keys via TUI

You can add or update API keys without leaving the terminal — just type `/keys` inside a session:

```
/keys          → opens provider list; select a provider and paste your key
```

Keys are saved to `~/.open-hub/config.json` and take effect immediately.

### Other configuration variables

```env
# Defaults
DEFAULT_PROVIDER=anthropic
DEFAULT_MODEL=claude-opus-4-5

# Limits
MAX_TOKENS_PER_TURN=32768       # output tokens per model call
MAX_GOAL_ITERATIONS=200         # max iterations in --goal mode

# Permission mode
AGENT_PERMISSION_MODE=bypassPermissions
```

## Usage

### Interactive TUI

```bash
ohagent
```

Starts a full-screen TUI session. Type your task and the agent executes it using tools.

### One-shot mode

```bash
ohagent -p "explain this codebase"
ohagent -p "fix all TypeScript errors in src/"
```

### Goal-driven autonomous mode

The agent loops until the goal condition is satisfied:

```bash
ohagent --goal "all tests pass and there are no TypeScript errors"
ohagent --goal "implement the feature described in TASK.md" --max-iterations 300
```

### Specify model and provider

```bash
ohagent -m gpt-4o --provider openai
ohagent -m claude-opus-4-5
ohagent -m gemini-2.5-pro --provider google
ohagent -m llama-3.3-70b-versatile --provider groq
```

### Session management

```bash
ohagent -c                  # continue last session
ohagent -r my-project       # resume session by name or ID
```

### All CLI flags

| Flag | Description |
|---|---|
| `-p, --print <query>` | Non-interactive: run query and exit |
| `-m, --model <model>` | Model to use |
| `--provider <name>` | Provider to use |
| `-c, --continue` | Continue most recent session |
| `-r, --resume <id>` | Resume session by ID or name |
| `--goal <condition>` | Goal-driven autonomous mode |
| `--max-tokens <n>` | Max output tokens per turn (default: 32768) |
| `--max-iterations <n>` | Max goal loop iterations (default: 200) |
| `--permission-mode <mode>` | `bypassPermissions` \| `default` \| `plan` |
| `--mcp-config <path>` | Load MCP servers from JSON file |
| `--verbose` | Show detailed tool execution output |

## TUI commands

Type these inside an interactive session:

| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/model` | Open interactive model selector (↑↓ to navigate, Enter to confirm) |
| `/model <name>` | Switch model directly by name |
| `/keys` | Open API key manager (add or update keys per provider) |
| `/provider <name>` | Switch provider |
| `/providers` | List all available providers |
| `/goal <condition>` | Start autonomous goal loop |
| `/mcp list` | List connected MCP servers |
| `/mcp install <name>` | Install a popular MCP server |
| `/mcp catalog` | Browse popular MCP servers |
| `/provider add` | Add a custom provider interactively |
| `/integrations` | Show all active providers and MCP servers |
| `/sessions` | List saved sessions |
| `/save [name]` | Save current session |
| `/compact` | Summarize conversation to free context |
| `/tokens` | Show token usage |
| `/exit` | Exit |

## Providers

| Provider | Models | Notes |
|---|---|---|
| **Anthropic** | Claude Opus 4.5, Sonnet 4.5, Haiku 3.5 | Best for complex tasks |
| **OpenAI** | GPT-4o, o3, o4-mini, GPT-4.1 | |
| **Google** | Gemini 2.5 Pro/Flash, 2.0 Flash | Largest context |
| **Groq** | Llama 4, Llama 3.3, Qwen 2.5 | Fastest inference |
| **Mistral** | Magistral, Mistral Large/Medium/Small | |
| **xAI** | Grok-3, Grok-3-mini | |
| **Perplexity** | Sonar Large/Small | Web-search enabled |
| **DeepSeek** | DeepSeek R2, V3 | Cost-effective |
| **Together AI** | 500+ open-source models | |
| **Fireworks** | Llama, Qwen, DeepSeek | |
| **Cerebras** | Llama 3.3 70B | Hardware-accelerated |
| **Cohere** | Command A+, Command R+ | |
| **Novita AI** | Open-source models | |
| **Qwen** | Qwen3, QwQ, Qwen2.5-Coder | |
| **Ollama** | Any local model | No API key needed |
| **Azure OpenAI** | GPT-4o, o-series | Enterprise |
| **Custom** | Any OpenAI-compatible API | Via env vars |

### Add a custom OpenAI-compatible provider

Works with LM Studio, vLLM, OpenRouter, and any other OpenAI-compatible endpoint:

```env
PROVIDER_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
PROVIDER_OPENROUTER_API_KEY=sk-or-...
PROVIDER_OPENROUTER_NAME=OpenRouter
PROVIDER_OPENROUTER_MODELS=meta-llama/llama-4-scout,google/gemini-2.5-flash
```

## MCP (Model Context Protocol)

Connect external tools and data sources:

```bash
# Inside a session:
/mcp install memory          # persistent memory across sessions
/mcp install filesystem      # extended file access
/mcp install github          # GitHub integration
/mcp catalog                 # browse 13 popular servers
```

Or configure via `~/.open-hub/mcp.json` or env vars:

```env
MCP_SERVER_MEMORY_TYPE=stdio
MCP_SERVER_MEMORY_COMMAND=npx
MCP_SERVER_MEMORY_ARGS=-y,@modelcontextprotocol/server-memory
```

## Built-in Tools

### Shell
- **Bash** — run any command with full shell features

### File System
- **Read** — read any file with optional line ranges
- **Write** — create or overwrite files (auto-creates directories)
- **Edit** — precise string replacement in files
- **Delete** — delete files or directories
- **Move** — move or rename
- **Copy** — copy files or directories
- **MakeDir** — create directory trees
- **FileInfo** — metadata (size, permissions, timestamps)
- **Chmod** — change permissions
- **LS** — list directory contents
- **Glob** — find files by pattern
- **Grep** — search file contents

### System / OS (macOS + Linux)
- **Open** — open files, URLs, or applications
- **AppleScript** — automate any macOS app (Finder, Safari, Mail, etc.)
- **ClipboardRead / ClipboardWrite** — system clipboard
- **Notify** — desktop notifications
- **Screenshot** — capture screen or windows
- **ProcessList** — list running processes
- **KillProcess** — send signals to processes
- **SystemInfo** — CPU, memory, disk, network info
- **ListApps** — installed applications
- **Env** — read environment variables

## Development

```bash
git clone https://github.com/dark-developer-lord/open-hub.git
cd open-hub
npm install

# Dev mode (no build step)
npm run dev -- -p "hello"

# Type-check
npm run lint

# Build
npm run build
```

### Project structure

```
src/
├── index.ts              # CLI entry point & provider wiring
├── agent/
│   ├── Agent.ts          # Core agent loop
│   └── GoalManager.ts    # Goal-driven execution
├── providers/            # One file per AI provider
│   ├── OpenAICompatProvider.ts  # Abstract base class
│   └── ...
├── tools/
│   ├── BashTool.ts
│   ├── FileTool.ts       # All file system tools
│   ├── SystemTool.ts     # All OS-level tools
│   └── ToolRegistry.ts
├── mcp/
│   └── MCPManager.ts     # MCP client manager
├── commands/
│   └── CommandRegistry.ts # Slash commands
├── config/
│   └── Config.ts         # ~/.open-hub/config.json
├── session/
│   └── SessionManager.ts
└── ui/
    └── TUI.tsx           # ink-based terminal UI
```

## Contributing

Pull requests are welcome. For major changes, open an issue first.

## License

[MIT](LICENSE)

