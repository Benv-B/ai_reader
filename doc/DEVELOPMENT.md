# 开发指南

本文档面向开发者，包含项目结构、开发环境搭建、测试方法和部署打包说明。

---

## 📁 项目结构

### 目录树

```
src/
├── main/                     # 主进程（Node.js）
│   ├── main.js              # Electron 入口
│   └── ipc-handlers.js      # IPC 通信处理
├── renderer/                 # 渲染进程（React + TypeScript）
│   ├── components/          # React 组件
│   │   ├── App.tsx          # 根组件
│   │   ├── PDFViewer.tsx    # PDF 渲染组件
│   │   ├── TranslationPanel.tsx  # 翻译面板
│   │   ├── TranslationBlock.tsx  # 翻译块组件
│   │   ├── StatusBar.tsx    # 状态栏
│   │   └── SettingsModal.tsx # 设置面板
│   ├── context/             # React Context
│   │   └── AppContext.tsx   # 全局状态管理
│   ├── services/            # 业务逻辑层
│   │   ├── pdf-service.ts
│   │   ├── translation-service.ts
│   │   └── cache-service.ts
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   └── hash.ts
│   ├── App.tsx              # 根组件
│   └── main.tsx             # React 入口
└── preload/
    └── preload.js           # 安全桥接
```

### 核心模块

| 文件 | 职责 | 技术栈 |
|------|------|--------|
| `main.js` | 应用入口 | Electron |
| `ipc-handlers.js` | IPC 处理、API 调用 | Node.js |
| `App.tsx` | 主逻辑、UI 控制 | React + TypeScript |
| `pdf-service.ts` | PDF 加载、渲染 | TypeScript |
| `translation-service.ts` | 翻译队列 | TypeScript |
| `cache-service.ts` | 缓存管理 | TypeScript |

---

## 🛠️ 开发环境搭建

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `env.example.txt` 为 `.env` 并填写 API Key。

### 3. 启动开发服务器

```bash
# 开发模式（Vite + Electron）
npm run dev

# 仅启动 Vite（用于调试）
npm run vite:dev
```

### 4. 开发工具

- **Vite Dev Server**: http://localhost:5173
- **Electron DevTools**: 开发模式自动打开
- **TypeScript**: 实时类型检查

---

## 🧪 测试

### 单元测试

使用 Vitest 进行单元测试：

```bash
# 运行所有测试
npm run test:unit

# 监听模式
npm run test:unit:watch
```

### 测试文件结构

```
test/
├── cache-service.test.ts    # 缓存服务测试
├── translation-service.test.ts  # 翻译服务测试
└── hash.test.ts             # 工具函数测试
```

### API 连接测试

```bash
npm run test:api
```

---

## 📦 构建和部署

### 开发模式

```bash
npm run dev
```

### 生产构建

```bash
# 构建渲染进程
npm run vite:build

# 启动生产模式
npm start
```

### 打包 Electron 应用（可选）

#### 1. 安装 electron-builder

```bash
npm install --save-dev electron-builder
```

#### 2. 配置 package.json

```json
{
  "scripts": {
    "build": "electron-builder --win --mac --linux"
  },
  "build": {
    "appId": "com.yourname.ai-pdf-reader",
    "productName": "AI PDF Reader Pro",
    "directories": { "output": "dist" },
    "files": ["dist-renderer/**/*", "src/main/**/*", "package.json"],
    "win": { "target": ["nsis"] },
    "mac": { "target": ["dmg"] },
    "linux": { "target": ["AppImage"] }
  }
}
```

#### 3. 打包

```bash
npm run build
```

---

## 🔧 代码规范

### TypeScript

- 使用严格模式 (`strict: true`)
- 所有函数和类必须有类型注解
- 使用接口定义数据结构

### React

- 使用函数组件 + Hooks
- Props 必须定义 TypeScript 接口
- 组件文件使用 PascalCase 命名

### 命名规范

- **文件**: kebab-case（组件除外）
- **组件**: PascalCase
- **函数/变量**: camelCase
- **常量**: UPPER_SNAKE_CASE

---

## 🐛 调试

### 开发模式

```bash
npm run dev
```

自动打开 DevTools。

### 日志

- **主进程**: `console.log` 输出到终端
- **渲染进程**: `console.log` 输出到 DevTools Console

### 常见问题

#### PDF.js Worker 路径错误

如果遇到 Worker 路径问题，检查 `vite.config.ts` 中的配置。

#### IPC 通信失败

确保 `preload.js` 正确加载，检查 `main.js` 中的 preload 路径。

---

## 📝 扩展开发

### 添加新的翻译服务

修改 `src/main/ipc-handlers.js`：

```javascript
ipcMain.handle('translate', async (event, { text, prevContext, nextContext }) => {
    const provider = process.env.TRANSLATION_PROVIDER || 'gemini';
    
    if (provider === 'openai') {
        return await callOpenAI(text);
    } else {
        return await callGemini(text);
    }
});
```

### 添加新的 React 组件

1. 在 `src/renderer/components/` 创建组件文件
2. 定义 TypeScript 接口
3. 在 `App.tsx` 中引入使用

### 自定义样式

修改 `src/renderer/App.css` 或创建组件级 CSS 文件。

---

## 🚀 性能优化

### 构建优化

- Vite 自动进行代码分割
- 生产构建启用压缩和 Tree Shaking

### 运行时优化

- 使用 React.memo 避免不必要的重渲染
- 使用 useMemo 和 useCallback 优化计算
- 虚拟滚动（如需要）

---

## 📚 相关文档

- [快速开始](QUICK_START.md)
- [架构文档](ARCHITECTURE.md)
- [更新日志](CHANGELOG.md)

---

**更多问题？查看主 [README.md](../README.md) 或提交 Issue。**

