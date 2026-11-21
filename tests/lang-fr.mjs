// Loaded before every test (npm test: node --import): the app in French, as the tests read
// the French texts — whatever the language of the machine (the CI runs in English).
Object.defineProperty(globalThis, 'navigator', { value: { language: 'fr-FR', languages: ['fr-FR'] }, configurable: true, writable: true });
