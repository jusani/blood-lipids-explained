// Build-time feature flags. The live build leaves them all off; `npm run build:photo` turns on the
// photo/PDF reading prototype (v2) in a separate test build (dist-photo/), never the live site.
// __PHOTO_READING__ is a literal true/false set in vite.config.ts, so the off build drops the code.
declare const __PHOTO_READING__: boolean;
export const photoReading: boolean = typeof __PHOTO_READING__ !== 'undefined' && __PHOTO_READING__;
