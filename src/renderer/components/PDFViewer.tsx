import React, { useEffect, useRef, forwardRef } from 'react';
import { useAppContext } from '../context/AppContext';

interface PDFViewerProps {
    onPageRendered: (pageNum: number, height: number) => void;
    onScroll: () => void;
}

export const PDFViewer = forwardRef<HTMLDivElement, PDFViewerProps>(({ onPageRendered, onScroll }, ref) => {
    const { document: doc, services } = useAppContext();
    const containerRef = useRef<HTMLDivElement>(null);
    // 合并 ref
    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    useEffect(() => {
        if (doc && containerRef.current) {
            renderPages();
        }
    }, [doc]);

    const renderPages = async () => {
        if (!containerRef.current || !doc) return;
        
        containerRef.current.innerHTML = ''; // 清空

        for (let i = 1; i <= doc.numPages; i++) {
            await renderPage(i);
        }
    };

    const renderPage = async (pageNum: number) => {
        if (!containerRef.current) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page';
        canvas.dataset.pageNumber = pageNum.toString();
        canvas.style.width = '90%';
        canvas.style.height = 'auto';
        containerRef.current.appendChild(canvas);

        try {
            await services.pdf.renderPage(pageNum, canvas, 1.5);
            
            // 获取实际渲染后的高度（因为 CSS width: 90% 会导致高度按比例缩放）
            const rect = canvas.getBoundingClientRect();
            // 注意：这里获取的是在视口中的高度，可能并不准确如果它还没被渲染出来？
            // 实际上 getBoundingClientRect 对于添加到 DOM 的元素是有效的。
            // 我们需要的是元素的 offsetHeight 或者 rect.height
            
            // 稍微延迟一下以确保布局更新？或者直接取
            onPageRendered(pageNum, rect.height);
            
        } catch (e) {
            console.error(`Failed to render page ${pageNum}`, e);
        }
    };

    return (
        <div 
            id="pdf-wrapper" 
            className="scroll-view" 
            ref={containerRef} 
            onScroll={onScroll}
            style={{ overflowY: doc ? 'auto' : 'hidden' }}
        >
            {/* Canvas elements will be injected here manually to keep compatibility with existing logic */}
        </div>
    );
});

PDFViewer.displayName = 'PDFViewer';

