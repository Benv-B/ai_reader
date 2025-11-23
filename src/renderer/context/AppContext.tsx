import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { AppContextType, PDFDocument, AppSettings, IPDFService, ITranslationService, ICacheService } from '../types';
import PDFService from '../services/pdf-service';
import TranslationService from '../services/translation-service';
import CacheService from '../services/cache-service';
import { TranslationManager } from '../services/translation-manager';

// 扩展 Context 类型以包含服务实例
interface ExtendedAppContextType extends AppContextType {
    services: {
        pdf: IPDFService;
        translation: ITranslationService;
        cache: ICacheService;
    };
    translationManager: TranslationManager;
}

export const AppContext = createContext<ExtendedAppContextType | null>(null);

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppContextProvider');
    }
    return context;
};

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    // 初始化服务单例
    const [services] = useState(() => ({
        pdf: new PDFService(),
        translation: new TranslationService(),
        cache: new CacheService()
    }));

    const [translationManager] = useState(() => 
        new TranslationManager(services.cache, services.pdf, {
            maxConcurrent: 1,
            batchSize: 3,
            windowRadius: 1
        })
    );

    const [document, setDocument] = useState<PDFDocument | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [settings, setSettingsState] = useState<AppSettings>({
        fontSize: 18,
        lineHeight: 1.9,
        fontFamily: 'songti',
        maxConcurrent: 2
    });

    // 加载保存的设置
    useEffect(() => {
        try {
            const saved = localStorage.getItem('app-settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                setSettingsState(prev => ({ ...prev, ...parsed }));
                
                // 更新翻译服务的并发数
                services.translation.maxConcurrent = parsed.maxConcurrent || 2;
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    }, [services.translation]);

    const setSettings = (newSettings: AppSettings) => {
        setSettingsState(newSettings);
        localStorage.setItem('app-settings', JSON.stringify(newSettings));
        
        // 更新服务配置
        services.translation.maxConcurrent = newSettings.maxConcurrent;
    };

    // 当文档变化时，更新 TranslationManager
    useEffect(() => {
        if (document) {
            translationManager.setDocument(document.hash, document.numPages);
        }
    }, [document, translationManager]);

    const value: ExtendedAppContextType = {
        document,
        currentPage,
        settings,
        setDocument,
        setCurrentPage,
        setSettings,
        services,
        translationManager
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
