import { forwardRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { TranslationBlock } from './TranslationBlock';

interface TranslationPanelProps {
    pageHeights: number[];
    activePage: number;
    onScroll: () => void;
}

export const TranslationPanel = forwardRef<HTMLDivElement, TranslationPanelProps>(({ pageHeights, activePage, onScroll }, ref) => {
    const { document: doc } = useAppContext();

    if (!doc) return <div id="ai-wrapper" className="scroll-view" style={{ overflowY: 'hidden' }}></div>;

    return (
        <div id="ai-wrapper" className="scroll-view" ref={ref} onScroll={onScroll}>
            {Array.from({ length: doc.numPages }, (_, i) => i + 1).map(pageNum => (
                <TranslationBlock
                    key={pageNum}
                    pageNum={pageNum}
                    height={pageHeights[pageNum - 1] || 0}
                    isActive={pageNum === activePage}
                />
            ))}
        </div>
    );
});

TranslationPanel.displayName = 'TranslationPanel';

