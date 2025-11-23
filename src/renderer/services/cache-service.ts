/**
 * 缓存服务（块级缓存）
 * 负责翻译结果的持久化存储和读取
 * 支持块级（block-level）和页级（page-level）缓存
 */
import { ICacheService, CacheItem } from '../types';

class CacheService implements ICacheService {
    private memoryCache: Map<string, string>;
    private ipc: any;

    constructor() {
        this.memoryCache = new Map(); // 内存缓存，加速访问
        this.ipc = (window as any).electron?.ipc; // IPC 通信接口
    }

    /**
     * 获取缓存的翻译结果（通用方法）
     * @param {string} key - 缓存键
     * @returns {Promise<string|null>} 翻译结果，不存在返回 null
     */
    async get(key: string): Promise<string | null> {
        // 先查内存缓存
        if (this.memoryCache.has(key)) {
            return this.memoryCache.get(key) || null;
        }

        // 再查文件缓存（通过 IPC）
        if (this.ipc) {
            try {
                const result = await this.ipc.invoke('cache-get', key);
                if (result) {
                    this.memoryCache.set(key, result);
                    return result;
                }
            } catch (err) {
                console.error('Cache read error:', err);
            }
        }

        return null;
    }

    /**
     * 获取块级缓存
     * @param {string} blockId - 块 ID（格式：docHash_pPageNum_bBlockIndex）
     * @returns {Promise<CacheItem|null>}
     */
    async getBlock(blockId: string): Promise<CacheItem | null> {
        const cacheKey = `block_${blockId}`;
        const cached = await this.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
    }

    /**
     * 批量获取多个块的缓存
     * @param {Array<string>} blockIds - 块 ID 数组
     * @returns {Promise<Map<string, CacheItem>>}
     */
    async getBlocks(blockIds: string[]): Promise<Map<string, CacheItem>> {
        const results = new Map<string, CacheItem>();
        await Promise.all(
            blockIds.map(async (blockId) => {
                const cached = await this.getBlock(blockId);
                if (cached) {
                    results.set(blockId, cached);
                }
            })
        );
        return results;
    }

    /**
     * 保存翻译结果到缓存（通用方法）
     * @param {string} key - 缓存键
     * @param {string} value - 翻译内容
     * @returns {Promise<void>}
     */
    async set(key: string, value: string): Promise<void> {
        // 更新内存缓存
        this.memoryCache.set(key, value);

        // 异步写入文件缓存（不阻塞 UI）
        if (this.ipc) {
            this.ipc.invoke('cache-set', key, value).catch((err: any) => {
                console.error('Cache write error:', err);
            });
        }
    }

    /**
     * 保存块级缓存
     * @param {string} blockId - 块 ID
     * @param {string} srcText - 原文
     * @param {string} dstText - 译文
     * @returns {Promise<void>}
     */
    async setBlock(blockId: string, srcText: string, dstText: string): Promise<void> {
        const cacheKey = `block_${blockId}`;
        const cacheValue = JSON.stringify({ src: srcText, dst: dstText });
        await this.set(cacheKey, cacheValue);
    }

    /**
     * 批量保存块级缓存
     * @param {Array<{blockId: string, src: string, dst: string}>} blocks
     * @returns {Promise<void>}
     */
    async setBlocks(blocks: { blockId: string; src: string; dst: string }[]): Promise<void> {
        await Promise.all(
            blocks.map(block => this.setBlock(block.blockId, block.src, block.dst))
        );
    }

    /**
     * 清空所有缓存
     * @returns {Promise<void>}
     */
    async clear(): Promise<void> {
        this.memoryCache.clear();
        if (this.ipc) {
            await this.ipc.invoke('cache-clear');
        }
        localStorage.clear();
    }

    /**
     * 获取缓存统计信息
     * @returns {Promise<{count: number, size: number}>}
     */
    async getStats(): Promise<{ count: number; size: number }> {
        if (this.ipc) {
            return await this.ipc.invoke('cache-stats');
        }
        return { count: this.memoryCache.size, size: 0 };
    }
}

export default CacheService;

