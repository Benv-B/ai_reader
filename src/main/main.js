/**
 * Electron 主进程
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { registerIPCHandlers } = require('./ipc-handlers');

// 加载环境变量：优先从用户配置目录读取，否则从应用目录读取
async function loadEnv() {
    const userConfigPath = path.join(app.getPath('userData'), '.env');
    const appConfigPath = path.join(__dirname, '../../.env');
    
    try {
        // 先尝试用户配置目录（打包后的应用使用此路径）
        await fs.access(userConfigPath);
        require('dotenv').config({ path: userConfigPath });
        console.log('✓ Loaded config from user data directory:', userConfigPath);
    } catch {
        try {
            // 回退到应用目录（开发模式使用此路径）
            await fs.access(appConfigPath);
            require('dotenv').config({ path: appConfigPath });
            console.log('✓ Loaded config from app directory:', appConfigPath);
        } catch {
            console.warn('⚠ No .env file found. Please configure GEMINI_API_KEY.');
            console.warn('  User config path:', userConfigPath);
            console.warn('  App config path:', appConfigPath);
        }
    }
}

// 在应用准备就绪前加载配置
loadEnv().catch(err => {
    console.error('Failed to load environment config:', err);
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true, // 启用上下文隔离（安全最佳实践）
            nodeIntegration: false // 禁用 node 集成（安全最佳实践）
        }
    });

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        // 开发：加载 Vite 开发服务器
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        // 生产：加载构建产物
        win.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
    }
}

// 注册 IPC 处理器
registerIPCHandlers();

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

