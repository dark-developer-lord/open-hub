import { providerRegistry } from '../providers/index.js'
import { toolRegistry } from '../tools/ToolRegistry.js'
import { mcpManager } from '../mcp/MCPManager.js'
import { goalManager } from './GoalManager.js'
import { Message, ToolUseBlock, ToolResultBlock, TextBlock, ChatOptions } from '../providers/types.js'
import { colors, formatToolCall, separator } from '../ui/colors.js'
import config from '../config/Config.js'
import { EventEmitter } from 'events'

export interface AgentOptions {
  verbose?: boolean
  stream?: boolean
}

export interface TurnResult {
  text: string
  toolCalls: number
  tokens: { input: number; output: number }
}

const AGENT_SYSTEM_PROMPT = `You are a powerful AI agent with full system access. You can read and write any file anywhere on the filesystem, execute any shell command, control applications, manage processes, and interact with external services via MCP.

Available tools and their capabilities:

SHELL:
- Bash: run any command — builds, tests, installs, git, network, system ops, scripts

FILE SYSTEM (unrestricted access to all paths):
- Read: read any file (supports line ranges)
- Write: create/overwrite any file (auto-creates parent dirs)
- Edit: precise text replacement in any file
- Delete: delete files or directories (use recursive=true for dirs)
- Move: move/rename files and directories
- Copy: copy files and directories
- MakeDir: create directory trees
- FileInfo: file metadata (size, perms, timestamps)
- Chmod: change file permissions
- LS: list directory contents
- Glob: find files by pattern (** recursive)
- Grep: search file contents by regex/text

SYSTEM / OS:
- Open: open files, URLs, or applications (uses macOS open / Linux xdg-open)
- AppleScript: automate any macOS application (Finder, Safari, Mail, Calendar, Terminal, etc.)
- ClipboardRead / ClipboardWrite: read and write the system clipboard
- Notify: send system desktop notifications
- Screenshot: capture screenshots of screen or windows
- ProcessList: list running processes
- KillProcess: send signals to processes
- SystemInfo: OS version, CPU, memory, disk, network info
- ListApps: list installed applications
- Env: read environment variables

MCP TOOLS: prefixed with mcp__<server>__<tool> — see /mcp list for active servers

Best practices:
1. Use absolute paths when working outside the current directory
2. Chain Bash commands with && for multi-step operations
3. After editing files, verify changes with Read
4. For complex AppleScript, write it clearly and test incrementally
5. When a task needs multiple steps, plan then execute systematically
6. Be thorough — complete tasks fully
`

export class Agent extends EventEmitter {
  private messages: Message[] = []
  private totalTokens = { input: 0, output: 0 }
  private verbose: boolean

  constructor(options: AgentOptions = {}) {
    super()
    this.verbose = options.verbose || false
  }

  /** True when TUI is active (has event listeners) */
  private isTUI(): boolean {
    return this.listenerCount('text') > 0
  }

  /** Write assistant text — event in TUI mode, stdout in REPL mode */
  private writeText(text: string): void {
    if (this.isTUI()) {
      this.emit('text', text)
    } else {
      process.stdout.write('\n' + colors.assistant('Agent') + ' ' + colors.dim('›') + ' ')
      process.stdout.write(text + '\n')
    }
  }

  private writeToolStart(name: string): void {
    if (this.isTUI()) {
      this.emit('toolStart', name)
    } else if (!this.verbose) {
      process.stdout.write(colors.tool(`  ⚙ ${name}`) + colors.muted(' ...'))
    }
  }

  private writeToolEnd(name: string, success: boolean): void {
    if (this.isTUI()) {
      this.emit('toolEnd', name, success)
    } else if (!this.verbose) {
      process.stdout.write(' ' + (success ? colors.success('✓') : colors.error('✗')) + '\n')
    }
  }

  getMessages(): Message[] {
    return this.messages
  }

  setMessages(messages: Message[]) {
    this.messages = messages
  }

  clearMessages() {
    this.messages = []
  }

  getTotalTokens() {
    return this.totalTokens
  }

