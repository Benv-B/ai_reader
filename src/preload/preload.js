/**
 * Preload 脚本
 * 在渲染进程和主进程之间建立安全的通信桥梁
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 IPC 接口给渲染进程
contextBridge.exposeInMainWorld('electron', {
    ipc: {
        /**
         * 调用主进程的方法
         * @param {string} channel - IPC 频道名
         * @param  {...any} args - 参数
         * @returns {Promise<any>}
         */
        invoke: (channel, ...args) => {
            // 白名单：只允许特定的 IPC 频道
            const validChannels = [
                'cache-get',
                'cache-set',
                'cache-clear',
                'cache-stats',
                'translate'
            ];
            
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            } else {
                throw new Error(`Invalid IPC channel: ${channel}`);
            }
        }
    }
});

console.log('Preload script loaded');

