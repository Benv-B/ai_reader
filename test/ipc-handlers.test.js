/**
 * IPC Handlers 单元测试
 * 测试主进程的 IPC 通信处理逻辑
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试缓存目录
const TEST_CACHE_DIR = path.join(__dirname, '../cache-test');

describe('IPC Handlers', () => {
    let originalEnv;
    let registerIPCHandlers;
    let mockIpcHandlers;
    let mockIpcMain;
    let mockHttps;
    let mockRequest;

    beforeEach(() => {
        // 重置 Mock 状态
        mockIpcHandlers = new Map();
        mockIpcMain = {
            handle: vi.fn((channel, handler) => {
                mockIpcHandlers.set(channel, handler);
            })
        };

        mockRequest = {
            on: vi.fn(),
            write: vi.fn(),
            end: vi.fn()
        };

        mockHttps = {
            request: vi.fn((options, callback) => {
                return mockRequest;
            })
        };

        // 保存环境
        originalEnv = { ...process.env };
        process.env.GEMINI_API_KEY = 'test-api-key';
        process.env.GEMINI_MODEL = 'gemini-2.0-flash-exp';

        // 加载模块
        const mod = require('../src/main/ipc-handlers.js');
        registerIPCHandlers = mod.registerIPCHandlers;
    });

    afterEach(async () => {
        process.env = originalEnv;
        try {
            const files = await fs.readdir(TEST_CACHE_DIR);
            await Promise.all(files.map(f => fs.unlink(path.join(TEST_CACHE_DIR, f))));
            await fs.rmdir(TEST_CACHE_DIR);
        } catch (e) {}
    });

    describe('Cache Operations', () => {
        it('should handle cache-get for non-existent key', async () => {
            registerIPCHandlers(mockIpcMain, mockHttps);
            const handler = mockIpcHandlers.get('cache-get');
            const result = await handler({}, 'non-existent-key');
            expect(result).toBeNull();
        });

        it('should handle cache-set and cache-get', async () => {
            registerIPCHandlers(mockIpcMain, mockHttps);
            const setHandler = mockIpcHandlers.get('cache-set');
            const getHandler = mockIpcHandlers.get('cache-get');

            const testKey = 'test-key-123';
            const testValue = 'test-value-中文测试';

            const setResult = await setHandler({}, testKey, testValue);
            expect(setResult).toBe(true);

            const getValue = await getHandler({}, testKey);
            expect(getValue).toBe(testValue);
        });

        it('should handle cache-clear', async () => {
            registerIPCHandlers(mockIpcMain, mockHttps);
            const setHandler = mockIpcHandlers.get('cache-set');
            const clearHandler = mockIpcHandlers.get('cache-clear');
            const getHandler = mockIpcHandlers.get('cache-get');

            await setHandler({}, 'key1', 'value1');
            const clearResult = await clearHandler({});
            expect(clearResult).toBe(true);

            const value1 = await getHandler({}, 'key1');
            expect(value1).toBeNull();
        });

        it('should handle cache-stats', async () => {
            registerIPCHandlers(mockIpcMain, mockHttps);
            const setHandler = mockIpcHandlers.get('cache-set');
            const statsHandler = mockIpcHandlers.get('cache-stats');

            await setHandler({}, 'key1', 'value1');
            const stats = await statsHandler({});
            expect(stats.count).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Translation API', () => {
        it('should throw error when API key is missing', async () => {
            delete process.env.GEMINI_API_KEY;
            registerIPCHandlers(mockIpcMain, mockHttps);
            const handler = mockIpcHandlers.get('translate');
            await expect(
                handler({}, { text: 'test' })
            ).rejects.toThrow('GEMINI_API_KEY is not set');
        });

        it('should handle missing content.parts (Empty Response)', async () => {
            mockHttps.request.mockImplementation((options, callback) => {
                const mockRes = {
                    on: (event, handler) => {
                        if (event === 'data') {
                            handler(Buffer.from(JSON.stringify({
                                candidates: [{
                                    content: { parts: [] }, // Empty parts
                                    finishReason: 'SAFETY'
                                }]
                            })));
                        } else if (event === 'end') handler();
                    }
                };
                callback(mockRes);
                return mockRequest;
            });

            registerIPCHandlers(mockIpcMain, mockHttps);
            const handler = mockIpcHandlers.get('translate');
            await expect(
                handler({}, { text: 'test' })
            ).rejects.toThrow('Invalid response structure: missing content.parts');
        });

        it('should handle valid API response', async () => {
            const mockTranslation = 'Result';
            mockHttps.request.mockImplementation((options, callback) => {
                const mockRes = {
                    on: (event, handler) => {
                        if (event === 'data') {
                            handler(Buffer.from(JSON.stringify({
                                candidates: [{
                                    content: { parts: [{ text: mockTranslation }] }
                                }]
                            })));
                        } else if (event === 'end') handler();
                    }
                };
                callback(mockRes);
                return mockRequest;
            });

            registerIPCHandlers(mockIpcMain, mockHttps);
            const handler = mockIpcHandlers.get('translate');
            const result = await handler({}, { text: 'test' });
            expect(result).toBe(mockTranslation);
        });

        it('should handle API error response', async () => {
            mockHttps.request.mockImplementation((options, callback) => {
                const mockRes = {
                    on: (event, handler) => {
                        if (event === 'data') {
                            handler(Buffer.from(JSON.stringify({
                                error: { message: 'API quota exceeded' }
                            })));
                        } else if (event === 'end') handler();
                    }
                };
                callback(mockRes);
                return mockRequest;
            });

            registerIPCHandlers(mockIpcMain, mockHttps);
            const handler = mockIpcHandlers.get('translate');
            await expect(
                handler({}, { text: 'test' })
            ).rejects.toThrow('API quota exceeded');
        });

        it('should handle UTF-8 correctly', async () => {
            const mockTranslation = '中文测试 😀';
            mockHttps.request.mockImplementation((options, callback) => {
                const mockRes = {
                    on: (event, handler) => {
                        if (event === 'data') {
                            const buf = Buffer.from(JSON.stringify({
                                candidates: [{
                                    content: { parts: [{ text: mockTranslation }] }
                                }]
                            }));
                            // Split buffer
                            handler(buf.subarray(0, 10));
                            handler(buf.subarray(10));
                        } else if (event === 'end') handler();
                    }
                };
                callback(mockRes);
                return mockRequest;
            });

            registerIPCHandlers(mockIpcMain, mockHttps);
            const handler = mockIpcHandlers.get('translate');
            const result = await handler({}, { text: 'test' });
            expect(result).toBe(mockTranslation);
        });
    });
});
