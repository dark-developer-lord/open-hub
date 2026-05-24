import chalk from 'chalk'

export const colors = {
  // Primary
  primary: chalk.hex('#7C3AED'),
  accent: chalk.hex('#06B6D4'),
  success: chalk.hex('#10B981'),
  warning: chalk.hex('#F59E0B'),
  error: chalk.hex('#EF4444'),
  muted: chalk.hex('#6B7280'),
  info: chalk.hex('#3B82F6'),

  // Text
  bold: chalk.bold,
  dim: chalk.dim,
  italic: chalk.italic,

  // Semantic
  goal: chalk.hex('#A855F7').bold,
  tool: chalk.hex('#06B6D4'),
  model: chalk.hex('#8B5CF6'),
  provider: chalk.hex('#EC4899'),
  command: chalk.hex('#F59E0B'),
  user: chalk.hex('#10B981').bold,
  assistant: chalk.hex('#60A5FA').bold,
  thinking: chalk.hex('#9CA3AF').italic,
  system: chalk.hex('#6366F1'),

  // Status indicators
  check: chalk.green('✓'),
  cross: chalk.red('✗'),
  arrow: chalk.cyan('→'),
  dot: chalk.gray('·'),
  star: chalk.yellow('★'),
  rocket: '🚀',
  target: '🎯',
  brain: '🧠',
  gear: '⚙',
  plug: '🔌',
  file: '📄',
  folder: '📁',
  bash: '💻',
  search: '🔍',
  checkmark: '✅',
  warning_sign: '⚠️',
  stop: '🛑',
}

export function banner() {
  return `
${colors.primary('┌─────────────────────────────────────────────────────────┐')}
${colors.primary('│')}  ${colors.goal('◆ AGENT CLI')} ${colors.muted('— AI Agent with MCP & Goal-Driven Execution')}  ${colors.primary('│')}
${colors.primary('│')}  ${colors.muted('Multi-provider · MCP Connected · Goal Autonomous')}         ${colors.primary('│')}
${colors.primary('└─────────────────────────────────────────────────────────┘')}
`
}

export function formatMessage(role: 'user' | 'assistant' | 'system', content: string): string {
  const prefix =
    role === 'user'
      ? `${colors.user('You')} `
      : role === 'assistant'
        ? `${colors.assistant('Agent')} `
        : `${colors.system('System')} `
  return `${prefix}${colors.dim('›')} ${content}`
}

export function formatToolCall(toolName: string, input: unknown): string {
  return `${colors.tool(`${colors.gear} ${toolName}`)} ${colors.muted(JSON.stringify(input).slice(0, 80) + '...')}`
}

export function formatGoalStatus(goal: string, iterations: number, maxIterations: number): string {
  const pct = Math.round((iterations / maxIterations) * 100)
  const bar = progressBar(pct, 20)
  return `${colors.goal(`${colors.target} GOAL`)} ${colors.muted(`[${bar}] turn ${iterations}/${maxIterations}`)} ${colors.dim('›')} ${goal}`
}

export function progressBar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width)
  const empty = width - filled
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty))
}

export function separator(label?: string): string {
  if (label) {
    return colors.muted(`── ${label} ${'─'.repeat(Math.max(0, 50 - label.length))}`)
  }
  return colors.muted('─'.repeat(56))
}
