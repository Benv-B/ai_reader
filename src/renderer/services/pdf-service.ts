/**
 * PDF 服务
 * 负责 PDF 的加载、渲染和文本提取
 */

import { generatePDFHash } from '../utils/hash';
import { IPDFService } from '../types';

// 动态导入 pdfjs-dist（本地依赖）
// 注意：这里我们需要手动处理 pdfjs-dist 的类型，或者假设它已经在 global 或者 node_modules 中正确处理
// 为避免复杂的类型配置，这里暂时使用 any，后续可以完善
let pdfjsLib: any = null;

// 初始化 PDF.js 库
async function initPDFJS() {
    if (!pdfjsLib) {
        // 导入本地的 pdfjs-dist
        // @ts-ignore
        pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
        
        // 配置 worker 路径
        // @ts-ignore
        pdfjsLib.GlobalWorkerOptions.workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url').then(m => m.default);
    }
    return pdfjsLib;
}

export interface PDFBlock {
    id: string;
    page: number;
    text: string;
    bbox: { x: number; y: number; w: number; h: number };
    type: string;
}

class PDFService implements IPDFService {
    private pdfDoc: any;
    private docHash: string | null;
    private pageTextMap: Map<number, string>;
    private pdfjsLib: any;

    constructor() {
        this.pdfDoc = null;
        this.docHash = null;
        this.pageTextMap = new Map();
        this.pdfjsLib = null;
    }
    
    /**
     * 初始化服务
     */
    async init() {
        if (!this.pdfjsLib) {
            this.pdfjsLib = await initPDFJS();
        }
    }

    /**
     * 加载 PDF 文档
     * @param {File} file - PDF 文件对象
     * @returns {Promise<{numPages: number, docHash: string}>}
     */
    async loadDocument(file: File): Promise<{ numPages: number; docHash: string }> {
        // 确保 PDF.js 已初始化
        await this.init();
        
        const buffer = await file.arrayBuffer();
        
        // 生成文档哈希
        this.docHash = await generatePDFHash(buffer);
        
        // 加载 PDF
        this.pdfDoc = await this.pdfjsLib.getDocument(buffer).promise;
        
        return {
            numPages: this.pdfDoc.numPages,
            docHash: this.docHash as string
        };
    }

    /**
     * 渲染单页 PDF 到 Canvas
     * @param {number} pageNum - 页码（从 1 开始）
     * @param {HTMLCanvasElement} canvas - 目标画布
     * @param {number} scale - 缩放比例
     * @returns {Promise<{width: number, height: number}>}
     */
    async renderPage(pageNum: number, canvas: HTMLCanvasElement, scale: number = 1.5): Promise<{ width: number; height: number }> {
        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Cannot get canvas context');

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        return {
            width: viewport.width,
            height: viewport.height
        };
    }

    /**
     * 提取页面文本内容
     * @param {number} pageNum - 页码
     * @returns {Promise<string>}
     */
    async extractPageText(pageNum: number): Promise<string> {
        // 先查缓存
        if (this.pageTextMap.has(pageNum)) {
            return this.pageTextMap.get(pageNum) || '';
        }

        const page = await this.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // 简单拼接：保留换行符
        const text = textContent.items
            .map((item: any) => item.str + (item.hasEOL ? '\n' : ''))
            .join(' ');
        
        this.pageTextMap.set(pageNum, text);
        return text;
    }

    /**
     * 获取页面的文本块（带坐标信息和统一 ID）
     * @param {number} pageNum - 页码
     * @returns {Promise<Array<PDFBlock>>}
     */
    async extractPageBlocks(pageNum: number): Promise<PDFBlock[]> {
        const page = await this.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });
        
        // 将文本项按 y 坐标分组为行
        const lines: any[][] = [];
        let currentLine: any[] = [];
        let lastY = -1;
        
        textContent.items.forEach((item: any) => {
            const transform = item.transform;
            // const x = transform[4];
            const y = viewport.height - transform[5]; // PDF 坐标系从下往上
            
            // 如果 y 坐标变化超过阈值，认为是新行
            if (lastY !== -1 && Math.abs(y - lastY) > 5) {
                if (currentLine.length > 0) {
                    lines.push([...currentLine]);
                    currentLine = [];
                }
            }
            
            currentLine.push({ str: item.str, x: transform[4], y, width: item.width, height: item.height });
            lastY = y;
        });
        
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        // 将相邻的行合并为段落块（根据 y 坐标间距判断）
        const paragraphs: any[][] = [];
        let currentParagraph: any[] = [];
        let lastLineY = -1;
        const PARAGRAPH_GAP = 15; // y 坐标间距超过此值认为是新段落
        
        lines.forEach(line => {
            const lineY = Math.min(...line.map(item => item.y));
            
            if (currentParagraph.length > 0 && Math.abs(lineY - lastLineY) > PARAGRAPH_GAP) {
                // 开始新段落
                paragraphs.push([...currentParagraph]);
                currentParagraph = [];
            }
            
            currentParagraph.push(line);
            lastLineY = lineY;
        });
        
        if (currentParagraph.length > 0) {
            paragraphs.push(currentParagraph);
        }
        
        // 将段落转换为块对象，并生成统一 ID
        const blocks = paragraphs.map((paragraph, blockIndex) => {
            // 合并段落中的所有行
            const allItems = paragraph.flat();
            const text = allItems.map((item: any) => item.str).join(' ').trim();
            
            // 计算边界框
            const x = Math.min(...allItems.map((item: any) => item.x));
            const y = Math.min(...allItems.map((item: any) => item.y));
            const maxX = Math.max(...allItems.map((item: any) => item.x + (item.width || 0)));
            const maxY = Math.max(...allItems.map((item: any) => item.y + (item.height || 0)));
            const w = maxX - x;
            const h = maxY - y;
            
            // 简单的类型判断
            let type = 'paragraph';
            if (text.length < 50 && /^[A-Z\s]+$/.test(text)) {
                type = 'heading';
            } else if (text.length < 10) {
                type = 'short';
            }
            
            // 生成统一的 block ID: docHash_pPageNum_bBlockIndex
            const blockId = `${this.docHash}_p${pageNum}_b${blockIndex}`;
            
            return { 
                id: blockId,
                page: pageNum,
                text, 
                bbox: { x, y, w, h }, 
                type 
            };
        });
        
        return blocks;
    }

    /**
     * 获取文档哈希
     * @returns {string|null}
     */
    getDocHash(): string | null {
        return this.docHash;
    }

    /**
     * 获取页数
     * @returns {number}
     */
    getNumPages(): number {
        return this.pdfDoc ? this.pdfDoc.numPages : 0;
    }

    /**
     * 释放资源
     */
    destroy() {
        if (this.pdfDoc) {
            this.pdfDoc.destroy();
        }
        this.pageTextMap.clear();
    }
}

export default PDFService;

