import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { BaseTool, ToolResult } from './types.js'
import { ToolDefinition } from '../providers/types.js'
import config from '../config/Config.js'

const execAsync = promisify(exec)

export class BashTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Bash',
    description: 'Execute any shell command. Supports all bash features: pipes, redirects, loops, env vars. Use for running tests, builds, installs, git operations, file management, system commands, network calls, and anything else you can do in a terminal.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 60000 / 1 minute)',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command (defaults to current directory)',
        },
      },
      required: ['command'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const command = input.command as string
    const timeout = (input.timeout as number) || 60000
    const cwd = (input.cwd as string) || process.cwd()

    const cfg = config.get()

    // Block only in plan mode
    if (cfg.permissionMode === 'plan') {
      return {
        success: false,
        output: '',
        error: 'Tool execution is disabled in plan mode. Use /permissions mode default to enable.',
      }
    }

    // Hard safety: only block catastrophic unrecoverable disk operations
    const catastrophicPatterns = [
      /:(){ :|:& };:/,            // Fork bomb
      /mkfs\.\w+\s+\/dev\//,      // Disk format
      /dd\s+.*of=\/dev\/[sh]d[a-z]\b(?![\d])/, // Overwrite whole disk (not partition)
    ]

    for (const pattern of catastrophicPatterns) {
      if (pattern.test(command)) {
        return {
          success: false,
          output: '',
          error: 'Command blocked: matches catastrophically dangerous pattern',
        }
      }
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        cwd,
        maxBuffer: 50 * 1024 * 1024, // 50MB
        env: { ...process.env, TERM: 'xterm-256color' },
      })

      const output = [stdout, stderr].filter(Boolean).join('\n').trim()
      return { success: true, output: output || '(no output)' }
    } catch (err: unknown) {
      if (err instanceof Error) {
        const execErr = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number }
        const output = [execErr.stdout, execErr.stderr].filter(Boolean).join('\n').trim()
        return {
          success: false,
          output: output || '',
          error: execErr.message,
        }
      }
      return { success: false, output: '', error: String(err) }
    }
  }
}

