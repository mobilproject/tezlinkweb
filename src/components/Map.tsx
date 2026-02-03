import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Custom Images
import carIcon from '../assets/car_marker.png';
import userIcon from '../assets/user_marker.png';
import pinIcon from '../assets/pin_marker.png';

let DefaultIcon = L.icon({
    iconUrl: pinIcon, // Default to pin
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper to center map
const RecenterMap = ({ lat, lon }: { lat: number; lon: number }) => {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lon], map.getZoom());
    }, [lat, lon, map]);
    return null;
};

// Helper for clicks
const MapEvents = ({ onClick }: { onClick: (lat: number, lon: number) => void }) => {
    useMapEvents({
        click(e) {
            onClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

interface MapProps {
    centerLat: number;
    centerLon: number;
    zoom?: number;
    markers: Array<{
        id: string;
        lat: number;
        lon: number;
        title?: string;
        price?: number;
        color?: 'red' | 'green' | 'blue' | 'yellow'; // Simple color mapping
        userType?: string;
        isMe?: boolean;
        paymentMethods?: string[];
        onClick?: () => void;
    }>;
    onMapClick?: (lat: number, lon: number) => void;
}

const Map: React.FC<MapProps> = ({ centerLat, centerLon, zoom = 13, markers, onMapClick }) => {
    return (
        <MapContainer center={[centerLat, centerLon]} zoom={zoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterMap lat={centerLat} lon={centerLon} />
            {onMapClick && <MapEvents onClick={onMapClick} />}

            {markers.map(m => {
                let markerIcon;
                if (m.price) {
                    // Price Tag Marker (Pin + Text)
                    markerIcon = L.divIcon({
                        className: 'custom-price-marker',
                        html: `
                            <div style="position: relative; width: 40px; height: 40px;">
                                <img src="${pinIcon}" style="width: 100%; height: 100%;" />
                                <div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); background: #ffeb3b; color: black; padding: 2px 6px; border-radius: 8px; font-weight: bold; border: 1px solid #333; font-size: 12px; white-space: nowrap;">
                                    $${m.price}
                                </div>
                            </div>
                        `,
                        iconSize: [40, 40],
                        iconAnchor: [20, 40]
                    });
                } else if (m.userType) {
                    // Custom User/Driver Marker with Payment Icon
                    const isCar = m.userType === 'Driver';
                    const icon = isCar ? '🚖' : '🧕';

                    let payIcons = '';
                    if (m.paymentMethods) {
                        if (m.paymentMethods.includes('Cash')) payIcons += '💵';
                        if (m.paymentMethods.includes('Click')) payIcons += '🟦';
                        if (m.paymentMethods.includes('Payme')) payIcons += '🟩';
                    }

                    markerIcon = L.divIcon({
                        className: 'custom-user-marker',
                        html: `
                            <div style="position: relative; width: 40px; height: 40px; display: flex; flex-direction: column; align-items: center;">
                                <div style="background: white; padding: 4px; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; gap: 2px;">
                                    <span>${icon}</span>
                                    ${payIcons ? `<span style="font-size: 14px; letter-spacing: -2px;">${payIcons}</span>` : ''}
                                </div>
                                <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid white; margin-top: -1px;"></div>
                                ${m.isMe ? `
                                    <div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); background: black; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap;">
                                        You
                                    </div>
                                ` : ''}
                            </div>
                        `,
                        iconSize: [40, 40],
                        iconAnchor: [20, 40], // Anchor to the bottom of the pin
                        popupAnchor: [0, -40]
                    });
                }
                else {
                    // Car or User Marker (original logic)
                    const isDriver = m.color === 'green';
                    const img = isDriver ? carIcon : userIcon;

                    markerIcon = L.icon({
                        iconUrl: img,
                        iconSize: [40, 40], // Adjust based on aspect ratio of generated image
                        iconAnchor: [20, 20],
                        popupAnchor: [0, -20]
                    });
                }

                return (
                    <Marker
                        key={m.id}
                        position={[m.lat, m.lon]}
                        icon={markerIcon}
                        eventHandlers={{
                            click: () => m.onClick && m.onClick(),
                        }}
                    >
                        {m.title && <Popup>{m.title}</Popup>}
                    </Marker>
                );
            })}
        </MapContainer>
    );
};

export default Map;
