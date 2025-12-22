"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockWhatsAppDriver = void 0;
exports.createWhatsAppDriver = createWhatsAppDriver;
const mock_1 = require("./mock");
const cloud_1 = require("./cloud");
/**
 * Factory para crear drivers de WhatsApp
 */
function createWhatsAppDriver(type) {
    switch (type) {
        case 'mock':
            return new mock_1.MockWhatsAppDriver();
        case 'cloud':
            // Driver de Meta WhatsApp Cloud API
            return new cloud_1.CloudWhatsAppDriver();
        case 'local':
            // TODO: Implementar driver local (ej. WhatsApp Web API)
            throw new Error('Local driver not implemented yet');
        default:
            throw new Error(`Unknown driver type: ${type}`);
    }
}
var mock_2 = require("./mock");
Object.defineProperty(exports, "MockWhatsAppDriver", { enumerable: true, get: function () { return mock_2.MockWhatsAppDriver; } });
