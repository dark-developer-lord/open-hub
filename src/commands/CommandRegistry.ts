import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { agent } from '../agent/Agent.js'
import { goalManager } from '../agent/GoalManager.js'
import { providerRegistry } from '../providers/index.js'
import { CustomProvider } from '../providers/CustomProvider.js'
import { mcpManager } from '../mcp/MCPManager.js'
import { sessionManager } from '../session/SessionManager.js'
import { toolRegistry } from '../tools/ToolRegistry.js'
import { colors, separator, banner } from '../ui/colors.js'
import config from '../config/Config.js'
import type { CustomProviderConfig } from '../config/Config.js'

export interface CommandContext {
  args: string
  rawArgs: string[]
  repl: {
    setModel(model: string): void
    clearScreen(): void
    exit(): void
    pause(): void
    resume(): void
  }
}

export interface Command {
  name: string
  aliases?: string[]
  description: string
  usage?: string
  category?: string
  handler(ctx: CommandContext): Promise<void> | void
}

export class CommandRegistry {
  private commands: Map<string, Command> = new Map()

  constructor() {
    this.registerAll()
  }

  private register(cmd: Command) {
    this.commands.set(cmd.name, cmd)
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.commands.set(alias, cmd)
      }
    }
  }

  private registerAll() {
    // ── GOAL ────────────────────────────────────────────────────────────────
    this.register({
      name: 'goal',
      description: 'Set a goal — agent keeps working autonomously until fully achieved',
      usage: '/goal <condition> | /goal clear | /goal status',
      category: 'agent',
      handler: async (ctx) => {
        const arg = ctx.args.trim()

        if (!arg || arg === 'status') {
          goalManager.printStatus()
          return
        }

        const clearWords = ['clear', 'stop', 'off', 'reset', 'cancel', 'none']
        if (clearWords.includes(arg.toLowerCase())) {
          if (goalManager.hasActiveGoal()) {
            goalManager.clearGoal(arg.toLowerCase() as 'clear')
            console.log(colors.warning('Goal cleared'))
          } else {
            console.log(colors.muted('No active goal'))
          }
          return
        }

        // Set and run goal
        await agent.runGoalLoop(arg)
      },
    })

    // ── MODEL ────────────────────────────────────────────────────────────────
    this.register({
      name: 'model',
      aliases: ['m'],
      description: 'Switch AI model/provider',
      usage: '/model [model-id|provider/model]',
      category: 'config',
      handler: (ctx) => {
        const arg = ctx.args.trim()

        if (!arg) {
          // List all models
          const current = providerRegistry.getCurrentModel()
          const provider = providerRegistry.getCurrentProvider()
          console.log(`\n${colors.bold('Current')}: ${colors.model(provider.name)} / ${colors.accent(current)}`)
          console.log('\n' + colors.bold('Available models:'))

          const allModels = providerRegistry.getAllModels()
          const byProvider: Record<string, typeof allModels> = {}
          for (const m of allModels) {
            if (!byProvider[m.provider]) byProvider[m.provider] = []
            byProvider[m.provider].push(m)
          }

          for (const [prov, models] of Object.entries(byProvider)) {
            const p = providerRegistry.getProvider(prov)
            console.log(`\n  ${colors.provider(p.name)}`)
            for (const m of models) {
              const active = m.id === current ? colors.success(' ←') : ''
              console.log(`    ${colors.accent(m.id)}${active}`)
              console.log(colors.muted(`      ${m.name} · ${(m.contextWindow / 1000).toFixed(0)}k ctx · tools:${m.supportsTools ? '✓' : '✗'}`))
            }
          }
          return
        }

        // Set model
        const [providerOrModel, model] = arg.includes('/') ? arg.split('/') : [undefined, arg]
        
        if (providerOrModel && model) {
          providerRegistry.setProvider(providerOrModel, model)
          console.log(colors.success(`Model set to ${providerOrModel}/${model}`))
        } else {
          const found = providerRegistry.setModel(arg)
          if (found) {
            console.log(colors.success(`Model set to ${found.name} (${found.id})`))
          } else {
            console.log(colors.warning(`Model '${arg}' not found in configured providers, setting directly`))
          }
        }

        ctx.repl.setModel(arg)
      },
    })

    // ── MCP ──────────────────────────────────────────────────────────────────
    this.register({
      name: 'mcp',
      description: 'Manage MCP server connections',
      usage: '/mcp [list|add|remove|status]',
      category: 'mcp',
      handler: async (ctx) => {
        const [subcommand, ...rest] = ctx.rawArgs

        if (!subcommand || subcommand === 'list' || subcommand === 'status') {
          console.log(`\n${colors.bold('MCP Servers')}`)
          console.log(separator())
          mcpManager.printStatus()
          return
        }

        if (subcommand === 'add') {
          // Parse: /mcp add <name> --transport <type> [--url <url>] [--scope local] -- <command> [args...]
          const name = rest[0]
          if (!name) {
            console.log(colors.error('Usage: /mcp add <name> --transport <stdio|http|sse> [--url <url>] -- <command> [args...]'))
            return
          }

          const transportIdx = rest.indexOf('--transport')
          const transport = transportIdx !== -1 ? rest[transportIdx + 1] : 'stdio'

          const urlIdx = rest.indexOf('--url')
          const url = urlIdx !== -1 ? rest[urlIdx + 1] : undefined

          const scopeIdx = rest.indexOf('--scope')
          const scope = (scopeIdx !== -1 ? rest[scopeIdx + 1] : 'local') as 'local' | 'project' | 'user'

          const dashDash = rest.indexOf('--')
          const commandArgs = dashDash !== -1 ? rest.slice(dashDash + 1) : []
          const command = commandArgs[0]
          const args = commandArgs.slice(1)

          const serverConfig = {
            type: transport as 'stdio' | 'http' | 'sse',
            command,
            args,
            url,
            scope,
          }

          console.log(colors.muted(`Connecting to MCP server '${name}'...`))
          const status = await mcpManager.connect(name, serverConfig)
          config.saveMCPServer(name, serverConfig)

          if (status.connected) {
            console.log(colors.success(`✓ Connected to '${name}' — ${status.tools.length} tools available`))
            if (status.tools.length > 0) {
              console.log(colors.muted('  Tools: ' + status.tools.map((t) => t.name.split('__').pop()).join(', ')))
            }
          } else {
            console.log(colors.error(`✗ Failed to connect: ${status.error}`))
          }
          return
        }

        if (subcommand === 'remove' || subcommand === 'rm') {
          const name = rest[0]
          if (!name) {
            console.log(colors.error('Usage: /mcp remove <name>'))
            return
          }
          await mcpManager.disconnect(name)
          config.removeMCPServer(name)
          console.log(colors.success(`Removed MCP server '${name}'`))
          return
        }

        if (subcommand === 'reload') {
          console.log(colors.muted('Reloading MCP servers...'))
          await mcpManager.disconnectAll()
          await mcpManager.loadServers()
          console.log(colors.success('MCP servers reloaded'))
          mcpManager.printStatus()
          return
        }

        if (subcommand === 'catalog') {
          console.log(`\n${colors.bold('MCP Server Catalog')}  ${colors.muted('(popular integrations)')}`)
          console.log(separator())
          const catalog = [
            { name: 'filesystem',  pkg: '@modelcontextprotocol/server-filesystem', desc: 'File system access',           cmd: 'npx -y @modelcontextprotocol/server-filesystem <path>' },
            { name: 'fetch',       pkg: '@modelcontextprotocol/server-fetch',      desc: 'HTTP fetch / web scraping',   cmd: 'npx -y @modelcontextprotocol/server-fetch' },
            { name: 'github',      pkg: '@modelcontextprotocol/server-github',     desc: 'GitHub repos, issues, PRs',   cmd: 'npx -y @modelcontextprotocol/server-github' },
            { name: 'gitlab',      pkg: '@modelcontextprotocol/server-gitlab',     desc: 'GitLab repos & MRs',          cmd: 'npx -y @modelcontextprotocol/server-gitlab' },
            { name: 'postgres',    pkg: '@modelcontextprotocol/server-postgres',   desc: 'PostgreSQL queries',          cmd: 'npx -y @modelcontextprotocol/server-postgres <conn-str>' },
            { name: 'sqlite',      pkg: '@modelcontextprotocol/server-sqlite',     desc: 'SQLite database',             cmd: 'npx -y @modelcontextprotocol/server-sqlite <db-path>' },
            { name: 'puppeteer',   pkg: '@modelcontextprotocol/server-puppeteer',  desc: 'Browser automation',         cmd: 'npx -y @modelcontextprotocol/server-puppeteer' },
            { name: 'brave-search',pkg: '@modelcontextprotocol/server-brave-search', desc: 'Brave web search',         cmd: 'npx -y @modelcontextprotocol/server-brave-search' },
            { name: 'memory',      pkg: '@modelcontextprotocol/server-memory',     desc: 'Persistent memory store',     cmd: 'npx -y @modelcontextprotocol/server-memory' },
            { name: 'slack',       pkg: '@modelcontextprotocol/server-slack',      desc: 'Slack workspace tools',       cmd: 'npx -y @modelcontextprotocol/server-slack' },
            { name: 'gdrive',      pkg: '@modelcontextprotocol/server-gdrive',     desc: 'Google Drive access',         cmd: 'npx -y @modelcontextprotocol/server-gdrive' },
            { name: 'sequential-thinking', pkg: '@modelcontextprotocol/server-sequential-thinking', desc: 'Step-by-step reasoning', cmd: 'npx -y @modelcontextprotocol/server-sequential-thinking' },
            { name: 'everything',  pkg: '@modelcontextprotocol/server-everything', desc: 'Test / demo all MCP features', cmd: 'npx -y @modelcontextprotocol/server-everything' },
          ]
          for (const item of catalog) {
            const connected = mcpManager.getServerStatus(item.name)?.connected
            const icon = connected ? colors.success('✓') : colors.muted('○')
            console.log(`  ${icon} ${colors.accent(item.name.padEnd(22))} ${colors.muted(item.desc)}`)
            console.log(`    ${colors.dim(item.cmd)}`)
          }
          console.log()
          console.log(colors.muted('  Quick install: /mcp install <name>'))
          console.log(colors.muted('  Custom:        /mcp add <name> -- npx -y <pkg> [args]'))
          return
        }

        if (subcommand === 'install') {
          const name = rest[0]
          const extraArgs = rest.slice(1)
          const catalog: Record<string, { pkg: string; args?: string[] }> = {
            filesystem:              { pkg: '@modelcontextprotocol/server-filesystem', args: extraArgs.length ? extraArgs : [process.cwd()] },
            fetch:                   { pkg: '@modelcontextprotocol/server-fetch' },
            github:                  { pkg: '@modelcontextprotocol/server-github' },
            gitlab:                  { pkg: '@modelcontextprotocol/server-gitlab' },
            postgres:                { pkg: '@modelcontextprotocol/server-postgres', args: extraArgs },
            sqlite:                  { pkg: '@modelcontextprotocol/server-sqlite',   args: extraArgs },
            puppeteer:               { pkg: '@modelcontextprotocol/server-puppeteer' },
            'brave-search':          { pkg: '@modelcontextprotocol/server-brave-search' },
            memory:                  { pkg: '@modelcontextprotocol/server-memory' },
            slack:                   { pkg: '@modelcontextprotocol/server-slack' },
            gdrive:                  { pkg: '@modelcontextprotocol/server-gdrive' },
            'sequential-thinking':   { pkg: '@modelcontextprotocol/server-sequential-thinking' },
            everything:              { pkg: '@modelcontextprotocol/server-everything' },
          }

          if (!name || !catalog[name]) {
            console.log(colors.error(`Unknown server '${name}'. Run /mcp catalog to see available servers.`))
            return
          }

          const entry = catalog[name]
          const serverConfig = {
            type: 'stdio' as const,
            command: 'npx',
            args: ['-y', entry.pkg, ...(entry.args || [])],
            scope: 'user' as const,
          }

          console.log(colors.muted(`Installing '${name}' via ${entry.pkg}...`))
          const status = await mcpManager.connect(name, serverConfig)
          config.saveMCPServer(name, serverConfig)

          if (status.connected) {
            console.log(colors.success(`✓ Connected '${name}' — ${status.tools.length} tools`))
            if (status.tools.length > 0) {
              console.log(colors.muted('  Tools: ' + status.tools.map((t) => t.name.split('__').pop()).join(', ')))
            }
          } else {
            console.log(colors.error(`✗ Failed: ${status.error}`))
            console.log(colors.muted('  Make sure Node.js/npx is installed and you have internet access'))
          }
          return
        }

        console.log(colors.error(`Unknown MCP subcommand: ${subcommand}`))
        console.log(colors.muted('Available: list, add, remove, reload, catalog, install'))
      },
    })

    // ── PROVIDER ─────────────────────────────────────────────────────────────
    this.register({
      name: 'provider',
      aliases: ['providers'],
      description: 'Manage AI providers — add custom OpenAI-compatible endpoints',
      usage: '/provider [list|add|remove|test]',
      category: 'config',
      handler: async (ctx) => {
        const [subcommand, ...rest] = ctx.rawArgs

        if (!subcommand || subcommand === 'list') {
          const all = providerRegistry.listProviders()
          const configured = new Set(providerRegistry.listConfiguredProviders())
          const customCfgs = config.get().customProviders || []
          const customIds = new Set(customCfgs.map((c) => c.id))

          console.log(`\n${colors.bold('AI Providers')}`)
          console.log(separator())
          console.log(`  ${colors.muted('Built-in providers:')}`)
          for (const id of all.filter((id) => !customIds.has(id))) {
            const p = providerRegistry.getProvider(id)
            const status = configured.has(id) ? colors.success('✓') : colors.muted('○')
            console.log(`    ${status} ${colors.provider(p.name)} ${colors.muted(`(${id})`)}  ${colors.muted(`${p.models.length} models`)}`)
          }

          if (customCfgs.length > 0) {
            console.log(`\n  ${colors.muted('Custom providers (from config):')}`)
            for (const cp of customCfgs) {
              const status = configured.has(cp.id) ? colors.success('✓') : colors.muted('○')
              console.log(`    ${status} ${colors.provider(cp.name)} ${colors.muted(`(${cp.id})`)}  ${colors.muted(cp.baseURL)}`)
              console.log(`       ${colors.muted(`${cp.models?.length || 1} models · key: ${cp.apiKey ? '***' : 'none'}`)}`)
            }
          }

          console.log()
          console.log(colors.muted('  Add a custom provider: /provider add <id> <baseURL> [--name <name>] [--key <apiKey>] [--models m1,m2]'))
          console.log(colors.muted('  Or set env vars: PROVIDER_<ID>_BASE_URL, PROVIDER_<ID>_API_KEY, PROVIDER_<ID>_MODELS'))
          return
        }

        if (subcommand === 'add') {
          // /provider add <id> <baseURL> [--name <name>] [--key <apiKey>] [--models m1,m2] [--allow-empty]
          const id = rest[0]
          const baseURL = rest[1]
          if (!id || !baseURL) {
            console.log(colors.error('Usage: /provider add <id> <baseURL> [--name <name>] [--key <apiKey>] [--models m1,m2]'))
            return
          }

          const nameIdx = rest.indexOf('--name')
          const name = nameIdx !== -1 ? rest[nameIdx + 1] : id

          const keyIdx = rest.indexOf('--key')
          const apiKey = keyIdx !== -1 ? rest[keyIdx + 1] : ''

          const modelsIdx = rest.indexOf('--models')
          const modelsStr = modelsIdx !== -1 ? rest[modelsIdx + 1] : ''
          const models = modelsStr
            ? modelsStr.split(',').map((m) => m.trim()).filter(Boolean).map((m) => ({ id: m, name: m, contextWindow: 128000 }))
            : []

          const allowEmptyKey = rest.includes('--allow-empty') || !apiKey

          const cfg: CustomProviderConfig = { id, name, baseURL, apiKey, allowEmptyKey, models }
          config.saveCustomProvider(cfg)
          providerRegistry.refreshFromConfig()
          console.log(colors.success(`✓ Provider '${name}' (${id}) added and registered`))
          console.log(colors.muted(`  Base URL: ${baseURL}`))
          if (models.length) console.log(colors.muted(`  Models:   ${models.map((m) => m.id).join(', ')}`))
          console.log(colors.muted(`  Use: /model ${id}/default  or  /model ${models[0]?.id || 'default'}`))
          return
        }

        if (subcommand === 'remove' || subcommand === 'rm') {
          const id = rest[0]
          if (!id) { console.log(colors.error('Usage: /provider remove <id>')); return }
          config.removeCustomProvider(id)
          providerRegistry.refreshFromConfig()
          console.log(colors.success(`Removed custom provider '${id}'`))
          return
        }

        if (subcommand === 'test') {
          const id = rest[0] || providerRegistry.getCurrentProvider().id
          const provider = providerRegistry.getProvider(id)
          if (!provider.isConfigured()) {
            console.log(colors.error(`Provider '${id}' is not configured (missing API key?)`))
            return
          }
          console.log(colors.muted(`Testing ${provider.name}...`))
          try {
            await (agent as unknown as { provider: typeof provider }).provider
            const result = await provider.chat(
              [{ role: 'user', content: 'Say "OK" and nothing else.' }],
              { model: provider.getDefaultModel(), maxTokens: 10 }
            )
            const text = typeof result.content === 'string'
              ? result.content
              : result.content.filter((b: { type: string }) => b.type === 'text').map((b: { type: string; text?: string }) => (b as { text: string }).text).join('')
            console.log(colors.success(`✓ ${provider.name} responded: ${text.trim()}`))
          } catch (err) {
            console.log(colors.error(`✗ ${provider.name} error: ${err}`))
          }
          return
        }

        console.log(colors.error(`Unknown subcommand: ${subcommand}`))
        console.log(colors.muted('Available: list, add, remove, test'))
      },
    })

    // ── INTEGRATIONS ─────────────────────────────────────────────────────────
    this.register({
      name: 'integrations',
      aliases: ['int'],
      description: 'Show all active API and MCP integrations',
      category: 'config',
      handler: () => {
        const configured = providerRegistry.listConfiguredProviders()
        const allMcp = mcpManager.getAllServers()
        const connectedMcp = allMcp.filter((s) => s.connected)
        const totalTools = connectedMcp.reduce((sum, s) => sum + s.tools.length, 0)

        console.log(`\n${colors.bold('Active Integrations')}`)
        console.log(separator())

        console.log(`\n  ${colors.bold('AI Providers')}  (${configured.length} configured)`)
        for (const id of configured) {
          const p = providerRegistry.getProvider(id)
          console.log(`    ${colors.success('✓')} ${colors.provider(p.name)}  ${colors.muted(`${p.models.length} models`)}`)
        }

        console.log(`\n  ${colors.bold('MCP Servers')}  (${connectedMcp.length}/${allMcp.length} connected · ${totalTools} tools)`)
        if (allMcp.length === 0) {
          console.log(colors.muted('    (none configured — use /mcp add or edit ~/.agent-cli/mcp.json)'))
        } else {
          for (const s of allMcp) {
            const icon = s.connected ? colors.success('✓') : colors.error('✗')
            const detail = s.connected ? colors.muted(`${s.tools.length} tools`) : colors.error(s.error || 'disconnected')
            console.log(`    ${icon} ${colors.accent(s.name)}  ${detail}`)
          }
        }

        console.log(`\n  ${colors.muted('Tip: /provider add  /mcp add  /mcp catalog')}`)
        console.log()
      },
    })

    // ── CLEAR ────────────────────────────────────────────────────────────────
    this.register({
      name: 'clear',
      aliases: ['reset', 'new'],
      description: 'Clear conversation context and start fresh',
      category: 'session',
      handler: (ctx) => {
        const name = ctx.args.trim()
        // Save current session first
        const currentId = sessionManager.getCurrentSessionId()
        if (currentId) {
          const session = sessionManager.load(currentId)
          if (session) {
            if (name) session.meta.name = name
            session.messages = agent.getMessages()
            sessionManager.save(session)
          }
        }
        agent.clearMessages()
        ctx.repl.clearScreen()
        console.log(colors.success('Context cleared. Starting fresh.'))
        if (name) console.log(colors.muted(`Previous session saved as '${name}'`))
      },
    })

    // ── COMPACT ──────────────────────────────────────────────────────────────
    this.register({
      name: 'compact',
      description: 'Summarize conversation to free context window',
      usage: '/compact [focus instructions]',
      category: 'session',
      handler: async (ctx) => {
        console.log(colors.muted('Compacting conversation...'))
        const stats = agent.getContextStats()
        const summary = await agent.compact(ctx.args || undefined)
        const newStats = agent.getContextStats()
        console.log(colors.success(`✓ Compacted: ${stats.messages} → ${newStats.messages} messages (~${stats.estimatedTokens} → ~${newStats.estimatedTokens} tokens)`))
        if (ctx.args) {
          console.log(colors.muted('Summary focus: ' + ctx.args))
        }
      },
    })

    // ── CONTEXT ──────────────────────────────────────────────────────────────
    this.register({
      name: 'context',
      description: 'Show context window usage',
      category: 'session',
      handler: () => {
        const stats = agent.getContextStats()
        const model = providerRegistry.getCurrentModel()
        const provider = providerRegistry.getCurrentProvider()
        const modelInfo = provider.getModel(model)
        const ctxWindow = modelInfo?.contextWindow || 200000

        const pct = Math.round((stats.estimatedTokens / ctxWindow) * 100)
        const barWidth = 40
        const filled = Math.round((pct / 100) * barWidth)
        const bar = colors.accent('█'.repeat(filled)) + colors.muted('░'.repeat(barWidth - filled))

        console.log(`\n${colors.bold('Context Usage')}`)
        console.log(separator())
        console.log(`  ${bar} ${colors.bold(pct + '%')}`)
        console.log(`  Messages: ${colors.accent(String(stats.messages))}`)
        console.log(`  Est. tokens: ${colors.accent(String(stats.estimatedTokens))} / ${colors.muted(String(ctxWindow))}`)
        console.log(`  Total tokens used: ${colors.accent(String(agent.getTotalTokens().input + agent.getTotalTokens().output))}`)
        console.log(`    Input: ${colors.muted(String(agent.getTotalTokens().input))}`)
        console.log(`    Output: ${colors.muted(String(agent.getTotalTokens().output))}`)
      },
    })

    // ── PLAN ─────────────────────────────────────────────────────────────────
    this.register({
      name: 'plan',
      description: 'Enter plan mode — agent plans before acting',
      usage: '/plan [task description]',
      category: 'agent',
      handler: async (ctx) => {
        const cfg = config.get()
        const prev = cfg.permissionMode
        
        config.set('permissionMode', 'plan')
        console.log(colors.info('📋 Plan mode ON — agent will plan but not execute tools'))

        if (ctx.args) {
          const result = await agent.turn(
            `Please create a detailed plan for: ${ctx.args}\n\nList the exact steps you would take, files to create/modify, commands to run. Do NOT execute anything, just plan.`
          )
        }
      },
    })

    // ── PERMISSIONS ──────────────────────────────────────────────────────────
    this.register({
      name: 'permissions',
      aliases: ['allowed-tools'],
      description: 'Manage tool permissions',
      usage: '/permissions [allow|deny|list|mode] [tool] [permission]',
      category: 'config',
      handler: (ctx) => {
        const [sub, ...rest] = ctx.rawArgs
        const cfg = config.get()

        if (!sub || sub === 'list') {
          console.log(`\n${colors.bold('Tool Permissions')}`)
          console.log(separator())
          console.log(`  Mode: ${colors.accent(cfg.permissionMode)}`)
          console.log(`  Auto-approve: ${cfg.agent.autoApproveTools.length > 0 ? cfg.agent.autoApproveTools.join(', ') : colors.muted('(none)')}`)
          console.log(`  Denied: ${cfg.agent.denyTools.length > 0 ? cfg.agent.denyTools.join(', ') : colors.muted('(none)')}`)
          console.log('\n  Available tools:')
          for (const t of toolRegistry.getAll()) {
            const allowed = !cfg.agent.denyTools.includes(t.definition.name)
            console.log(`    ${allowed ? colors.success('✓') : colors.error('✗')} ${t.definition.name}`)
          }
          return
        }

        if (sub === 'mode') {
          const mode = rest[0] as 'default' | 'acceptEdits' | 'plan' | 'auto' | 'bypassPermissions'
          if (!mode) {
            console.log(colors.error('Usage: /permissions mode <default|acceptEdits|plan|auto|bypassPermissions>'))
            return
          }
          config.set('permissionMode', mode)
          console.log(colors.success(`Permission mode set to '${mode}'`))
          return
        }

        if (sub === 'allow') {
          const tool = rest[0]
          if (!tool) { console.log(colors.error('Usage: /permissions allow <tool>')); return }
          const denied = cfg.agent.denyTools.filter((t) => t !== tool)
          const current = cfg.agent
          config.set('agent', { ...current, denyTools: denied })
          console.log(colors.success(`Tool '${tool}' allowed`))
          return
        }

        if (sub === 'deny') {
          const tool = rest[0]
          if (!tool) { console.log(colors.error('Usage: /permissions deny <tool>')); return }
          const current = cfg.agent
          if (!current.denyTools.includes(tool)) {
            config.set('agent', { ...current, denyTools: [...current.denyTools, tool] })
          }
          console.log(colors.success(`Tool '${tool}' denied`))
          return
        }
      },
    })

    // ── RESUME / CONTINUE ────────────────────────────────────────────────────
    this.register({
      name: 'resume',
      aliases: ['continue', 'r'],
      description: 'Resume a previous session',
      usage: '/resume [session-id|name]',
      category: 'session',
      handler: (ctx) => {
        const arg = ctx.args.trim()

        if (!arg) {
          // List recent sessions
          const sessions = sessionManager.list().slice(0, 10)
          if (sessions.length === 0) {
            console.log(colors.muted('No sessions found'))
            return
          }
          console.log(`\n${colors.bold('Recent Sessions')}`)
          console.log(separator())
          for (const s of sessions) {
            const date = new Date(s.updatedAt).toLocaleString()
            console.log(`  ${colors.accent(s.id.slice(0, 8))} ${colors.bold(s.name)} ${colors.muted(`(${s.messageCount} msgs · ${date})`)}`)
          }
          return
        }

        const session = sessionManager.load(arg) || sessionManager.loadByName(arg)
        if (!session) {
          console.log(colors.error(`Session '${arg}' not found`))
          return
        }

        agent.setMessages(session.messages)
        sessionManager.setCurrentSessionId(session.meta.id)
        console.log(colors.success(`✓ Resumed session '${session.meta.name}' (${session.messages.length} messages)`))
      },
    })

    // ── RENAME ───────────────────────────────────────────────────────────────
    this.register({
      name: 'rename',
      description: 'Rename the current session',
      usage: '/rename <new name>',
      category: 'session',
      handler: (ctx) => {
        const name = ctx.args.trim()
        const id = sessionManager.getCurrentSessionId()
        if (!id) {
          console.log(colors.muted('No active session to rename'))
          return
        }
        if (sessionManager.rename(id, name)) {
          console.log(colors.success(`Session renamed to '${name}'`))
        }
      },
    })

    // ── EXPORT ───────────────────────────────────────────────────────────────
    this.register({
      name: 'export',
      description: 'Export conversation as plain text',
      usage: '/export [filename]',
      category: 'session',
      handler: (ctx) => {
        const id = sessionManager.getCurrentSessionId()
        if (!id) {
          console.log(colors.muted('No active session to export'))
          return
        }
        const content = sessionManager.export(id)
        const filename = ctx.args.trim() || `session-${Date.now()}.md`
        writeFileSync(filename, content)
        console.log(colors.success(`✓ Exported to ${filename}`))
      },
    })

    // ── DIFF ─────────────────────────────────────────────────────────────────
    this.register({
      name: 'diff',
      description: 'Show uncommitted git changes',
      category: 'review',
      handler: async () => {
        const result = await agent.turn('Show me the current git diff (uncommitted changes) with syntax highlighting context. Run `git diff` and `git status` and present the changes clearly.')
      },
    })

    // ── CODE REVIEW ──────────────────────────────────────────────────────────
    this.register({
      name: 'code-review',
      aliases: ['cr'],
      description: 'Review current diff for correctness bugs',
      usage: '/code-review [low|medium|high] [target]',
      category: 'review',
      handler: async (ctx) => {
        const effort = ctx.rawArgs.find((a) => ['low', 'medium', 'high', 'xhigh', 'max'].includes(a)) || 'medium'
        const target = ctx.rawArgs.filter((a) => !['low', 'medium', 'high', 'xhigh', 'max'].includes(a)).join(' ')

        await agent.turn(
          `Perform a ${effort}-effort code review on ${target || 'the current git diff'}. Focus on:
1. Correctness bugs and logic errors
2. Security vulnerabilities (injection, auth, data exposure)
3. Performance issues
4. Missing error handling
5. Type safety issues

Run \`git diff\` first to see the changes. Report findings without making edits.`
        )
      },
    })

    // ── SECURITY REVIEW ──────────────────────────────────────────────────────
    this.register({
      name: 'security-review',
      description: 'Analyze code for security vulnerabilities',
      category: 'review',
      handler: async () => {
        await agent.turn(
          `Perform a comprehensive security review of the pending changes. Check for:
1. Injection vulnerabilities (SQL, command, XSS)
2. Authentication/authorization issues
3. Sensitive data exposure
4. Insecure dependencies
5. OWASP Top 10 issues

Run \`git diff\` and \`git status\`, then analyze all changed files. Report findings with severity levels.`
        )
      },
    })

    // ── INIT ─────────────────────────────────────────────────────────────────
    this.register({
      name: 'init',
      description: 'Initialize project with AGENT.md guide',
      category: 'project',
      handler: async () => {
        await agent.turn(
          `Analyze this project and create an AGENT.md file that captures:
1. Project type and tech stack
2. Build commands (how to build, test, run)
3. Project structure overview
4. Key conventions and patterns
5. Common development tasks

Read relevant files (package.json, README, config files) first, then write a comprehensive AGENT.md.`
        )
      },
    })

    // ── MEMORY ───────────────────────────────────────────────────────────────
    this.register({
      name: 'memory',
      description: 'Edit AGENT.md memory files',
      category: 'project',
      handler: async (ctx) => {
        const action = ctx.args.trim()
        if (!action || action === 'show') {
          await agent.turn('Read and display the AGENT.md file if it exists. If not, explain how to create one with /init.')
          return
        }
        await agent.turn(`Update the AGENT.md memory file: ${action}`)
      },
    })

    // ── EFFORT ───────────────────────────────────────────────────────────────
    this.register({
      name: 'effort',
      description: 'Set effort level (affects thoroughness)',
      usage: '/effort [low|medium|high|xhigh|max]',
      category: 'config',
      handler: (ctx) => {
        const level = ctx.args.trim()
        const valid = ['low', 'medium', 'high', 'xhigh', 'max']
        if (!level) {
          console.log(`Current effort: ${colors.accent(config.get().defaults.effort)}`)
          console.log(`Options: ${valid.join(', ')}`)
          return
        }
        if (!valid.includes(level)) {
          console.log(colors.error(`Invalid effort level. Use: ${valid.join(', ')}`))
          return
        }
        config.set('defaults', { ...config.get().defaults, effort: level as 'low' | 'medium' | 'high' | 'xhigh' | 'max' })
        console.log(colors.success(`Effort level set to '${level}'`))
      },
    })

    // ── TASKS ────────────────────────────────────────────────────────────────
    this.register({
      name: 'tasks',
      aliases: ['bashes'],
      description: 'List and manage background tasks',
      category: 'agent',
      handler: () => {
        // In this implementation, tasks are tracked via goal iterations
        const goal = goalManager.getGoal()
        if (goal?.status === 'active') {
          console.log(`\n${colors.bold('Active Task')}`)
          console.log(separator())
          goalManager.printStatus()
        } else {
          console.log(colors.muted('No active background tasks'))
        }
      },
    })

    // ── REWIND ───────────────────────────────────────────────────────────────
    this.register({
      name: 'rewind',
      aliases: ['checkpoint', 'undo'],
      description: 'Rewind conversation to a previous point',
      usage: '/rewind [N]  (remove last N messages, default 2)',
      category: 'session',
      handler: (ctx) => {
        const n = parseInt(ctx.args.trim()) || 2
        const messages = agent.getMessages()
        if (messages.length === 0) {
          console.log(colors.muted('No messages to rewind'))
          return
        }
        const removed = Math.min(n, messages.length)
        agent.setMessages(messages.slice(0, -removed))
        console.log(colors.success(`✓ Rewound ${removed} message(s). Conversation has ${agent.getMessages().length} messages.`))
      },
    })

    // ── COST / USAGE ─────────────────────────────────────────────────────────
    this.register({
      name: 'usage',
      aliases: ['cost', 'stats'],
      description: 'Show session token usage and estimated cost',
      category: 'session',
      handler: () => {
        const tokens = agent.getTotalTokens()
        const model = providerRegistry.getCurrentModel()

        // Rough cost estimates (per 1M tokens, in USD)
        const costs: Record<string, { input: number; output: number }> = {
          'claude-opus': { input: 15, output: 75 },
          'claude-sonnet': { input: 3, output: 15 },
          'claude-haiku': { input: 0.25, output: 1.25 },
          'gpt-4o': { input: 5, output: 15 },
          'gpt-4o-mini': { input: 0.15, output: 0.6 },
          'gemini-1.5-pro': { input: 3.5, output: 10.5 },
        }

        let costEntry = costs['claude-sonnet'] // default
        for (const [key, val] of Object.entries(costs)) {
          if (model.includes(key.replace('claude-', ''))) {
            costEntry = val
            break
          }
        }

        const inputCost = (tokens.input / 1_000_000) * costEntry.input
        const outputCost = (tokens.output / 1_000_000) * costEntry.output
        const total = inputCost + outputCost

        console.log(`\n${colors.bold('Session Usage')}`)
        console.log(separator())
        console.log(`  Model:         ${colors.accent(model)}`)
        console.log(`  Input tokens:  ${colors.accent(tokens.input.toLocaleString())}  (~$${inputCost.toFixed(4)})`)
        console.log(`  Output tokens: ${colors.accent(tokens.output.toLocaleString())}  (~$${outputCost.toFixed(4)})`)
        console.log(`  Total tokens:  ${colors.accent((tokens.input + tokens.output).toLocaleString())}`)
        console.log(`  Est. cost:     ${colors.bold('~$' + total.toFixed(4))}`)
      },
    })

    // ── HELP ─────────────────────────────────────────────────────────────────
    this.register({
      name: 'help',
      aliases: ['h', '?'],
      description: 'Show help and available commands',
      category: 'general',
      handler: (ctx) => {
        const filter = ctx.args.trim()

        const categories: Record<string, Command[]> = {}
        const seen = new Set<string>()

        for (const cmd of this.commands.values()) {
          if (seen.has(cmd.name)) continue
          seen.add(cmd.name)
          if (filter && !cmd.name.includes(filter) && !cmd.description.toLowerCase().includes(filter)) continue
          const cat = cmd.category || 'general'
          if (!categories[cat]) categories[cat] = []
          categories[cat].push(cmd)
        }

        console.log(`\n${colors.bold('Commands')} ${colors.muted('(type / to filter)')}`)

        const catOrder = ['agent', 'config', 'session', 'review', 'project', 'mcp', 'general']
        const catLabels: Record<string, string> = {
          agent: '◆ Agent & Goals',
          config: '⚙ Configuration',
          session: '📂 Session',
          review: '🔍 Review',
          project: '📁 Project',
          mcp: '🔌 MCP',
          general: '● General',
        }

        for (const cat of [...catOrder, ...Object.keys(categories).filter((c) => !catOrder.includes(c))]) {
          const cmds = categories[cat]
          if (!cmds?.length) continue

          console.log(`\n  ${colors.bold(catLabels[cat] || cat)}`)
          for (const cmd of cmds) {
            const aliases = cmd.aliases?.length ? colors.muted(` (${cmd.aliases.join(', ')})`) : ''
            console.log(`    ${colors.command('/' + cmd.name)}${aliases}`)
            console.log(`      ${colors.muted(cmd.description)}`)
            if (cmd.usage) console.log(`      ${colors.dim(cmd.usage)}`)
          }
        }
        console.log()
      },
    })

    // ── STATUS ───────────────────────────────────────────────────────────────
    this.register({
      name: 'status',
      description: 'Show agent status: model, provider, goal, MCP',
      category: 'general',
      handler: () => {
        const provider = providerRegistry.getCurrentProvider()
        const model = providerRegistry.getCurrentModel()
        const cfg = config.get()
        const contextStats = agent.getContextStats()
        const mcpServers = mcpManager.getAllServers()

        console.log(`\n${colors.bold('Agent Status')}`)
        console.log(separator())
        console.log(`  Provider:    ${colors.provider(provider.name)}`)
        console.log(`  Model:       ${colors.model(model)}`)
        console.log(`  Mode:        ${colors.accent(cfg.permissionMode)}`)
        console.log(`  Effort:      ${colors.muted(cfg.defaults.effort)}`)
        console.log(`  Messages:    ${colors.muted(String(contextStats.messages))} (~${contextStats.estimatedTokens} tokens)`)
        console.log(`  MCP servers: ${colors.muted(String(mcpServers.length))} (${mcpServers.filter((s) => s.connected).length} connected)`)

        const goal = goalManager.getGoal()
        if (goal?.status === 'active') {
          console.log(`\n  ${colors.goal('🎯 Active Goal')}: ${goal.description}`)
          console.log(`     Iteration ${goal.iterations}/${goal.maxIterations}`)
        }
        console.log()
      },
    })

    // ── VERBOSE ──────────────────────────────────────────────────────────────
    this.register({
      name: 'verbose',
      description: 'Toggle verbose tool output',
      category: 'config',
      handler: () => {
        const current = (agent as unknown as { verbose: boolean }).verbose
        ;(agent as unknown as { verbose: boolean }).verbose = !current
        console.log(colors.success(`Verbose mode: ${!current ? 'ON' : 'OFF'}`))
      },
    })

    // ── ADD-DIR ──────────────────────────────────────────────────────────────
    this.register({
      name: 'add-dir',
      description: 'Add working directory for file access',
      usage: '/add-dir <path>',
      category: 'config',
      handler: (ctx) => {
        const dir = ctx.args.trim()
        if (!dir) { console.log(colors.error('Usage: /add-dir <path>')); return }
        process.chdir(dir)
        console.log(colors.success(`Working directory: ${dir}`))
      },
    })

    // ── BATCH ────────────────────────────────────────────────────────────────
    this.register({
      name: 'batch',
      description: 'Orchestrate large-scale changes in parallel across codebase',
      usage: '/batch <instruction>',
      category: 'agent',
      handler: async (ctx) => {
        if (!ctx.args.trim()) {
          console.log(colors.error('Usage: /batch <instruction>'))
          return
        }
        await agent.turn(
          `Perform a batch operation across the codebase: ${ctx.args}\n\n` +
          `Steps:\n1. Research the codebase to understand scope\n` +
          `2. Decompose into independent units\n` +
          `3. Execute each unit systematically\n` +
          `4. Verify results after completion\n\n` +
          `Begin by exploring the codebase structure.`
        )
      },
    })

    // ── AGENTS ───────────────────────────────────────────────────────────────
    this.register({
      name: 'agents',
      description: 'Manage subagent configurations',
      category: 'agent',
      handler: (ctx) => {
        console.log(colors.muted('Subagent management is available via goal-driven multi-step execution.'))
        console.log(colors.muted('Use /goal to set a complex goal requiring multiple steps.'))
      },
    })

    // ── CONFIG / SETTINGS ────────────────────────────────────────────────────
    this.register({
      name: 'config',
      aliases: ['settings'],
      description: 'View or update configuration',
      usage: '/config [key] [value]',
      category: 'config',
      handler: (ctx) => {
        const [key, ...vals] = ctx.rawArgs
        const cfg = config.get()

        if (!key) {
          console.log(`\n${colors.bold('Configuration')}`)
          console.log(separator())
          console.log('  ' + JSON.stringify(cfg, (k, v) => {
            if (k === 'apiKey' && v) return '***'
            return v
          }, 2).split('\n').join('\n  '))
          return
        }

        console.log(colors.muted('Use /model, /effort, /permissions for changing settings'))
      },
    })

    // ── RECAP ────────────────────────────────────────────────────────────────
    this.register({
      name: 'recap',
      description: 'Generate a one-line summary of the current session',
      category: 'session',
      handler: async () => {
        const stats = agent.getContextStats()
        if (stats.messages === 0) {
          console.log(colors.muted('No conversation to recap'))
          return
        }
        await agent.turn('In one sentence, summarize what we have accomplished in this session so far.')
      },
    })

    // ── EXIT / QUIT ──────────────────────────────────────────────────────────
    this.register({
      name: 'exit',
      aliases: ['quit', 'q'],
      description: 'Exit the CLI',
      category: 'general',
      handler: (ctx) => {
        console.log(colors.muted('\nGoodbye! 👋'))
        ctx.repl.exit()
      },
    })

    // ── BTW ──────────────────────────────────────────────────────────────────
    this.register({
      name: 'btw',
      description: 'Ask a side question without adding to main conversation',
      usage: '/btw <question>',
      category: 'general',
      handler: async (ctx) => {
        if (!ctx.args.trim()) return
        const savedMessages = [...agent.getMessages()]
        await agent.turn(ctx.args)
        agent.setMessages(savedMessages) // Restore — side question doesn't affect history
      },
    })
  }

  async handle(input: string, repl: CommandContext['repl']): Promise<boolean> {
    if (!input.startsWith('/')) return false

    const trimmed = input.slice(1).trim()
    const spaceIdx = trimmed.indexOf(' ')
    const name = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)
    const argsStr = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()

    const cmd = this.commands.get(name.toLowerCase())
    if (!cmd) {
      // Suggest closest match
      const names = Array.from(new Set(this.commands.values()).values()).map((c) => c.name)
      const close = names.find((n) => n.startsWith(name.slice(0, 2)))
      console.log(colors.error(`Unknown command: /${name}`) + (close ? colors.muted(` — did you mean /${close}?`) : ''))
      console.log(colors.muted('Type /help for available commands'))
      return true
    }

    const ctx: CommandContext = {
      args: argsStr,
      rawArgs: argsStr ? argsStr.split(/\s+/) : [],
      repl,
    }

    try {
      await cmd.handler(ctx)
    } catch (err) {
      console.error(colors.error(`Command /${cmd.name} failed:`), err)
    }

    return true
  }

  list(): Command[] {
    return Array.from(new Set(this.commands.values()))
  }
}

export const commandRegistry = new CommandRegistry()
