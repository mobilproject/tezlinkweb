export const playSound = (soundName: 'welcome' | 'new_request' | 'success' | 'notification' | 'cancel' | 'click') => {
    // Vite base path logic
    const basePath = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

    // Mapping for VARIATIONS (Simple Random or Sequential logic could go here)
    // For now, let's map the generic names to the specific files the user provided
    // to ensure they hear the "cool sounds" they added.

    // TODO: In the future, we can add a 'category' or 'theme' param to this function
    // and select different sets of sounds.

    let fileName = '';

    // Helper for random choice
    const pick = (prefix: string, count: number) => {
        const num = Math.floor(Math.random() * count) + 1;
        return `${prefix}_${num}.wav`;
    };

    switch (soundName) {
        case 'welcome':
            // we have welcome_1 to welcome_6
            fileName = pick('welcome', 6);
            break;
        case 'new_request':
            // we have alert_1
            fileName = 'alert_1.wav';
            break;
        case 'success':
            // we have success_1, success_2
            fileName = pick('success', 2);
            break;
        case 'notification':
            // notification_1
            fileName = 'notification_1.wav';
            break;
        case 'cancel':
            // cancel_1, cancel_2
            fileName = pick('cancel', 2);
            break;
        case 'click':
            // reusing notification_1 as a neutral click sound for now, or could use a distinct one if available
            fileName = 'notification_1.wav';
            break;
    }

    const audio = new Audio(`${basePath}sounds/${fileName}`);

    // Force reset if needed, though 'new Audio' creates fresh instance.
    audio.currentTime = 0;

    audio.play().catch(e => {
        // User Interaction Requirement: Browsers block auto-play. 
        // We log it. The welcome sound might fail if no interaction happened yet.
        // Subsequent sounds (after clicks) should work.
        console.warn("[Audio] Play failed (likely no interaction):", e);
    });
};
