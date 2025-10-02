import { WhatsAppDriver, DriverType } from './whatsappDriver'
import { MockWhatsAppDriver } from './mock'

/**
 * Factory para crear drivers de WhatsApp
 */
export function createWhatsAppDriver(type: DriverType): WhatsAppDriver {
  switch (type) {
    case 'mock':
      return new MockWhatsAppDriver()
    
    case 'cloud':
      // TODO: Implementar driver de WhatsApp Cloud API
      throw new Error('Cloud driver not implemented yet')
    
    case 'local':
      // TODO: Implementar driver local (ej. WhatsApp Web API)
      throw new Error('Local driver not implemented yet')
    
    default:
      throw new Error(`Unknown driver type: ${type}`)
  }
}

export { WhatsAppDriver, DriverType } from './whatsappDriver'
export { MockWhatsAppDriver } from './mock'
