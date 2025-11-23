import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { generatePageCacheKey } from '../utils/hash';

// 声明全局 marked (来自 CDN)
declare const marked: any;

interface TranslationBlockProps {
    pageNum: number;
    height: number;
    isActive: boolean;
}

export const TranslationBlock: React.FC<TranslationBlockProps> = ({ pageNum, height, isActive }) => {
    const { services, document: doc, settings, translationManager } = useAppContext();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [content, setContent] = useState<string>('');
    const [error, setError] = useState<string>('');

    const style: React.CSSProperties = {
        height: height > 0 ? `${height}px` : 'auto',
        display: isActive ? 'block' : 'none' // 只在激活时显示内容，但容器始终存在以保持高度
    };

    // 应用样式设置
    const contentStyle: React.CSSProperties = {
        fontSize: `${settings.fontSize}px`,
        lineHeight: settings.lineHeight,
        fontFamily: getFontFamily(settings.fontFamily),
        display: status === 'success' ? 'block' : 'none'
    };

    // 订阅 TranslationManager 的状态变化
    useEffect(() => {
        if (!doc) return;

        // 初始化：检查缓存
        const cacheKey = generatePageCacheKey(doc.hash, pageNum);
        services.cache.get(cacheKey).then(cached => {
            if (cached) {
                setContent(cached);
                setStatus('success');
            } else {
                setStatus('idle');
            }
        });

        // 订阅状态变化
        const unsubscribe = translationManager.subscribe((num, state) => {
            if (num !== pageNum) return;

            switch (state.status) {
                case 'queued':
                    setStatus('idle');
                    break;
                case 'translating':
                    setStatus('loading');
                    break;
                case 'done':
                    if (state.translated) {
                        setContent(state.translated);
                        setStatus('success');
                    }
                    break;
                case 'error':
                    setError(state.error || 'Unknown error');
                    setStatus('error');
                    break;
            }
        });

        return () => {
            unsubscribe();
        };
    }, [doc, pageNum, translationManager, services.cache]);

    const retry = () => {
        // 重试：清除当前页状态，让 TranslationManager 重新调度
        if (doc) {
            translationManager.requestWindow(pageNum);
        }
    };

    // 渲染 Markdown
    const renderContent = () => {
        if (!content) return null;
        try {
            const html = typeof marked !== 'undefined' ? marked.parse(content) : content;
            return <div dangerouslySetInnerHTML={{ __html: html }} />;
        } catch (e) {
            return <div>{content}</div>;
        }
    };

    return (
        <div 
            id={`trans-page-${pageNum}`} 
            className="trans-page" 
            style={{ ...style, display: 'block' }} // 容器始终显示，内部内容根据 isActive 切换
        >
            {/* Loading State */}
            {status === 'loading' && isActive && (
                <div className="loading-state" id={`loading-${pageNum}`}>
                    <span>Page {pageNum} · 本页翻译中…</span>
                </div>
            )}

            {/* Error State */}
            {status === 'error' && isActive && (
                <div className="loading-state">
                    <span style={{ color: 'red' }}>Error: {error}</span>
                    <button className="retry-btn" onClick={retry}>Retry</button>
                </div>
            )}

            {/* Content State */}
            <div className="content-area" style={{...contentStyle, display: (isActive && status === 'success') ? 'block' : 'none'}}>
                {renderContent()}
            </div>
            
            {/* Placeholder for non-active pages */}
            {!isActive && status !== 'loading' && (
                 <div className="loading-state" style={{display: 'none'}}></div>
            )}
        </div>
    );
};

function getFontFamily(key: string): string {
    const map: Record<string, string> = {
        'songti': '"Songti SC", "Noto Serif SC", "SimSun", "STSong", "Georgia", serif',
        'kaiti': '"KaiTi", "STKaiti", "Songti SC", serif',
        'yahei': '"Microsoft YaHei", "微软雅黑", sans-serif',
        'fangsong': '"FangSong", "STFangsong", serif'
    };
    return map[key] || map['songti'];
}

