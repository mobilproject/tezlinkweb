import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { Transaction, Call } from '../types';
import RatingModal from './RatingModal';

interface NegotiationCardProps {
    activeTx: Transaction;
    role: 'Driver' | 'Customer';
    activeCall: Call | null;
    currentUserId: string;
    onMakeOffer: (price: number) => void;
    onAccept: () => void;
    onCancel: () => void;
    onSubmitRating: (rating: number) => void;
}

const NegotiationCard: React.FC<NegotiationCardProps> = ({
    activeTx, role, activeCall, currentUserId,
    onMakeOffer, onAccept, onCancel, onSubmitRating
}) => {
    const { t } = useLanguage();
    const [offerPrice, setOfferPrice] = useState('');
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        const iAccepted = (currentUserId === activeTx.DriverId && activeTx.DriverAcceptedPrice) ||
            (currentUserId === activeTx.CustomerId && activeTx.CustomerAcceptedPrice);

        if (activeTx.Status === 'Agreed') {
            setStatusMsg(`${t('dealAgreed')}: ${activeTx.Price}!`);
        } else if (iAccepted) {
            setStatusMsg(`${t('sentOffer')} ${activeTx.Price}. ${t('waitingResponse')}`);
        } else {
            setStatusMsg(`${t('offer')}: ${activeTx.Price}. ${t('offerAction')}.`);
        }
    }, [activeTx, currentUserId, t]);

    const handleMakeOfferClick = () => {
        if (!offerPrice) return;
        const price = parseFloat(offerPrice);
        if (!isNaN(price) && price > 0) {
            onMakeOffer(price);
            setOfferPrice('');
        }
    };

    const handleNavigation = () => {
        if (!activeCall) return;
        const pickup = `${activeCall.Latitude},${activeCall.Longitude}`;
        let url = `https://www.google.com/maps/dir/?api=1&destination=${pickup}&travelmode=driving`;

        if (activeCall.DestLat && activeCall.DestLon) {
            const dest = `${activeCall.DestLat},${activeCall.DestLon}`;
            url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${pickup}&travelmode=driving`;
        }
        window.open(url, '_blank');
    };

    return (
        <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: 'white', padding: 20, borderRadius: 10, boxShadow: '0 0 20px rgba(0,0,0,0.4)',
            zIndex: 1000, width: 320, border: '1px solid #eee'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, color: '#333' }}>{t('negotiation')}</h3>
                <div style={{
                    background: '#E8F5E9', color: '#2E7D32', padding: '5px 10px',
                    borderRadius: '15px', fontWeight: 'bold', fontSize: '1.2rem'
                }}>
                    {activeTx.Price} {t('currency')}
                </div>
            </div>

            <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '0.9rem' }}>{statusMsg}</p>

            <div style={{ display: activeTx.Status === 'Agreed' ? 'none' : 'flex', gap: 10, marginBottom: 10 }}>
                <input
                    type="number"
                    value={offerPrice}
                    onChange={e => setOfferPrice(e.target.value)}
                    placeholder={t('price')}
                    style={{
                        flex: 1, padding: '10px', fontSize: '1.2rem', fontWeight: 'bold',
                        border: '2px solid #2196F3', borderRadius: '5px', textAlign: 'center'
                    }}
                />
                <button onClick={handleMakeOfferClick} style={{
                    background: '#2196F3', color: 'white', border: 'none',
                    padding: '0 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer'
                }}>
                    {t('offer')}
                </button>
            </div>

            <button onClick={onAccept} disabled={activeTx.Status !== 'Negotiating'} style={{
                width: '100%', padding: '12px', background: activeTx.Status === 'Negotiating' ? '#4CAF50' : '#ccc',
                color: 'white', border: 'none', borderRadius: '5px', fontSize: '1.1rem', fontWeight: 'bold',
                cursor: activeTx.Status === 'Negotiating' ? 'pointer' : 'default'
            }}>
                {t('acceptPrice')}
            </button>

            {/* Navigation Button for Driver */}
            {role === 'Driver' && activeTx.Status === 'Agreed' && activeCall && (
                <button
                    onClick={handleNavigation}
                    style={{
                        width: '100%', marginTop: '10px', padding: '10px',
                        background: '#FF9800', color: 'white', border: 'none', borderRadius: '5px',
                        fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                >
                    <span>🧭</span> {t('navigateToPickup')}
                </button>
            )}

            {/* CANCEL / REJECT BUTTON */}
            <button
                onClick={onCancel}
                style={{
                    width: '100%', marginTop: '15px', padding: '10px',
                    background: '#f44336', color: 'white', border: 'none', borderRadius: '5px',
                    fontWeight: 'bold', cursor: 'pointer'
                }}
            >
                {t('cancel')} / Reject
            </button>

            {/* Rating Modal */}
            {activeTx.Status === 'Completed' && (
                <RatingModal onSubmit={onSubmitRating} />
            )}
        </div>
    );
};

export default NegotiationCard;
