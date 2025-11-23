"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const r = (0, express_1.Router)();
r.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'chatbot-backend', time: new Date().toISOString() });
});
exports.default = r;
