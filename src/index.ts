#!/usr/bin/env node
import { createInterface } from 'readline'
import { program } from 'commander'
import { agent } from './agent/Agent.js'
import { goalManager } from './agent/GoalManager.js'
import { commandRegistry } from './commands/CommandRegistry.js'
import { providerRegistry } from './providers/index.js'
import { mcpManager } from './mcp/MCPManager.js'
import { sessionManager } from './session/SessionManager.js'
import { colors, banner, separator } from './ui/colors.js'
import config from './config/Config.js'
import { readFileSync, existsSync } from 'fs'

// ── CLI Setup ────────────────────────────────────────────────────────────────

program
  .name('agent')
  .description('AI Agent CLI — Multi-provider, MCP-connected, Goal-driven')
  .version('1.0.0')
  .argument('[query]', 'Initial query or task')
  .option('-p, --print <query>', 'Non-interactive: print response and exit')
  .option('-m, --model <model>', 'Model to use (e.g. claude-opus-4-5, gpt-4o)')
  .option('--provider <provider>', 'Provider to use (anthropic, openai, google, groq)')
  .option('-c, --continue', 'Continue most recent session')
  .option('-r, --resume <session>', 'Resume session by ID or name')
  .option('--goal <condition>', 'Start with a goal — agent runs until achieved')
  .option('--mcp-config <path>', 'Load MCP servers from JSON file')
  .option('--permission-mode <mode>', 'Permission mode (default, plan, bypassPermissions)')
  .option('--max-tokens <n>', 'Max output tokens per turn (default: 32768)')
  .option('--max-iterations <n>', 'Max goal loop iterations (default: 200)')
  .option('--verbose', 'Verbose tool output')
  .option('--no-banner', 'Skip the banner')

// ── Subcommands ──────────────────────────────────────────────────────────────

program
  .command('mcp')
  .description('Manage MCP servers (use /mcp inside session for interactive management)')
  .option('list', 'List configured servers')
  .action(async (options) => {
    const servers = config.loadMCPServers()
    const entries = Object.entries(servers)
    if (entries.length === 0) {
      console.log(colors.muted('No MCP servers configured'))
      return
    }
    console.log(`\n${colors.bold('MCP Servers')}`)
    for (const [name, cfg] of entries) {
      console.log(`  ${colors.accent(name)} [${cfg.type}] ${cfg.url || cfg.command || ''}`)
    }
  })

program
  .command('auth')
  .description('Manage authentication')
  .command('status')
  .action(() => {
    const cfg = config.get()
    console.log(`\n${colors.bold('Authentication Status')}`)
    console.log(separator())
    const providers = [
      { name: 'Anthropic', key: cfg.providers.anthropic?.apiKey },
      { name: 'OpenAI', key: cfg.providers.openai?.apiKey },
      { name: 'Google', key: cfg.providers.google?.apiKey },
      { name: 'Groq', key: cfg.providers.groq?.apiKey },
    ]
    for (const p of providers) {
      const status = p.key ? colors.success('✓ configured') : colors.error('✗ not set')
      console.log(`  ${p.name}: ${status}`)
    }
  })

// ── Main Function ────────────────────────────────────────────────────────────

async function main() {
  program.parse()
  const opts = program.opts()
  const args = program.args

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

  // Non-interactive print mode: agent -p "query"
  if (opts.print) {
    if (opts.continue) {
      const recent = sessionManager.getMostRecent(process.cwd())
      if (recent) agent.setMessages(recent.messages)
    }
    if (opts.resume) {
      const session = sessionManager.load(opts.resume) || sessionManager.loadByName(opts.resume)
      if (session) agent.setMessages(session.messages)
    }
    const result = await agent.turn(opts.print)
    if (!result.text) {
      // text was printed inline, nothing more needed
    }
    await mcpManager.disconnectAll()
    process.exit(0)
  }

  // Interactive REPL mode
  if (!opts.noBanner) {
    console.log(banner())
  }

  // Handle --continue / --resume
  if (opts.continue) {
    const recent = sessionManager.getMostRecent(process.cwd())
    if (recent) {
      agent.setMessages(recent.messages)
      sessionManager.setCurrentSessionId(recent.meta.id)
      console.log(colors.success(`✓ Resumed session '${recent.meta.name}' (${recent.messages.length} messages)`))
    }
  } else if (opts.resume) {
    const session = sessionManager.load(opts.resume) || sessionManager.loadByName(opts.resume)
    if (session) {
      agent.setMessages(session.messages)
      sessionManager.setCurrentSessionId(session.meta.id)
      console.log(colors.success(`✓ Resumed session '${session.meta.name}'`))
    } else {
      console.error(colors.error(`Session '${opts.resume}' not found`))
    }
  } else {
    // Create new session
    const session = sessionManager.createSession()
    sessionManager.setCurrentSessionId(session.meta.id)
  }

  // Print provider status
  const configuredProviders = providerRegistry.listConfiguredProviders()
  if (configuredProviders.length === 0) {
    console.log(colors.warning('⚠️  No AI providers configured. Copy .env.example to .env and add API keys.'))
    console.log(colors.muted('   Then run: cp .env.example .env && nano .env'))
    console.log()
  } else {
    const provider = providerRegistry.getCurrentProvider()
    const model = providerRegistry.getCurrentModel()
    const mcpCount = mcpManager.getAllServers().filter((s) => s.connected).length
    const mcpInfo = mcpCount > 0 ? colors.muted(` · ${mcpCount} MCP servers`) : ''
    console.log(colors.muted(`  ${provider.name} / ${model}${mcpInfo}`))
    console.log(colors.muted(`  Type /help for commands, /goal <task> for autonomous execution`))
    console.log()
  }

  // Handle initial query from args
  if (args[0] && !['mcp', 'auth'].includes(args[0])) {
    await agent.turn(args[0])
  }

  // Handle --goal flag
  if (opts.goal) {
    await agent.runGoalLoop(opts.goal)
  }

  // Start REPL
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
      } catch (err) {
        console.error(colors.error('\nError: ') + String(err))
      }

      prompt()
    })
  }

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

  prompt()
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
