#!/usr/bin/env node
import { createInterface } from 'readline'
import { program, Command } from 'commander'
import { agent } from './agent/Agent.js'
import { goalManager } from './agent/GoalManager.js'
import { commandRegistry } from './commands/CommandRegistry.js'
import { providerRegistry } from './providers/index.js'
import { mcpManager } from './mcp/MCPManager.js'
import { sessionManager } from './session/SessionManager.js'
import { colors, banner, separator } from './ui/colors.js'
import config from './config/Config.js'
import { readFileSync, existsSync } from 'fs'

// Extract positional query BEFORE commander parses (avoids "unknown command" error)
const KNOWN_SUBCOMMANDS = ['mcp', 'auth', 'setup', 'help']
const rawArgs = process.argv.slice(2)
const firstPositional = rawArgs.find(a => !a.startsWith('-') && !rawArgs[rawArgs.indexOf(a) - 1]?.match(/^(-p|--print|-m|--model|--provider|-r|--resume|--goal|--mcp-config|--permission-mode|--max-tokens|--max-iterations)$/))
const initialQuery = firstPositional && !KNOWN_SUBCOMMANDS.includes(firstPositional) ? firstPositional : undefined

// Remove the query from argv so commander doesn't see it as an unknown command
if (initialQuery) {
  const idx = process.argv.indexOf(initialQuery)
  process.argv.splice(idx, 1)
}

// ── CLI Setup ────────────────────────────────────────────────────────────────

program
  .name('agent')
  .description('AI Agent CLI — Multi-provider, MCP-connected, Goal-driven')
  .version('1.0.0')
  .option('-p, --print <query>', 'Run query autonomously and exit (non-interactive)')
  .option('-m, --model <model>', 'Model to use (e.g. claude-opus-4-5, gpt-4o)')
  .option('--provider <provider>', 'Provider to use (anthropic, openai, google, groq)')
  .option('-c, --continue', 'Continue most recent session')
  .option('-r, --resume <session>', 'Resume session by ID or name')
  .option('--goal <condition>', 'Explicit goal — agent loops until achieved')
  .option('--mcp-config <path>', 'Load MCP servers from JSON file')
  .option('--permission-mode <mode>', 'Permission mode (default, plan, bypassPermissions)')
  .option('--max-tokens <n>', 'Max output tokens per turn (default: 32768)')
  .option('--max-iterations <n>', 'Max goal loop iterations (default: 200)')
  .option('--verbose', 'Verbose tool output')
  .option('--no-banner', 'Skip the banner')
  .option('--no-tui', 'Use classic REPL instead of TUI')
  .allowUnknownOption(false)
  .allowExcessArguments(true)
  .action(() => { /* default action — prevents commander from showing help on no-args */ })

// ── Subcommands ──────────────────────────────────────────────────────────────

const mcpCmd = new Command('mcp')
  .description('List configured MCP servers')
  .action(async () => {
    const servers = config.loadMCPServers()
    const entries = Object.entries(servers)
    if (entries.length === 0) {
      console.log(colors.muted('No MCP servers configured. Use /mcp inside a session to add one.'))
    } else {
      console.log(`\n${colors.bold('MCP Servers')}`)
      for (const [name, cfg] of entries) {
        console.log(`  ${colors.accent(name)} [${cfg.type}] ${cfg.url || cfg.command || ''}`)
      }
    }
    process.exit(0)
  })
program.addCommand(mcpCmd)

const authCmd = new Command('auth')
  .description('Show configured API keys')
  .action(() => {
    const cfg = config.get()
    console.log(`\n${colors.bold('Authentication Status')}`)
    console.log(separator())
    const providers = [
      { name: 'Anthropic', key: cfg.providers.anthropic?.apiKey },
      { name: 'OpenAI', key: cfg.providers.openai?.apiKey },
      { name: 'Google', key: cfg.providers.google?.apiKey },
      { name: 'Groq', key: cfg.providers.groq?.apiKey },
      { name: 'Mistral', key: cfg.providers.mistral?.apiKey },
      { name: 'xAI', key: cfg.providers.xai?.apiKey },
      { name: 'DeepSeek', key: cfg.providers.deepseek?.apiKey },
    ]
    for (const p of providers) {
      const status = p.key ? colors.success('✓ configured') : colors.error('✗ not set')
      console.log(`  ${p.name}: ${status}`)
    }
    console.log()
    console.log(colors.muted('  Edit ~/.agent-cli/config.json or set env vars (ANTHROPIC_API_KEY, etc.)'))
    process.exit(0)
  })
program.addCommand(authCmd)

const setupCmd = new Command('setup')
  .description('Request macOS permissions and create config files')
  .action(async () => {
    const { runSetup } = await import('./setup/Permissions.js')
    await runSetup()
    process.exit(0)
  })
program.addCommand(setupCmd)

// ── Main Function ────────────────────────────────────────────────────────────

