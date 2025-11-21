# 📚 AI PDF Reader

> 一款优雅的双语对照 PDF 阅读器，基于 Electron + Gemini AI，让英文技术书籍阅读体验如同翻阅精装纸质书。

![Version](https://img.shields.io/badge/version-1.0-blue)
![Electron](https://img.shields.io/badge/electron-39.2.3-47848f)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ 核心特性

### 🎯 智能对齐翻译
- **页对页精准同步**：左右滑动时，原文与译文保持严格的视觉对齐
- **跨页上下文感知**：AI 能理解跨页句子，确保翻译连贯无断层
- **标题自动识别**：通过 Few-Shot Learning，精准还原书籍的章节结构

### 📖 极致排版美学
- **书籍级排版**：采用宋体/楷体，1.9 倍行高，模拟纸质书的呼吸感
- **动态字号适配**：自动调整字体大小，确保内容完美填充页面
- **段落智能对齐**：两端对齐 + 首行缩进，符合中文阅读习惯

### ⚡ 高性能体验
- **本地缓存**：翻译结果自动缓存，再次打开瞬间加载
- **实时翻译**：滚动到哪翻译到哪，无需等待全书翻译完成
- **双向滚动绑定**：无论滑动哪一侧，另一侧都会精确跟随

---

## 🚀 快速开始

### 环境要求
- Node.js >= 20.0.0
- npm 或 yarn

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/你的用户名/ai-pdf-reader.git
cd ai-pdf-reader

# 2. 安装依赖
npm install

# 3. 启动应用
npm start
```

### 配置 API Key

打开 `renderer.js`，在顶部配置你的 Gemini API Key：

```javascript
const API_KEY = "你的_GEMINI_API_KEY"; 
const MODEL_NAME = "gemini-2.5-flash-lite";
```

> 💡 获取 API Key：访问 [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## 🎨 界面预览

```
┌────────────────────────────────────────────────────────────┐
│  📄 AI Pro Reader                           [Open PDF]     │
├──────────────────────┬─────────────────────────────────────┤
│                      │                                     │
│   📖 原文 (English)   │      🌏 译文 (中文)                 │
│                      │                                     │
│  ┌──────────────┐   │   ┌──────────────────────────┐     │
│  │              │   │   │  ## 第一章                │     │
│  │  PDF 原图     │ ◀─▶  │                          │     │
│  │              │   │   │  译文内容自动对齐...      │     │
│  │              │   │   │                          │     │
│  └──────────────┘   │   └──────────────────────────┘     │
│                      │                                     │
│  滚动同步 ━━━━━━━━━━ 双向绑定 ━━━━━━━━━━━ 滚动同步        │
└──────────────────────┴─────────────────────────────────────┘
```

---

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| **Electron** | 跨平台桌面应用框架 |
| **PDF.js** | PDF 渲染与文本提取 |
| **Gemini AI** | 智能翻译引擎 |
| **Marked.js** | Markdown 渲染 |
| **CSS Grid/Flexbox** | 响应式排版布局 |

---

## 📝 核心算法

### 1. 页对页累计高度映射
传统的"全局百分比同步"会导致累积误差。本项目采用**分段映射**算法：

```javascript
// 将滚动位置映射到具体的页码和页内偏移
const idx = findPageIndex(scrollTop);
const ratio = (scrollTop - pageTop) / pageHeight;
targetScrollTop = targetPageTop + ratio * targetPageHeight;
```

### 2. Few-Shot 标题识别
通过在 Prompt 中提供正反示例，引导 AI 正确识别标题：

```
输入："PART ONE SAVING APPLE When..."
❌ 错误："第一部分 拯救苹果 当..."
✅ 正确："## 第一部分 拯救苹果\n\n当..."
```

### 3. 动态排版优化
根据内容长度自动调整字号和行距：
- 内容溢出 → 缩小字号（18px → 14px）
- 内容过少 → 保持固定行距，让留白体现质感

---

## 🎯 使用技巧

1. **首次打开 PDF**：等待所有页面加载完成（看到 "Ready" 提示）
2. **开始阅读**：向下滚动，译文会自动触发翻译
3. **手动触发**：点击右侧的 "Translate Now" 按钮
4. **清除缓存**：打开 DevTools（F12）→ Console → `localStorage.clear()`

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 本地开发

```bash
# 启动开发模式（带 DevTools）
npm start

# 构建生产版本
npm run build  # (需要先配置 electron-builder)
```

### 待优化功能
- [ ] 支持更多 AI 模型（OpenAI, Claude）
- [ ] 添加笔记/高亮功能
- [ ] 导出双语对照 PDF
- [ ] 支持自定义字体和主题

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

- [PDF.js](https://mozilla.github.io/pdf.js/) - Mozilla 的强大 PDF 引擎
- [Google Gemini](https://deepmind.google/technologies/gemini/) - 高质量翻译 API
- [Electron](https://www.electronjs.org/) - 让 Web 技术跨越桌面

---

## 📧 联系方式

如有问题或建议，欢迎：
- 提交 [Issue](../../issues)
- 发送邮件：your-email@example.com
- 关注更新：Star ⭐ 本项目

---

<p align="center">
  Made with ❤️ by Your Name
</p>

