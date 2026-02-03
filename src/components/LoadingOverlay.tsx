import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LoadingOverlay: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', // Deep Blue Gradient
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, color: 'white', fontFamily: 'sans-serif'
        }}>
            <div className="spinner" style={{
                width: '60px', height: '60px',
                border: '6px solid rgba(255,255,255,0.3)',
                borderTop: '6px solid #ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }}></div>
            <h2 style={{ marginTop: '20px', fontSize: '24px', fontWeight: '300' }}>{t('locating')}</h2>
            <p style={{ opacity: 0.8, fontSize: '14px' }}>{t('pleaseWait')}</p>

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LoadingOverlay;
