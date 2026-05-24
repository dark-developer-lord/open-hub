import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Message } from '../providers/types.js'
import config from '../config/Config.js'

export interface SessionMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  model: string
  provider: string
  messageCount: number
  directory: string
  tags: string[]
}

export interface Session {
  meta: SessionMeta
  messages: Message[]
}

export class SessionManager {
  private sessionsDir: string
  private currentSessionId: string | null = null

  constructor() {
    this.sessionsDir = config.get().sessions.dir
    this.ensureDir()
  }

  private ensureDir() {
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true })
    }
  }

  private sessionPath(id: string): string {
    return join(this.sessionsDir, `${id}.json`)
  }

  createSession(name?: string, model?: string, provider?: string): Session {
    const id = uuidv4()
    const meta: SessionMeta = {
      id,
      name: name || `session-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: model || config.get().defaults.model,
      provider: provider || config.get().defaults.provider,
      messageCount: 0,
      directory: process.cwd(),
      tags: [],
    }

    const session: Session = { meta, messages: [] }
    this.save(session)
    this.currentSessionId = id
    return session
  }

  save(session: Session) {
    session.meta.updatedAt = new Date().toISOString()
    session.meta.messageCount = session.messages.length
    writeFileSync(this.sessionPath(session.meta.id), JSON.stringify(session, null, 2))
  }

  load(id: string): Session | null {
    const path = this.sessionPath(id)
    if (!existsSync(path)) return null
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as Session
    } catch {
      return null
    }
  }

  loadByName(name: string): Session | null {
    const sessions = this.list()
    const meta = sessions.find((s) => s.name === name || s.id.startsWith(name))
    if (!meta) return null
    return this.load(meta.id)
  }

  list(): SessionMeta[] {
    this.ensureDir()
    const files = readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'))
    const sessions: SessionMeta[] = []

    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(this.sessionsDir, file), 'utf-8')) as Session
        sessions.push(data.meta)
      } catch {
        // skip corrupt sessions
      }
    }

    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  getMostRecent(cwd?: string): Session | null {
    const sessions = this.list()
    const filtered = cwd ? sessions.filter((s) => s.directory === cwd) : sessions
    if (filtered.length === 0) return null
    return this.load(filtered[0].id)
  }

  rename(id: string, newName: string): boolean {
    const session = this.load(id)
    if (!session) return false
    session.meta.name = newName
    this.save(session)
    return true
  }

  delete(id: string): boolean {
    const path = this.sessionPath(id)
    if (!existsSync(path)) return false
    unlinkSync(path)
    return true
  }

  export(id: string): string {
    const session = this.load(id)
    if (!session) return ''

    const lines: string[] = [
      `# Session: ${session.meta.name}`,
      `Date: ${session.meta.createdAt}`,
      `Model: ${session.meta.provider}/${session.meta.model}`,
      `Messages: ${session.meta.messageCount}`,
      '',
      '---',
      '',
    ]

    for (const msg of session.messages) {
      const role = msg.role.toUpperCase()
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content, null, 2)
      lines.push(`## ${role}`)
      lines.push(content)
      lines.push('')
    }

    return lines.join('\n')
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  setCurrentSessionId(id: string) {
    this.currentSessionId = id
  }
}

export const sessionManager = new SessionManager()
