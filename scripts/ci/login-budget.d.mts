export const WINDOW_SEC: number;
export const LIMIT: number;
export const HEADROOM: number;
export function secondsToWait(events: { t: number; n: number }[], now: number, need: number, opts?: { windowSec?: number; limit?: number; headroom?: number }): number;