  addUserMessage(content: string) {
    this.messages.push({ role: 'user', content })
  }

  /**
   * Main turn: sends messages to the AI and executes any tool calls.
   * Returns when the AI has no more tool calls to execute (end_turn).
   */
  async turn(userMessage?: string): Promise<TurnResult> {
    if (userMessage) {
      this.messages.push({ role: 'user', content: userMessage })
    }

    const cfg = config.get()
    let totalText = ''
    let totalToolCalls = 0
    const turnTokens = { input: 0, output: 0 }

    // Build system prompt
    let system = AGENT_SYSTEM_PROMPT
    if (goalManager.hasActiveGoal()) {
      system += goalManager.buildGoalSystemPrompt()
    }

    // Build tool list (built-in + MCP)
    const builtinTools = toolRegistry.getDefinitionsFiltered(
      cfg.agent.autoApproveTools.length > 0 ? undefined : undefined,
      cfg.agent.denyTools
    )
    const mcpTools = mcpManager.getConnectedTools()
    const allTools = [...builtinTools, ...mcpTools]

    // Agentic loop: keep going until end_turn (no more tool calls)
    let continueLoop = true
    while (continueLoop) {
      const provider = providerRegistry.getCurrentProvider()
      const model = providerRegistry.getCurrentModel()

      const options: ChatOptions = {
        model,
        maxTokens: cfg.defaults.maxTokens,
        system,
        tools: allTools.length > 0 ? allTools : undefined,
        toolChoice: allTools.length > 0 ? 'auto' : undefined,
      }

      const response = await provider.chat(this.messages, options)

      turnTokens.input += response.usage.inputTokens
      turnTokens.output += response.usage.outputTokens
      this.totalTokens.input += response.usage.inputTokens
      this.totalTokens.output += response.usage.outputTokens

      // Add assistant response to history
      this.messages.push({ role: 'assistant', content: response.content, reasoning_content: response.reasoning_content })

      // Extract and display text
      const text = response.content
        .filter((b): b is TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')

      if (text) {
        totalText += text
        if (!goalManager.hasActiveGoal()) {
          this.writeText(text)
        }
      }

      // Check for goal achievement signal in text
      if (goalManager.hasActiveGoal() && text) {
        const parsed = goalManager.parseResponse(text)
        if (parsed.achieved) {
          continueLoop = false
          break
        }
        this.writeText(text)
      }

      // Execute tool calls
      const toolCalls = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')

      if (toolCalls.length === 0 || response.stopReason === 'end_turn') {
        continueLoop = false
        break
      }

      totalToolCalls += toolCalls.length

      // Execute each tool call and collect results
      const toolResults: ToolResultBlock[] = []
      for (const tc of toolCalls) {
        if (this.verbose) {
          console.log('\n' + separator())
          console.log(formatToolCall(tc.name, tc.input))
        } else {
          this.writeToolStart(tc.name)
        }

        // Determine if it's an MCP tool or built-in
        const isMCP = tc.name.startsWith('mcp__')
        let result

        if (isMCP) {
          result = await mcpManager.callTool(tc.name, tc.input)
        } else {
          result = await toolRegistry.execute(tc.name, tc.input)
        }

        if (!this.verbose) {
          this.writeToolEnd(tc.name, result.success)
        }

        if (this.verbose) {
          if (result.success) {
            console.log(colors.success('Result:'), result.output.slice(0, 500))
          } else {
            console.log(colors.error('Error:'), result.error)
          }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: result.success ? result.output : (result.error || 'Error'),
          is_error: !result.success,
        })
      }

      // Add tool results as user message
      this.messages.push({ role: 'user', content: toolResults })
    }

    this.emit('turnEnd')
    return {
      text: totalText,
      toolCalls: totalToolCalls,
      tokens: turnTokens,
    }
  }

