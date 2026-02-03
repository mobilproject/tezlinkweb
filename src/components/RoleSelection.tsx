import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface RoleSelectionProps {
    onSelectRole: (role: 'Driver' | 'Customer') => void;
    onLogout: () => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole, onLogout }) => {
    const { t } = useLanguage();

    return (
        <div className="login-container">
            <div className="login-card" style={{ maxWidth: '600px' }}>
                <div className="brand-section">
                    <h1 className="brand-title" style={{ fontSize: '2rem' }}>{t('welcome')}</h1>
                    <p className="brand-subtitle">{t('chooseJourney')}</p>
                </div>

                <div className="role-options">
                    <div className="role-card" onClick={() => onSelectRole('Driver')}>
                        <div className="role-icon">🚖</div>
                        <div className="role-title">{t('driver')}</div>
                        <div className="role-desc">{t('driverDesc')}</div>
                    </div>
                    <div className="role-card" onClick={() => onSelectRole('Customer')}>
                        <div className="role-icon">🧕</div>
                        <div className="role-title">{t('passenger')}</div>
                        <div className="role-desc">{t('passengerDesc')}</div>
                    </div>
                </div>

                <button className="submit-btn secondary" onClick={onLogout}>
                    Logout
                </button>
                <div className="brand-tagline">{t('bottomTagline')}</div>
            </div>
        </div>
    );
};

export default RoleSelection;
