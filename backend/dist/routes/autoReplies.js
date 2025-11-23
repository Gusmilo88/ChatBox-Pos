"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const logger_1 = __importDefault(require("../libs/logger"));
const session_1 = require("../middleware/session");
const router = (0, express_1.Router)();
// Esquema para crear/actualizar regla
const autoReplyRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'El nombre es requerido').max(100),
    enabled: zod_1.z.boolean().default(true),
    type: zod_1.z.enum(['keyword', 'schedule']),
    priority: zod_1.z.number().int().min(0).max(100).default(0),
    // Campos para tipo 'keyword'
    keywords: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    matchType: zod_1.z.enum(['any', 'all']).optional(),
    response: zod_1.z.string().min(1).max(1000).optional(),
    // Campos para tipo 'schedule'
    schedule: zod_1.z.object({
        days: zod_1.z.array(zod_1.z.number().int().min(0).max(6)), // 0 = domingo, 6 = sábado
        startTime: zod_1.z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // Formato HH:mm
        endTime: zod_1.z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // Formato HH:mm
        timezone: zod_1.z.string().optional()
    }).optional(),
    scheduleResponse: zod_1.z.string().min(1).max(1000).optional(),
    // Filtros
    isClientOnly: zod_1.z.boolean().optional(),
    isLeadOnly: zod_1.z.boolean().optional()
}).refine((data) => {
    // Validar que si es tipo 'keyword', tenga keywords y response
    if (data.type === 'keyword') {
        return !!(data.keywords && data.keywords.length > 0 && data.response);
    }
    // Validar que si es tipo 'schedule', tenga schedule y scheduleResponse
    if (data.type === 'schedule') {
        return !!(data.schedule && data.scheduleResponse);
    }
    return true;
}, {
    message: 'Los campos requeridos para el tipo de regla no están completos'
});
// GET /api/auto-replies - Listar todas las reglas
router.get('/', session_1.requireSession, async (req, res) => {
    try {
        // Intentar obtener reglas ordenadas por prioridad
        let snapshot;
        try {
            snapshot = await firebase_1.collections.autoReplyRules()
                .orderBy('priority', 'desc')
                .orderBy('name', 'asc')
                .get();
        }
        catch (orderError) {
            // Si falla el ordenamiento (puede ser que no haya índice), obtener sin ordenar
            logger_1.default.warn('error_ordering_auto_reply_rules', { error: orderError.message });
            snapshot = await firebase_1.collections.autoReplyRules().get();
        }
        const rules = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data
            };
        });
        // Ordenar manualmente si no se pudo ordenar en la query
        rules.sort((a, b) => {
            const priorityDiff = (b.priority || 0) - (a.priority || 0);
            if (priorityDiff !== 0)
                return priorityDiff;
            return (a.name || '').localeCompare(b.name || '');
        });
        res.json({ rules });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_listing_auto_reply_rules', { error: msg });
        // Si es un error de colección no existente, retornar array vacío
        if (msg.includes('collection') || msg.includes('not found')) {
            return res.json({ rules: [] });
        }
        res.status(500).json({ error: 'Error al listar reglas' });
    }
});
// GET /api/auto-replies/:id - Obtener una regla específica
router.get('/:id', session_1.requireSession, async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await firebase_1.collections.autoReplyRules().doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Regla no encontrada' });
        }
        res.json({
            id: doc.id,
            ...doc.data()
        });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_getting_auto_reply_rule', { id: req.params.id, error: msg });
        res.status(500).json({ error: 'Error al obtener regla' });
    }
});
// POST /api/auto-replies - Crear una nueva regla
router.post('/', session_1.requireSession, async (req, res) => {
    try {
        // Validar datos
        const validationResult = autoReplyRuleSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validationResult.error.issues
            });
        }
        const ruleData = validationResult.data;
        const docRef = await firebase_1.collections.autoReplyRules().add({
            ...ruleData,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        logger_1.default.info('auto_reply_rule_created', {
            id: docRef.id,
            name: ruleData.name,
            type: ruleData.type
        });
        res.status(201).json({
            id: docRef.id,
            ...ruleData
        });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_creating_auto_reply_rule', { error: msg });
        res.status(500).json({ error: 'Error al crear regla' });
    }
});
// PATCH /api/auto-replies/:id - Actualizar una regla
router.patch('/:id', session_1.requireSession, async (req, res) => {
    try {
        const { id } = req.params;
        // Validar datos (parcial para actualización)
        // Crear esquema parcial manualmente
        const partialSchema = zod_1.z.object({
            name: zod_1.z.string().min(1).max(100).optional(),
            enabled: zod_1.z.boolean().optional(),
            type: zod_1.z.enum(['keyword', 'schedule']).optional(),
            priority: zod_1.z.number().int().min(0).max(100).optional(),
            keywords: zod_1.z.array(zod_1.z.string().min(1)).optional(),
            matchType: zod_1.z.enum(['any', 'all']).optional(),
            response: zod_1.z.string().min(1).max(1000).optional(),
            schedule: zod_1.z.object({
                days: zod_1.z.array(zod_1.z.number().int().min(0).max(6)),
                startTime: zod_1.z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
                endTime: zod_1.z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
                timezone: zod_1.z.string().optional()
            }).optional(),
            scheduleResponse: zod_1.z.string().min(1).max(1000).optional(),
            isClientOnly: zod_1.z.boolean().optional(),
            isLeadOnly: zod_1.z.boolean().optional()
        });
        const validationResult = partialSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validationResult.error.issues
            });
        }
        const ruleData = validationResult.data;
        const docRef = firebase_1.collections.autoReplyRules().doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Regla no encontrada' });
        }
        await docRef.update({
            ...ruleData,
            updatedAt: new Date()
        });
        logger_1.default.info('auto_reply_rule_updated', {
            id,
            changes: Object.keys(ruleData)
        });
        const updatedDoc = await docRef.get();
        res.json({
            id: updatedDoc.id,
            ...updatedDoc.data()
        });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_updating_auto_reply_rule', { id: req.params.id, error: msg });
        res.status(500).json({ error: 'Error al actualizar regla' });
    }
});
// DELETE /api/auto-replies/:id - Eliminar una regla
router.delete('/:id', session_1.requireSession, async (req, res) => {
    try {
        const { id } = req.params;
        const docRef = firebase_1.collections.autoReplyRules().doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Regla no encontrada' });
        }
        await docRef.delete();
        logger_1.default.info('auto_reply_rule_deleted', { id });
        res.json({ message: 'Regla eliminada correctamente' });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_deleting_auto_reply_rule', { id: req.params.id, error: msg });
        res.status(500).json({ error: 'Error al eliminar regla' });
    }
});
exports.default = router;
