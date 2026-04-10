import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon }  from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { adminApi, type AdminVessel } from '../api/client'
import { Wifi, WifiOff, Terminal as TermIcon, X } from 'lucide-react'

const RELAY_URL = (import.meta.env.VITE_RELAY_URL as string | undefined) ?? ''

type ShellStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'error'

const S = {
  h1:     { fontSize: 22, fontWeight: 700, color: '#e8edf2', margin: '0 0 4px' } as React.CSSProperties,
  sub:    { fontSize: 13, color: '#6b7280', marginBottom: 24 } as React.CSSProperties,
  grid:   { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, height: 'calc(100vh - 140px)' } as React.CSSProperties,
  list:   { background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 12, overflow: 'auto' } as React.CSSProperties,
  item:   (active: boolean): React.CSSProperties => ({
    padding: '13px 16px', cursor: 'pointer', borderBottom: '1px solid #0d1420',
    background: active ? '#0f1e35' : 'transparent',
    borderLeft: active ? '2px solid #0ea5e9' : '2px solid transparent',
    transition: 'all 0.1s',
  }),
  term:   { background: '#020407', border: '1px solid #131e2d', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const },
  termtb: { padding: '10px 16px', background: '#080c12', borderBottom: '1px solid #131e2d', display: 'flex', alignItems: 'center', gap: 10 },
  termbd: { flex: 1, padding: 8, overflow: 'hidden' } as React.CSSProperties,
}

function StatusDot({ status }: { status: ShellStatus }) {
  const colors: Record<ShellStatus, string> = { idle: '#374151', connecting: '#f59e0b', online: '#22c55e', offline: '#ef4444', error: '#ef4444' }
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], display: 'inline-block', flexShrink: 0 }} />
}

export default function Shell() {
  const [vessels, setVessels] = useState<AdminVessel[]>([])
  const [selected, setSelected] = useState<AdminVessel | null>(null)
  const [status, setStatus]   = useState<ShellStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  const termDivRef = useRef<HTMLDivElement>(null)
  const termRef    = useRef<Terminal | null>(null)
  const fitRef     = useRef<FitAddon | null>(null)
  const wsRef      = useRef<WebSocket | null>(null)

  useEffect(() => {
    adminApi.vessels.list().then(setVessels).catch(() => {})
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    termRef.current?.dispose()
    termRef.current = null
  }, [])

  const openShell = useCallback(async (vessel: AdminVessel) => {
    if (!RELAY_URL) {
      setStatus('error')
      setStatusMsg('VITE_RELAY_URL not configured')
      return
    }

    disconnect()
    setSelected(vessel)
    setStatus('connecting')
    setStatusMsg('Requesting shell token…')

    let token: string
    try {
      const result = await adminApi.shell.getToken(vessel.id)
      token = result.token
    } catch (e: unknown) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : 'Failed to get token')
      return
    }

    // Init terminal
    const term = new Terminal({
      theme:       { background: '#020407', foreground: '#c9d4df', cursor: '#0ea5e9' },
      fontFamily:  '"JetBrains Mono", "Fira Code", monospace',
      fontSize:    13,
      cursorBlink: true,
      scrollback:  2000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    termRef.current = term
    fitRef.current  = fit

    if (termDivRef.current) {
      term.open(termDivRef.current)
      fit.fit()
    }

    // Connect WebSocket
    setStatusMsg('Connecting to relay…')
    const wsUrl = `${RELAY_URL.replace(/^http/, 'ws')}/ws?type=admin&vesselId=${encodeURIComponent(vessel.id)}&token=${token}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      setStatusMsg('Waiting for agent…')
    }

    ws.onmessage = (ev) => {
      const data = ev.data
      // Check for control frames (JSON strings)
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data) as { __ctrl?: string }
          if (msg.__ctrl === 'agent_online') {
            setStatus('online')
            setStatusMsg(`Connected to ${vessel.name ?? vessel.id}`)
            term.write('\r\n\x1b[32m── NauticShield remote shell ──\x1b[0m\r\n\r\n')
          } else if (msg.__ctrl === 'agent_offline' || msg.__ctrl === 'agent_disconnected') {
            setStatus('offline')
            setStatusMsg('Agent offline — vessel may be disconnected')
            term.write('\r\n\x1b[31m[relay] Agent offline\x1b[0m\r\n')
          }
          return
        } catch { /* fall through */ }
        term.write(data)
      } else {
        // Binary terminal data
        term.write(new Uint8Array(data as ArrayBuffer))
      }
    }

    ws.onclose = () => {
      if (status !== 'error') {
        setStatus('offline')
        setStatusMsg('Disconnected')
      }
      term.write('\r\n\x1b[31m[relay] Connection closed\x1b[0m\r\n')
    }

    ws.onerror = () => {
      setStatus('error')
      setStatusMsg('WebSocket error — check relay URL')
    }

    // Forward keystrokes to relay
    term.onData(input => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(input))
      }
    })

    // Resize handler
    const onResize = () => fit.fit()
    window.addEventListener('resize', onResize)
    // Clean up resize listener when component unmounts (via disconnect)
    const origDispose = term.dispose.bind(term)
    term.dispose = () => { window.removeEventListener('resize', onResize); origDispose(); }
  }, [disconnect, status])

  useEffect(() => () => disconnect(), [disconnect])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h1 style={S.h1}>Remote Shell</h1>
      <p style={S.sub}>Open a terminal session on any connected vessel</p>

      {!RELAY_URL && (
        <div style={{ color: '#f87171', background: '#450a0a20', border: '1px solid #450a0a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          <strong>VITE_RELAY_URL</strong> is not set. Add it to your <code>.env.local</code> and Vercel env vars after deploying the relay server.
        </div>
      )}

      <div style={S.grid}>
        {/* Vessel list */}
        <div style={S.list}>
          <div style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #131e2d', background: '#080c12' }}>
            Vessels
          </div>
          {vessels.length === 0 ? (
            <div style={{ padding: 24, color: '#4b5563', fontSize: 13, textAlign: 'center' }}>No vessels</div>
          ) : vessels.map(v => (
            <div key={v.id} style={S.item(selected?.id === v.id)} onClick={() => openShell(v)}>
              <div style={{ fontWeight: 600, color: '#e8edf2', fontSize: 13, marginBottom: 3 }}>{v.name ?? v.id}</div>
              <div style={{ fontSize: 11, color: '#4b5563', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ background: '#052e16', color: v.last_synced_at ? '#22c55e' : '#4b5563', padding: '1px 6px', borderRadius: 8, fontSize: 10 }}>
                  {v.last_synced_at ? 'Online' : 'Unknown'}
                </span>
                {v.plan && <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{v.plan}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Terminal pane */}
        <div style={S.term}>
          <div style={S.termtb}>
            <TermIcon size={14} color="#6b7280" />
            {selected ? (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e8edf2', flex: 1 }}>{selected.name ?? selected.id}</span>
                <StatusDot status={status} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>{statusMsg}</span>
                {status === 'online' && (
                  <>
                    <Wifi size={13} color="#22c55e" />
                  </>
                )}
                {(status === 'offline' || status === 'error') && <WifiOff size={13} color="#ef4444" />}
                <button
                  onClick={disconnect}
                  style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 2 }}
                  title="Disconnect"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: '#4b5563' }}>Select a vessel to open a shell</span>
            )}
          </div>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1f2d3d' }}>
              <TermIcon size={48} />
            </div>
          ) : (
            <div ref={termDivRef} style={S.termbd} />
          )}
        </div>
      </div>
    </div>
  )
}
