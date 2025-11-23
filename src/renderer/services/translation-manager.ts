/**
 * 翻译管理器
 * 负责统一调度翻译任务，实现窗口预取和批量翻译
 */

import { generatePageCacheKey } from '../utils/hash';
import type { ICacheService, IPDFService } from '../types';

export type PageStatus = 'idle' | 'queued' | 'translating' | 'done' | 'error';

export interface PageState {
    status: PageStatus;
    translated?: string;
    error?: string;
}

interface BatchTask {
    pageNum: number;
    text: string;
    priority: number;
    resolve: (value: string) => void;
    reject: (reason?: any) => void;
}

export class TranslationManager {
    private pageStates: Map<number, PageState>;
    private queue: BatchTask[];
    private isProcessing: boolean;
    private activeRequests: number;
    private maxConcurrent: number;
    private batchSize: number;
    private windowRadius: number;
    private cooldownUntil: number | null;
    private currentPage: number;
    private docHash: string | null;
    private numPages: number;
    
    private ipc: any;
    private cacheService: ICacheService;
    private pdfService: IPDFService;
    
    private listeners: Set<(pageNum: number, state: PageState) => void>;

    constructor(
        cacheService: ICacheService,
        pdfService: IPDFService,
        options: {
            maxConcurrent?: number;
            batchSize?: number;
            windowRadius?: number;
        } = {}
    ) {
        this.pageStates = new Map();
        this.queue = [];
        this.isProcessing = false;
        this.activeRequests = 0;
        this.maxConcurrent = options.maxConcurrent || 1;
        this.batchSize = options.batchSize || 3;
        this.windowRadius = options.windowRadius || 1;
        this.cooldownUntil = null;
        this.currentPage = 1;
        this.docHash = null;
        this.numPages = 0;
        
        this.ipc = (window as any).electron?.ipc;
        this.cacheService = cacheService;
        this.pdfService = pdfService;
        
        this.listeners = new Set();
    }

    setDocument(docHash: string, numPages: number) {
        this.docHash = docHash;
        this.numPages = numPages;
        this.pageStates.clear();
        this.queue = [];
    }

    setCurrentPage(pageNum: number) {
        this.currentPage = pageNum;
    }

    setMaxConcurrent(value: number) {
        this.maxConcurrent = value;
    }

    setBatchSize(value: number) {
        this.batchSize = value;
    }

    setWindowRadius(value: number) {
        this.windowRadius = value;
    }

    subscribe(listener: (pageNum: number, state: PageState) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(pageNum: number, state: PageState) {
        this.listeners.forEach(listener => listener(pageNum, state));
    }

    getPageState(pageNum: number): PageState {
        return this.pageStates.get(pageNum) || { status: 'idle' };
    }

    async requestWindow(centerPage: number) {
        if (!this.docHash) return;

        const pagesToEnsure: number[] = [];
        
        for (let delta = -this.windowRadius; delta <= this.windowRadius; delta++) {
            const p = centerPage + delta;
            if (p < 1 || p > this.numPages) continue;
            pagesToEnsure.push(p);
        }

        const unique = [...new Set(pagesToEnsure)];
        
        for (const pageNum of unique) {
            await this.ensurePageTranslated(pageNum);
        }
    }

    private async ensurePageTranslated(pageNum: number) {
        if (!this.docHash) return;

        const state = this.pageStates.get(pageNum);
        if (state && (state.status === 'done' || state.status === 'queued' || state.status === 'translating')) {
            return;
        }

        const cacheKey = generatePageCacheKey(this.docHash, pageNum);
        const cached = await this.cacheService.get(cacheKey);
        
        if (cached) {
            const newState: PageState = { status: 'done', translated: cached };
            this.pageStates.set(pageNum, newState);
            this.notifyListeners(pageNum, newState);
            return;
        }

        this.enqueuePageTranslate(pageNum);
    }

    private async enqueuePageTranslate(pageNum: number) {
        const state = this.pageStates.get(pageNum);
        if (state && (state.status === 'queued' || state.status === 'translating' || state.status === 'done')) {
            return;
        }

        const queuedState: PageState = { status: 'queued' };
        this.pageStates.set(pageNum, queuedState);
        this.notifyListeners(pageNum, queuedState);

        try {
            const text = await this.pdfService.extractPageText(pageNum);
            const priority = Math.abs(pageNum - this.currentPage);

            return new Promise<string>((resolve, reject) => {
                this.queue.push({ pageNum, text, priority, resolve, reject });
                this.queue.sort((a, b) => a.priority - b.priority);
                this.processQueue();
            }).then(result => {
                const doneState: PageState = { status: 'done', translated: result };
                this.pageStates.set(pageNum, doneState);
                this.notifyListeners(pageNum, doneState);
                
                if (this.docHash) {
                    const cacheKey = generatePageCacheKey(this.docHash, pageNum);
                    this.cacheService.set(cacheKey, result);
                }
            }).catch(err => {
                const errorState: PageState = { status: 'error', error: err.message };
                this.pageStates.set(pageNum, errorState);
                this.notifyListeners(pageNum, errorState);
            });
        } catch (err: any) {
            const errorState: PageState = { status: 'error', error: err.message };
            this.pageStates.set(pageNum, errorState);
            this.notifyListeners(pageNum, errorState);
        }
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
            const batch = this.queue.splice(0, Math.min(this.batchSize, this.queue.length));
            
            batch.forEach(task => {
                const translatingState: PageState = { status: 'translating' };
                this.pageStates.set(task.pageNum, translatingState);
                this.notifyListeners(task.pageNum, translatingState);
            });

            this.activeRequests++;

            this.executeBatch(batch)
                .then(results => {
                    batch.forEach((task, i) => task.resolve(results[i]));
                })
                .catch(err => {
                    batch.forEach(task => task.reject(err));
                })
                .finally(() => {
                    this.activeRequests--;
                    this.processQueue();
                });
        }

        this.isProcessing = false;
    }

    private async executeBatch(batch: BatchTask[]): Promise<string[]> {
        if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
            const waitTime = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
            throw new Error(`Rate limit cooldown. Please wait ${waitTime}s`);
        }

        try {
            if (batch.length === 1) {
                const result = await this.ipc.invoke('translate', {
                    text: batch[0].text,
                    prevContext: '',
                    nextContext: ''
                });
                return [result];
            }

            const delimiter = '\n\n###PAGE_SPLIT###\n\n';
            const promptText = batch.map(task => {
                return `【PAGE ${task.pageNum}】\n${task.text}`;
            }).join(delimiter);

            const rawResult = await this.ipc.invoke('translateBatch', {
                text: promptText,
                delimiter,
                pageCount: batch.length
            });

            const parts = String(rawResult).split(delimiter).map(s => s.trim());

            if (parts.length !== batch.length) {
                console.warn(`Batch split mismatch: expected ${batch.length}, got ${parts.length}`);
                return batch.map(() => String(rawResult));
            }

            return parts;
        } catch (e: any) {
            const msg = String(e.message || '');

            if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('exceeded')) {
                this.cooldownUntil = Date.now() + 20_000;
                console.error('Rate limit hit, cooling down for 20s');
            }

            throw e;
        }
    }

    getQueueStatus() {
        return {
            pending: this.queue.length,
            active: this.activeRequests,
            cooldown: this.cooldownUntil ? Math.max(0, Math.ceil((this.cooldownUntil - Date.now()) / 1000)) : 0
        };
    }

    clearQueue() {
        this.queue.forEach(task => {
            task.reject(new Error('Queue cleared'));
        });
        this.queue = [];
    }
}

