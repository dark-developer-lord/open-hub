# Agent CLI

<p align="center">
  <b>A powerful open-source AI agent for your terminal.</b><br>
  17 providers · 24 built-in tools · MCP support · Goal-driven autonomous execution · Full system access
</p>

<p align="center">
  <a href="https://github.com/dark-developer-lord/open-hub"><img src="https://img.shields.io/github/stars/dark-developer-lord/open-hub?style=flat&color=yellow" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js"></a>
</p>

---

Agent CLI is a terminal-based AI agent that can write code, edit files, run commands, control your OS, connect to any AI model, and autonomously complete complex multi-step tasks — all from a single `agent` command.

## Features

- **17 AI providers** out of the box: Anthropic, OpenAI, Google Gemini, Groq, Mistral, xAI, Perplexity, DeepSeek, Together AI, Fireworks, Cerebras, Cohere, Novita, Qwen, Ollama, Azure OpenAI — plus any custom OpenAI-compatible endpoint
- **MCP support** — connect any [Model Context Protocol](https://modelcontextprotocol.io) server with one command or env var
- **Goal-driven mode** — set a goal, agent loops autonomously until it's achieved
- **24 built-in tools** — file system, shell, OS-level (clipboard, screenshots, notifications, AppleScript), process management
- **Session management** — save, resume, and name conversations
- **Context compaction** — automatically summarize long conversations to stay within model context
- **Dynamic providers** — add any OpenAI-compatible API via env vars without touching code
- **Full system access** — read/write any file, run any command, control any app

## Quick Start

### Install from npm

```bash
npm install -g agent-cli
```

### Or build from source

```bash
git clone https://github.com/YOUR_USERNAME/agent-cli.git
cd agent-cli
npm install
npm run build
npm link
```

### Set your API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
# or any other provider key
```

### Run

```bash
agent
```

## Installation

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### From npm (recommended)

```bash
npm install -g agent-cli
```

### From source

```bash
git clone https://github.com/YOUR_USERNAME/agent-cli.git
cd agent-cli
npm install
npm run build   # compiles TypeScript → dist/
npm link        # registers `agent` command globally
```

## Configuration

On first run, agent-cli creates `~/.agent-cli/config.json` automatically.

### Environment variables

Copy `.env.example` to `.env` in any working directory:

```bash
cp .env.example .env
```

Key variables:

```env
# Provider API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
GROQ_API_KEY=...

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

### Interactive mode

```bash
agent
```

Starts a REPL session. Type your task, the agent executes it using tools and returns results.

### One-shot mode

```bash
agent -p "explain this codebase"
agent -p "fix all TypeScript errors in src/"
```

### Goal-driven mode

The agent loops autonomously until the goal condition is met:

```bash
agent --goal "all tests pass and there are no TypeScript errors"
agent --goal "implement the feature described in TASK.md" --max-iterations 300
```

### Specify model and provider

```bash
agent -m gpt-4o --provider openai
agent -m claude-opus-4-5
agent -m gemini-2.5-pro --provider google
agent -m llama-3.3-70b-versatile --provider groq
```

### Session management

```bash
agent -c                        # continue last session
agent -r my-project             # resume session by name or ID
```

### CLI flags

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

## Session commands

Inside an interactive session:

| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/model <model>` | Switch model |
| `/provider <name>` | Switch provider |
| `/providers` | List all available providers |
| `/goal <condition>` | Set a goal and start autonomous loop |
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

### Add a custom provider

Any OpenAI-compatible endpoint (LM Studio, vLLM, OpenRouter, etc.):

```env
PROVIDER_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
PROVIDER_OPENROUTER_API_KEY=sk-or-...
PROVIDER_OPENROUTER_NAME=OpenRouter
PROVIDER_OPENROUTER_MODELS=meta-llama/llama-4-scout,google/gemini-2.5-flash
```

## MCP (Model Context Protocol)

Connect external tools and data sources via MCP:

```bash
# Inside a session:
/mcp install memory          # persistent memory
/mcp install filesystem      # extended file access
/mcp install github          # GitHub integration
/mcp catalog                 # browse 13 popular servers
```

Or via `~/.agent-cli/mcp.json` or env vars:

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
git clone https://github.com/YOUR_USERNAME/agent-cli.git
cd agent-cli
npm install

# Run in dev mode (no build step needed)
npm run dev -- -p "hello"

# Type-check
npm run lint

# Build
npm run build
```

### Project structure

```
src/
├── index.ts              # CLI entry point
├── agent/
│   ├── Agent.ts          # Core agent loop
│   └── GoalManager.ts    # Goal-driven execution
├── providers/            # One file per AI provider
│   ├── OpenAICompatProvider.ts  # Abstract base
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
│   └── Config.ts
├── session/
│   └── SessionManager.ts
└── ui/
    └── colors.ts
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

