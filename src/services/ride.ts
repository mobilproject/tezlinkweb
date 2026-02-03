import {
    ref,
    set,
    onValue,
    query,
    orderByChild,
    equalTo,
    get,
    remove,
} from 'firebase/database';
import { collection, addDoc } from 'firebase/firestore';
import { database, firestore } from './firebase';
import type { Call, Transaction, UserLocation } from '../types';

// HISTORY
export const recordRideHistory = async (tx: Transaction, call?: Call) => {
    try {
        const historyRef = collection(firestore, 'ride_history');
        // Combine Tx and Call data for a complete record
        const record = {
            // IDs
            TransactionId: tx.TransactionId,
            CustomerId: tx.CustomerId,
            DriverId: tx.DriverId,

            // Financials
            Price: tx.Price,
            Status: 'Agreed', // Explicitly marking as the agreed point

            // Locations (Snapshot at Agreement)
            StartLat: call?.Latitude ?? 0,
            StartLon: call?.Longitude ?? 0,
            DestLat: call?.DestLat ?? 0,
            DestLon: call?.DestLon ?? 0,

            // Metadata
            RecordedAt: new Date().toISOString(),
            OriginalCallId: tx.CallId
        };
        await addDoc(historyRef, record);
        console.log('[RideService] Ride History Recorded:', tx.TransactionId);
    } catch (e) {
        console.error('[RideService] Failed to record history:', e);
    }
};

// LOCATIONS
export const updateLocation = async (userId: string, lat: number, lon: number, type: string, seats: number = 0, pax: number = 0, paymentMethods: string[] = []) => {
    const locRef = ref(database, `locations/${userId}`);
    const data: UserLocation = {
        UserId: userId,
        Latitude: lat,
        Longitude: lon,
        UserType: type,
        AvailableSeats: seats,
        PassengerCount: pax,
        PaymentMethods: paymentMethods,
        LastUpdated: new Date().toISOString()
    };
    await set(locRef, data);
};

export const updateLocationWithRating = async (userId: string, lat: number, lon: number, type: string, seats: number = 0, pax: number = 0, paymentMethods: string[] = [], rating: number = 5.0) => {
    const locRef = ref(database, `locations/${userId}`);
    const data: UserLocation = {
        UserId: userId,
        Latitude: lat,
        Longitude: lon,
        UserType: type,
        AvailableSeats: seats,
        PassengerCount: pax,
        PaymentMethods: paymentMethods,
        Rating: rating,
        LastUpdated: new Date().toISOString()
    };
    await set(locRef, data);
};

// USER PROFILES & RATINGS
export const getUserRating = async (userId: string): Promise<number> => {
    try {
        const snap = await get(ref(database, `users/${userId}/rating`));
        return snap.val()?.average || 5.0; // Default to 5.0
    } catch {
        return 5.0;
    }
};

export const submitRating = async (tx: Transaction, raterRole: 'Driver' | 'Customer', rating: number) => {
    // 1. Update Transaction
    const txRef = ref(database, `transactions/${tx.TransactionId}`);
    const updatedTx = { ...tx };
    if (raterRole === 'Driver') {
        updatedTx.CustomerRating = rating; // Driver rates Customer
    } else {
        updatedTx.DriverRating = rating; // Customer rates Driver
    }
    await set(txRef, updatedTx);

    // 2. Update Target User Profile (Aggregate)
    const targetUserId = raterRole === 'Driver' ? tx.CustomerId : tx.DriverId;
    const userRatingRef = ref(database, `users/${targetUserId}/rating`);

    // Concurrency Warning: This is a simple read-modify-write. 
    // In high volume, use a Transaction (firebase/database transaction), but for prototype this is fine.
    const snap = await get(userRatingRef);
    const current = snap.val() || { average: 5.0, count: 0 };

    const newCount = (current.count || 0) + 1;
    // Weighted Average
    const newAverage = ((current.average || 5.0) * (current.count || 0) + rating) / newCount;

    await set(userRatingRef, {
        average: newAverage,
        count: newCount
    });

    return newAverage;
};

export const observeUserLocations = (typeToWatch: string, callback: (locs: UserLocation[]) => void) => {
    const locationsRef = ref(database, 'locations');
    // Simple listener, filtering client side because RTDB query capabilities are limited for multiple fields
    return onValue(locationsRef, (snapshot) => {
        const val = snapshot.val();
        if (!val) {
            console.log('[RideService] No Locations found.');
            callback([]);
            return;
        }
        const all = Object.values(val) as UserLocation[];
        // Filter by Type AND Stale (> 5 mins)
        const now = new Date();
        const filtered = all.filter(u => {
            if (u.UserType !== typeToWatch) return false;

            const lastUpdate = new Date(u.LastUpdated);
            const diffMins = (now.getTime() - lastUpdate.getTime()) / 60000;
            return diffMins < 5; // Active only
        });

        console.log(`[RideService] Locations: Raw=${all.length} Filtered=${filtered.length}`);
        callback(filtered);
    });
};

// CALLS
export const createCall = async (call: Call) => {
    console.log('[RideService] Creating Call:', call.CallId);
    const callRef = ref(database, `calls/${call.CallId}`);
    await set(callRef, call);
};

