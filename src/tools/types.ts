import { ToolDefinition } from '../providers/types.js'

export interface ToolResult {
  success: boolean
  output: string
  error?: string
}

export interface Tool {
  definition: ToolDefinition
  execute(input: Record<string, unknown>): Promise<ToolResult>
}

export abstract class BaseTool implements Tool {
  abstract definition: ToolDefinition
  abstract execute(input: Record<string, unknown>): Promise<ToolResult>
}
