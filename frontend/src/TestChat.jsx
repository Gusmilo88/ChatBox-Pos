import { useEffect, useRef, useState } from 'react'

const quicks = [
  { label: 'hola', value: 'hola' },
  { label: 'menu', value: 'menu' },
  { label: 'CUIT válido', value: '20123456786' },
  { label: '1 saldo', value: '1' },
  { label: '2 comprobantes', value: '2' },
  { label: 'humano', value: 'humano' },
  { label: 'quiero info', value: 'quiero info' },
]

export default function TestChat() {
  const [from, setFrom] = useState('+5491100000002')
  const [text, setText] = useState('')
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  async function send(msg) {
    const toSend = (msg ?? text).trim()
    if (!from || !toSend) return
    setText('')
    setLoading(true)
    setLog(l => [...l, { who: 'you', text: toSend }])
    try {
      const res = await fetch('/api/simulate/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, text: toSend }),
      })
      const data = await res.json().catch(() => ({}))
      const replies = Array.isArray(data?.replies) ? data.replies : [JSON.stringify(data)]
      setLog(l => [...l, ...replies.map(t => ({ who: 'bot', text: String(t) }))])
    } catch {
      setLog(l => [...l, { who: 'sys', text: '[error de red]' }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '24px auto', padding: 16 }}>
      <h1 style={{ margin: 0, marginBottom: 4, color: '#111' }}>Tester Chatbox (local)</h1>
      <p style={{ marginTop: 0, opacity: .7, fontSize: 14, color: '#111' }}>
        Enviá mensajes al backend en <code>/api/simulate/message</code>.
      </p>

      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <label style={{ color: '#111' }}>De (E.164)
          <input
            value={from}
            onChange={e => setFrom(e.target.value)}
            placeholder="+549..."
            style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, background:'#fff', color:'#111' }}
          />
        </label>

        <label style={{ color: '#111' }}>Mensaje
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder="Escribí y apretá Enter…"
            style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, background:'#fff', color:'#111' }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => send()}
            disabled={loading}
            style={{ padding: '8px 12px', background:'#fafafa', border:'1px solid #ddd', borderRadius:8, color:'#111', cursor:'pointer' }}
          >
            {loading ? 'Enviando…' : 'Enviar'}
          </button>
          {quicks.map(q => (
            <button
              key={q.label}
              onClick={() => send(q.value)}
              style={{ padding: '6px 10px', background:'#fafafa', border:'1px solid #ddd', borderRadius:8, color:'#111', cursor:'pointer' }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, minHeight: 280, background: '#fff' }}>
        <div ref={listRef}>
          {log.map((m, i) => (
            <div key={i} style={{
              background: m.who === 'you' ? '#e9f3ff' : m.who === 'bot' ? '#f6f6f6' : '#fff4d6',
              border: '1px solid #e6e6e6',
              borderRadius: 10,
              padding: '8px 10px',
              margin: '8px 0',
              color:'#111'
            }}>
              <div style={{ fontSize: 12, opacity: .6, marginBottom: 4, color:'#111' }}>
                {m.who === 'you' ? 'vos' : m.who === 'bot' ? 'bot' : 'sistema'}
              </div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color:'#111' }}>{m.text}</pre>
            </div>
          ))}
          {log.length === 0 && (
            <div style={{ opacity: .6, fontSize: 14, color:'#111' }}>
              Todavía no hay mensajes. Probá con "hola" o "20123456786".
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 12, opacity: .7, marginTop: 8, color:'#111' }}>
        Tip: cambiá el <b>From</b> para aislar sesiones (ej. +549...0002, +549...0003).
      </p>
    </div>
  )
}
