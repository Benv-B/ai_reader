/**
 * 翻译服务
 * 负责调用 AI API 进行翻译，支持多种模型和队列管理
 */

import { ITranslationService, TranslationTask } from '../types';

interface QueueTask extends TranslationTask {
    resolve: (value: string | PromiseLike<string>) => void;
    reject: (reason?: any) => void;
}

class TranslationService implements ITranslationService {
    private queue: QueueTask[]; // 翻译队列
    private isProcessing: boolean;
    public maxConcurrent: number; // 最大并发请求数
    private activeRequests: number;
    private ipc: any;

    constructor() {
        this.queue = []; 
        this.isProcessing = false;
        this.maxConcurrent = 2; 
        this.activeRequests = 0;
        this.ipc = (window as any).electron?.ipc;
    }

    /**
     * 添加翻译任务到队列
     * @param {TranslationTask} task - 翻译任务
     * @returns {Promise<string>} 翻译结果
     */
    async translate(task: TranslationTask): Promise<string> {
        return new Promise((resolve, reject) => {
            this.queue.push({ ...task, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * 处理翻译队列
     */
    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
            const task = this.queue.shift();
            if (!task) break;
            
            this.activeRequests++;

            this.executeTranslation(task)
                .then(result => {
                    task.resolve(result);
                })
                .catch(err => {
                    task.reject(err);
                })
                .finally(() => {
                    this.activeRequests--;
                    this.processQueue();
                });
        }

        this.isProcessing = false;
    }

    /**
     * 执行单个翻译任务
     * @param {TranslationTask} task - 翻译任务
     * @returns {Promise<string>}
     */
    private async executeTranslation(task: TranslationTask): Promise<string> {
        const { text, prevContext = '', nextContext = '' } = task;

        // 通过 IPC 调用主进程的翻译 API（保护 API Key）
        if (this.ipc) {
            return await this.ipc.invoke('translate', {
                text,
                prevContext,
                nextContext
            });
        }

        // 如果没有 IPC（开发模式），抛出错误
        throw new Error('Translation service not available. Please configure IPC.');
    }

    /**
     * 批量翻译（用于预取）
     * @param {Array<TranslationTask>} tasks - 任务数组
     * @returns {Promise<Array<string>>}
     */
    async batchTranslate(tasks: TranslationTask[]): Promise<string[]> {
        return Promise.all(tasks.map(task => this.translate(task)));
    }

    /**
     * 获取队列状态
     * @returns {{pending: number, active: number}}
     */
    getQueueStatus(): { pending: number; active: number } {
        return {
            pending: this.queue.length,
            active: this.activeRequests
        };
    }

    /**
     * 清空队列
     */
    clearQueue(): void {
        this.queue.forEach(task => {
            task.reject(new Error('Queue cleared'));
        });
        this.queue = [];
    }
}

export default TranslationService;

