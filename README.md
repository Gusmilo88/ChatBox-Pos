# ChatBox POS 💬🤖

Proyecto de desarrollo de un **chatbot con IA integrado a WhatsApp y Xubio**, con validación de clientes en Firebase y panel de administración (dashboard).  

## 🚀 Estructura del proyecto

/frontend → Dashboard (React + Vite)
/backend → Lógica del chatbot (Node.js + Express, WhatsApp API, Firebase, Xubio, OpenAI)
/docs → Documentación y decisiones técnicas (opcional)


## 🛠️ Tecnologías principales

- **Frontend**
  - React + Vite
  - TailwindCSS (para el dashboard)
  - Axios (conexión al backend)

- **Backend**
  - Node.js + Express
  - Firebase (validación clientes y base de datos)
  - OpenAI (módulo IA)
  - API de WhatsApp Business (proveedor oficial)
  - API de Xubio (integración contable)

## 📋 Funcionalidades previstas

- Validación de clientes por CUIT en Firebase  
- Flujo de conversación Cliente / No Cliente  
- Registro de No Clientes en Google Sheet o Excel conectado  
- Consultas a Xubio (comprobantes, saldos, facturación)  
- Respuestas asistidas con IA (OpenAI)  
- Dashboard administrativo:
  - Ver conversaciones en tiempo real
  - Filtrar clientes / no clientes
  - Responder manualmente
  - Exportar datos (Excel/PDF)

## 🔧 Cómo ejecutar el proyecto

### Frontend
```bash
cd frontend
npm install
npm run dev

### Backend
cd backend
npm install
npm run start
