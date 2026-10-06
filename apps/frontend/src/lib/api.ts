/**
 * Client demo build: data comes from the in-browser demo store and no
 * network request is made. Only an explicit VITE_DEMO_MODE=false switches
 * the app to the real backend.
 */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE !== 'false';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';
