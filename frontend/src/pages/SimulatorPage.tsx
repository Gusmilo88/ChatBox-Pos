import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, MessageSquare, User, Bot, CheckCircle2, XCircle, Info } from 'lucide-react'

interface SimulatorStatus {
  operators: Array<{ name: string; phone: string; keywords: string[] }>
  recentConversations: Array<{
    id: string
    phone: string
    lastMessage: string
    assignedTo?: string
    needsReply: boolean
  }>
}

interface Message {
  id: string
  from: 'client' | 'bot' | 'operator'
  text: string
  timestamp: Date
  conversationId?: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export function SimulatorPage() {
  const [clientPhone, setClientPhone] = useState('+5491125522465')
  const [clientMessage, setClientMessage] = useState('')
  const [operatorPhone, setOperatorPhone] = useState('')
  const [operatorMessage, setOperatorMessage] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<SimulatorStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Cargar estado inicial
  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/simulator/status`)
      const data = await response.json()
      if (data.success) {
        setStatus(data.status)
      }
    } catch (err) {
      console.error('Error cargando estado:', err)
    }
  }

  const simulateClientMessage = async () => {
    if (!clientPhone || !clientMessage.trim()) {
      setError('Por favor completá el número y el mensaje')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${API_URL}/api/simulator/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clientPhone,
          text: clientMessage
        })
      })

      const data = await response.json()

      if (data.success) {
        // Agregar mensaje del cliente
        const clientMsg: Message = {
          id: `client-${Date.now()}`,
          from: 'client',
          text: clientMessage,
          timestamp: new Date(),
          conversationId: data.conversationId
        }
        setMessages(prev => [...prev, clientMsg])

        // Agregar respuestas del bot
        if (data.botReplies && data.botReplies.length > 0) {
          data.botReplies.forEach((reply: string, index: number) => {
            setTimeout(() => {
              const botMsg: Message = {
                id: `bot-${Date.now()}-${index}`,
                from: 'bot',
                text: reply,
                timestamp: new Date(),
                conversationId: data.conversationId
              }
              setMessages(prev => [...prev, botMsg])
            }, index * 500) // Delay para simular respuesta del bot
          })
        }

        // Si fue derivado, mostrar info
        if (data.derivedTo) {
          setSuccess(`✅ Cliente derivado automáticamente a: ${data.derivedTo}`)
          setOperatorPhone('') // Limpiar para que el usuario seleccione
        } else {
          setSuccess('✅ Mensaje procesado correctamente')
        }

        setClientMessage('')
        setSelectedConversation(data.conversationId)
        await loadStatus() // Recargar estado
      } else {
        setError(data.error || 'Error al simular mensaje')
      }
    } catch (err) {
      setError('Error de conexión: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  const simulateOperatorResponse = async () => {
    if (!operatorPhone || !operatorMessage.trim()) {
      setError('Por favor completá el número del operador y el mensaje')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${API_URL}/api/simulator/operator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorPhone,
          messageText: operatorMessage,
          clientPhone: selectedConversation ? undefined : undefined // Se busca automáticamente
        })
      })

      const data = await response.json()

      if (data.success) {
        // Agregar mensaje del operador
        const operatorMsg: Message = {
          id: `operator-${Date.now()}`,
          from: 'operator',
          text: operatorMessage,
          timestamp: new Date(),
          conversationId: data.conversationId
        }
        setMessages(prev => [...prev, operatorMsg])

        setSuccess(`✅ Respuesta del operador ${data.operatorName} enviada al cliente`)
        setOperatorMessage('')
        await loadStatus()
      } else {
        setError(data.error || 'Error al simular respuesta del operador')
      }
    } catch (err) {
      setError('Error de conexión: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🧪 Simulador del Chatbot</h1>
        <p className="text-muted-foreground">
          Probá TODO el flujo del chatbot sin depender de Meta WhatsApp. Usa la lógica REAL del bot.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo: Simulación */}
        <div className="lg:col-span-2 space-y-6">
          {/* Simular mensaje de cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Simular Mensaje de Cliente
              </CardTitle>
              <CardDescription>
                Enviá un mensaje como si fueras un cliente. El bot responderá automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientPhone">Número del Cliente</Label>
                <Input
                  id="clientPhone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+5491125522465"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="clientMessage">Mensaje</Label>
                <Textarea
                  id="clientMessage"
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  placeholder="Ej: Hola, necesito ayuda con facturación urgente"
                  rows={3}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      simulateClientMessage()
                    }
                  }}
                />
              </div>
              <Button
                onClick={simulateClientMessage}
                disabled={loading || !clientPhone || !clientMessage.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Mensaje del Cliente
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                💡 Tip: Probá con palabras clave como "facturación", "urgente", "consulta" para probar la derivación automática
              </p>
            </CardContent>
          </Card>

          {/* Simular respuesta de operador */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Simular Respuesta de Operador
              </CardTitle>
              <CardDescription>
                Simulá que un operador (secretaria) responde al cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="operatorPhone">Número del Operador</Label>
                <Input
                  id="operatorPhone"
                  value={operatorPhone}
                  onChange={(e) => setOperatorPhone(e.target.value)}
                  placeholder="+54911XXXX-XXXX"
                  disabled={loading}
                />
                {status && status.operators.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Operadores configurados:</p>
                    {status.operators.map((op, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="mr-2 cursor-pointer"
                        onClick={() => setOperatorPhone(op.phone.replace(/\*/g, ''))}
                      >
                        {op.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="operatorMessage">Mensaje del Operador</Label>
                <Textarea
                  id="operatorMessage"
                  value={operatorMessage}
                  onChange={(e) => setOperatorMessage(e.target.value)}
                  placeholder="Ej: Hola, te ayudo con la facturación..."
                  rows={3}
                  disabled={loading}
                />
              </div>
              <Button
                onClick={simulateOperatorResponse}
                disabled={loading || !operatorPhone || !operatorMessage.trim()}
                className="w-full"
                variant="outline"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Respuesta del Operador
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Historial de mensajes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Historial de Mensajes
              </CardTitle>
              <CardDescription>
                Conversación simulada en tiempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay mensajes aún. Simulá un mensaje de cliente para comenzar.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          msg.from === 'client' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.from === 'client'
                              ? 'bg-primary text-primary-foreground'
                              : msg.from === 'operator'
                              ? 'bg-orange-100 text-orange-900'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {msg.from === 'client' ? (
                              <User className="h-4 w-4" />
                            ) : msg.from === 'operator' ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                            <span className="text-xs font-semibold">
                              {msg.from === 'client'
                                ? 'Cliente'
                                : msg.from === 'operator'
                                ? 'Operador'
                                : 'Bot'}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Panel derecho: Estado y conversaciones */}
        <div className="space-y-6">
          {/* Estado del simulador */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Estado del Simulador
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold">Operadores Configurados</Label>
                    {status.operators.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {status.operators.map((op, idx) => (
                          <div key={idx} className="text-sm">
                            <Badge variant="outline">{op.name}</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              Keywords: {op.keywords.join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">
                        No hay operadores configurados
                      </p>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-sm font-semibold">Conversaciones Recientes</Label>
                    {status.recentConversations.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {status.recentConversations.slice(0, 5).map((conv) => (
                          <div
                            key={conv.id}
                            className={`p-2 rounded border cursor-pointer ${
                              selectedConversation === conv.id ? 'border-primary' : ''
                            }`}
                            onClick={() => setSelectedConversation(conv.id)}
                          >
                            <p className="text-xs font-semibold">{conv.phone}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.lastMessage}
                            </p>
                            {conv.assignedTo && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                → {conv.assignedTo}
                              </Badge>
                            )}
                            {conv.needsReply && (
                              <Badge variant="destructive" className="mt-1 ml-1 text-xs">
                                Necesita respuesta
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">
                        No hay conversaciones aún
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Cargando estado...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-sm">ℹ️ Información</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                Este simulador usa la <strong>lógica REAL</strong> del bot:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Detección de urgencia</li>
                <li>Derivación automática</li>
                <li>Respuestas del bot</li>
                <li>Reenvío a operadores</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Podés probar TODO sin depender de Meta WhatsApp.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

