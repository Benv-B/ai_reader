// ================= 配置区 =================
const API_KEY = "AIzaSyAGA6VBmqOS2SscGEDpE9usLp1AI5jmKGI"; 
const MODEL_NAME = "gemini-2.5-flash-lite"; 
// =========================================

const pdfWrapper = document.getElementById('pdf-wrapper');
const aiWrapper = document.getElementById('ai-wrapper');
const fileInput = document.getElementById('file-input');
const statusBar = document.getElementById('status-bar');

let pdfDoc = null;
let pageTextMap = {}; 
let currentFileName = "";

// 用于严格对齐的累计高度映射缓存
let leftSegments = [];   // [{top, height}...]
let rightSegments = [];  // [{top, height}...]
let syncLock = false;    // 防止滚动事件相互触发


// 1. 加载 PDF
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentFileName = file.name;
    
    const buffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument(buffer).promise;
    
    pdfWrapper.innerHTML = '';
    aiWrapper.innerHTML = '';
    pageTextMap = {};
    
    statusBar.textContent = `Initializing ${pdfDoc.numPages} pages...`;

    // 渲染所有页面 (为了获得高度，必须按顺序处理)
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        await renderPagePair(i);
    }

    // 【关键修复】渲染完所有页面后，强制再次同步一次高度
    // 确保因为滚动条出现/消失、Flex布局调整导致的细微高度变化被修正
    syncRightHeightsToLeft();
    
    statusBar.textContent = "Ready. Start Scrolling.";
    
    // 启动监听
    initObservers();
    // 启动双向滚动绑定
    initScrollSync();

    // 初始化一次映射
    rebuildSegments();
    // 监听窗口尺寸变化，重建映射
    window.addEventListener('resize', () => {
        // 由于 canvas 会随容器宽度自适应，高度也会变化，需要同步右侧高度
        syncRightHeightsToLeft();
        rebuildSegments();
    });
});

async function renderPagePair(pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 }); // 1.5倍清晰度
    
    // --- 左侧 PDF ---
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.className = 'pdf-page';
    canvas.dataset.pageNumber = pageNum;
    // CSS 宽度设为 90%，高度自适应
    canvas.style.width = "90%";
    canvas.style.height = "auto"; 
    
    pdfWrapper.appendChild(canvas);
    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // --- 右侧 镜像白纸 ---
    // 关键点：获取 Canvas 在浏览器中渲染出来的真实高度
    const renderHeight = canvas.getBoundingClientRect().height;
    
    const div = document.createElement('div');
    div.id = `trans-page-${pageNum}`;
    div.className = 'trans-page';
    // 宽度和左边保持一致
    div.style.width = "90%"; 
    // 核心修改：强制高度严格一致，不再是 min-height
    div.style.height = `${renderHeight}px`; 
    
    div.innerHTML = `
        <div class="loading-state" id="loading-${pageNum}">
            <span>Page ${pageNum}</span>
            <button class="retry-btn" onclick="forceTranslate(${pageNum})">Translate Now</button>
        </div>
        <div class="content-area" style="display:none;"></div>
    `;
    aiWrapper.appendChild(div);

    // 提取文本
    const textContent = await page.getTextContent();
    const text = textContent.items.map(item => item.str + (item.hasEOL ? '\n' : '')).join(' ');
    pageTextMap[pageNum] = text;
}

// 将右侧每页高度与左侧 canvas 的实际渲染高度保持一致（在 resize 时也会调用）
function syncRightHeightsToLeft() {
    const leftPages = Array.from(pdfWrapper.querySelectorAll('.pdf-page'));
    const rightPages = Array.from(aiWrapper.querySelectorAll('.trans-page'));
    for (let i = 0; i < Math.min(leftPages.length, rightPages.length); i++) {
        const h = leftPages[i].getBoundingClientRect().height;
        rightPages[i].style.height = `${h}px`;
    }
}

