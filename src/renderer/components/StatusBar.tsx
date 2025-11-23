import React, { useRef } from 'react';
import { useAppContext } from '../context/AppContext';

interface StatusBarProps {
    statusMessage: string;
    onShowSettings: () => void;
    onShowCacheStats: () => void;
    onClearCache: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
    statusMessage, 
    onShowSettings, 
    onShowCacheStats, 
    onClearCache 
}) => {
    const { services, setDocument } = useAppContext();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // 这里我们可能需要向上传递状态，或者使用 Context 中的全局状态
            // 暂时假设父组件会处理 loading 状态显示，这里只负责加载文档
            const { numPages, docHash } = await services.pdf.loadDocument(file);
            setDocument({
                hash: docHash,
                numPages,
                fileName: file.name
            });
        } catch (err) {
            console.error('Failed to load PDF', err);
            alert('Failed to load PDF: ' + (err as Error).message);
        }
    };

    return (
        <div id="header">
            <div id="status-bar">{statusMessage}</div>
            <div>
                <input 
                    type="file" 
                    id="file-input" 
                    accept="application/pdf" 
                    style={{ display: 'none' }} 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                <button onClick={() => fileInputRef.current?.click()}>Open PDF</button>
                <button onClick={onShowSettings} style={{ marginLeft: '10px', background: '#666' }}>⚙️ Settings</button>
                <button onClick={onShowCacheStats} style={{ marginLeft: '5px', background: '#555' }}>Cache Stats</button>
                <button onClick={onClearCache} style={{ marginLeft: '5px', background: '#c44' }}>Clear Cache</button>
            </div>
        </div>
    );
};

