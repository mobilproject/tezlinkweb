import React, { useEffect, useState, useRef } from 'react';
import './LoginPage.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Map from '../components/Map';
import { auth } from '../services/firebase';
import {
    updateLocation,
    observeUserLocations,
    createCall,
    observeCalls,
    acceptCall,
    createTransaction,
    observeTransaction,
    observeCall,
    clearDatabase,
    getCall,
    cancelCall,
    cancelTransaction
} from '../services/ride';
import type { UserLocation, Call, Transaction } from '../types';
import { onAuthStateChanged } from 'firebase/auth';

const MapPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [user, setUser] = useState(auth.currentUser);
    const [role, setRole] = useState<'Driver' | 'Customer' | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<string[]>([]);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [myLoc, setMyLoc] = useState({ lat: 40.7128, lon: -74.0060 }); // Default NYC
    const [others, setOthers] = useState<UserLocation[]>([]);
    const [calls, setCalls] = useState<Call[]>([]);
    const [activeTx, setActiveTx] = useState<Transaction | null>(null);
    const [activeCall, setActiveCall] = useState<Call | null>(null); // For Driver Navigation
    const [isLocating, setIsLocating] = useState(true);
    const [myCallId, setMyCallId] = useState<string | null>(null);

    // State needed for Negotiation
    const [offerPrice, setOfferPrice] = useState('');
    const [statusMsg, setStatusMsg] = useState('');

    // Request Modal State
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestLoc, setRequestLoc] = useState<{ lat: number, lon: number } | null>(null);
    const [initialOffer, setInitialOffer] = useState('');

    // Refs for cleanup
    const txSubRef = useRef<(() => void) | null>(null);

    // 1. Auth Check - NO CHANGES NEEDED
    useEffect(() => {
        console.log('[MapPage] Checking Auth...');
        const unsub = onAuthStateChanged(auth, (u) => {
            console.log('[MapPage] Auth State Changed:', u ? 'Logged In' : 'Logged Out', u?.uid);
            if (!u) navigate('/');
            else setUser(u);
        });
        return unsub;
    }, [navigate]);

    // 2. Location Tracking - NO CHANGES NEEDED
    useEffect(() => {
        if (!user || !role) return;
        console.log(`[MapPage] Starting Location Tracking for ${role}`);

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                // console.log('[MapPage] GPS Update:', latitude, longitude); // Spammy
                setMyLoc({ lat: latitude, lon: longitude });
                setIsLocating(false);
                // Push to Firebase
                if (isConfirmed) {
                    updateLocation(user.uid, latitude, longitude, role, role === 'Driver' ? 4 : 0, role === 'Customer' ? 1 : 0, paymentMethod);
                }
            },
            (err) => console.error('[MapPage] GPS Error:', err),
            { enableHighAccuracy: true }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [user, role]);

    // 3. Listen for Others & Calls
    useEffect(() => {
        if (!user || !role) return;
        console.log('[MapPage] Subscribing to Data...');

        const targetType = role === 'Driver' ? 'Customer' : 'Driver';
        // Listen for users
        const unsubLocs = observeUserLocations(targetType, (locs) => {
            console.log(`[MapPage] Received ${locs.length} ${targetType}s`);
            setOthers(locs);
        });

        // Listen for calls (Everyone)
        const unsubCalls = observeCalls((vals) => {
            console.log(`[MapPage] Received ${vals.length} Calls`);
            setCalls(vals);
        });

        return () => {
            unsubLocs();
            unsubCalls();
        };
    }, [user, role]);

    // 4. Handle Negotiation Sync (Port of LoadTransaction)
    const loadTransaction = (txId: string) => {
        if (txSubRef.current) txSubRef.current(); // Unsub previous
        console.log('[MapPage] Loading Transaction:', txId);

        const unsub = observeTransaction(txId, (tx) => {
            if (!tx) return;

            // STRICT SCOPING: Ensure this transaction belongs to our active Call
            if (myCallId && tx.CallId && tx.CallId !== myCallId) {
                console.warn('[MapPage] Mismatched CallId in Transaction. Ignoring.', tx.CallId, myCallId);
                return;
            }

            setActiveTx(tx);
            // Fetch Call Details for Navigation (if we don't have them)
            if (tx.CallId) {
                getCall(tx.CallId).then(call => {
                    if (call) setActiveCall(call);
                });
            }
            console.log('[MapPage] Tx Update:', tx.Status, tx.Price);

            // Logic for alerts/messages
            const myId = user?.uid;
            const iAccepted = (myId === tx.DriverId && tx.DriverAcceptedPrice) || (myId === tx.CustomerId && tx.CustomerAcceptedPrice);

            if (tx.Status === 'Agreed') {
                setStatusMsg(`${t('dealAgreed')}: ${tx.Price}!`);
            } else if (iAccepted) {
                setStatusMsg(`${t('sentOffer')} ${tx.Price}. ${t('waitingResponse')}`);
            } else {
                setStatusMsg(`${t('offer')}: ${tx.Price}. ${t('offerAction')}.`);
            }

            if (tx.Status === 'Completed') {
                alert(t('rideCompleted'));
                setActiveTx(null);
                setRole(null); // Reset or just map
                setMyCallId(null); // Clear active call
                if (txSubRef.current) txSubRef.current();
            }

            if (tx.Status === 'Cancelled') {
                alert('Ride Cancelled.');
                setActiveTx(null);
                setMyCallId(null);
                setActiveCall(null);
                if (txSubRef.current) txSubRef.current();
            }
        });
        txSubRef.current = unsub;
    };

    // Customer: Watch my own calls to see if accepted
    useEffect(() => {
        if (role === 'Customer' && user && !activeTx && myCallId) {
            console.log('[MapPage] Monitoring My Call:', myCallId);
            const unsub = observeCall(myCallId, (call) => {
                if (call && call.Status === 'Accepted' && call.TransactionId) {
                    console.log('[MapPage] Call Accepted! Joining Tx:', call.TransactionId);
                    loadTransaction(call.TransactionId);
                }
            });
            return () => unsub();
        }
    }, [role, user, activeTx, myCallId]);


    // Handlers
    const handleMapClick = (lat: number, lon: number) => {
        if (role !== 'Customer') return;
        setRequestLoc({ lat, lon });
        setInitialOffer('');
        setShowRequestModal(true);
    };

    const submitRequest = async () => {
        if (!requestLoc || !initialOffer) return;
        const price = parseFloat(initialOffer);
        if (isNaN(price) || price <= 0) {
            alert('Please enter a valid price');
            return;
        }

        const callId = crypto.randomUUID();
        setMyCallId(callId); // TRACK THIS ID
        const call: Call = {
            CallId: callId,
            InitiatorId: user!.uid,
            InitiatorEmail: user!.email || '',
            Latitude: myLoc.lat,
            Longitude: myLoc.lon,
            InitiatorType: 'Customer',
            PassengerCount: 1,
            Status: 'Open',
            OfferPrice: price,
            DestLat: requestLoc.lat,
            DestLon: requestLoc.lon,
            CreatedAt: new Date().toISOString()
        };
        await createCall(call);
        setShowRequestModal(false);
        // alert(`Request Sent for ${price}! Waiting for Driver...`);
    };

    const handlePinClick = async (markerId: string, type: 'User' | 'Call') => {
        if (type === 'Call' && role === 'Driver') {
            const call = calls.find(c => c.CallId === markerId);
            if (!call) return;

            // TRACK THIS ID (Strict Scoping)
            setMyCallId(call.CallId);

            const txId = crypto.randomUUID();
            const success = await acceptCall(markerId, user!.uid, txId);
            if (success) {
                const tx: Transaction = {
                    TransactionId: txId,
                    CallId: call.CallId, // Link to Call
                    CustomerId: call.InitiatorId,
                    DriverId: user!.uid,
                    Status: 'Negotiating', // Start Negotiating
                    Price: call.OfferPrice || 0,
                    DriverRating: 0,
                    CustomerRating: 0,
                    DriverAcceptedPrice: false, // Driver hasn't agreed yet
                    CustomerAcceptedPrice: true, // Customer initiated
                    CreatedAt: new Date().toISOString()
                };
                await createTransaction(tx);
                loadTransaction(txId);
            }
        }
    };

    const handleMakeOffer = async () => {
        console.log('[MapPage] Making Offer...');
        if (!activeTx) { console.error('No Active Tx'); return; }
        if (!offerPrice) { console.error('No Price Input'); return; }

        const price = parseFloat(offerPrice);
        console.log('[MapPage] Offer Price:', price);

        const myId = user!.uid;
        const updated = { ...activeTx };
        updated.Price = price;
        updated.Status = 'Negotiating';

        if (myId === updated.DriverId) {
            updated.DriverAcceptedPrice = true;
            updated.CustomerAcceptedPrice = false;
        } else {
            updated.DriverAcceptedPrice = false;
            updated.CustomerAcceptedPrice = true;
        }

        console.log('[MapPage] Updating Transaction:', updated);
        await createTransaction(updated);
        console.log('[MapPage] Transaction Updated');
    };

    const handleAccept = async () => {
        if (!activeTx) return;
        const myId = user!.uid;
        const updated = { ...activeTx };

        if (myId === updated.DriverId) updated.DriverAcceptedPrice = true;
        else updated.CustomerAcceptedPrice = true;

        if (updated.DriverAcceptedPrice && updated.CustomerAcceptedPrice) {
            updated.Status = 'Agreed';
        }

        await createTransaction(updated);
    };


    const [showMenu, setShowMenu] = useState(false);

    // 0. Flashy Loading Overlay
    if (isLocating && role) {
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
    }

    // Render
    if (!role) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ maxWidth: '600px' }}>
                    <div className="brand-section">
                        <h1 className="brand-title" style={{ fontSize: '2rem' }}>{t('welcome')}</h1>
                        <p className="brand-subtitle">{t('chooseJourney')}</p>
                    </div>

                    <div className="role-options">
                        <div className="role-card" onClick={() => setRole('Driver')}>
                            <div className="role-icon">🚖</div>
                            <div className="role-title">{t('driver')}</div>
                            <div className="role-desc">{t('driverDesc')}</div>
                        </div>
                        <div className="role-card" onClick={() => setRole('Customer')}>
                            <div className="role-icon">🧕</div>
                            <div className="role-title">{t('passenger')}</div>
                            <div className="role-desc">{t('passengerDesc')}</div>
                        </div>
                    </div>

                    <button className="submit-btn secondary" onClick={() => auth.signOut()}>
                        Logout
                    </button>
                    <div className="brand-tagline">{t('bottomTagline')}</div>
                </div>
            </div>
        );
    }

    // Payment Selection
    if (!isConfirmed && !myCallId && !activeTx) {
        const togglePayment = (method: string) => {
            if (paymentMethod.includes(method)) {
                setPaymentMethod(paymentMethod.filter(m => m !== method));
            } else {
                setPaymentMethod([...paymentMethod, method]);
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
                            style={{ borderColor: paymentMethod.includes('Cash') ? '#00C6FF' : 'rgba(255,255,255,0.1)' }}
                        >
                            <div className="role-icon">💵</div>
                            <div className="role-title">{t('cash')}</div>
                        </div>
                        <div
                            className="role-card"
                            onClick={() => togglePayment('Click')}
                            style={{ borderColor: paymentMethod.includes('Click') ? '#00C6FF' : 'rgba(255,255,255,0.1)' }}
                        >
                            <div className="role-icon">🟦</div>
                            <div className="role-title">{t('click')}</div>
                        </div>
                        <div
                            className="role-card"
                            onClick={() => togglePayment('Payme')}
                            style={{ borderColor: paymentMethod.includes('Payme') ? '#00C6FF' : 'rgba(255,255,255,0.1)' }}
                        >
                            <div className="role-icon">🟩</div>
                            <div className="role-title">{t('payme')}</div>
                        </div>
                    </div>

                    {paymentMethod.length > 0 && (
                        <button className="submit-btn" style={{ marginTop: '20px' }} onClick={() => setIsConfirmed(true)}>
                            Continue
                        </button>
                    )}

                    <button
                        onClick={() => auth.signOut()}
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
    }

    // Build Markers
    const markers = [
        ...others.map(u => {
            let userType = u.UserType;
            // Clean up user type just in case
            if (userType !== 'Driver' && userType !== 'Customer') userType = 'Customer';

            return {
                id: u.UserId,
                lat: Number(u.Latitude),
                lon: Number(u.Longitude),
                userType: userType, // Pass userType explicitly for icon logic
                paymentMethods: u.PaymentMethods,
                // fallback color logic if needed by old map code
                color: (userType === 'Driver' ? 'green' : 'red') as any,
                title: userType,
                onClick: () => handlePinClick(u.UserId, 'User')
            };
        }),
    ];

    // Add Call Markers (Pickup + Destination)
    calls.forEach(c => {
        // 1. Pickup Marker (Human Icon)
        markers.push({
            id: `${c.CallId}_pickup`,
            lat: Number(c.Latitude),
            lon: Number(c.Longitude),
            userType: 'Customer', // Shows Human Icon
            title: `${t('pickup')} (User)`,
            color: 'red', // Fallback
            // Pass payment info if available (would need to be added to Call type or fetched)
            onClick: () => handlePinClick(c.CallId, 'Call')
        } as any);

        // 2. Destination Marker (Price Tag)
        if (c.DestLat && c.DestLon) {
            markers.push({
                id: `${c.CallId}_dest`,
                lat: Number(c.DestLat),
                lon: Number(c.DestLon),
                price: c.OfferPrice, // Shows Price Tag
                title: `${t('destination')} ($${c.OfferPrice})`,
                color: 'yellow',
                onClick: () => handlePinClick(c.CallId, 'Call')
            } as any);
        } else {
            // If no destination (legacy?), just show price at pickup? 
            // Actually, forcing visual split is better. If no dest, maybe the original logic applies.
            // But for now, let's assume valid calls have dest. 
            // If not, we can fallback to showing price at pickup.
            markers.push({
                id: `${c.CallId}_legacy`,
                lat: Number(c.Latitude),
                lon: Number(c.Longitude),
                price: c.OfferPrice,
                title: `${t('pickup')} ($${c.OfferPrice})`,
                color: 'yellow',
                onClick: () => handlePinClick(c.CallId, 'Call')
            } as any);
        }
    });

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '100%', position: 'relative' }}>
                <Map
                    centerLat={myLoc.lat}
                    centerLon={myLoc.lon}
                    markers={markers}
                    onMapClick={handleMapClick}
                />

                {/* Menu Toggle */}
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    style={{
                        position: 'absolute', top: 20, right: 20, zIndex: 1000,
                        background: 'white', border: '1px solid #ccc', borderRadius: 5, padding: '10px 15px',
                        cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}
                >
                    {showMenu ? t('close') : t('menu')}
                </button>

                {/* Menu Dropdown */}
                {showMenu && (
                    <div style={{
                        position: 'absolute', top: 60, right: 20, zIndex: 1000,
                        background: 'white', padding: 10, borderRadius: 5, boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                        minWidth: 150
                    }}>
                        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>{t('settings')}</p>
                        <button
                            onClick={async () => {
                                if (confirm(t('resetConfirm'))) {
                                    await clearDatabase();
                                    alert(t('dbCleared'));
                                    window.location.reload();
                                }
                            }}
                            style={{
                                width: '100%',
                                background: 'red', color: 'white', padding: 8, borderRadius: 5, border: 'none', cursor: 'pointer'
                            }}
                        >
                            {t('resetSystem')}
                        </button>
                    </div>
                )}

                {/* Overlay */}
                {activeTx && (
                    <div style={{
                        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                        background: 'white', padding: 20, borderRadius: 10, boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                        zIndex: 1000, width: 300
                    }}>
                        <h3>{t('negotiation')}</h3>
                        <p>{statusMsg}</p>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                            <input
                                type="number"
                                value={offerPrice}
                                onChange={e => setOfferPrice(e.target.value)}
                                placeholder={t('price')}
                                style={{ flex: 1, padding: 5 }}
                            />
                            <button onClick={handleMakeOffer} style={{ background: '#2196F3', color: 'white', border: 'none', padding: 5 }}>{t('offer')}</button>
                        </div>
                        <button onClick={handleAccept} disabled={activeTx.Status !== 'Negotiating'} style={{ width: '100%', padding: 10, background: '#4CAF50', color: 'white', border: 'none' }}>
                            {t('acceptPrice')}
                        </button>

                        {/* Navigation Button for Driver */}
                        {role === 'Driver' && activeTx.Status === 'Agreed' && activeCall && (
                            <button
                                onClick={() => {
                                    const pickup = `${activeCall.Latitude},${activeCall.Longitude}`;
                                    let url = `https://www.google.com/maps/dir/?api=1&destination=${pickup}&travelmode=driving`; // Default to just pickup

                                    if (activeCall.DestLat && activeCall.DestLon) {
                                        // Waypoint Mode: Driver -> Pickup -> Destination
                                        const dest = `${activeCall.DestLat},${activeCall.DestLon}`;
                                        url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${pickup}&travelmode=driving`;
                                    }

                                    window.open(url, '_blank');
                                }}
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
                            onClick={() => {
                                if (confirm('Are you sure you want to cancel?')) {
                                    if (activeTx.CallId) cancelCall(activeTx.CallId);
                                    cancelTransaction(activeTx.TransactionId);
                                    // Local cleanup happens via listener
                                }
                            }}
                            style={{
                                width: '100%', marginTop: '15px', padding: '10px',
                                background: '#f44336', color: 'white', border: 'none', borderRadius: '5px',
                                fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            {t('cancel')} / Reject
                        </button>
                    </div>
                )}

                {/* Request Creation Modal - Redesigned */}
                {showRequestModal && (
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

                            <h3 style={{ margin: 0, fontSize: '20px', color: '#333' }}>{t('requestRide')}</h3>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>
                                    {t('offerPriceLabel')}
                                </label>
                                <input
                                    type="number"
                                    value={initialOffer}
                                    onChange={e => setInitialOffer(e.target.value)}
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
                                    onClick={() => setShowRequestModal(false)}
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
                                    onClick={submitRequest}
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
                )}
            </div>
        </div>
    );
};

export default MapPage;