// 计算每侧页面段的累计映射（用相邻元素 offsetTop 之差得到“含外边距”的段高，零误差）
function rebuildSegments() {
    const calc = (wrapper, selector) => {
        const pages = Array.from(wrapper.querySelectorAll(selector));
        const segs = [];
        for (let i = 0; i < pages.length; i++) {
            const top = pages[i].offsetTop;
            const nextTop = (i < pages.length - 1) ? pages[i + 1].offsetTop : wrapper.scrollHeight;
            const height = Math.max(1, nextTop - top); // 防止除零
            segs.push({ top, height });
        }
        return segs;
    };
    leftSegments = calc(pdfWrapper, '.pdf-page');
    rightSegments = calc(aiWrapper, '.trans-page');
}

// 2. 机械级滚动同步 (严格页对页，累计高度映射，双向)
function initScrollSync() {
    const mapScroll = (fromLeft) => {
        if (syncLock) return;
        const source = fromLeft ? pdfWrapper : aiWrapper;
        const target = fromLeft ? aiWrapper : pdfWrapper;
        const sSegs = fromLeft ? leftSegments : rightSegments;
        const tSegs = fromLeft ? rightSegments : leftSegments;
        if (!sSegs.length || !tSegs.length) return;

        syncLock = true;

        const y = source.scrollTop;
        // 1) 找到 y 所在的段
        let idx = sSegs.findIndex(seg => y >= seg.top && y < seg.top + seg.height);
        if (idx === -1) {
            // 顶部或底部边界情况
            idx = (y < (sSegs[0]?.top ?? 0)) ? 0 : sSegs.length - 1;
        }
        const seg = sSegs[idx];
        const ratio = seg.height > 0 ? (y - seg.top) / seg.height : 0;

        // 2) 映射到目标段
        const tSeg = tSegs[Math.min(idx, tSegs.length - 1)];
        const targetTop = tSeg.top + ratio * tSeg.height;
        target.scrollTop = targetTop;

        // 解锁
        // 使用 requestAnimationFrame 保证一次绘制周期内只同步一次
        requestAnimationFrame(() => { syncLock = false; });
    };

    // 左侧带动右侧
    pdfWrapper.addEventListener('scroll', () => mapScroll(true));

    // 右侧带动左侧
    aiWrapper.addEventListener('scroll', () => mapScroll(false));
}

// 3. 视口检测 (用于触发翻译)
function initObservers() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // 当页面进入视口 10% 时就准备翻译，不再等待大面积
            if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
                const pageNum = entry.target.dataset.pageNumber;
                checkAndTranslate(pageNum);
            }
        });
    }, { root: pdfWrapper, threshold: [0.1] }); // 阈值降低，更容易触发

    document.querySelectorAll('.pdf-page').forEach(c => observer.observe(c));
}

// 4. 翻译逻辑
async function checkAndTranslate(pageNum) {
    const contentArea = document.querySelector(`#trans-page-${pageNum} .content-area`);
    // 如果已经翻译过（内容区可见），就不动了
    if (contentArea && contentArea.style.display !== 'none') return;

    forceTranslate(pageNum);
}

// 暴露给全局，以便按钮调用
window.forceTranslate = async function(pageNum) {
    const rawText = pageTextMap[pageNum];
    const loadingDiv = document.getElementById(`loading-${pageNum}`);
    const contentDiv = document.querySelector(`#trans-page-${pageNum} .content-area`);

    if (!rawText || rawText.length < 20) {
        if(loadingDiv) loadingDiv.innerHTML = "No text detected.";
        return;
    }

    // 检查缓存
    const key = `trans_v8_${currentFileName}_${pageNum}`;
    const cached = localStorage.getItem(key);
    if (cached) {
        applyTranslation(pageNum, cached);
        return;
    }

    if(loadingDiv) loadingDiv.innerHTML = "✨ AI Thinking...";
    statusBar.textContent = `Translating Page ${pageNum}...`;

    // --- 上下文拼接 (Context Stitching) ---
    // 获取前一页的末尾和后一页的开头，帮助 AI 理解跨页长句
    const prevText = pageTextMap[pageNum - 1] || "";
    const nextText = pageTextMap[pageNum + 1] || "";
    
    // 取前页最后 800 字符（足够覆盖大多数跨页长难句）
    const contextPrev = prevText.slice(-800);
    // 取后页开始 800 字符
    const contextNext = nextText.slice(0, 800);

    try {
        const result = await callGeminiAPI(rawText, contextPrev, contextNext);
        localStorage.setItem(key, result);
        applyTranslation(pageNum, result);
        statusBar.textContent = `Page ${pageNum} Done.`;
    } catch (err) {
        if(loadingDiv) loadingDiv.innerHTML = `<span style="color:red">Error</span><button class="retry-btn" onclick="forceTranslate(${pageNum})">Retry</button>`;
        console.error(err);
    }
}

