/**
 * System-level tools: open applications/files/URLs, clipboard, notifications,
 * screenshots, process management, system info. macOS-first but gracefully
 * falls back to Linux equivalents where possible.
 */
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir, platform, homedir } from 'os'
import { BaseTool, ToolResult } from './types.js'
import { ToolDefinition } from '../providers/types.js'

const execAsync = promisify(exec)
const IS_MAC = platform() === 'darwin'
const IS_LINUX = platform() === 'linux'

// ── Open ────────────────────────────────────────────────────────────────────

export class OpenTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Open',
    description: 'Open a file, directory, URL, or application. On macOS uses `open`, on Linux uses `xdg-open`. Can launch any installed application by name or bundle ID.',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'What to open: a file path, URL (https://...), or app name (e.g., "Safari", "Finder", "Terminal", "Visual Studio Code")',
        },
        app: {
          type: 'string',
          description: 'Optional: open target with a specific application name',
        },
        background: {
          type: 'boolean',
          description: 'Open in background without bringing to foreground (macOS only)',
        },
        new_instance: {
          type: 'boolean',
          description: 'Force opening a new instance of the application (macOS only)',
        },
      },
      required: ['target'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const target = input.target as string
    const app = input.app as string | undefined
    const background = (input.background as boolean) || false
    const newInstance = (input.new_instance as boolean) || false

    try {
      if (IS_MAC) {
        const parts = ['open']
        if (background) parts.push('-g')
        if (newInstance) parts.push('-n')
        if (app) parts.push('-a', `"${app}"`)
        // resolve file paths but leave URLs as-is
        const resolvedTarget = target.startsWith('http') || target.startsWith('mailto:')
          ? target
          : resolve(target)
        parts.push(`"${resolvedTarget}"`)
        const cmd = parts.join(' ')
        await execAsync(cmd)
        return { success: true, output: `Opened: ${target}${app ? ` with ${app}` : ''}` }
      } else if (IS_LINUX) {
        await execAsync(`xdg-open "${target}"`)
        return { success: true, output: `Opened: ${target}` }
      } else {
        return { success: false, output: '', error: 'Open is only supported on macOS and Linux' }
      }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── AppleScript / osascript ─────────────────────────────────────────────────

export class AppleScriptTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'AppleScript',
    description: 'Run AppleScript code to control macOS applications (only on macOS). Can automate Finder, Safari, Mail, Calendar, Reminders, Messages, Terminal, and any scriptable app. Can read/write data, click UI elements, and trigger actions.',
    input_schema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'AppleScript code to execute. Example: tell application "Finder" to open home',
        },
      },
      required: ['script'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    if (!IS_MAC) {
      return { success: false, output: '', error: 'AppleScript is only available on macOS' }
    }
    const script = input.script as string
    try {
      // Write to temp file to avoid shell quoting issues with complex scripts
      const tmpFile = join(tmpdir(), `agent_applescript_${Date.now()}.applescript`)
      writeFileSync(tmpFile, script, 'utf-8')
      const { stdout, stderr } = await execAsync(`osascript "${tmpFile}"`, { timeout: 30000 })
      try { unlinkSync(tmpFile) } catch { /* ignore */ }
      return { success: true, output: stdout.trim() || stderr.trim() || '(completed)' }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string }
      return { success: false, output: e.stdout || '', error: e.stderr || e.message || String(err) }
    }
  }
}

// ── Clipboard ──────────────────────────────────────────────────────────────