async function main() {
  program.parse()
  const opts = program.opts()

  // Apply CLI options to config
  if (opts.provider || opts.model) {
    try {
      if (opts.provider) {
        providerRegistry.setProvider(opts.provider, opts.model)
      } else if (opts.model) {
        providerRegistry.setModel(opts.model)
      }
    } catch (err) {
      console.error(colors.error(String(err)))
      process.exit(1)
    }
  }

  if (opts.permissionMode) {
    config.set('permissionMode', opts.permissionMode)
  }

  if (opts.maxTokens) {
    const n = parseInt(opts.maxTokens)
    if (!isNaN(n) && n > 0) config.set('defaults', { ...config.get().defaults, maxTokens: n })
  }

  if (opts.maxIterations) {
    const n = parseInt(opts.maxIterations)
    if (!isNaN(n) && n > 0) config.set('agent', { ...config.get().agent, maxGoalIterations: n })
  }

  // Load MCP config from file
  if (opts.mcpConfig) {
    try {
      const mcpData = JSON.parse(readFileSync(opts.mcpConfig, 'utf-8'))
      for (const [name, serverCfg] of Object.entries(mcpData.mcpServers || {})) {
        config.saveMCPServer(name, serverCfg as Parameters<typeof config.saveMCPServer>[1])
      }
    } catch (err) {
      console.error(colors.error(`Failed to load MCP config: ${err}`))
    }
  }

  // Load MCP servers
  await mcpManager.loadServers()

  // ── Check configured providers ─────────────────────────────────────────────
  const configuredProviders = providerRegistry.listConfiguredProviders()
  if (configuredProviders.length === 0) {
    console.log()
    console.log(colors.warning('⚠️  No AI provider configured.'))
    console.log()
    console.log(colors.muted('  Set at least one API key to get started:'))
    console.log(colors.muted('    export ANTHROPIC_API_KEY=sk-ant-...'))
    console.log(colors.muted('    export OPENAI_API_KEY=sk-...'))
    console.log(colors.muted('    export GROQ_API_KEY=...  (free tier available — groq.com)'))
    console.log()
    console.log(colors.muted('  Or copy and edit the config file:'))
    console.log(colors.muted('    cp .env.example .env && nano .env'))
    console.log()
    process.exit(1)
  }

  // Auto-switch to a configured provider if the default one has no key
  const defaultProvider = config.get().defaults.provider
  if (!configuredProviders.includes(defaultProvider)) {
    const first = configuredProviders[0]
    providerRegistry.setProvider(first)
  }

  // ── Non-interactive mode: agent -p "query" ─────────────────────────────────
  const query = opts.print || initialQuery

  if (opts.print) {
    // Restore session if requested
    if (opts.continue) {
      const recent = sessionManager.getMostRecent(process.cwd())
      if (recent) agent.setMessages(recent.messages)
    } else if (opts.resume) {
      const session = sessionManager.load(opts.resume) || sessionManager.loadByName(opts.resume)
      if (session) agent.setMessages(session.messages)
    }
    // Single chat turn — print response and exit
    await agent.turn(opts.print)
    await mcpManager.disconnectAll()
    process.exit(0)
  }

  // ── Interactive mode ───────────────────────────────────────────────────────

  // Session setup
  if (opts.continue) {
    const recent = sessionManager.getMostRecent(process.cwd())
    if (recent) {
      agent.setMessages(recent.messages)
      sessionManager.setCurrentSessionId(recent.meta.id)
    }
  } else if (opts.resume) {
    const session = sessionManager.load(opts.resume) || sessionManager.loadByName(opts.resume)
    if (session) {
      agent.setMessages(session.messages)
      sessionManager.setCurrentSessionId(session.meta.id)
    }
  } else {
    const session = sessionManager.createSession()
    sessionManager.setCurrentSessionId(session.meta.id)
  }

  const provider = providerRegistry.getCurrentProvider()
  const model = providerRegistry.getCurrentModel()
  const mcpCount = mcpManager.getAllServers().filter((s) => s.connected).length

  // ── TUI mode (default) ────────────────────────────────────────────────────
  const useTUI = opts.tui !== false  // true unless --no-tui passed

  if (useTUI) {
    const { startTUI } = await import('./ui/TUI.js')

    // Slash command handler that returns display text for TUI
    const onSlashCommand = async (input: string): Promise<string | undefined> => {
      const lines: string[] = []
      const origLog   = console.log
      const origError = console.error
      const capture = (...args: unknown[]) =>
        lines.push(args.map(String).join(' ').replace(/\x1b\[[0-9;]*m/g, ''))
      console.log   = capture
      console.error = capture
      const fakeRepl = {
        clearScreen: () => { lines.push('[screen cleared]') },
        exit: () => {
          console.log   = origLog
          console.error = origError
          mcpManager.disconnectAll().then(() => process.exit(0))
        },
        pause: () => {},
        resume: () => {},
        setModel: (_m: string) => {},
      }
      try {
        await commandRegistry.handle(input, fakeRepl)
      } finally {
        console.log   = origLog
        console.error = origError
      }
      return lines.length > 0 ? lines.join('\n') : undefined
    }

    startTUI({
      agent,
      statusInfo: { provider: provider.name, model, mcpCount, tokens: 0 },
      onChat: async (text) => {
        await agent.turn(text)
        saveCurrentSession()
      },
      onSlashCommand,
      initialQuery: opts.goal ? undefined : initialQuery,
    })

    // If --goal flag, start goal loop inside TUI
    if (opts.goal) {
      void agent.runGoalLoop(opts.goal)
    }

    // TUI runs until user exits — keep process alive
    return
  }

  // ── Classic REPL mode (--no-tui) ─────────────────────────────────────────
  if (!opts.noBanner) {
    console.log(banner())
  }

  const mcpInfo = mcpCount > 0 ? colors.muted(` · ${mcpCount} MCP`) : ''
  console.log(colors.muted(`  ${provider.name} / ${model}${mcpInfo}`))
  console.log(colors.muted('  /help for commands  ·  /goal <задача> для автономного режима'))
  console.log()

  if (initialQuery) {
    await agent.turn(initialQuery)
  }

  if (opts.goal) {
    await agent.runGoalLoop(opts.goal)
  }

  await startREPL(opts.verbose || false)
}

// ── REPL ─────────────────────────────────────────────────────────────────────

async function startREPL(verbose: boolean) {
  // Set verbose on agent
  ;(agent as unknown as { verbose: boolean }).verbose = verbose

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 1000,
  })

  const repl = {
    setModel: (model: string) => {
      // model already set via registry
    },
    clearScreen: () => {
      process.stdout.write('\x1Bc')
      console.log(banner())
    },
    exit: () => {
      const currentId = sessionManager.getCurrentSessionId()
      if (currentId) {
        const session = sessionManager.load(currentId)
        if (session) {
          session.messages = agent.getMessages()
          sessionManager.save(session)
        }
      }
      mcpManager.disconnectAll().then(() => process.exit(0))
    },
    pause: () => rl.pause(),
    resume: () => rl.resume(),
  }

  const getPrompt = () => {
    const provider = providerRegistry.getCurrentProvider()
    const model = providerRegistry.getCurrentModel().split('-').slice(-2).join('-')
    const goalActive = goalManager.hasActiveGoal() ? colors.goal(' 🎯') : ''
    return `${colors.primary('◆')} ${colors.muted(model)}${goalActive} ${colors.dim('›')} `
  }

  rl.on('close', () => {
    repl.exit()
  })

  // Main REPL loop
  const prompt = () => {
    rl.question(getPrompt(), async (input) => {
      input = input.trim()

      if (!input) {
        prompt()
        return
      }

      // Handle command
      if (input.startsWith('/')) {
        await commandRegistry.handle(input, repl)
        // Save session after each interaction
        saveCurrentSession()
        prompt()
        return
      }

      // Regular chat
      try {
        await agent.turn(input)
        saveCurrentSession()
      } catch (err: any) {
        const isConnErr = err?.cause?.code === 'ECONNREFUSED' || err?.code === 'ECONNREFUSED'
        if (isConnErr) {
          console.error(colors.error('\n✗ Connection refused — is the provider reachable?'))
          console.error(colors.muted('  If using Ollama: ollama serve'))
          console.error(colors.muted('  Or set an API key: export ANTHROPIC_API_KEY=sk-ant-...'))
        } else if (err?.status === 401 || err?.status === 403) {
          console.error(colors.error('\n✗ Authentication failed — check your API key (run: agent auth)'))
        } else {
          console.error(colors.error('\n✗ ') + (err?.message ?? String(err)))
        }
      }

      prompt()
    })
  }

  prompt()
}

// ── Session save helper (shared by TUI and REPL) ─────────────────────────────

function saveCurrentSession() {
  const currentId = sessionManager.getCurrentSessionId()
  if (currentId) {
    const session = sessionManager.load(currentId)
    if (session) {
      session.messages = agent.getMessages()
      sessionManager.save(session)
    }
  }
}

// ── Graceful exit ────────────────────────────────────────────────────────────

process.on('SIGINT', async () => {
  if (goalManager.hasActiveGoal()) {
    console.log(colors.warning('\n\n⚠️  Goal interrupted. Use /goal clear to remove it or /goal to check status.'))
  } else {
    console.log(colors.muted('\n\nInterrupted. Run agent again to continue.'))
  }
  await mcpManager.disconnectAll()
  process.exit(0)
})

process.on('uncaughtException', (err) => {
  console.error(colors.error('\nUnexpected error:'), err.message)
  process.exit(1)
})

main().catch((err) => {
  console.error(colors.error('Fatal:'), err)
  process.exit(1)
})
