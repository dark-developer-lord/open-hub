import { colors, formatGoalStatus } from '../ui/colors.js'

export interface Goal {
  id: string
  description: string
  condition: string
  createdAt: Date
  achievedAt?: Date
  iterations: number
  maxIterations: number
  plan: string[]
  currentStepIndex: number
  status: 'active' | 'achieved' | 'failed' | 'paused'
  history: GoalEvent[]
}

export interface GoalEvent {
  type: 'step_completed' | 'progress_check' | 'plan_updated' | 'achieved' | 'failed'
  timestamp: Date
  description: string
}

const GOAL_ACHIEVED_SIGNAL = 'GOAL_ACHIEVED:'
const GOAL_PROGRESS_SIGNAL = 'GOAL_PROGRESS:'
const GOAL_PLAN_SIGNAL = 'GOAL_PLAN:'

export class GoalManager {
  private currentGoal: Goal | null = null
  private goalHistory: Goal[] = []

  setGoal(description: string, maxIterations = 50): Goal {
    // Clear previous if active
    if (this.currentGoal?.status === 'active') {
      this.currentGoal.status = 'paused'
      this.goalHistory.push(this.currentGoal)
    }

    const goal: Goal = {
      id: `goal_${Date.now()}`,
      description,
      condition: description,
      createdAt: new Date(),
      iterations: 0,
      maxIterations,
      plan: [],
      currentStepIndex: 0,
      status: 'active',
      history: [],
    }

    this.currentGoal = goal
    return goal
  }

  getGoal(): Goal | null {
    return this.currentGoal
  }

  hasActiveGoal(): boolean {
    return this.currentGoal?.status === 'active'
  }

  clearGoal(reason: 'clear' | 'stop' | 'off' | 'cancel' = 'clear') {
    if (this.currentGoal) {
      if (this.currentGoal.status === 'active') {
        this.currentGoal.status = 'failed'
        this.currentGoal.history.push({
          type: 'failed',
          timestamp: new Date(),
          description: `Goal cleared manually (${reason})`,
        })
      }
      this.goalHistory.push(this.currentGoal)
      this.currentGoal = null
    }
  }

  incrementIteration(): boolean {
    if (!this.currentGoal) return false
    this.currentGoal.iterations++
    return this.currentGoal.iterations < this.currentGoal.maxIterations
  }

  isMaxIterationsReached(): boolean {
    if (!this.currentGoal) return false
    return this.currentGoal.iterations >= this.currentGoal.maxIterations
  }

  setPlan(steps: string[]) {
    if (this.currentGoal) {
      this.currentGoal.plan = steps
      this.currentGoal.currentStepIndex = 0
      this.currentGoal.history.push({
        type: 'plan_updated',
        timestamp: new Date(),
        description: `Plan set with ${steps.length} steps`,
      })
    }
  }

  markAchieved(explanation: string) {
    if (this.currentGoal) {
      this.currentGoal.status = 'achieved'
      this.currentGoal.achievedAt = new Date()
      this.currentGoal.history.push({
        type: 'achieved',
        timestamp: new Date(),
        description: explanation,
      })
      this.goalHistory.push(this.currentGoal)
      this.currentGoal = null
    }
  }

  markFailed(reason: string) {
    if (this.currentGoal) {
      this.currentGoal.status = 'failed'
      this.currentGoal.history.push({
        type: 'failed',
        timestamp: new Date(),
        description: reason,
      })
      this.goalHistory.push(this.currentGoal)
      this.currentGoal = null
    }
  }

  /**
   * Parses the AI response to check for goal achievement signals.
   * Returns true if the goal has been marked as achieved.
   */
  parseResponse(text: string): {
    achieved: boolean
    explanation?: string
    progress?: string
    planUpdate?: string[]
  } {
    // Check for GOAL_ACHIEVED signal
    if (text.includes(GOAL_ACHIEVED_SIGNAL)) {
      const idx = text.indexOf(GOAL_ACHIEVED_SIGNAL)
      const explanation = text.slice(idx + GOAL_ACHIEVED_SIGNAL.length).trim()
      this.markAchieved(explanation)
      return { achieved: true, explanation }
    }

    // Check for GOAL_PLAN signal
    if (text.includes(GOAL_PLAN_SIGNAL)) {
      const idx = text.indexOf(GOAL_PLAN_SIGNAL)
      const planText = text.slice(idx + GOAL_PLAN_SIGNAL.length).trim()
      const steps = planText
        .split('\n')
        .map((s) => s.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean)
      this.setPlan(steps)
      return { achieved: false, planUpdate: steps }
    }

    return { achieved: false }
  }

  /**
   * Build the system prompt extension for goal-driven mode
   */
  buildGoalSystemPrompt(): string {
    if (!this.currentGoal) return ''

    const goal = this.currentGoal
    const stepList = goal.plan.length > 0
      ? `\n\nCurrent plan:\n${goal.plan.map((s, i) => `${i + 1}. ${i === goal.currentStepIndex ? '→ ' : '  '}${s}`).join('\n')}`
      : ''

    return `
## GOAL-DRIVEN MODE ACTIVE

You are working toward a specific goal and MUST continue until it is FULLY achieved.

**Goal**: ${goal.description}
**Progress**: Iteration ${goal.iterations}/${goal.maxIterations}${stepList}

**Instructions**:
1. Analyze what has been done so far and what still needs to be done
2. Execute the next necessary action using available tools
3. After each action, assess if the ENTIRE goal is completely fulfilled
4. Only when ALL aspects of the goal are 100% complete, respond with:
   \`GOAL_ACHIEVED: <explanation of what was accomplished>\`
5. If you need to create/update a plan, include:
   \`GOAL_PLAN:\n1. Step one\n2. Step two\n...\`

**Important**: Do NOT stop working until the goal is genuinely and completely achieved. 
Every response must either use tools to make progress OR signal goal achievement.
If you cannot use tools right now, explain what you did and what is still needed.
`
  }

  printStatus() {
    if (!this.currentGoal) {
      const last = this.goalHistory[this.goalHistory.length - 1]
      if (last) {
        const statusColor = last.status === 'achieved' ? colors.success : colors.error
        console.log(`${colors.goal('Last goal')}: ${last.description}`)
        console.log(`${colors.muted('Status')}: ${statusColor(last.status)}`)
        if (last.achievedAt) {
          console.log(`${colors.muted('Achieved at')}: ${last.achievedAt.toLocaleString()}`)
        }
      } else {
        console.log(colors.muted('No active goal. Use /goal <condition> to set one.'))
      }
      return
    }

    const g = this.currentGoal
    console.log(formatGoalStatus(g.description, g.iterations, g.maxIterations))
    if (g.plan.length > 0) {
      console.log(colors.muted('\nPlan:'))
      g.plan.forEach((step, i) => {
        const marker = i < g.currentStepIndex
          ? colors.success('✓')
          : i === g.currentStepIndex
            ? colors.accent('→')
            : colors.muted('○')
        console.log(`  ${marker} ${step}`)
      })
    }
  }

  getRecentHistory(): Goal[] {
    return this.goalHistory.slice(-5)
  }
}

export const goalManager = new GoalManager()
