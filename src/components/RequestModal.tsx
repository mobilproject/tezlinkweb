import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface RequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (price: number) => void;
}

const RequestModal: React.FC<RequestModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const { t } = useLanguage();
    const [offer, setOffer] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!offer) return;
        const price = parseFloat(offer);
        if (isNaN(price) || price <= 0) {
            alert('Please enter a valid price');
            return;
        }
        onSubmit(price);
        setOffer(''); // Reset after submit
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 2000
        }}>
            <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                width: '320px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#333' }}>{t('requestRide')}</h3>

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>
                        {t('offerPriceLabel')}
                    </label>
                    <input
                        type="number"
                        value={offer}
                        onChange={e => setOffer(e.target.value)}
                        placeholder="50"
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                        autoFocus
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: '#f5f5f5',
                            color: '#333',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {t('request')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RequestModal;
