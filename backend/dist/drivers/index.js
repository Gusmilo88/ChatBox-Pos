"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockWhatsAppDriver = void 0;
exports.createWhatsAppDriver = createWhatsAppDriver;
const mock_1 = require("./mock");
/**
 * Factory para crear drivers de WhatsApp
 */
function createWhatsAppDriver(type) {
    switch (type) {
        case 'mock':
            return new mock_1.MockWhatsAppDriver();
        case 'cloud':
            // TODO: Implementar driver de WhatsApp Cloud API
            throw new Error('Cloud driver not implemented yet');
        case 'local':
            // TODO: Implementar driver local (ej. WhatsApp Web API)
            throw new Error('Local driver not implemented yet');
        default:
            throw new Error(`Unknown driver type: ${type}`);
    }
}
var mock_2 = require("./mock");
Object.defineProperty(exports, "MockWhatsAppDriver", { enumerable: true, get: function () { return mock_2.MockWhatsAppDriver; } });
//# sourceMappingURL=index.js.map