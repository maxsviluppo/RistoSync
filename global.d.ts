/// <reference types="vite/client" />

interface Window {
    webkitSpeechRecognition: any;
}

interface WindowEventMap {
    'storage-quota-exceeded': CustomEvent;
}
