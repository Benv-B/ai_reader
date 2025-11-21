const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true, // 允许在网页里使用 Node.js 能力
            contextIsolation: false // 关闭隔离，为了让演示代码最简单
        }
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools(); // 想调试可以把这行注释取消
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});