export class ClipboardReadTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'ClipboardRead',
    description: 'Read the current clipboard contents as text.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  }

  async execute(_input: Record<string, unknown>): Promise<ToolResult> {
    try {
      const cmd = IS_MAC ? 'pbpaste' : 'xclip -selection clipboard -o'
      const { stdout } = await execAsync(cmd)
      return { success: true, output: stdout || '(clipboard is empty)' }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

export class ClipboardWriteTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'ClipboardWrite',
    description: 'Write text to the clipboard.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to put on the clipboard' },
      },
      required: ['text'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const text = input.text as string
    try {
      const cmd = IS_MAC ? 'pbcopy' : 'xclip -selection clipboard'
      await new Promise<void>((res, rej) => {
        const proc = spawn(IS_MAC ? 'pbcopy' : 'xclip', IS_MAC ? [] : ['-selection', 'clipboard'])
        proc.stdin.write(text)
        proc.stdin.end()
        proc.on('close', (code) => code === 0 ? res() : rej(new Error(`exit ${code}`)))
      })
      return { success: true, output: `Copied ${text.length} characters to clipboard` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── Notification ───────────────────────────────────────────────────────────

export class NotifyTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Notify',
    description: 'Send a system notification (toast/banner). macOS uses osascript, Linux uses notify-send.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title' },
        message: { type: 'string', description: 'Notification body text' },
        sound: { type: 'boolean', description: 'Play notification sound (macOS only, default: false)' },
      },
      required: ['title', 'message'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const title = (input.title as string).replace(/"/g, '\\"')
    const message = (input.message as string).replace(/"/g, '\\"')
    const sound = (input.sound as boolean) || false

    try {
      if (IS_MAC) {
        const soundPart = sound ? ` sound name "Glass"` : ''
        await execAsync(
          `osascript -e 'display notification "${message}" with title "${title}"${soundPart}'`
        )
      } else {
        await execAsync(`notify-send "${title}" "${message}"`)
      }
      return { success: true, output: `Notification sent: ${title}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── Screenshot ─────────────────────────────────────────────────────────────

export class ScreenshotTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Screenshot',
    description: 'Take a screenshot of the screen or a specific window. Saves to a file. macOS uses screencapture.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Output file path (default: ~/Desktop/screenshot_<timestamp>.png)',
        },
        window: {
          type: 'boolean',
          description: 'Capture a specific window interactively (macOS only)',
        },
        delay: {
          type: 'number',
          description: 'Delay in seconds before taking the screenshot',
        },
      },
      required: [],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const ts = Date.now()
    const outputPath = resolve(
      (input.path as string) || join(homedir(), 'Desktop', `screenshot_${ts}.png`)
    )
    const delay = (input.delay as number) || 0
    const windowMode = (input.window as boolean) || false

    try {
      if (IS_MAC) {
        const parts = ['screencapture', '-x']  // -x = no sound
        if (delay > 0) parts.push('-T', String(delay))
        if (windowMode) parts.push('-w')
        parts.push(`"${outputPath}"`)
        await execAsync(parts.join(' '), { timeout: (delay + 30) * 1000 })
      } else {
        // Linux fallback: import from ImageMagick or scrot
        await execAsync(`scrot "${outputPath}"`)
      }
      return { success: true, output: `Screenshot saved to: ${outputPath}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── ProcessList ────────────────────────────────────────────────────────────

export class ProcessListTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'ProcessList',
    description: 'List running processes. Can filter by name. Shows PID, CPU, memory, and command.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Filter processes by name (case-insensitive substring match)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of processes to return (default: 30)',
        },
      },
      required: [],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filter = (input.filter as string | undefined)?.toLowerCase()
    const limit = (input.limit as number) || 30

    try {
      const { stdout } = await execAsync('ps aux', { maxBuffer: 5 * 1024 * 1024 })
      let lines = stdout.split('\n').filter(Boolean)
      const header = lines[0]
      let procs = lines.slice(1)

      if (filter) {
        procs = procs.filter((l) => l.toLowerCase().includes(filter))
      }

      procs = procs.slice(0, limit)
      return { success: true, output: [header, ...procs].join('\n') }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── KillProcess ────────────────────────────────────────────────────────────

export class KillProcessTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'KillProcess',
    description: 'Send a signal to a process by PID. Default signal is SIGTERM (graceful shutdown). Use signal=SIGKILL to force kill.',
    input_schema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID to signal' },
        signal: { type: 'string', description: 'Signal to send: SIGTERM (default), SIGKILL, SIGHUP, SIGINT' },
      },
      required: ['pid'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const pid = input.pid as number
    const signal = (input.signal as string) || 'SIGTERM'
    try {
      process.kill(pid, signal as NodeJS.Signals)
      return { success: true, output: `Sent ${signal} to process ${pid}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── SystemInfo ─────────────────────────────────────────────────────────────

export class SystemInfoTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'SystemInfo',
    description: 'Get system information: OS version, CPU, memory, disk usage, uptime, network interfaces.',
    input_schema: {
      type: 'object',
      properties: {
        detail: {
          type: 'string',
          description: 'What to check: all (default), cpu, memory, disk, network, os',
          enum: ['all', 'cpu', 'memory', 'disk', 'network', 'os'],
        },
      },
      required: [],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const detail = (input.detail as string) || 'all'
    try {
      const parts: string[] = []

      if (detail === 'all' || detail === 'os') {
        const { stdout } = await execAsync('uname -a 2>/dev/null || ver')
        parts.push(`OS: ${stdout.trim()}`)
        if (IS_MAC) {
          const { stdout: swVer } = await execAsync('sw_vers 2>/dev/null').catch(() => ({ stdout: '' }))
          if (swVer) parts.push(swVer.trim())
        }
      }

      if (detail === 'all' || detail === 'cpu') {
        if (IS_MAC) {
          const { stdout } = await execAsync('sysctl -n machdep.cpu.brand_string 2>/dev/null').catch(() => ({ stdout: '' }))
          const { stdout: cores } = await execAsync('sysctl -n hw.logicalcpu 2>/dev/null').catch(() => ({ stdout: '' }))
          parts.push(`CPU: ${stdout.trim()} (${cores.trim()} logical cores)`)
        } else {
          const { stdout } = await execAsync('lscpu 2>/dev/null | head -20').catch(() => ({ stdout: '' }))
          parts.push(`CPU:\n${stdout.trim()}`)
        }
      }

      if (detail === 'all' || detail === 'memory') {
        if (IS_MAC) {
          const { stdout } = await execAsync('vm_stat 2>/dev/null').catch(() => ({ stdout: '' }))
          const total = await execAsync('sysctl -n hw.memsize 2>/dev/null').then(r => `${Math.round(parseInt(r.stdout)/1024/1024/1024)}GB`).catch(() => 'unknown')
          parts.push(`Memory: ${total} total\n${stdout.trim()}`)
        } else {
          const { stdout } = await execAsync('free -h 2>/dev/null').catch(() => ({ stdout: '' }))
          parts.push(`Memory:\n${stdout.trim()}`)
        }
      }

      if (detail === 'all' || detail === 'disk') {
        const { stdout } = await execAsync('df -h 2>/dev/null').catch(() => ({ stdout: '' }))
        parts.push(`Disk:\n${stdout.trim()}`)
      }

      if (detail === 'all' || detail === 'network') {
        const { stdout } = await execAsync('ifconfig 2>/dev/null || ip addr 2>/dev/null').catch(() => ({ stdout: '' }))
        parts.push(`Network:\n${stdout.trim().slice(0, 2000)}`)
      }

      return { success: true, output: parts.join('\n\n') }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── ListApps ───────────────────────────────────────────────────────────────

export class ListAppsTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'ListApps',
    description: 'List installed applications. On macOS lists /Applications and ~/Applications. On Linux lists installed packages.',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Filter apps by name (case-insensitive)' },
      },
      required: [],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filter = (input.filter as string | undefined)?.toLowerCase()
    try {
      if (IS_MAC) {
        const { stdout: sys } = await execAsync('ls /Applications 2>/dev/null').catch(() => ({ stdout: '' }))
        const { stdout: user } = await execAsync(`ls ~/Applications 2>/dev/null`).catch(() => ({ stdout: '' }))
        let apps = [...sys.split('\n'), ...user.split('\n')].filter(a => a.endsWith('.app')).map(a => a.replace('.app', ''))
        if (filter) apps = apps.filter(a => a.toLowerCase().includes(filter))
        return { success: true, output: apps.sort().join('\n') || '(none found)' }
      } else {
        const { stdout } = await execAsync('dpkg --get-selections 2>/dev/null | head -100 || rpm -qa 2>/dev/null | head -100')
        let lines = stdout.split('\n').filter(Boolean)
        if (filter) lines = lines.filter(l => l.toLowerCase().includes(filter))
        return { success: true, output: lines.join('\n') || '(none found)' }
      }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── Env ────────────────────────────────────────────────────────────────────

export class EnvTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Env',
    description: 'Read or list environment variables. Can read a specific variable or list all (with optional filter).',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Specific variable name to read (optional)' },
        filter: { type: 'string', description: 'Filter variable names (case-insensitive substring)' },
      },
      required: [],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const name = input.name as string | undefined
    const filter = (input.filter as string | undefined)?.toLowerCase()

    if (name) {
      const val = process.env[name]
      return { success: true, output: val !== undefined ? `${name}=${val}` : `(not set)` }
    }

    let entries = Object.entries(process.env)
      .map(([k, v]) => `${k}=${v || ''}`)
      .sort()

    if (filter) entries = entries.filter(e => e.toLowerCase().includes(filter))
    return { success: true, output: entries.join('\n') }
  }
}
