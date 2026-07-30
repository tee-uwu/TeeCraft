// Small deterministic helpers so a world seed produces the same terrain,
// trees and ore veins every time it's regenerated (needed for save/load).

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashSeed(...parts) {
    // djb2-ish string hash -> 32bit int, used to derive a per-chunk seed
    const str = parts.join('_');
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
}

export function randomSeed() {
    return Math.floor(Math.random() * 2147483647);
}
