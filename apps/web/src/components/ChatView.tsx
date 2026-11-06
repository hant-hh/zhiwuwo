import { useState } from 'react'
import { confirmRecord, sendChat } from '../api'
import type { ChatMode, RecordResponse } from '../types'
import RecordCard from './RecordCard'

type ChatMessage = {
  id: number
  role: 'user' | 'bot'
  text?: string
  record?: RecordResponse
  records?: RecordResponse[]
}

const MODES: { key: ChatMode; label: string; tip: string }[] = [
  { key: 'auto', label: '智能', tip: '我会自动判断你是要记东西还是找东西，直接说就行' },
  { key: 'record', label: '录入', tip: '强制按「录入」处理：说出把什么放在哪' },
  { key: 'query', label: '查询', tip: '强制按「查询」处理：问某样东西在哪' },
]

const EXAMPLES = ['我的护照在哪里', '书房里有什么', '把雨伞放阳台']

export default function ChatView({ token }: { token: string }) {
  const [mode, setMode] = useState<ChatMode>('auto')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)

  async function send(override?: string) {
    const text = (override ?? input).trim()
    if (!text || busy) return
    setInput('')
    const uid = Date.now()
    setMessages((m) => [...m, { id: uid, role: 'user', text }])
    setBusy(true)
    try {
      const res = await sendChat(token, text, mode)
      setMessages((m) => [
        ...m,
        {
          id: uid + 1,
          role: 'bot',
          text: res.answer,
          record: res.record ?? undefined,
          records: res.records,
        },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        { id: uid + 1, role: 'bot', text: `出错：${String(err)}` },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm(rec: RecordResponse) {
    try {
      const updated = await confirmRecord(token, rec.id, {
        item: rec.item,
        location: rec.location,
        placed_at: rec.placed_at,
        note: rec.note,
      })
      setMessages((m) =>
        m.map((msg) => ({
          ...msg,
          record: msg.record?.id === rec.id ? updated : msg.record,
          records: msg.records?.map((r) => (r.id === rec.id ? updated : r)),
        })),
      )
    } catch (err) {
      setMessages((m) => [
        ...m,
        { id: Date.now(), role: 'bot', text: `确认失败：${String(err)}` },
      ])
    }
  }

  const tip = MODES.find((m) => m.key === mode)?.tip ?? ''

  return (
    <div className="chat">
      <div className="chat-header">
        <span>置物窝 · 找东西助手</span>
        <div className="tabs">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={mode === m.key ? 'active' : ''}
              onClick={() => setMode(m.key)}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mode-tip">{tip}</div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="hint-box">
            <strong>直接说话就行，不用切换模式</strong>
            <br />
            「把护照放在书房抽屉」记一条，或「我的护照在哪里」找东西
            <div className="chips">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  className="chip"
                  type="button"
                  onClick={() => send(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="bubble user">
              {msg.text}
            </div>
          ) : (
            <div key={msg.id} className="bubble bot">
              {msg.text && <p className="bot-answer">{msg.text}</p>}
              {msg.record && (
                <RecordCard record={msg.record} onConfirm={handleConfirm} />
              )}
              {msg.records?.map((r) => (
                <RecordCard key={r.id} record={r} onConfirm={handleConfirm} />
              ))}
            </div>
          ),
        )}
      </div>

      <div className="input-bar">
        <input
          placeholder="问我东西放哪儿，或告诉我放在哪…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
        />
        <button onClick={() => send()} disabled={busy}>
          {busy ? '…' : '发送'}
        </button>
      </div>
    </div>
  )
}
