/**
 * TypeScript 类型定义
 */

// PDF 文档元数据
export interface PDFDocument {
  hash: string;
  numPages: number;
  fileName: string;
}

// 页面信息
export interface PageInfo {
  pageNum: number;
  height: number;
  offsetTop: number;
}

// 翻译状态枚举
export enum TranslationStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
  Cached = 'cached',
}

// 页面翻译数据
export interface PageTranslation {
  pageNum: number;
  status: TranslationStatus;
  content?: string;
  error?: string;
}

// 应用设置
export interface AppSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: 'songti' | 'kaiti' | 'yahei' | 'fangsong';
  maxConcurrent: number;
}

// 缓存项
export interface CacheItem {
  src: string;
  dst: string;
}

// 滚动位置
export interface ScrollPosition {
  top: number;
  pageNum: number;
  ratio: number;
}

// 段信息（用于滚动同步）
export interface SegmentInfo {
  top: number;
  height: number;
}

// PDF 服务接口
export interface IPDFService {
  loadDocument(file: File): Promise<{ numPages: number; docHash: string }>;
  renderPage(pageNum: number, canvas: HTMLCanvasElement, scale?: number): Promise<{ width: number; height: number }>;
  extractPageText(pageNum: number): Promise<string>;
  getDocHash(): string | null;
  getNumPages(): number;
  destroy(): void;
}

// 翻译服务接口
export interface ITranslationService {
  translate(task: TranslationTask): Promise<string>;
  getQueueStatus(): { pending: number; active: number };
  clearQueue(): void;
}

// 翻译任务
export interface TranslationTask {
  text: string;
  prevContext?: string;
  nextContext?: string;
  pageNum: number;
  blockId?: string;
}

// 缓存服务接口
export interface ICacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<{ count: number; size: number }>;
}

// 应用上下文类型
export interface AppContextType {
  document: PDFDocument | null;
  currentPage: number;
  settings: AppSettings;
  setDocument: (doc: PDFDocument) => void;
  setCurrentPage: (page: number) => void;
  setSettings: (settings: AppSettings) => void;
}

