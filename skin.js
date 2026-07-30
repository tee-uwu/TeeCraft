import * as THREE from 'three';
import { supabase, getCurrentUser } from './auth.js';

// ─── Minecraft 64x64 Skin UV Layout ──────────────────────────────────────────
// BoxGeometry face order: +X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back)
// Each entry: [srcX, srcY, srcW, srcH] in 64x64 skin pixels

const SKIN_SIZE = 64;

const HEAD_UVS = [
    [16, 8,  8, 8],  // right
    [0,  8,  8, 8],  // left
    [8,  0,  8, 8],  // top
    [16, 0,  8, 8],  // bottom (unused top-bottom hat)
    [8,  8,  8, 8],  // front (FACE) ← the important one
    [24, 8,  8, 8],  // back
];

const BODY_UVS = [
    [28, 20, 4, 12],
    [16, 20, 4, 12],
    [20, 16, 8, 4],
    [28, 16, 8, 4],
    [20, 20, 8, 12],  // front
    [32, 20, 8, 12],
];

const RIGHT_ARM_UVS = [
    [44, 20, 4, 12],
    [40, 20, 4, 12],
    [44, 16, 4, 4],
    [48, 16, 4, 4],
    [44, 20, 4, 12],  // front
    [48, 20, 4, 12],
];

const LEFT_ARM_UVS = [ // Mirrored for new-style skins (64x64)
    [36, 52, 4, 12],
    [32, 52, 4, 12],
    [36, 48, 4, 4],
    [40, 48, 4, 4],
    [36, 52, 4, 12],
    [40, 52, 4, 12],
];

const RIGHT_LEG_UVS = [
    [4, 20, 4, 12],
    [0, 20, 4, 12],
    [4, 16, 4, 4],
    [8, 16, 4, 4],
    [4, 20, 4, 12],  // front
    [8, 20, 4, 12],
];

const LEFT_LEG_UVS = [
    [20, 52, 4, 12],
    [16, 52, 4, 12],
    [20, 48, 4, 4],
    [24, 48, 4, 4],
    [20, 52, 4, 12],
    [24, 52, 4, 12],
];

// ─── Skin Texture Builder ─────────────────────────────────────────────────────
function extractFaceTex(img, sx, sy, sw, sh) {
    const SCALE = 4;
    const c = document.createElement('canvas');
    c.width = sw * SCALE;
    c.height = sh * SCALE;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * SCALE, sh * SCALE);
    return new THREE.CanvasTexture(c);
}

function makeMaterials(img, uvSet) {
    return uvSet.map(([sx, sy, sw, sh]) => {
        const tex = extractFaceTex(img, sx, sy, sw, sh);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return new THREE.MeshLambertMaterial({ map: tex });
    });
}

// Build a fully textured player group from a loaded Image element
export function buildSkinnedPlayer(img) {
    const group = new THREE.Group();

    // Head
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        makeMaterials(img, HEAD_UVS)
    );
    head.position.y = 1.4;
    group.add(head);

    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.3),
        makeMaterials(img, BODY_UVS)
    );
    body.position.y = 0.8;
    group.add(body);

    // Right Arm
    const rArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.65, 0.22),
        makeMaterials(img, RIGHT_ARM_UVS)
    );
    rArm.position.set(-0.36, 0.82, 0);
    group.add(rArm);

    // Left Arm
    const lArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.65, 0.22),
        makeMaterials(img, LEFT_ARM_UVS)
    );
    lArm.position.set(0.36, 0.82, 0);
    group.add(lArm);

    // Right Leg
    const rLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.75, 0.25),
        makeMaterials(img, RIGHT_LEG_UVS)
    );
    rLeg.position.set(-0.13, 0.08, 0);
    group.add(rLeg);

    // Left Leg
    const lLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.75, 0.25),
        makeMaterials(img, LEFT_LEG_UVS)
    );
    lLeg.position.set(0.13, 0.08, 0);
    group.add(lLeg);

    return group;
}

// Load an image from a URL or data URL and return HTMLImageElement
export function loadSkinImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load skin'));
        img.src = url;
    });
}

// ─── Supabase Skin Storage ────────────────────────────────────────────────────
// We store skin as base64 in user_metadata['skin_data'] (small PNG ≈3-8 KB base64)
// and also cache it in localStorage for instant offline loads.

const SKIN_LOCALSTORAGE_KEY = 'teecraft_skin_data';

export async function uploadSkin(file) {
    // Validate
    if (!file || !file.type.startsWith('image/')) return { error: 'Not an image file' };
    if (file.size > 512 * 1024) return { error: 'Skin file too large (max 512KB)' };

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;

            // Validate it's a proper image and resize to 64x64
            const img = new Image();
            img.onload = async () => {
                // Draw onto a 64x64 canvas (accept various standard skin sizes)
                const canvas = document.createElement('canvas');
                canvas.width = 64; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, 64, 64);
                // Support both 64x32 legacy and 64x64 modern skins
                ctx.drawImage(img, 0, 0, 64, 64);
                const pngDataUrl = canvas.toDataURL('image/png');

                // Save to localStorage immediately for instant use
                localStorage.setItem(SKIN_LOCALSTORAGE_KEY, pngDataUrl);

                // Save to Supabase user_metadata
                const user = await getCurrentUser();
                if (user && supabase) {
                    try {
                        // Try Supabase Storage first (bucket: skins, path: userId/skin.png)
                        const blob = await (await fetch(pngDataUrl)).blob();
                        const path = `${user.id}/skin.png`;
                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('skins')
                            .upload(path, blob, {
                                contentType: 'image/png',
                                upsert: true
                            });

                        if (!uploadError) {
                            const { data: { publicUrl } } = supabase.storage
                                .from('skins')
                                .getPublicUrl(path);
                            // Also store the public URL in user_metadata for multiplayer
                            await supabase.auth.updateUser({
                                data: { skin_url: publicUrl, skin_data: pngDataUrl }
                            });
                            resolve({ success: true, url: publicUrl, dataUrl: pngDataUrl });
                            return;
                        }
                    } catch (_) { /* storage bucket may not exist, fall back */ }

                    // Fallback: store base64 in user_metadata directly
                    try {
                        await supabase.auth.updateUser({
                            data: { skin_data: pngDataUrl, skin_url: null }
                        });
                    } catch (err) {
                        console.warn('Skin metadata save failed:', err);
                    }
                }
                resolve({ success: true, url: null, dataUrl: pngDataUrl });
            };
            img.onerror = () => resolve({ error: 'Invalid image' });
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
}

export async function loadMySkin() {
    // 1. Check localStorage cache first (instant)
    const cached = localStorage.getItem(SKIN_LOCALSTORAGE_KEY);
    if (cached) return cached;

    // 2. Load from Supabase user metadata
    const user = await getCurrentUser();
    if (!user) return null;

    const meta = user.user_metadata || {};
    if (meta.skin_data) {
        localStorage.setItem(SKIN_LOCALSTORAGE_KEY, meta.skin_data);
        return meta.skin_data;
    }
    if (meta.skin_url) return meta.skin_url;
    return null;
}

export async function getMyMeta() {
    const user = await getCurrentUser();
    if (!user) return {};
    return user.user_metadata || {};
}

export function clearSkinCache() {
    localStorage.removeItem(SKIN_LOCALSTORAGE_KEY);
}
