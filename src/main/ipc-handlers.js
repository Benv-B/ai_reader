/**
 * IPC 处理程序
 * 主进程与渲染进程之间的通信桥梁
 */

const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// 缓存目录
const CACHE_DIR = path.join(__dirname, '../../cache');

// 确保缓存目录存在
async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create cache directory:', err);
    }
}

/**
 * 获取缓存文件路径
 * @param {string} key - 缓存键
 * @returns {string} 文件路径
 */
function getCachePath(key) {
    // 使用 key 的哈希作为文件名，避免特殊字符问题
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(CACHE_DIR, `${hash}.txt`);
}

/**
 * 注册所有 IPC 处理器
 * @param {Object} [injectedIpcMain] - 可选，用于依赖注入
 * @param {Object} [injectedHttps] - 可选，用于依赖注入
 */
function registerIPCHandlers(injectedIpcMain, injectedHttps) {
    const ipcMain = injectedIpcMain || require('electron').ipcMain;
    const httpsLib = injectedHttps || https;

    ensureCacheDir();

    // 缓存读取
    ipcMain.handle('cache-get', async (event, key) => {
        try {
            const cachePath = getCachePath(key);
            const content = await fs.readFile(cachePath, 'utf-8');
            return content;
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Cache read error:', err);
            }
            return null;
        }
    });

    // 缓存写入
    ipcMain.handle('cache-set', async (event, key, value) => {
        try {
            const cachePath = getCachePath(key);
            await fs.writeFile(cachePath, value, 'utf-8');
            return true;
        } catch (err) {
            console.error('Cache write error:', err);
            return false;
        }
    });

    // 清空缓存
    ipcMain.handle('cache-clear', async () => {
        try {
            const files = await fs.readdir(CACHE_DIR);
            await Promise.all(
                files.map(file => fs.unlink(path.join(CACHE_DIR, file)))
            );
            return true;
        } catch (err) {
            console.error('Cache clear error:', err);
            return false;
        }
    });

    // 缓存统计
    ipcMain.handle('cache-stats', async () => {
        try {
            const files = await fs.readdir(CACHE_DIR);
            let totalSize = 0;
            for (const file of files) {
                const stat = await fs.stat(path.join(CACHE_DIR, file));
                totalSize += stat.size;
            }
            return {
                count: files.length,
                size: totalSize
            };
        } catch (err) {
            console.error('Cache stats error:', err);
            return { count: 0, size: 0 };
        }
    });

    // 翻译 API 调用（保护 API Key）
    ipcMain.handle('translate', async (event, { text, prevContext, nextContext }) => {
        const API_KEY = process.env.GEMINI_API_KEY;
        const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

        if (!API_KEY) {
            throw new Error("GEMINI_API_KEY is not set. Please configure it in your .env file.");
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const systemPrompt = `
你是一名精通排版的书籍翻译专家。你的任务是将提取自 PDF 的英文片段翻译成中文，并完美还原书籍的结构。

【上下文说明】：
为了处理跨页句子，我提供了 [上一页结尾] 和 [下一页开头] 作为参考。
⚠️ 请只翻译 [当前页内容]！不要重复翻译上下文。

【核心指令 - 标题识别 (至关重要)】：
PDF 提取的文本往往丢失格式，你需要根据文本特征"猜"出标题：
1. **全大写短语**：如 "PART ONE", "INTRODUCTION"，必须处理为标题。
2. **短行独立文本**：如果一行字很短（少于 10 个词）且语义像标题（如 "The Age of Apple"），必须处理为标题。
3. **章节编号**：遇到 "Chapter 1", "Prologue" 等，必须处理为标题。

【输出格式要求】：
1. **标题语法**：检测到标题时，必须使用 Markdown 标题语法（# 或 ##）。
   - 一级标题（如书名、PART）：使用 ##
   - 二级标题（如章节名）：使用 ###
2. **换行隔离**：标题和正文之间必须空一行。
3. **段落**：保留原有的段落结构。

【示例 (Few-Shot Learning)】：

输入原文：
"PART ONE SAVING APPLE When Time published a cover story..."

❌ 错误输出（禁止）：
"第一部分 拯救苹果 当《时代》杂志发表..." (错误：标题混入正文)
"**第一部分 拯救苹果** 当《时代》杂志发表..." (错误：只加粗没换行)

✅ 正确输出：
"## 第一部分 拯救苹果

当《时代》杂志发表一篇封面故事..." (正确：使用了标题语法，且与正文换行)
`;

        const userContent = `
【上一页结尾 (仅供参考)】：
...${prevContext}

【当前页内容 (请翻译此部分)】：
${text}

【下一页开头 (仅供参考)】：
${nextContext}...
`;

        const payload = {
            contents: [{
                parts: [{
                    text: systemPrompt + "\n\n" + userContent
                }]
            }]
        };

        try {
            // 使用原生 https 模块（兼容性更好）
            const response = await new Promise((resolve, reject) => {
                const urlObj = new URL(url);
                const options = {
                    hostname: urlObj.hostname,
                    path: urlObj.pathname + urlObj.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
                    }
                };

                const req = httpsLib.request(options, (res) => {
                    // 使用 Buffer 累积，避免 UTF-8 多字节字符跨 chunk 被拆断导致的 � 问号
                    const chunks = [];
                    res.on('data', (chunk) => {
                        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    });
                    res.on('end', () => {
                        try {
                            const body = Buffer.concat(chunks).toString('utf8');
                            resolve(JSON.parse(body));
                        } catch (err) {
                            reject(new Error('Failed to parse response'));
                        }
                    });
                });

                req.on('error', reject);
                req.write(JSON.stringify(payload));
                req.end();
            });

            if (response.error) {
                console.error("Gemini API Error:", response.error);
                throw new Error(response.error.message);
            }
            
            // 防御性检查响应结构
            if (!response.candidates || response.candidates.length === 0) {
                console.error("Gemini API Invalid Response:", JSON.stringify(response, null, 2));
                // 检查是否被安全过滤器拦截
                if (response.promptFeedback) {
                     console.error("Prompt Feedback:", JSON.stringify(response.promptFeedback, null, 2));
                }
                throw new Error("No translation candidates returned from API.");
            }
            
            const candidate = response.candidates[0];
            if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                 console.error("Gemini API Missing Content:", JSON.stringify(candidate, null, 2));
                 if (candidate.finishReason) {
                     console.error("Finish Reason:", candidate.finishReason);
                 }
                throw new Error("Invalid response structure: missing content.parts");
            }
            
            const translatedText = candidate.content.parts[0].text;
            if (!translatedText) {
                throw new Error("Translation text is empty");
            }
            
            return translatedText;
        } catch (err) {
            console.error('Translation error:', err);
            throw err;
        }
    });

    // 批量翻译 API 调用
    ipcMain.handle('translateBatch', async (event, { text, delimiter, pageCount }) => {
        const API_KEY = process.env.GEMINI_API_KEY;
        const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

        if (!API_KEY) {
            throw new Error("GEMINI_API_KEY is not set. Please configure it in your .env file.");
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const systemPrompt = `
你是一名精通排版的书籍翻译专家。你的任务是将提取自 PDF 的英文片段翻译成中文，并完美还原书籍的结构。

【批量翻译说明】：
输入中包含 ${pageCount} 页内容，使用 "${delimiter}" 分隔。
请按顺序分别翻译每一页，并用**完全相同的分隔符** "${delimiter}" 把译文拼接起来。

【核心指令 - 标题识别 (至关重要)】：
PDF 提取的文本往往丢失格式，你需要根据文本特征"猜"出标题：
1. **全大写短语**：如 "PART ONE", "INTRODUCTION"，必须处理为标题。
2. **短行独立文本**：如果一行字很短（少于 10 个词）且语义像标题（如 "The Age of Apple"），必须处理为标题。
3. **章节编号**：遇到 "Chapter 1", "Prologue" 等，必须处理为标题。

【输出格式要求】：
1. **标题语法**：检测到标题时，必须使用 Markdown 标题语法（# 或 ##）。
   - 一级标题（如书名、PART）：使用 ##
   - 二级标题（如章节名）：使用 ###
2. **换行隔离**：标题和正文之间必须空一行。
3. **段落**：保留原有的段落结构。
4. **分隔符**：每页译文之间必须用 "${delimiter}" 分隔。

【示例输出格式】：
## 第一页标题

第一页正文内容...
${delimiter}
## 第二页标题

第二页正文内容...
`;

        const userContent = text;

        const payload = {
            contents: [{
                parts: [{
                    text: systemPrompt + "\n\n" + userContent
                }]
            }]
        };

        try {
            const response = await new Promise((resolve, reject) => {
                const urlObj = new URL(url);
                const options = {
                    hostname: urlObj.hostname,
                    path: urlObj.pathname + urlObj.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
                    }
                };

                const req = httpsLib.request(options, (res) => {
                    const chunks = [];
                    res.on('data', (chunk) => {
                        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    });
                    res.on('end', () => {
                        try {
                            const body = Buffer.concat(chunks).toString('utf8');
                            resolve(JSON.parse(body));
                        } catch (err) {
                            reject(new Error('Failed to parse response'));
                        }
                    });
                });

                req.on('error', reject);
                req.write(JSON.stringify(payload));
                req.end();
            });

            if (response.error) {
                console.error("Gemini API Error:", response.error);
                throw new Error(response.error.message);
            }
            
            if (!response.candidates || response.candidates.length === 0) {
                console.error("Gemini API Invalid Response:", JSON.stringify(response, null, 2));
                if (response.promptFeedback) {
                     console.error("Prompt Feedback:", JSON.stringify(response.promptFeedback, null, 2));
                }
                throw new Error("No translation candidates returned from API.");
            }
            
            const candidate = response.candidates[0];
            if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                 console.error("Gemini API Missing Content:", JSON.stringify(candidate, null, 2));
                 if (candidate.finishReason) {
                     console.error("Finish Reason:", candidate.finishReason);
                 }
                throw new Error("Invalid response structure: missing content.parts");
            }
            
            const translatedText = candidate.content.parts[0].text;
            if (!translatedText) {
                throw new Error("Translation text is empty");
            }
            
            return translatedText;
        } catch (err) {
            console.error('Batch translation error:', err);
            throw err;
        }
    });

    console.log('IPC handlers registered');
}

module.exports = { registerIPCHandlers };

