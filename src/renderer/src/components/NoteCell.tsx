import React, { useState, useRef, useEffect } from 'react'

type Props = {
  value: string | false
  onSave: (note: string) => void
}

function stripHtml(html: string | false): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function NoteCell({ value, onSave }: Props): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const displayText = stripHtml(value)

  function autoResize(): void {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  function startEdit(): void {
    setDraft(displayText)
    setEditing(true)
  }

  useEffect(() => {
    if (editing && textareaRef.current) {
      autoResize()
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [editing])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setDraft(e.target.value)
    autoResize()
  }

  function handleBlur(): void {
    setEditing(false)
    if (draft !== displayText) onSave(draft)
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') setEditing(false)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      textareaRef.current?.blur()
    }
  }

  return (
    <div className="note-cell">
      {editing ? (
        <textarea
          ref={textareaRef}
          className="note-cell__input"
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span
          className={`note-cell__text ${!displayText ? 'note-cell__text--empty' : ''}`}
          onClick={startEdit}
          title="Click to edit note"
        >
          {displayText || 'Add a note…'}
        </span>
      )}

      <style>{`
        .note-cell {
          width: 100%;
        }
        .note-cell__text {
          display: block;
          white-space: pre-wrap;
          word-break: break-word;
          cursor: text;
          width: 100%;
          font-size: 12px;
          line-height: 1.5;
          padding: 2px 4px;
          border-radius: 3px;
          transition: background 0.1s;
          color: rgba(226,226,232,0.75);
        }
        .note-cell__text:hover {
          background: rgba(255,255,255,0.05);
          color: rgba(226,226,232,0.95);
        }
        .note-cell__text--empty {
          color: rgba(226,226,232,0.25);
          font-style: italic;
        }
        .note-cell__input {
          width: 100%;
          resize: none;
          overflow: hidden;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(100,160,255,0.35);
          border-radius: 4px;
          padding: 4px 6px;
          font-size: 12px;
          color: #e2e2e8;
          line-height: 1.5;
          min-height: 28px;
          display: block;
        }
        .note-cell__input:focus {
          border-color: rgba(100,160,255,0.6);
          background: rgba(255,255,255,0.08);
        }
      `}</style>
    </div>
  )
}
