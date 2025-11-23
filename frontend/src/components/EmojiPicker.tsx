import { useState, useRef, useEffect } from 'react'
import { Smile, X } from 'lucide-react'

const EMOJI_CATEGORIES = {
  'Frecuentes': ['😀', '😂', '❤️', '👍', '😊', '🙏', '😍', '😎', '🥳', '🤔'],
  'Emociones': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'],
  'Gestos': ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎'],
  'Objetos': ['📱', '💻', '⌚', '📷', '📹', '🎥', '📞', '☎️', '📠', '📺', '📻', '🎙', '🎚', '🎛', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳']
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Frecuentes')
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '0',
        marginBottom: '8px',
        width: '320px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        border: '1px solid #e5e7eb',
        zIndex: 1000,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          gap: '4px',
          flex: 1,
          overflowX: 'auto'
        }}>
          {Object.keys(EMOJI_CATEGORIES).map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeCategory === category ? '#e0f2fe' : 'transparent',
                color: activeCategory === category ? '#0369a1' : '#6b7280',
                fontSize: '12px',
                fontWeight: activeCategory === category ? '600' : '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {category}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Emojis Grid */}
      <div style={{
        padding: '12px',
        maxHeight: '200px',
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '4px'
      }}>
        {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
          <button
            key={index}
            onClick={() => {
              onSelect(emoji)
              onClose()
            }}
            style={{
              padding: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '24px',
              borderRadius: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

