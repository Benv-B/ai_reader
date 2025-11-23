import React from 'react';
import { useAppContext } from '../context/AppContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { settings, setSettings, services, translationManager } = useAppContext();
    const [localSettings, setLocalSettings] = React.useState(settings);
    const [cacheStats, setCacheStats] = React.useState<string>('加载中...');

    React.useEffect(() => {
        if (isOpen) {
            setLocalSettings(settings);
            loadCacheStats();
        }
    }, [isOpen, settings]);

    const loadCacheStats = async () => {
        try {
            const stats = await services.cache.getStats();
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            setCacheStats(`文件数：${stats.count}，总大小：${sizeMB} MB`);
        } catch (e) {
            setCacheStats('无法获取缓存统计');
        }
    };

    const handleSave = () => {
        setSettings(localSettings);
        translationManager.setMaxConcurrent(localSettings.maxConcurrent);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div id="settings-modal" className="show">
            <div className="settings-content">
                <h2>⚙️ 设置</h2>
                
                <div className="setting-item">
                    <label htmlFor="font-size">翻译区字体大小</label>
                    <input 
                        type="range" 
                        id="font-size" 
                        min="14" 
                        max="24" 
                        step="1"
                        value={localSettings.fontSize}
                        onChange={e => setLocalSettings({...localSettings, fontSize: parseInt(e.target.value)})}
                    />
                    <span>{localSettings.fontSize}px</span>
                </div>
                
                <div className="setting-item">
                    <label htmlFor="line-height">行高</label>
                    <input 
                        type="range" 
                        id="line-height" 
                        min="1.4" 
                        max="2.4" 
                        step="0.1"
                        value={localSettings.lineHeight}
                        onChange={e => setLocalSettings({...localSettings, lineHeight: parseFloat(e.target.value)})}
                    />
                    <span>{localSettings.lineHeight}</span>
                </div>
                
                <div className="setting-item">
                    <label htmlFor="font-family">字体</label>
                    <select 
                        id="font-family"
                        value={localSettings.fontFamily}
                        onChange={e => setLocalSettings({...localSettings, fontFamily: e.target.value as any})}
                    >
                        <option value="songti">宋体（默认）</option>
                        <option value="kaiti">楷体</option>
                        <option value="yahei">微软雅黑</option>
                        <option value="fangsong">仿宋</option>
                    </select>
                </div>
                
                <div className="setting-item">
                    <label htmlFor="max-concurrent">翻译并发数</label>
                    <input 
                        type="number" 
                        id="max-concurrent" 
                        min="1" 
                        max="5" 
                        value={localSettings.maxConcurrent}
                        onChange={e => setLocalSettings({...localSettings, maxConcurrent: parseInt(e.target.value)})}
                    />
                </div>
                
                <div className="setting-item">
                    <label>缓存信息</label>
                    <div style={{ color: '#888', fontSize: '13px' }}>{cacheStats}</div>
                </div>
                
                <div className="settings-buttons">
                    <button className="cancel-btn" onClick={onClose}>取消</button>
                    <button onClick={handleSave}>保存</button>
                </div>
            </div>
        </div>
    );
};

