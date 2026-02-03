import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface PaymentSelectionProps {
    paymentMethods: string[];
    setPaymentMethods: (methods: string[]) => void;
    onContinue: () => void;
    onLogout: () => void;
}

const PaymentSelection: React.FC<PaymentSelectionProps> = ({ paymentMethods, setPaymentMethods, onContinue, onLogout }) => {
    const { t } = useLanguage();

    const togglePayment = (method: string) => {
        if (paymentMethods.includes(method)) {
            setPaymentMethods(paymentMethods.filter(m => m !== method));
        } else {
            setPaymentMethods([...paymentMethods, method]);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card" style={{ maxWidth: '600px' }}>
                <div className="brand-section">
                    <h1 className="brand-title" style={{ fontSize: '2rem' }}>{t('selectPayment')}</h1>
                </div>

                <div className="role-options">
                    <div
                        className="role-card"
                        onClick={() => togglePayment('Cash')}
                        style={{ borderColor: paymentMethods.includes('Cash') ? '#00C6FF' : 'rgba(255,255,255,0.1)' }}
                    >
                        <div className="role-icon">💵</div>
                        <div className="role-title">{t('cash')}</div>
                    </div>
                    <div
                        className="role-card"
                        onClick={() => togglePayment('Click')}
                        style={{ borderColor: paymentMethods.includes('Click') ? '#00C6FF' : 'rgba(255,255,255,0.1)' }}
                    >
                        <div className="role-icon">🟦</div>
                        <div className="role-title">{t('click')}</div>
                    </div>
                    <div
                        className="role-card"
                        onClick={() => togglePayment('Payme')}
                        style={{ borderColor: paymentMethods.includes('Payme') ? '#00C6FF' : 'rgba(255,255,255,0.1)' }}
                    >
                        <div className="role-icon">🟩</div>
                        <div className="role-title">{t('payme')}</div>
                    </div>
                </div>

                {paymentMethods.length > 0 && (
                    <button className="submit-btn" style={{ marginTop: '20px' }} onClick={onContinue}>
                        Continue
                    </button>
                )}

                <button
                    onClick={onLogout}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'transparent',
                        border: '1px solid #ccc',
                        color: '#666',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#333'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#ccc'}
                >
                    Logout ↪
                </button>
            </div>
        </div>
    );
};

export default PaymentSelection;