// CRITERIA EXPLANATION:
// 1. Firebase "onValue" sends ALL data at that path immediately upon connection.
//    - If there are 50 old calls, we get 50 old calls instantly.
// 2. "Sticking to Latest Data" requires us to FILTER out the noise.
// 3. We rely on two main Criteria:
//    a) TIME: Data older than X minutes is ignored (assumed abandoned).
//    b) ID: Once we start a flow, we listen to *specific* IDs (e.g. observeCall(myId)), ignoring the global list.

export const observeCalls = (callback: (calls: Call[]) => void) => {
    console.log('[RideService] Observing Calls...');
    // QUERY: We ask Firebase for calls where Status == 'Open'
    // LIMITATION: Firebase RTDB can only filter by ONE property (Status). It cannot filter by 'Time' AND 'Status' simultaneously.
    const callsRef = query(ref(database, 'calls'), orderByChild('Status'), equalTo('Open'));

    return onValue(callsRef, (snapshot) => {
        const val = snapshot.val();
        if (!val) {
            console.log('[RideService] No Open Calls.');
            callback([]);
            return;
        }
        const list = Object.values(val) as Call[];

        // CLIENT-SIDE FILTERING (The "Criteria"):
        // We receive ALL 'Open' calls, even ones from yesterday.
        // We must manually check the 'CreatedAt' timestamp.
        const now = new Date();
        const activeList = list.filter(c => {
            // Fallback: If no date, assume it's new (or risk hiding valid data) - though in prod we might assume old.
            const created = c.CreatedAt ? new Date(c.CreatedAt) : new Date();

            // CRITERIA: A call is "Stale" if created > 12 hours ago.
            const diffHours = (now.getTime() - created.getTime()) / 3600000;
            return diffHours < 12;
        });

        console.log(`[RideService] Calls Update: Raw=${list.length} Active=${activeList.length}`);
        callback(activeList);
    });
};

// PRECISE OBSERVATION:
// Once we know the specific ID (from the map click), we ignore the list
// and listen ONLY to this specific node. This is the source of truth for the transaction.
export const observeCall = (callId: string, callback: (call: Call | null) => void) => {
    const callRef = ref(database, `calls/${callId}`);
    return onValue(callRef, (snapshot) => {
        callback(snapshot.val() as Call | null);
    });
};

export const acceptCall = async (callId: string, acceptorId: string, txId: string) => {
    const callRef = ref(database, `calls/${callId}`);
    try {
        const snapshot = await get(callRef);
        const call = snapshot.val() as Call;
        if (call && call.Status === 'Open') {
            await set(callRef, { ...call, Status: 'Accepted', AcceptedBy: acceptorId, TransactionId: txId });
            return true;
        }
        return false;
    } catch (e) {
        console.error("Accept Call failed", e);
        return false;
    }
};

export const getCall = async (callId: string): Promise<Call | null> => {
    try {
        const snapshot = await get(ref(database, `calls/${callId}`));
        return snapshot.val() as Call | null;
    } catch {
        return null;
    }
};


// TRANSACTIONS
export const createTransaction = async (tx: Transaction) => {
    const txRef = ref(database, `transactions/${tx.TransactionId}`);
    await set(txRef, tx);
};

export const observeTransaction = (txId: string, callback: (tx: Transaction | null) => void) => {
    const txRef = ref(database, `transactions/${txId}`);
    return onValue(txRef, (snapshot) => {
        callback(snapshot.val() as Transaction | null);
    });
};

// CANCELLATION
export const cancelCall = async (callId: string) => {
    const callRef = ref(database, `calls/${callId}`);
    try {
        const snapshot = await get(callRef);
        const call = snapshot.val() as Call;
        if (call) {
            await set(callRef, { ...call, Status: 'Cancelled' });
        }
    } catch (e) {
        console.error("Cancel Call failed", e);
    }
};

export const cancelTransaction = async (txId: string) => {
    const txRef = ref(database, `transactions/${txId}`);
    try {
        const snapshot = await get(txRef);
        const tx = snapshot.val() as Transaction;
        if (tx) {
            await set(txRef, { ...tx, Status: 'Cancelled' });
        }
    } catch (e) {
        console.error("Cancel Tx failed", e);
    }
};

// PERSISTENCE HELPER
export const findActiveCall = async (userId: string, role: 'Driver' | 'Customer'): Promise<Call | null> => {
    // 1. Get all calls (we have to client-side filter due to RTDB limits or lack of complex index)
    // Optimization: In a real app we'd index on InitiatorId or AcceptedBy.
    try {
        const snapshot = await get(ref(database, 'calls'));
        const val = snapshot.val();
        if (!val) return null;

        const allCalls = Object.values(val) as Call[];

        // Find a generic open/accepted call for this user
        // Customer: Im the initiator
        // Driver: Im the Acceptor
        const found = allCalls.find(c => {
            const isMyCall = role === 'Customer' ? c.InitiatorId === userId : c.AcceptedBy === userId;
            const isActive = c.Status === 'Open' || c.Status === 'Accepted';
            // Also ignore stale ones > 12h
            const created = c.CreatedAt ? new Date(c.CreatedAt) : new Date();
            const diffHours = (new Date().getTime() - created.getTime()) / 3600000;

            return isMyCall && isActive && diffHours < 12;
        });

        return found || null;
    } catch {
        return null;
    }
};

// CLEANUP
export const clearDatabase = async () => {
    console.log('[RideService] Clearing Database...');
    await remove(ref(database, 'calls'));
    await remove(ref(database, 'transactions'));
    console.log('[RideService] Database Cleared');
};