  /**
   * Goal-driven autonomous loop.
   * Keeps running turns until the goal is achieved or max iterations reached.
   */
  async runGoalLoop(goalDescription: string): Promise<void> {
    const cfg = config.get()
    const goal = goalManager.setGoal(goalDescription, cfg.agent.maxGoalIterations)

    console.log('\n' + colors.goal(`🎯 GOAL SET: ${goalDescription}`))
    console.log(colors.muted(`   Max iterations: ${goal.maxIterations}`))
    console.log(separator())
    this.emit('goalStart', goalDescription)

    // Start with the goal as the first user message
    const initialPrompt = `I need you to achieve the following goal completely and autonomously:\n\n**Goal**: ${goalDescription}\n\nStart by analyzing what needs to be done, create a plan, and begin executing it. Continue until the goal is fully achieved.`

    while (goalManager.hasActiveGoal()) {
      if (goalManager.isMaxIterationsReached()) {
        console.log(colors.warning(`\n⚠️  Max iterations (${goal.maxIterations}) reached without achieving goal`))
        goalManager.markFailed('Max iterations reached')
        break
      }

      const iteration = (goalManager.getGoal()?.iterations || 0) + 1
      const maxIter = goalManager.getGoal()?.maxIterations || 50
      if (!this.isTUI()) {
        process.stdout.write(colors.muted(`\n[iter ${iteration}/${maxIter}] `))
      }

      goalManager.incrementIteration()

      // On first iteration, use initial prompt; thereafter continue autonomously
      const message = this.messages.length === 0 ? initialPrompt : undefined

      try {
        const result = await this.turn(message)

        if (!goalManager.hasActiveGoal()) {
          // Goal was achieved during turn
          console.log('\n' + colors.success('✅ GOAL ACHIEVED!'))
          console.log(separator())
          break
        }
      } catch (err: any) {
        const isConnErr = err?.cause?.code === 'ECONNREFUSED' || err?.code === 'ECONNREFUSED'
        if (isConnErr) {
          const currentProvider = (this as any).provider?.name || 'provider'
          console.error(colors.error(`\n✗ Connection refused — ${currentProvider} is not reachable.`))
          console.error(colors.muted('  If using Ollama, run: ollama serve'))
          console.error(colors.muted('  Or set an API key: export ANTHROPIC_API_KEY=sk-ant-...'))
        } else if (err?.status === 401 || err?.status === 403) {
          console.error(colors.error('\n✗ Authentication failed — check your API key.'))
          console.error(colors.muted('  Run: agent auth'))
        } else {
          console.error(colors.error('\n✗ Error:'), err?.message ?? String(err))
        }
        goalManager.markFailed(String(err))
        break
      }
    }
    this.emit('goalEnd')
  }

  /**
   * Compact the conversation: summarize older messages to free context
   */
  async compact(instructions?: string): Promise<string> {
    if (this.messages.length < 4) {
      return 'Conversation is short, compaction not needed'
    }

    const provider = providerRegistry.getCurrentProvider()
    const model = providerRegistry.getCurrentModel()

    const summaryPrompt = instructions
      ? `Summarize this conversation, focusing on: ${instructions}. Be concise but capture all key decisions, code changes, and context needed to continue.`
      : `Summarize this conversation concisely. Capture all key decisions, code changes, file paths created/modified, commands run, and important context needed to continue the work.`

    const cfg = config.get()
    const response = await provider.chat(
      [
        ...this.messages,
        { role: 'user', content: summaryPrompt },
      ],
      { model, maxTokens: Math.max(cfg.defaults.maxTokens, 8192) }
    )

    const summary = provider.extractText(response)

    // Replace conversation with summary
    this.messages = [
      {
        role: 'user',
        content: `[Previous conversation summary]\n${summary}\n\n[End of summary — continue from here]`,
      },
      {
        role: 'assistant',
        content: 'Understood. I have the context from our previous conversation and am ready to continue.',
      },
    ]

    return summary
  }

  getContextStats(): { messages: number; estimatedTokens: number } {
    const text = this.messages.map((m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return content
    }).join('')

    // Rough estimate: 4 chars per token
    return {
      messages: this.messages.length,
      estimatedTokens: Math.round(text.length / 4),
    }
  }
}

export const agent = new Agent()
