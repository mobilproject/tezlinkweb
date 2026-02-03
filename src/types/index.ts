export type UserRole = 'Driver' | 'Customer';

export interface UserLocation {
    UserId: string;
    Latitude: number;
    Longitude: number;
    UserType: string;
    AvailableSeats: number;
    PassengerCount: number;
    PaymentMethods?: string[];
    Rating?: number; // 0-5
    LastUpdated: string; // ISO Date
}

export interface Call {
    CallId: string;
    InitiatorId: string;
    InitiatorEmail?: string;
    InitiatorName?: string;
    Latitude: number;
    Longitude: number;
    InitiatorType: string;
    PassengerCount: number;
    Status: 'Open' | 'Accepted' | 'Completed' | 'Cancelled';
    AcceptedBy?: string;
    TransactionId?: string;
    OfferPrice?: number;
    DestLat?: number;
    DestLon?: number;
    CreatedAt: string; // ISO Date
}

export interface Transaction {
    TransactionId: string;
    CallId?: string; // Added for traceability
    DriverId: string;
    CustomerId: string;
    Status: 'Negotiating' | 'Agreed' | 'Completed' | 'Cancelled';
    Price: number;
    DriverRating: number;
    CustomerRating: number;
    DriverAcceptedPrice: boolean;
    CustomerAcceptedPrice: boolean;
    CreatedAt: string; // ISO Date
}
