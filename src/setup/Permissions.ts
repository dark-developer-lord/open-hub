/**
 * macOS permission setup — requests all permissions needed by agent-cli.
 * Run with: agent setup
 */
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { colors, separator } from '../ui/colors.js'

const execAsync = promisify(exec)

interface PermResult {
  name: string
  status: 'granted' | 'denied' | 'unknown'
  hint?: string
}

export async function runSetup(): Promise<void> {
  console.log()
  console.log(colors.bold('◆ AGENT CLI — Setup & Permissions'))
  console.log(colors.muted('  Configuring full system access for agent-cli...'))
  console.log(separator())

  // ── Config directories ────────────────────────────────────────────────────
  const configDir = join(homedir(), '.agent-cli')
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
    console.log(colors.success('  ✓ Created ~/.agent-cli/'))
  } else {
    console.log(colors.success('  ✓ Config dir exists: ~/.agent-cli/'))
  }

  const cfgFile = join(configDir, 'config.json')
  if (!existsSync(cfgFile)) {
    writeFileSync(cfgFile, JSON.stringify({
      defaults: { provider: 'anthropic', model: '' },
      agent: { permissionMode: 'bypassPermissions', maxGoalIterations: 200 },
    }, null, 2))
    console.log(colors.success('  ✓ Created ~/.agent-cli/config.json'))
  }

  // ── macOS permissions ─────────────────────────────────────────────────────
  console.log()
  console.log(colors.muted('  ─── macOS Permissions ───────────────────────────'))
  console.log()

  const results: PermResult[] = await Promise.all([
    checkNotifications(),
    checkScreenRecording(),
    checkAccessibility(),
  ])

  for (const r of results) {
    const icon = r.status === 'granted' ? colors.success('  ✓') : colors.warning('  ⚠')
    const statusText = r.status === 'granted'
      ? colors.success('granted')
      : colors.warning('needs manual grant')
    console.log(`${icon}  ${r.name}: ${statusText}`)
    if (r.hint) {
      console.log(colors.muted(`      ${r.hint}`))
    }
  }

  // ── Full Disk Access ──────────────────────────────────────────────────────
  console.log()
  console.log(colors.muted('  ─── Full Disk Access (required for reading any file) ───'))
  console.log()
  console.log(colors.muted('  Enable your terminal app in:'))
  console.log(colors.muted('  System Settings → Privacy & Security → Full Disk Access'))
  console.log()

  // Try to open System Settings directly
  try {
    execSync('open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"', { stdio: 'ignore' })
    console.log(colors.muted('  (System Settings opened automatically)'))
  } catch {
    // Non-macOS or old macOS
    try {
      execSync('open /System/Applications/System\\ Preferences.app', { stdio: 'ignore' })
    } catch { /* skip */ }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log()
  console.log(separator())
  console.log()
  console.log(colors.success('  ✓ Setup complete!'))
  console.log()
  console.log(colors.muted('  Next steps:'))
  console.log(colors.muted('    1. Set an API key:  export ANTHROPIC_API_KEY=sk-ant-...'))
  console.log(colors.muted('       (or add to ~/.agent-cli/.env or .env in your project)'))
  console.log(colors.muted('    2. Run: agent'))
  console.log()
}

async function checkNotifications(): Promise<PermResult> {
  try {
    await execAsync(
      `osascript -e 'display notification "Agent CLI setup complete" with title "Agent CLI" subtitle "All permissions granted"'`,
      { timeout: 5000 }
    )
    return { name: 'Notifications', status: 'granted' }
  } catch {
    return {
      name: 'Notifications',
      status: 'unknown',
      hint: 'System Settings → Notifications → Terminal → Allow Notifications',
    }
  }
}

async function checkScreenRecording(): Promise<PermResult> {
  try {
    await execAsync('screencapture -x /tmp/.agent-cli-perm-check.png 2>/dev/null', { timeout: 5000 })
    execSync('rm -f /tmp/.agent-cli-perm-check.png', { stdio: 'ignore' })
    return { name: 'Screen Recording', status: 'granted' }
  } catch {
    return {
      name: 'Screen Recording',
      status: 'unknown',
      hint: 'System Settings → Privacy & Security → Screen Recording → enable Terminal',
    }
  }
}

async function checkAccessibility(): Promise<PermResult> {
  try {
    await execAsync(
      `osascript -e 'tell application "System Events" to get name of first process'`,
      { timeout: 5000 }
    )
    return { name: 'Accessibility (AppleScript UI)', status: 'granted' }
  } catch {
    return {
      name: 'Accessibility (AppleScript UI)',
      status: 'unknown',
      hint: 'System Settings → Privacy & Security → Accessibility → enable Terminal',
    }
  }
}
