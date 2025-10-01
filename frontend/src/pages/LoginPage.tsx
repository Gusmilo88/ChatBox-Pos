import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, LogIn } from 'lucide-react'

interface LoginForm {
  email: string
  password: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Incluir cookies
        body: JSON.stringify(form)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al iniciar sesión')
      }

      // Login exitoso, redirigir al dashboard
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof LoginForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    if (error) setError('') // Limpiar error al escribir
  }

  const isFormValid = form.email.includes('@') && form.password.length >= 8

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <h1 className="login-title">Iniciar Sesión</h1>
          <p className="login-description">
            Accede a tu dashboard de conversaciones
          </p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          {/* Email Field */}
          <div className="login-field-group">
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleInputChange('email')}
              disabled={isLoading}
              required
              className="login-input"
            />
          </div>

          {/* Password Field */}
          <div className="login-field-group">
            <div className="login-password-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={form.password}
                onChange={handleInputChange('password')}
                disabled={isLoading}
                required
                className="login-input"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="eye-icon" />
                ) : (
                  <Eye className="eye-icon" />
                )}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="login-button"
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? (
              <>
                <div className="login-spinner" />
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        {/* Credenciales de prueba - TEMPORAL */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: '#475569'
          }}>
            🔑 Credenciales de prueba:
          </p>
          <div style={{
            fontSize: '13px',
            color: '#64748b',
            fontFamily: 'monospace',
            lineHeight: '1.4'
          }}>
            <div>admin@test.com</div>
            <div>password123</div>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>Dashboard de WhatsApp Business</p>
        </div>
      </div>
    </div>
  )
}
