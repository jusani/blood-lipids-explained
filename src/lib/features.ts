// Build-time feature flags. Photo/PDF reading is on by default (testing mode, Justina 2026-10-12);
// `npm run build:nophoto` makes a build without it.
// __PHOTO_READING__ is a literal true/false set in vite.config.ts, so the off build drops the code.
declare const __PHOTO_READING__: boolean;
export const photoReading: boolean = typeof __PHOTO_READING__ !== 'undefined' && __PHOTO_READING__;
