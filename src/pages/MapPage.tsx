import React, { useEffect, useState, useRef } from 'react';
import './LoginPage.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Map from '../components/Map';
import { auth } from '../services/firebase';
import { playSound } from '../utils/audio';
import {
    updateLocation,
    observeUserLocations,
    createCall,
    observeCalls,
    acceptCall,
    createTransaction,
    observeTransaction,
    observeCall,
    getCall,
    cancelCall,
    cancelTransaction,
    recordRideHistory,
    submitRating,
    getUserRating,
    updateLocationWithRating
} from '../services/ride';
import type { UserLocation, Call, Transaction, Gender } from '../types';
import { onAuthStateChanged } from 'firebase/auth';
import GenderSelection from '../components/GenderSelection';
import RoleSelection from '../components/RoleSelection';
import PaymentSelection from '../components/PaymentSelection';
import MenuDropdown from '../components/MenuDropdown';
import NegotiationCard from '../components/NegotiationCard';
import RequestModal from '../components/RequestModal';

const MapPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [user, setUser] = useState(auth.currentUser);
    const [gender, setGender] = useState<Gender | null>(null);
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

    // Welcome Sound
    useEffect(() => {
        playSound('welcome');
    }, []);

    // WATCH FOR NEW CALLS (Driver)
    const prevCallsLen = useRef(0);
    useEffect(() => {
        if (role === 'Driver' && calls.length > prevCallsLen.current) {
            // Only play if it's a legitimate new call
            if (prevCallsLen.current > 0 || calls.length > 0) playSound('new_request');
        }
        prevCallsLen.current = calls.length;
    }, [calls, role]);

    // WATCH FOR OFFERS (Customer)
    const prevStatus = useRef<string | null>(null);
    useEffect(() => {
        if (activeTx && activeTx.Status === 'Negotiating' && prevStatus.current !== 'Negotiating') {
            // Status changed to Negotiating -> Driver made an offer or counter-offer
            playSound('notification');
        }
        prevStatus.current = activeTx?.Status || null;
    }, [activeTx]);

    // Request Modal State
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestLoc, setRequestLoc] = useState<{ lat: number, lon: number } | null>(null);

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
                    // Start of Selection
                    const isBusy = activeTx || myCallId;
                    const seats = (role === 'Driver') ? (isBusy ? 0 : 4) : 0;
                    updateLocation(user.uid, latitude, longitude, role, gender, seats, role === 'Customer' ? 1 : 0, paymentMethod);
                    // End of Selection
                }
            },
            (err) => console.error('[MapPage] GPS Error:', err),
            { enableHighAccuracy: true }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [user, role]);

    // 3. Listen for Others & Calls (GEO-QUERY)
    const [mapView, setMapView] = useState<{ center: [number, number], radius: number }>({
        center: [40.7128, -74.0060], // Default
        radius: 5000 // Default 5km
    });

    // Update initial view when myLoc changes (first load)
    useEffect(() => {
        if (myLoc) {
            setMapView(prev => ({ ...prev, center: [myLoc.lat, myLoc.lon] }));
        }
    }, [myLoc]);

    useEffect(() => {
        if (!user || !role) return;
        console.log('[MapPage] Subscribing to Data (Geo)...', mapView.center, mapView.radius);

        const targetType = role === 'Driver' ? 'Customer' : 'Driver';

        // Listen for users (Geospatial)
        const unsubLocs = observeUserLocations(targetType, mapView.center, mapView.radius, (locs) => {
            console.log(`[MapPage] Received ${locs.length} ${targetType}s in view`);
            setOthers(locs);
        });

        // Listen for calls (Everyone) - Still global for now as ride service for calls wasn't requested to be geo-filtered yet, or stick to same?
        // User request specifically said "users to select... based on location". 
        // Calls are "users" in a sense (initiators).
        // ride.ts observeCalls is still global. Let's keep it global for simplicity unless requested to filter calls too.
        // Usually drivers want to see calls nearby. `findActiveCall` does local filtering.
        // Let's stick to observing Users via Geo.
        const unsubCalls = observeCalls((vals) => {
            console.log(`[MapPage] Received ${vals.length} Calls`);
            setCalls(vals);
        });

        return () => {
            unsubLocs();
            unsubCalls();
        };
    }, [user, role, mapView.center[0], mapView.center[1], mapView.radius]); // Debounce?

    const handleBoundsChange = (center: [number, number], radius: number) => {
        // Debounce optimization could happen here, but for now direct update
        // Prevent excessive updates if change is small? 
        setMapView({ center, radius });
    };

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
                // playSound('success'); // handled in handleAccept or just rely on state
            } else if (iAccepted) {
                // waiting
            } else {
                // offer received
            }

            if (tx.Status === 'Completed') {
                alert(t('rideCompleted'));
                setActiveTx(null);
                setRole(null); // Reset or just map
                setMyCallId(null); // Clear active call
                if (txSubRef.current) txSubRef.current();
            }

            if (tx.Status === 'Cancelled') {
                playSound('cancel');
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
        // setInitialOffer(''); // Removed from state
        setShowRequestModal(true);
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



    const handleAccept = async () => {
        if (!activeTx) return;
        const myId = user!.uid;
        const updated = { ...activeTx };

        if (myId === updated.DriverId) updated.DriverAcceptedPrice = true;
        else updated.CustomerAcceptedPrice = true;

        if (updated.DriverAcceptedPrice && updated.CustomerAcceptedPrice) {
            updated.Status = 'Agreed';
            playSound('success');
            // Start the recording process (fire-and-forget or await depending on needs)
            // Ideally we need the Call object too. Since we might not have it strictly in scope here easily without looking it up,
            // we'll try to find it from the calls list or just pass what we have.
            // For better reliability, we might want to fetch the Call from the ID, but for now:
            const relatedCall = calls.find(c => c.CallId === updated.CallId);
            recordRideHistory(updated, relatedCall);
        }

        await createTransaction(updated);
    };


    const [showMenu, setShowMenu] = useState(false);

    // 0. Flashy Loading Overlay - Removed to allow map loading in background.
    // We rely on the z-index overlays to cover the map while loading/selecting.

    // Build Markers
    console.log('[MapPage] Rendering Markers. Gender:', gender);

    const markers = [
        ...others.map(u => {
            let userType = u.UserType;
            if (userType !== 'Driver' && userType !== 'Customer') userType = 'Customer';

            return {
                id: u.UserId,
                lat: Number(u.Latitude),
                lon: Number(u.Longitude),
                userType: userType,
                gender: u.Gender,
                paymentMethods: u.PaymentMethods,
                availableSeats: u.AvailableSeats,
                color: (userType === 'Driver' ? 'green' : 'red') as any,
                title: userType,
                popupContent: (
                    <div style={{ minWidth: 150 }}>
                        <h3 style={{ margin: '0 0 5px', fontSize: '1rem' }}>{u.UserType === 'Driver' ? t('driver') : t('passenger')}</h3>
                        {u.Rating && (
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                <span style={{ color: '#FFD700', marginRight: 5 }}>⭐</span>
                                <span>{u.Rating.toFixed(1)}</span>
                            </div>
                        )}
                        {u.UserType === 'Driver' && u.AvailableSeats === 0 && (
                            <div style={{ color: 'red', fontWeight: 'bold', marginTop: 5 }}>
                                {t('busy')}
                            </div>
                        )}
                        {u.PaymentMethods && u.PaymentMethods.length > 0 && (
                            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: 5 }}>
                                {u.PaymentMethods.join(', ')}
                            </div>
                        )}
                    </div>
                ),
                isMe: false,
                onClick: () => handlePinClick(u.UserId, 'User')
            };
        }),
    ];

    // Add ME marker (so I can see myself before requesting)
    if (myLoc && user && role) {
        markers.push({
            id: 'me',
            lat: myLoc.lat,
            lon: myLoc.lon,
            userType: role,
            gender: gender || undefined,
            isMe: true,
            title: 'You',
            popupContent: (
                <div style={{ textAlign: 'center' }}>
                    <strong>{t('welcome')}</strong>
                    {paymentMethod && paymentMethod.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 5 }}>
                            {paymentMethod.join(', ')}
                        </div>
                    )}
                </div>
            ),
            paymentMethods: paymentMethod,
            availableSeats: (role === 'Driver') ? ((activeTx || myCallId) ? 0 : 4) : 0,
            color: 'blue' as any,
            onClick: async () => { }
        });
    }

    // Add Call Markers (Pickup + Destination)
    calls.forEach(c => {
        markers.push({
            id: `${c.CallId}_pickup`,
            lat: Number(c.Latitude),
            lon: Number(c.Longitude),
            userType: 'Customer', // Shows Human Icon
            gender: c.InitiatorGender, // Pass gender explicitly!
            title: `${t('pickup')} (User)`,
            popupContent: (
                <div>
                    <strong>{t('pickup')}</strong>
                    <div style={{ marginTop: 5 }}>
                        👤 {c.PassengerCount} {t('passenger')}
                    </div>
                </div>
            ),
            color: 'red', // Fallback
            onClick: () => handlePinClick(c.CallId, 'Call')
        } as any);

        if (c.DestLat && c.DestLon) {
            markers.push({
                id: `${c.CallId}_dest`,
                lat: Number(c.DestLat),
                lon: Number(c.DestLon),
                price: c.OfferPrice,
                title: `${t('destination')} ($${c.OfferPrice})`,
                popupContent: (
                    <div>
                        <strong>{t('destination')}</strong>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4CAF50', marginTop: 5 }}>
                            ${c.OfferPrice}
                        </div>
                    </div>
                ),
                color: 'yellow',
                onClick: () => handlePinClick(c.CallId, 'Call')
            } as any);
        } else {
            markers.push({
                id: `${c.CallId}_legacy`,
                lat: Number(c.Latitude),
                lon: Number(c.Longitude),
                price: c.OfferPrice,
                title: `${t('pickup')} ($${c.OfferPrice})`,
                popupContent: (
                    <div>
                        <strong>{t('pickup')}</strong>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4CAF50', marginTop: 5 }}>
                            ${c.OfferPrice}
                        </div>
                    </div>
                ),
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
                    onBoundsChanged={handleBoundsChange}
                />

                {/* Overlays */}
                {!gender && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2000 }}>
                        <GenderSelection
                            onSelectGender={setGender}
                            onLogout={() => {
                                playSound('cancel');
                                auth.signOut();
                            }}
                        />
                    </div>
                )}

                {(gender && !role) && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2000 }}>
                        <RoleSelection
                            gender={gender}
                            onSelectRole={setRole}
                            onLogout={() => {
                                playSound('cancel');
                                auth.signOut();
                            }}
                        />
                    </div>
                )}

                {(role && !isConfirmed && !myCallId && !activeTx) && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2000 }}>
                        <PaymentSelection
                            paymentMethods={paymentMethod}
                            setPaymentMethods={setPaymentMethod}
                            onContinue={() => {
                                playSound('click');
                                setIsConfirmed(true);
                            }}
                            onLogout={() => {
                                playSound('cancel');
                                auth.signOut();
                            }}
                        />
                    </div>
                )}

                {/* Loading Indicator for Map (Non-blocking) */}
                {isLocating && (
                    <div style={{
                        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 1500, background: 'white', padding: '5px 15px', borderRadius: 20,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5
                    }}>
                        <div className="spinner" style={{ width: 12, height: 12, border: '2px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        {t('locating')}...
                    </div>
                )}

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
                {showMenu && <MenuDropdown onClose={() => setShowMenu(false)} />}

                {/* Overlay */}
                {activeTx && role && user && (
                    <NegotiationCard
                        activeTx={activeTx}
                        role={role}
                        activeCall={activeCall}
                        currentUserId={user.uid}
                        onMakeOffer={async (price) => {
                            if (!activeTx) return;
                            const myId = user.uid;
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
                            await createTransaction(updated);
                        }}
                        onAccept={handleAccept}
                        onCancel={() => {
                            if (confirm('Are you sure you want to cancel?')) {
                                if (activeTx.CallId) cancelCall(activeTx.CallId);
                                cancelTransaction(activeTx.TransactionId);
                            }
                        }}
                        onSubmitRating={async (rating) => {
                            await submitRating(activeTx, role, rating);
                            if (myLoc && user && role) {
                                const currentRating = await getUserRating(user.uid);
                                updateLocationWithRating(user.uid, myLoc.lat, myLoc.lon, role, gender, 4, 0, [], currentRating);
                            }
                            setActiveTx(null);
                            setActiveCall(null);
                            setMyCallId(null);
                            window.location.reload();
                        }}
                    />
                )}

                {/* Request Creation Modal - Redesigned */}
                <RequestModal
                    isOpen={showRequestModal}
                    onClose={() => setShowRequestModal(false)}
                    onSubmit={async (price) => {
                        // Logic from old submitRequest but adapted
                        if (!requestLoc) return;

                        const callId = crypto.randomUUID();
                        setMyCallId(callId);
                        const call: Call = {
                            CallId: callId,
                            InitiatorId: user!.uid,
                            InitiatorEmail: user!.email || '',
                            Latitude: myLoc.lat,
                            Longitude: myLoc.lon,
                            InitiatorType: 'Customer',
                            InitiatorGender: gender || undefined, // PASS GENDER HERE
                            PassengerCount: 1,
                            Status: 'Open',
                            OfferPrice: price,
                            DestLat: requestLoc.lat,
                            DestLon: requestLoc.lon,
                            CreatedAt: new Date().toISOString()
                        };
                        await createCall(call);
                        setShowRequestModal(false);
                    }}
                />
            </div>
        </div>
    );
};

export default MapPage;
