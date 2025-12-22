import { WhatsAppDriver, DriverType } from './whatsappDriver'
import { MockWhatsAppDriver } from './mock'
import { CloudWhatsAppDriver } from './cloud'

/**
 * Factory para crear drivers de WhatsApp
 */
export function createWhatsAppDriver(type: DriverType): WhatsAppDriver {
  switch (type) {
    case 'mock':
      return new MockWhatsAppDriver()
    
    case 'cloud':
      // Driver de Meta WhatsApp Cloud API
      return new CloudWhatsAppDriver()
    
    case 'local':
      // TODO: Implementar driver local (ej. WhatsApp Web API)
      throw new Error('Local driver not implemented yet')
    
    default:
      throw new Error(`Unknown driver type: ${type}`)
  }
}

export { WhatsAppDriver, DriverType } from './whatsappDriver'
export { MockWhatsAppDriver } from './mock'
