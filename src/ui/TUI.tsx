/**
 * Terminal UI built with ink (React for CLI).
 * Provides a beautiful chat interface with command palette.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Text, useInput, useApp, Static, render } from 'ink'
import TextInput from 'ink-text-input'
import type { Agent } from '../agent/Agent.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TUIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  tools: { name: string; status: 'running' | 'done' | 'error' }[]
  done: boolean
}

export interface TUIStatusInfo {
  provider: string
  model: string
  mcpCount: number
  tokens: number
}

export interface TUIProps {
  agent: Agent
  statusInfo: TUIStatusInfo
  onChat: (text: string) => Promise<void>
  onSlashCommand: (input: string) => Promise<string | undefined>
  initialQuery?: string
}

// ── Commands palette ──────────────────────────────────────────────────────────

const COMMANDS = [
  { name: '/goal',     args: '<task>',  desc: 'Autonomous goal loop' },
  { name: '/model',    args: '<name>',  desc: 'Switch model' },
  { name: '/provider', args: '<name>',  desc: 'Switch provider' },
  { name: '/clear',    args: '',        desc: 'Clear chat history' },
  { name: '/compact',  args: '',        desc: 'Compact conversation' },
  { name: '/tokens',   args: '',        desc: 'Token usage' },
  { name: '/save',     args: '[name]',  desc: 'Save session' },
  { name: '/sessions', args: '',        desc: 'List saved sessions' },
  { name: '/resume',   args: '<id>',    desc: 'Resume session' },
  { name: '/plan',     args: '<task>',  desc: 'Plan only (no execution)' },
  { name: '/tools',    args: '',        desc: 'List available tools' },
  { name: '/mcp',      args: '',        desc: 'MCP server status' },
  { name: '/help',     args: '',        desc: 'Show help' },
  { name: '/exit',     args: '',        desc: 'Exit' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBar = ({ provider, model, mcpCount, tokens, goalActive }: {
  provider: string; model: string; mcpCount: number; tokens: number; goalActive: boolean
}) => (
  <Box paddingX={1} borderStyle="single" borderColor="cyan">
    <Text color="cyan" bold>◆ OPEN-HUB</Text>
    <Text color="gray">  ·  </Text>
    <Text color="white">{provider}</Text>
    <Text color="gray"> / </Text>
    <Text color="yellow">{model}</Text>
    {mcpCount > 0 && <Text color="green">  ·  {mcpCount} MCP</Text>}
    {goalActive && <Text color="magenta">  ·  🎯 GOAL</Text>}
    {tokens > 0 && <Text color="gray">  ·  ↑{tokens} tok</Text>}
    <Box flexGrow={1}><Text> </Text></Box>
    <Text color="gray" dimColor>Tab: cmds  Ctrl+C: exit</Text>
  </Box>
)

const UserMessage = ({ msg }: { msg: TUIMessage }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box paddingLeft={1}>
      <Text color="blue" bold> You </Text>
      <Text color="gray" dimColor>›</Text>
    </Box>
    <Box paddingLeft={3}>
      <Text wrap="wrap">{msg.text}</Text>
    </Box>
  </Box>
)

const AssistantMessage = ({ msg }: { msg: TUIMessage }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box paddingLeft={1}>
      <Text color="green" bold>Agent</Text>
      <Text color="gray" dimColor> ›</Text>
    </Box>
    {msg.tools.map((t, i) => (
      <Box key={i} paddingLeft={3}>
        <Text color="yellow">⚙ {t.name}</Text>
        <Text color="gray"> ... </Text>
        {t.status === 'running' && <Text color="yellow">●</Text>}
        {t.status === 'done'    && <Text color="green">✓</Text>}
        {t.status === 'error'   && <Text color="red">✗</Text>}
      </Box>
    ))}
    {msg.text ? (
      <Box paddingLeft={3}>
        <Text wrap="wrap">{msg.text}</Text>
      </Box>
    ) : (!msg.done && msg.tools.length === 0) ? (
      <Box paddingLeft={3}><Text color="yellow" dimColor>●  thinking...</Text></Box>
    ) : null}
  </Box>
)

const SystemMessage = ({ msg }: { msg: TUIMessage }) => (
  <Box marginBottom={1} paddingLeft={1}>
    <Text color="gray" dimColor>ℹ  {msg.text}</Text>
  </Box>
)

const MessageView = ({ msg }: { msg: TUIMessage }) => {
  if (msg.role === 'user')      return <UserMessage msg={msg} />
  if (msg.role === 'system')    return <SystemMessage msg={msg} />
  return <AssistantMessage msg={msg} />
}

const CommandPalette = ({ filter }: { filter: string }) => {
  const isFiltering = filter.startsWith('/')
  const filtered = isFiltering
    ? COMMANDS.filter(c => c.name.startsWith(filter.split(' ')[0]))
    : COMMANDS
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginX={1}
      marginBottom={1}
    >
      <Box>
        <Text color="gray" bold> Commands  </Text>
        <Text color="gray" dimColor>(Tab to hide)</Text>
      </Box>
      {filtered.map(cmd => (
        <Box key={cmd.name}>
          <Text color="cyan">{cmd.name}</Text>
          {cmd.args ? <Text color="gray" dimColor> {cmd.args}</Text> : null}
          <Text color="gray" dimColor>  —  {cmd.desc}</Text>
        </Box>
      ))}
    </Box>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

const App = ({ agent, statusInfo: initialStatus, onChat, onSlashCommand, initialQuery }: TUIProps) => {
  const { exit } = useApp()
  const [completedMsgs, setCompletedMsgs] = useState<TUIMessage[]>([])
  const [streamingMsg, setStreamingMsg]   = useState<TUIMessage | null>(null)
  const [input, setInput]                  = useState('')
  const [isLoading, setIsLoading]         = useState(false)
  const [showCmds, setShowCmds]           = useState(false)
  const [status, setStatus]               = useState(initialStatus)
  const [goalActive, setGoalActive]       = useState(false)
  const idRef = useRef(0)
  const nextId = () => String(++idRef.current)

  // Agent event listeners
  useEffect(() => {
    const onText = (text: string) => {
      setStreamingMsg(prev => {
        const base = prev ?? { id: nextId(), role: 'assistant' as const, text: '', tools: [], done: false }
        return { ...base, text: base.text + text }
      })
    }
    const onToolStart = (name: string) => {
      setStreamingMsg(prev => {
        const base = prev ?? { id: nextId(), role: 'assistant' as const, text: '', tools: [], done: false }
        return { ...base, tools: [...base.tools, { name, status: 'running' as const }] }
      })
    }
    const onToolEnd = (name: string, success: boolean) => {
      setStreamingMsg(prev => {
        if (!prev) return prev
        // Update last tool with this name that is still 'running'
        const tools = [...prev.tools]
        const idx = tools.map(t => t.name).lastIndexOf(name)
        if (idx !== -1) tools[idx] = { name, status: success ? 'done' : 'error' }
        return { ...prev, tools }
      })
    }
    const onTurnEnd = () => {
      setStreamingMsg(prev => {
        if (prev) {
          const done = { ...prev, done: true }
          setCompletedMsgs(msgs => [...msgs, done])
        }
        return null
      })
      setIsLoading(false)
      const tok = agent.getTotalTokens()
      setStatus(s => ({ ...s, tokens: tok.input + tok.output }))
    }
    const onGoalStart = () => setGoalActive(true)
    const onGoalEnd   = () => setGoalActive(false)

    agent.on('text',      onText)
    agent.on('toolStart', onToolStart)
    agent.on('toolEnd',   onToolEnd)
    agent.on('turnEnd',   onTurnEnd)
    agent.on('goalStart', onGoalStart)
    agent.on('goalEnd',   onGoalEnd)

    return () => {
      agent.off('text',      onText)
      agent.off('toolStart', onToolStart)
      agent.off('toolEnd',   onToolEnd)
      agent.off('turnEnd',   onTurnEnd)
      agent.off('goalStart', onGoalStart)
      agent.off('goalEnd',   onGoalEnd)
    }
  }, [agent])

  // Run initial query if provided
  useEffect(() => {
    if (initialQuery) {
      void submit(initialQuery)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useInput((_ch, key) => {
    if (key.tab) setShowCmds(v => !v)
    if (key.escape) setShowCmds(false)
  })

  const addSysMsg = (text: string) => {
    setCompletedMsgs(msgs => [...msgs, { id: nextId(), role: 'system', text, tools: [], done: true }])
  }

  const submit = useCallback(async (value: string) => {
    const text = value.trim()
    if (!text || isLoading) return
    setInput('')
    setShowCmds(false)

    if (text.startsWith('/')) {
      const userMsg: TUIMessage = { id: nextId(), role: 'user', text, tools: [], done: true }
      setCompletedMsgs(msgs => [...msgs, userMsg])
      setIsLoading(true)
      try {
        const result = await onSlashCommand(text)
        if (result !== undefined) {
          addSysMsg(result)
        }
        // Refresh status after command
        const tok = agent.getTotalTokens()
        setStatus(s => ({ ...s, tokens: tok.input + tok.output }))
      } finally {
        setIsLoading(false)
      }
      return
    }

    const userMsg: TUIMessage = { id: nextId(), role: 'user', text, tools: [], done: true }
    setCompletedMsgs(msgs => [...msgs, userMsg])
    setIsLoading(true)
    // Create empty streaming placeholder immediately
    setStreamingMsg({ id: nextId(), role: 'assistant', text: '', tools: [], done: false })

    try {
      await onChat(text)
    } catch (err: any) {
      setStreamingMsg(null)
      setIsLoading(false)
      const isConn = err?.cause?.code === 'ECONNREFUSED'
      const msg = isConn
        ? '✗ Connection refused. Is the provider running? (Ollama: ollama serve)'
        : `✗ ${err?.message ?? String(err)}`
      addSysMsg(msg)
    }
  }, [isLoading, onChat, onSlashCommand])

  const showCmdPalette = showCmds || (input.startsWith('/') && input.length > 0)

  return (
    <Box flexDirection="column">
      {/* Status bar */}
      <StatusBar
        provider={status.provider}
        model={status.model}
        mcpCount={status.mcpCount}
        tokens={status.tokens}
        goalActive={goalActive}
      />

      {/* Completed messages (static — never re-renders) */}
      <Static items={completedMsgs}>
        {(msg) => <MessageView key={msg.id} msg={msg} />}
      </Static>

      {/* In-progress streaming message */}
      {streamingMsg && <MessageView msg={streamingMsg} />}

      {/* Command palette */}
      {showCmdPalette && <CommandPalette filter={input} />}

      {/* Input bar */}
      <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'} paddingX={1}>
        {isLoading ? (
          <Text color="yellow" dimColor> ● Processing...</Text>
        ) : (
          <Box>
            <Text color="cyan" bold> › </Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={submit}
              placeholder="Type a message, /command, or press Tab for commands..."
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Start TUI ─────────────────────────────────────────────────────────────────

export function startTUI(props: TUIProps): void {
  const { unmount } = render(<App {...props} />, { patchConsole: true })
  // Store unmount so it can be called on exit
  ;(globalThis as any).__tuiUnmount = unmount
}
