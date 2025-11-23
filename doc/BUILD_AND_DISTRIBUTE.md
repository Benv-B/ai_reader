# 📦 打包和分发指南

## 快速打包

```bash
# 1. 构建前端
npm run vite:build

# 2. 打包应用
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

打包完成后，可执行文件在 `release/` 目录。

---

## 打包输出

- **Windows**: `release/AI PDF Reader Setup x.x.x.exe` - 安装程序
- **macOS**: `release/AI PDF Reader-x.x.x.dmg` - DMG 安装包
- **Linux**: `release/AI PDF Reader-x.x.x.AppImage` - AppImage 文件

---

## 用户配置 API Key

打包后的应用需要用户自己配置 API Key。

### 配置目录

- **Windows**: `C:\Users\用户名\AppData\Roaming\ai-pdf-reader\`
- **macOS**: `~/Library/Application Support/ai-pdf-reader/`
- **Linux**: `~/.config/ai-pdf-reader/`

### 配置步骤

1. 在配置目录创建 `.env` 文件
2. 添加以下内容：

```
GEMINI_API_KEY=用户的_API_KEY
GEMINI_MODEL=gemini-2.0-flash-exp
```

3. 重启应用

**获取 API Key**: https://aistudio.google.com/app/apikey

---

## 应用图标（可选）

在 `build/` 目录放入图标文件：
- `icon.ico` (Windows)
- `icon.icns` (macOS)
- `icon.png` (Linux)

如果没有图标，会使用默认图标。

---

## 常见问题

### 打包后应用无法启动

1. 确认 `dist-renderer/` 目录存在
2. 检查控制台错误信息
3. 确认主进程文件路径正确

### Windows 安装程序被杀毒软件拦截

1. 进行代码签名（推荐）
2. 提交到杀毒软件白名单

### macOS 提示"无法打开"

1. 右键点击应用 → "打开"
2. 或进行代码签名（需要 Apple Developer 账号）

---

## 高级配置

### 自定义应用信息

编辑 `package.json`：

```json
{
  "name": "ai-pdf-reader",
  "version": "2.0.0",
  "description": "AI-powered bilingual PDF reader"
}
```

### 修改安装程序

编辑 `electron-builder.yml` 中的 `nsis` 部分（Windows）或相应平台配置。

---

## 参考资源

- [electron-builder 文档](https://www.electron.build/)
- [Electron 分发指南](https://www.electronjs.org/docs/latest/tutorial/distribution)
