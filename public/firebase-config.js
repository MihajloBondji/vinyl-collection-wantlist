// Firebase Configuration and Initialization
// For production: Get values from Firebase Console → Project Settings → Your apps
// For local emulator: Use placeholder values below

const firebaseConfig = {
    apiKey: "AIzaSyTestKeyForLocalDevelopment",
    authDomain: "localhost",
    projectId: "vinyl-collection-wantlist",
    storageBucket: "vinyl-collection-wantlist.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    
    // Connect to local emulator if running locally (localhost or LAN IP)
    const host = location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    const isPrivateIP = host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');

    if (isLocalHost || isPrivateIP) {
        firebase.functions().useEmulator('localhost', 5001);
        console.log('Firebase: Using local emulator');
    }
    
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}
