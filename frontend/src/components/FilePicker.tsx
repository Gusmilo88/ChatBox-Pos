import { useState, useRef } from 'react'
import { Image, File, X } from 'lucide-react'

interface FilePickerProps {
  onSelect: (file: File) => void
  onClose: () => void
}

export function FilePicker({ onSelect, onClose }: FilePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }
    }
  }

  const handleSend = () => {
    if (selectedFile) {
      onSelect(selectedFile)
      onClose()
      setSelectedFile(null)
      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: '0',
      marginBottom: '8px',
      width: '280px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      border: '1px solid #e5e7eb',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      {/* Preview */}
      {preview && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '200px',
          backgroundColor: '#f3f4f6'
        }}>
          <img
            src={preview}
            alt="Preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
          <button
            onClick={() => {
              setPreview(null)
              setSelectedFile(null)
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              padding: '4px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Options */}
      <div style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f9fafb'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Image size={20} color="#3b82f6" />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
              Foto o Video
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Seleccionar desde galería
            </div>
          </div>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f9fafb'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <File size={20} color="#d97706" />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
              Documento
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              PDF, Word, etc.
            </div>
          </div>
        </button>

        {selectedFile && (
          <button
            onClick={handleSend}
            style={{
              marginTop: '8px',
              padding: '10px',
              backgroundColor: '#25d366',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Enviar {selectedFile.name}
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            color: '#6b7280',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

