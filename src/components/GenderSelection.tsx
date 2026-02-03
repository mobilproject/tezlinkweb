import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { Gender } from '../types';

interface GenderSelectionProps {
    onSelectGender: (gender: Gender) => void;
    onLogout: () => void;
}

const GenderSelection: React.FC<GenderSelectionProps> = ({ onSelectGender, onLogout }) => {
    const { t } = useLanguage();

    return (
        <div className="login-container">
            <div className="login-card" style={{ maxWidth: '600px' }}>
                <div className="brand-section">
                    <h1 className="brand-title" style={{ fontSize: '2rem' }}>{t('welcome')}</h1>
                    <p className="brand-subtitle">{t('chooseGender')}</p>
                </div>

                <div className="role-options">
                    <div className="role-card" onClick={() => onSelectGender('Male')}>
                        <div className="role-icon">👨</div>
                        <div className="role-title">{t('male')}</div>
                    </div>
                    <div className="role-card" onClick={() => onSelectGender('Female')}>
                        <div className="role-icon">🧕</div>
                        <div className="role-title">{t('female')}</div>
                    </div>
                </div>

                <button className="submit-btn secondary" onClick={onLogout}>
                    Logout
                </button>
            </div>
        </div>
    );
};

export default GenderSelection;
