# 📚 AI PDF Reader Pro

> 专业级双语对照 PDF 阅读器，基于 Electron + React + TypeScript + Gemini AI，采用模块化架构，具备企业级缓存和安全机制。

![Version](https://img.shields.io/badge/version-2.0-blue)
![Electron](https://img.shields.io/badge/electron-39.2.3-47848f)
![React](https://img.shields.io/badge/react-18.2.0-61dafb)
![TypeScript](https://img.shields.io/badge/typescript-5.3.0-3178c6)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 核心特性

### 🎯 智能翻译系统
- **文档哈希识别**：基于 SHA-256 内容哈希，同一文档永久缓存
- **队列管理**：智能翻译队列，最大并发控制，避免 API 限流
- **上下文感知**：跨页句子处理，确保翻译连贯无断层
- **预取机制**：自动翻译下一页，提升阅读流畅度

### 🔒 企业级安全
- **API Key 保护**：API Key 存储在主进程，前端无法访问
- **环境变量管理**：支持 `.env` 配置，避免硬编码
- **上下文隔离**：启用 Electron 安全最佳实践
- **IPC 白名单**：严格限制渲染进程与主进程通信

### 📖 极致阅读体验
- **页对页精准同步**：机械级滚动对齐，零误差
- **书籍级排版**：宋体/楷体，1.9 倍行高，模拟纸质书
- **动态字号适配**：内容自动适配页面高度
- **标题智能识别**：Few-Shot Learning 还原章节结构

### ⚡ 高性能架构
- **模块化设计**：PDF 服务、翻译服务、缓存服务独立解耦
- **双层缓存**：内存缓存 + 文件系统持久化
- **异步优先**：所有 I/O 操作异步处理，UI 永不阻塞
- **资源管理**：自动释放 PDF 文档资源，防止内存泄漏

### 🚀 现代化技术栈
- **React 18**：组件化 UI，数据驱动
- **TypeScript 5**：类型安全，编译时检查
- **Vite 5**：极速构建，热模块替换
- **Vitest**：单元测试，保障代码质量

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装步骤

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd reader

# 2. 安装依赖
npm install

# 3. 配置 API Key
# 复制 env.example.txt 为 .env
# 编辑 .env，填写你的 Gemini API Key

# 4. 启动应用（开发模式）
npm run dev

# 或启动生产模式
npm start
```

### 配置说明

创建 `.env` 文件：

```bash
# Gemini API 配置
GEMINI_API_KEY=你的_API_KEY
GEMINI_MODEL=gemini-2.0-flash-exp

# 开发模式（可选）
NODE_ENV=development
```

> 💡 获取 API Key：访问 [Google AI Studio](https://aistudio.google.com/app/apikey)

**详细步骤**：查看 [doc/QUICK_START.md](doc/QUICK_START.md)

---

## 🏗️ 项目结构

```
reader/
├── src/                    # 源代码
│   ├── main/              # Electron 主进程
│   │   ├── main.js        # 应用入口
│   │   └── ipc-handlers.js # IPC 通信处理
│   ├── preload/           # 预加载脚本
│   │   └── preload.js
│   └── renderer/          # 渲染进程（React + TypeScript）
│       ├── components/     # React 组件
│       ├── context/        # React Context
│       ├── services/       # 业务逻辑层
│       ├── types/          # TypeScript 类型定义
│       ├── utils/          # 工具函数
│       ├── App.tsx         # 根组件
│       └── main.tsx        # React 入口
├── doc/                    # 文档目录
│   ├── QUICK_START.md     # 快速开始指南
│   ├── DEVELOPMENT.md     # 开发指南
│   ├── BUILD_AND_DISTRIBUTE.md # 打包分发指南
│   └── TRANSLATION_OPTIMIZATION.md # 翻译优化说明
├── test/                   # 测试文件
│   ├── *.test.ts          # 单元测试
│   └── test-api.js        # API 测试
├── cache/                  # 缓存目录（自动生成）
├── index.html             # HTML 入口
├── vite.config.ts         # Vite 配置
├── tsconfig.json           # TypeScript 配置
└── package.json
```

---

## 🎨 核心模块说明

### 1. PDF 服务 (`src/renderer/services/pdf-service.ts`)

负责 PDF 文档的加载、渲染和文本提取：

```typescript
import PDFService from './services/pdf-service';

const pdfService = new PDFService();

// 加载文档，返回页数和文档哈希
const { numPages, docHash } = await pdfService.loadDocument(file);

// 渲染页面到 Canvas
await pdfService.renderPage(pageNum, canvas, scale);

// 提取页面文本
const text = await pdfService.extractPageText(pageNum);
```

### 2. 翻译服务 (`src/renderer/services/translation-service.ts`)

智能翻译队列管理：

```typescript
import TranslationService from './services/translation-service';

const translationService = new TranslationService();

// 添加翻译任务（自动排队）
const result = await translationService.translate({
    text: '原文',
    prevContext: '上一页上下文',
    nextContext: '下一页上下文'
});
```

### 3. 缓存服务 (`src/renderer/services/cache-service.ts`)

双层缓存架构：

```typescript
import CacheService from './services/cache-service';

const cacheService = new CacheService();

// 读取缓存
const cached = await cacheService.get(key);

// 写入缓存
await cacheService.set(key, value);

// 缓存统计
const stats = await cacheService.getStats();
```

---

## 📝 使用指南

### 基本操作

1. **打开 PDF**：点击 "Open PDF" 选择文件
2. **开始阅读**：滚动左侧 PDF，右侧自动翻译
3. **查看缓存**：点击 "Cache Stats" 查看统计
4. **清空缓存**：点击 "Clear Cache" 重置所有缓存

### 开发模式

```bash
# 启动双进程开发（Vite + Electron）
npm run dev

# 仅启动 Vite 开发服务器
npm run vite:dev

# 运行单元测试
npm run test:unit
```

### 构建生产版本

```bash
# 构建渲染进程
npm run vite:build

# 启动生产模式
npm start
```

### 打包分发

```bash
# 1. 构建前端
npm run vite:build

# 2. 打包应用
npm run build        # 当前平台
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

打包完成后，可执行文件在 `release/` 目录。

**用户配置 API Key**（打包后的应用）：
- Windows: `C:\Users\用户名\AppData\Roaming\ai-pdf-reader\.env`
- macOS: `~/Library/Application Support/ai-pdf-reader/.env`
- Linux: `~/.config/ai-pdf-reader/.env`

在配置目录创建 `.env` 文件，内容：
```
GEMINI_API_KEY=你的_API_KEY
GEMINI_MODEL=gemini-2.0-flash-exp
```

详细说明：查看 [doc/BUILD_AND_DISTRIBUTE.md](doc/BUILD_AND_DISTRIBUTE.md)

---

## 🧪 测试

### 单元测试

```bash
# 运行所有测试
npm run test:unit

# 监听模式
npm run test:unit:watch
```

### API 连接测试

```bash
npm run test:api
```

---

## 🔧 故障排查

### 问题 1：翻译失败

**可能原因**：
- API Key 未配置或无效
- 网络连接问题
- API 配额用尽

**解决方案**：
1. 检查 `.env` 文件是否存在且配置正确
2. 运行 `npm run test:api` 测试 API 连接
3. 打开 DevTools 查看控制台错误

### 问题 2：滚动不同步

**可能原因**：
- 页面高度未正确同步
- 窗口尺寸改变

**解决方案**：
1. 刷新页面（Ctrl+R）
2. 重新加载 PDF

### 问题 3：缓存未生效

**可能原因**：
- 缓存目录权限问题
- IPC 通信失败

**解决方案**：
1. 确认 `cache/` 目录存在
2. 检查主进程是否正常启动
3. 使用 "Clear Cache" 后重试

---

## 📚 文档导航

- **[快速开始](doc/QUICK_START.md)** - 5 分钟上手指南
- **[开发指南](doc/DEVELOPMENT.md)** - 开发环境搭建、测试、部署
- **[打包分发](doc/BUILD_AND_DISTRIBUTE.md)** - 打包和分发指南
- **[翻译优化](doc/TRANSLATION_OPTIMIZATION.md)** - 翻译系统优化说明

---

## 🛠️ 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| **Electron** | 跨平台桌面框架 | ^39.2.3 |
| **React** | UI 框架 | ^18.2.0 |
| **TypeScript** | 类型系统 | ^5.3.0 |
| **Vite** | 构建工具 | ^5.0.0 |
| **PDF.js** | PDF 渲染引擎 | ^5.4.394 |
| **Gemini AI** | 智能翻译 API | 2.0-flash-exp |
| **Vitest** | 测试框架 | ^1.6.1 |

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 本地开发

```bash
# 开发模式（带 DevTools）
npm run dev

# 测试 API
npm run test:api

# 运行单元测试
npm run test:unit
```

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

- [PDF.js](https://mozilla.github.io/pdf.js/) - Mozilla 的强大 PDF 引擎
- [Google Gemini](https://deepmind.google/technologies/gemini/) - 高质量翻译 API
- [Electron](https://www.electronjs.org/) - 跨平台桌面框架
- [React](https://react.dev/) - UI 框架
- [Vite](https://vitejs.dev/) - 极速构建工具

---

<p align="center">
  <b>让英文技术书籍阅读如母语般流畅</b><br>
  Made with ❤️ and ☕
</p>
