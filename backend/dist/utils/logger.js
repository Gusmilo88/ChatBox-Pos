"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
// Alias mínimo para evitar imports rotos a '../utils/logger'
const logger_1 = __importDefault(require("../libs/logger"));
exports.logger = logger_1.default;
exports.default = logger_1.default;
