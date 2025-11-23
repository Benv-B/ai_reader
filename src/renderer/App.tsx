import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppContext } from './context/AppContext';
import { StatusBar } from './components/StatusBar';
import { PDFViewer } from './components/PDFViewer';
import { TranslationPanel } from './components/TranslationPanel';
import { SettingsModal } from './components/SettingsModal';
import './App.css';

interface SegmentInfo {
    top: number;
    height: number;
}

export const App: React.FC = () => {
    const { document: doc, currentPage, setCurrentPage, services, translationManager } = useAppContext();
    
    const [statusMessage, setStatusMessage] = useState('Waiting for PDF...');
    const [pageHeights, setPageHeights] = useState<number[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const pdfWrapperRef = useRef<HTMLDivElement>(null);
    const aiWrapperRef = useRef<HTMLDivElement>(null);
    
    const leftSegments = useRef<SegmentInfo[]>([]);
    const rightSegments = useRef<SegmentInfo[]>([]);
    const syncLock = useRef(false);
    const observer = useRef<IntersectionObserver | null>(null);
    const intersectionMap = useRef<Map<number, IntersectionObserverEntry>>(new Map());

    // 初始化页面高度数组
    useEffect(() => {
        if (doc) {
            setPageHeights(new Array(doc.numPages).fill(0));
            setStatusMessage(`Loaded ${doc.fileName} (${doc.numPages} pages)`);
        }
    }, [doc]);

    // 处理窗口大小调整
    useEffect(() => {
        const handleResize = () => {
            if (!doc || !pdfWrapperRef.current) return;
            
            // 重新测量左侧页面高度
            const pages = Array.from(pdfWrapperRef.current.querySelectorAll('.pdf-page'));
            const newHeights = new Array(doc.numPages).fill(0);
            
            pages.forEach((page) => {
                const pageNum = parseInt((page as HTMLElement).dataset.pageNumber || '0');
                if (pageNum > 0) {
                    newHeights[pageNum - 1] = page.getBoundingClientRect().height;
                }
            });
            
            setPageHeights(newHeights);
            // rebuildSegments 会在渲染更新后通过 useEffect 或 requestAnimationFrame 调用
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [doc]);

    // 监听 pageHeights 变化以重建 segments
    useEffect(() => {
        // 等待 DOM 更新
        const timer = setTimeout(rebuildSegments, 100);
        return () => clearTimeout(timer);
    }, [pageHeights]);

    // PDF 页面渲染完成回调
    const handlePageRendered = useCallback((pageNum: number, height: number) => {
        setPageHeights(prev => {
            const newHeights = [...prev];
            newHeights[pageNum - 1] = height;
            return newHeights;
        });
        // 每次页面渲染高度变化，重建段信息
        // 由于 setState 是异步的，这里可能需要防抖或延迟
        requestAnimationFrame(rebuildSegments);
    }, []);

    // 重建滚动段信息
    const rebuildSegments = () => {
        if (!pdfWrapperRef.current || !aiWrapperRef.current) return;

        const calc = (wrapper: HTMLElement, selector: string): SegmentInfo[] => {
            const pages = Array.from(wrapper.querySelectorAll(selector)) as HTMLElement[];
            return pages.map((page, i) => {
                const top = page.offsetTop;
                const nextTop = (i < pages.length - 1) ? (pages[i + 1] as HTMLElement).offsetTop : wrapper.scrollHeight;
                const height = Math.max(1, nextTop - top);
                return { top, height };
            });
        };

        leftSegments.current = calc(pdfWrapperRef.current, '.pdf-page');
        rightSegments.current = calc(aiWrapperRef.current, '.trans-page');
    };

    // 滚动同步
    useEffect(() => {
        const mapScroll = (fromLeft: boolean) => {
            if (syncLock.current) return;

            const source = fromLeft ? pdfWrapperRef.current : aiWrapperRef.current;
            const target = fromLeft ? aiWrapperRef.current : pdfWrapperRef.current;
            const sSegs = fromLeft ? leftSegments.current : rightSegments.current;
            const tSegs = fromLeft ? rightSegments.current : leftSegments.current;

            if (!source || !target || !sSegs.length || !tSegs.length) return;

            syncLock.current = true;
            const y = source.scrollTop;
            
            // 找到当前滚动位置对应的段
            let idx = sSegs.findIndex(seg => y >= seg.top && y < seg.top + seg.height);
            if (idx === -1) idx = (y < (sSegs[0]?.top ?? 0)) ? 0 : sSegs.length - 1;
            
            const seg = sSegs[idx];
            // 如果高度为 0 或无效，不进行同步，避免跳动
            if (!seg || seg.height <= 0) {
                requestAnimationFrame(() => { syncLock.current = false; });
                return;
            }

            const ratio = (y - seg.top) / seg.height;
            const tSeg = tSegs[Math.min(idx, tSegs.length - 1)];
            
            if (tSeg && tSeg.height > 0) {
                target.scrollTop = tSeg.top + ratio * tSeg.height;
            }
            
            requestAnimationFrame(() => { syncLock.current = false; });
        };

        const pdfWrapper = pdfWrapperRef.current;
        const aiWrapper = aiWrapperRef.current;

        if (pdfWrapper && aiWrapper) {
            const handleLeftScroll = () => mapScroll(true);
            const handleRightScroll = () => mapScroll(false);

            pdfWrapper.addEventListener('scroll', handleLeftScroll);
            aiWrapper.addEventListener('scroll', handleRightScroll);

            return () => {
                pdfWrapper.removeEventListener('scroll', handleLeftScroll);
                aiWrapper.removeEventListener('scroll', handleRightScroll);
            };
        }
    }, [doc]); // 当 doc 变化时重新绑定，虽然 refs 可能不变，但内容变了

    // Intersection Observer (确定当前页)
    useEffect(() => {
        if (!doc || !pdfWrapperRef.current) return;

        const onPagesIntersect = (entries: IntersectionObserverEntry[]) => {
            entries.forEach(entry => {
                const pageNum = parseInt((entry.target as HTMLElement).dataset.pageNumber || '0');
                if (pageNum > 0) {
                    intersectionMap.current.set(pageNum, entry);
                }
            });
            pickAndShowActivePage();
        };

        observer.current = new IntersectionObserver(onPagesIntersect, {
            root: pdfWrapperRef.current,
            threshold: [0, 0.25, 0.5, 0.75, 1]
        });

        // 观察所有 PDF 页面
        // 注意：由于 PDF 页面是动态渲染的，我们可能需要一种机制来在渲染后添加观察
        // 或者使用 MutationObserver 监听 pdfWrapper 的子元素变化
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof HTMLElement && node.classList.contains('pdf-page')) {
                        observer.current?.observe(node);
                    }
                });
            });
        });

        mutationObserver.observe(pdfWrapperRef.current, { childList: true });

        return () => {
            observer.current?.disconnect();
            mutationObserver.disconnect();
        };
    }, [doc]);

    const pickAndShowActivePage = () => {
        if (intersectionMap.current.size === 0) return;

        let bestPage = currentPage;
        let bestRatio = -1;

        intersectionMap.current.forEach((entry, page) => {
            const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
            if (ratio > bestRatio) {
                bestRatio = ratio;
                bestPage = page;
            }
        });

        if (bestPage !== currentPage) {
            setCurrentPage(bestPage);
            setStatusMessage(`Page ${bestPage} / ${doc?.numPages}`);
        }
    };

    // 窗口预取逻辑（使用 TranslationManager）
    useEffect(() => {
        if (!doc || !currentPage) return;

        // Debounce: 防止快速滚动时频繁触发
        const timer = setTimeout(() => {
            translationManager.setCurrentPage(currentPage);
            translationManager.requestWindow(currentPage);
        }, 300);

        return () => clearTimeout(timer);
    }, [currentPage, doc, translationManager]);

    // 处理缓存统计
    const handleShowCacheStats = async () => {
        const stats = await services.cache.getStats();
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        alert(`缓存统计：\n文件数：${stats.count}\n总大小：${sizeMB} MB`);
    };

    const handleClearCache = async () => {
        if (confirm('确定要清空所有缓存吗？')) {
            await services.cache.clear();
            alert('缓存已清空');
            window.location.reload();
        }
    };

    return (
        <>
            <StatusBar 
                statusMessage={statusMessage}
                onShowSettings={() => setIsSettingsOpen(true)}
                onShowCacheStats={handleShowCacheStats}
                onClearCache={handleClearCache}
            />
            
            <div id="main-container">
                <PDFViewer 
                    ref={pdfWrapperRef}
                    onPageRendered={handlePageRendered}
                    onScroll={() => { /* handled by effect */ }}
                />
                <TranslationPanel 
                    ref={aiWrapperRef}
                    pageHeights={pageHeights}
                    activePage={currentPage}
                    onScroll={() => { /* handled by effect */ }}
                />
            </div>

            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        </>
    );
};

