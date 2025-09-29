import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface User {
  email: string
  role: 'owner' | 'operador'
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false
  })
  const navigate = useNavigate()

  // Verificar autenticación al montar
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const user = await response.json()
        setAuthState({
          user,
          isLoading: false,
          isAuthenticated: true
        })
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false
        })
      }
    } catch (error) {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false
      })
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al iniciar sesión')
      }

      const data = await response.json()
      setAuthState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true
      })

      return data
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    } finally {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false
      })
      navigate('/login')
    }
  }

  return {
    ...authState,
    login,
    logout,
    checkAuth
  }
}
