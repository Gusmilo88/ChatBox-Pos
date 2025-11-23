"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Alias para pruebas de WhatsApp
const express_1 = require("express");
const security_1 = require("../middleware/security");
const wa360_test_1 = require("./wa360_test");
const r = (0, express_1.Router)();
/**
 * POST /wa/test/send
 * Alias para la lógica de prueba de WhatsApp (reutiliza handleTestSend de wa360_test)
 * Requiere header: x-api-key
 */
r.post('/wa/test/send', (0, security_1.requireApiKey)(), wa360_test_1.handleTestSend);
exports.default = r;
