/**
 * PDF 文档哈希工具
 * 用于生成文档的唯一标识，替代不可靠的文件名
 */

/**
 * 生成 PDF 文档的 SHA-256 哈希值
 * @param {ArrayBuffer} buffer - PDF 文件的二进制数据
 * @returns {Promise<string>} 16位短哈希
 */
export async function generatePDFHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    // 取前16位作为短哈希（足够避免碰撞）
    return hashHex.substring(0, 16);
}

/**
 * 为 PDF 页面的文本块生成唯一 ID
 * @param {string} docHash - 文档哈希
 * @param {number} pageNum - 页码
 * @param {number} blockIndex - 块索引
 * @returns {string} 块 ID，格式：docHash_pX_bY
 */
export function generateBlockId(docHash: string, pageNum: number, blockIndex: number): string {
    return `${docHash}_p${pageNum}_b${blockIndex}`;
}

/**
 * 为整页生成缓存键
 * @param {string} docHash - 文档哈希
 * @param {number} pageNum - 页码
 * @returns {string} 页缓存键
 */
export function generatePageCacheKey(docHash: string, pageNum: number): string {
    return `trans_${docHash}_p${pageNum}`;
}

