"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestMessageSchema = void 0;
exports.handleTestSend = handleTestSend;
const express_1 = require("express");
const zod_1 = require("zod");
const whatsapp360_1 = require("../services/whatsapp360");
const logger_1 = require("../utils/logger");
exports.sendTestMessageSchema = zod_1.z.object({
    to: zod_1.z.string().min(5),
    text: zod_1.z.string().min(1),
});
async function handleTestSend(req, res) {
    try {
        const body = exports.sendTestMessageSchema.parse(req.body);
        const result = await (0, whatsapp360_1.send360Text)(body.to, body.text);
        if (result.success) {
            return res.json({ ok: true, result });
        }
        else {
            const msg = result.error || 'Error al enviar mensaje';
            logger_1.logger.error('wa360_test_send_failed', { error: msg });
            return res.status(400).json({ error: msg });
        }
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.logger.error('wa360_test_send_failed', { error: msg });
        return res.status(400).json({ error: msg });
    }
}
const router = (0, express_1.Router)();
router.post('/send', handleTestSend);
router.get('/status', (_req, res) => res.json({ ok: true, provider: '360dialog' }));
exports.default = router;
