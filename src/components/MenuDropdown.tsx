import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { clearDatabase } from '../services/ride';

interface MenuDropdownProps {
    onClose: () => void;
}

const MenuDropdown: React.FC<MenuDropdownProps> = ({ onClose }) => {
    const { t, setLanguage } = useLanguage();

    const handleReset = async () => {
        if (confirm(t('resetConfirm'))) {
            await clearDatabase();
            alert(t('dbCleared'));
            window.location.reload();
        }
    };

    return (
        <div style={{
            position: 'absolute', top: 60, right: 20, zIndex: 1000,
            background: 'white', padding: 10, borderRadius: 5, boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            minWidth: 150
        }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>{t('settings')}</p>

            <div style={{ marginBottom: 15 }}>
                <p style={{ fontSize: '0.9rem', marginBottom: 5, color: '#666' }}>Language</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {(['en', 'uz', 'ru', 'tj'] as const).map(lang => (
                        <button
                            key={lang}
                            onClick={() => setLanguage(lang)}
                            style={{
                                padding: 5, fontSize: '0.8rem', cursor: 'pointer',
                                border: '1px solid #ccc', borderRadius: 3, background: '#f9f9f9'
                            }}
                        >
                            {lang.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={handleReset}
                style={{
                    width: '100%',
                    background: 'red', color: 'white', padding: 8, borderRadius: 5, border: 'none', cursor: 'pointer'
                }}
            >
                {t('resetSystem')}
            </button>
        </div>
    );
};

export default MenuDropdown;
