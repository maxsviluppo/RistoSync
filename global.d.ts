
export { };

declare global {
    interface Window {
        webkitSpeechRecognition: any;
    }
    interface WindowEventMap {
        'storage-quota-exceeded': CustomEvent;
    }
}
