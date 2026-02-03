import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface RatingModalProps {
    onSubmit: (rating: number) => void;
}

const RatingModal: React.FC<RatingModalProps> = ({ onSubmit }) => {
    const { t } = useLanguage();
    const [rating, setRating] = useState(0);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 2000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'white'
        }}>
            <h2>{t('rateDriver') || 'Rate Your Ride'}</h2>
            <div style={{ display: 'flex', gap: 10, fontSize: '2rem', cursor: 'pointer', marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} onClick={() => setRating(star)} style={{ color: star <= rating ? 'gold' : 'gray' }}>★</span>
                ))}
            </div>
            <button
                onClick={() => {
                    if (rating > 0) onSubmit(rating);
                }}
                style={{
                    padding: '10px 30px', background: '#4CAF50', color: 'white',
                    border: 'none', borderRadius: 25, fontSize: '1.2rem'
                }}
            >
                {t('submitRating') || 'Submit Rating'}
            </button>
        </div>
    );
};

export default RatingModal;
