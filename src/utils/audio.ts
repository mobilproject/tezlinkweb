// Cache to store preloaded Audio objects
const audioCache: Record<string, HTMLAudioElement> = {};

// Helper to get base path
const getBasePath = () => import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export const preloadSounds = () => {
    const basePath = getBasePath();
    const sounds = [
        // Welcome
        'welcome_1.wav', 'welcome_2.wav', 'welcome_3.wav',
        'welcome_4.wav', 'welcome_5.wav', 'welcome_6.wav',
        // Alerts
        'alert_1.wav',
        // Success
        'success_1.wav', 'success_2.wav',
        // Notifications
        'notification_1.wav',
        // Cancel
        'cancel_1.wav', 'cancel_2.wav'
    ];

    console.log('[Audio] Preloading sounds...');
    sounds.forEach(filename => {
        const audio = new Audio(`${basePath}sounds/${filename}`);
        audio.preload = 'auto'; // Hint to browser
        // Force load logic if strict preloading is needed, but just creating the component usually works in modern browsers
        audioCache[filename] = audio;
    });
};

export const playSound = (soundName: 'welcome' | 'new_request' | 'success' | 'notification' | 'cancel' | 'click') => {
    // Mapping for VARIATIONS
    let fileName = '';

    // Helper for random choice
    const pick = (prefix: string, count: number) => {
        const num = Math.floor(Math.random() * count) + 1;
        return `${prefix}_${num}.wav`;
    };

    switch (soundName) {
        case 'welcome':
            fileName = pick('welcome', 6);
            break;
        case 'new_request':
            fileName = 'alert_1.wav';
            break;
        case 'success':
            fileName = pick('success', 2);
            break;
        case 'notification':
            fileName = 'notification_1.wav';
            break;
        case 'cancel':
            fileName = pick('cancel', 2);
            break;
        case 'click':
            fileName = 'notification_1.wav';
            break;
    }

    // Attempt to play from cache or fallback
    let audio = audioCache[fileName];
    if (!audio) {
        console.warn(`[Audio] Sound ${fileName} not in cache, loading on the fly.`);
        const basePath = getBasePath();
        audio = new Audio(`${basePath}sounds/${fileName}`);
    } else {
        // Clone node implies generic HTML element clone, might not be efficient for Audio API instant reuse.
        // Better: Reset currentTime and play the same instance, OR clone if overlapping sounds are needed.
        // For interface sounds, overlapping is rare or fine to cut off.
        // But for rapid clicks, cloning is better.
        // Let's optimize: Just .play() allows overlapping? No, it restarts or continues.
        // Simple clone for overlap support:
        // audio = audio.cloneNode() as HTMLAudioElement; 
        // Actually, let's keep it simple: reset time. If we need overlap (spamming click), we might need cloning.
        audio.currentTime = 0;
    }

    audio.play().catch(e => {
        console.warn("[Audio] Play failed:", e);
    });
};