function applyTranslation(pageNum, markdownText) {
    const loadingDiv = document.getElementById(`loading-${pageNum}`);
    const contentDiv = document.querySelector(`#trans-page-${pageNum} .content-area`);
    const pageDiv = document.getElementById(`trans-page-${pageNum}`);
    
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (contentDiv) {
        contentDiv.style.display = 'block';
        contentDiv.innerHTML = marked.parse(markdownText);
        
        // --- 智能排版优化 (Layout Optimizer) ---
        // 目标：不仅要塞进去，还要撑满页面，让视觉密度与左侧接近
        optimizeLayout(pageDiv, contentDiv);

        // 【终极对齐修正】排版完成后，强制重置一次高度，确保没有被撑大
        const leftPage = document.querySelector(`.pdf-page[data-page-number="${pageNum}"]`);
        if (leftPage) {
            const h = leftPage.getBoundingClientRect().height;
            pageDiv.style.height = `${h}px`;
        }

        // 翻译渲染后重建映射，保证滚动依旧严格对齐
        // 延迟一点点，等待 DOM 彻底稳定
        requestAnimationFrame(() => {
            syncRightHeightsToLeft(); // 再次全量校准所有高度
            rebuildSegments();
        });
    }
}

// 智能排版：只处理溢出，不再强行撑满，保持行距的统一美感
function optimizeLayout(container, content) {
    const targetHeight = container.clientHeight; 
    
    let fontSize = 18; // 和 CSS 保持一致
    // 固定行高，不要动态调整，否则会破坏“书的质感”
    const lineHeight = 1.9; 
    const minFontSize = 14; // 稍微调大最小字号，太小了看不清宋体
    
    // 1. 初始渲染
    applyStyle(content, fontSize, lineHeight);

    // 2. 仅处理溢出情况
    if (content.scrollHeight > targetHeight) {
        // 逐步缩小字号，保持行高比例不变
        while (content.scrollHeight > targetHeight && fontSize > minFontSize) {
            fontSize -= 0.5;
            applyStyle(content, fontSize, lineHeight);
        }
        // 如果还是溢出，尝试微调一点点 padding (作弊)
        if (content.scrollHeight > targetHeight) {
             const pTags = content.querySelectorAll('p');
             pTags.forEach(p => p.style.marginBottom = '10px'); // 牺牲一点段落间距
        }
        
        container.style.overflowY = "hidden"; 
    } 
    // 3. 如果内容太少，保持默认，留白反而更有呼吸感
}

function applyStyle(el, fs, lh) {
    el.style.fontSize = `${fs.toFixed(1)}px`;
    el.style.lineHeight = lh.toFixed(2);
}

// 5. API 调用 (增强版：带标题识别 + 上下文感知)
async function callGeminiAPI(currentText, prevContext, nextContext) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    const systemPrompt = `
    你是一名精通排版的书籍翻译专家。你的任务是将提取自 PDF 的英文片段翻译成中文，并完美还原书籍的结构。

    【上下文说明】：
    为了处理跨页句子，我提供了 [上一页结尾] 和 [下一页开头] 作为参考。
    ⚠️ 请只翻译 [当前页内容]！不要重复翻译上下文。

    【核心指令 - 标题识别 (至关重要)】：
    PDF 提取的文本往往丢失格式，你需要根据文本特征“猜”出标题：
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
    ${currentText}
    
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

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    // 错误处理
    if (data.error) {
        console.error("Gemini API Error:", data.error);
        throw new Error(data.error.message);
    }
    
    // 安全获取内容
    if (data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("No translation returned.");
    }
}

