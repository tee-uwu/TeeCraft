import * as THREE from 'three';
import { supabase, getCurrentUser } from './auth.js';

// ─── Chat System ──────────────────────────────────────────────────────────────
const CHAT_VISIBLE_MS = 6000; // how long a message floats above head

function addChatMessage(author, text, isLocal = false) {
    const log = document.getElementById('chat-log');
    if (!log) return;

    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<span class="chat-author">${isLocal ? '🟢' : '🔵'} ${escHtml(author)}:</span>${escHtml(text)}`;
    log.appendChild(el);

    // Fade out and remove after timeout
    setTimeout(() => { el.style.opacity = '0'; }, CHAT_VISIBLE_MS - 600);
    setTimeout(() => { el.remove(); }, CHAT_VISIBLE_MS);

    // Keep only last 8 messages visible
    while (log.children.length > 8) log.removeChild(log.firstChild);
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Speech Bubble canvas helper ─────────────────────────────────────────────
function makeSpeechBubble(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);

    // Bubble background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, 8, 8, 496, 90, 16);
    ctx.fill();
    ctx.strokeStyle = '#55ffff';
    ctx.lineWidth = 4;
    roundRect(ctx, 8, 8, 496, 90, 16);
    ctx.stroke();

    // Tail
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.moveTo(240, 96); ctx.lineTo(272, 96); ctx.lineTo(256, 120);
    ctx.closePath(); ctx.fill();

    // Text
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Word-wrap at ~40 chars
    const maxW = 460;
    let line = text.length > 36 ? text.slice(0, 33) + '…' : text;
    ctx.fillText(line, 256, 52);

    return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ─── Multiplayer Manager ──────────────────────────────────────────────────────
export class MultiplayerManager {
    constructor(scene, world, player) {
        this.scene = scene;
        this.world = world;
        this.player = player;
        this.remotePlayers = new Map(); // userId -> { group, nameSprite, bubbleSprite, targetPos, targetRotY, lastSeen, bubbleTimer }
        this.channel = null;
        this.currentUser = null;
        this.updateInterval = 0;

        this._initChatUI();
        this.init();
    }

    _initChatUI() {
        const chatBar   = document.getElementById('chat-bar');
        const chatInput = document.getElementById('chat-input');
        if (!chatBar || !chatInput) return;

        // Press T to open chat (only while game is running / pointer locked)
        document.addEventListener('keydown', (e) => {
            // Don't intercept if console or other modal is open
            if (!chatBar.classList.contains('hidden')) return;
            if (e.code === 'KeyT' && document.pointerLockElement) {
                e.preventDefault();
                document.exitPointerLock();
                chatBar.classList.remove('hidden');
                chatInput.value = '';
                chatInput.focus();
            }
        });

        // Esc closes chat
        chatInput.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                chatBar.classList.add('hidden');
                chatInput.value = '';
            }
            if (e.code === 'Enter') {
                e.preventDefault();
                const msg = chatInput.value.trim();
                chatBar.classList.add('hidden');
                chatInput.value = '';
                if (msg) this.sendChat(msg);
            }
        });
    }

    async init() {
        this.currentUser = await getCurrentUser();
        if (!this.currentUser || !supabase) return;

        const userId   = this.currentUser.id;
        const userName = this.currentUser.email ? this.currentUser.email.split('@')[0] : 'Player';
        this.userName  = userName;

        this.channel = supabase.channel('teecraft_multiplayer', {
            config: { presence: { key: userId } }
        });

        // Listen for player movement broadcasts
        this.channel.on('broadcast', { event: 'player-move' }, ({ payload }) => {
            if (payload.id === userId) return;
            this.updateRemotePlayer(payload);
        });

        // Listen for block changes
        this.channel.on('broadcast', { event: 'block-change' }, ({ payload }) => {
            if (payload.id === userId) return;
            if (payload.action === 'set') {
                this.world.setBlockRaw(payload.x, payload.y, payload.z, payload.blockType);
            }
        });

        // 💬 Listen for chat messages
        this.channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
            if (payload.id === userId) return;
            addChatMessage(payload.name, payload.text, false);
            this._showBubble(payload.id, payload.text);
        });

        // Presence leave
        this.channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
            for (const p of leftPresences) {
                if (p.key) this.removeRemotePlayer(p.key);
            }
        });

        this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await this.channel.track({
                    id: userId,
                    name: userName,
                    online_at: new Date().toISOString()
                });
            }
        });
    }

    // ── Chat ─────────────────────────────────────────────────────────────────
    sendChat(text) {
        if (!text || !this.channel || !this.currentUser) return;
        const name = this.userName || 'Player';

        // Show locally in chat log
        addChatMessage(name, text, true);

        // Show bubble above own head (via a temporary DOM sprite at screen center-top)
        this._showLocalBubble(text);

        // Broadcast to others
        this.channel.send({
            type: 'broadcast',
            event: 'chat',
            payload: { id: this.currentUser.id, name, text }
        });
    }

    _showLocalBubble(text) {
        // Show as a floating UI label above crosshair for the local player
        let localBubble = document.getElementById('local-chat-bubble');
        if (!localBubble) {
            localBubble = document.createElement('div');
            localBubble.id = 'local-chat-bubble';
            localBubble.style.cssText = `
                position: absolute;
                bottom: 56%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.75);
                border: 2px solid #55ffff;
                border-radius: 8px;
                padding: 6px 14px;
                color: #fff;
                font-family: 'Silkscreen', monospace;
                font-size: 12px;
                z-index: 1800;
                pointer-events: none;
                white-space: nowrap;
                max-width: 340px;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            document.getElementById('game-ui')?.appendChild(localBubble);
        }
        localBubble.textContent = `💬 ${text}`;
        localBubble.style.display = 'block';
        clearTimeout(localBubble._timeout);
        localBubble._timeout = setTimeout(() => {
            localBubble.style.display = 'none';
        }, CHAT_VISIBLE_MS);
    }

    _showBubble(userId, text) {
        const remote = this.remotePlayers.get(userId);
        if (!remote) return;

        // Update or create the speech bubble sprite above the player
        if (remote.bubbleSprite) {
            remote.group.remove(remote.bubbleSprite);
            remote.bubbleSprite.material.map.dispose();
            remote.bubbleSprite.material.dispose();
        }

        const canvas = makeSpeechBubble(text);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.position.y = 2.8;
        sprite.scale.set(3.0, 0.75, 1);
        remote.group.add(sprite);
        remote.bubbleSprite = sprite;
        remote.bubbleTimer = CHAT_VISIBLE_MS / 1000;
    }

    // ── Movement ─────────────────────────────────────────────────────────────
    broadcastMove() {
        if (!this.channel || !this.currentUser) return;
        const pos = this.player.camera.position;
        const rot = this.player.camera.rotation;
        this.channel.send({
            type: 'broadcast',
            event: 'player-move',
            payload: {
                id: this.currentUser.id,
                name: this.userName || 'Player',
                x: pos.x, y: pos.y, z: pos.z,
                rotY: rot.y,
                heldItem: this.player.getActiveItemId()
            }
        });
    }

    broadcastBlockChange(x, y, z, blockType, action = 'set') {
        if (!this.channel || !this.currentUser) return;
        this.channel.send({
            type: 'broadcast',
            event: 'block-change',
            payload: { id: this.currentUser.id, x, y, z, blockType, action }
        });
    }

    updateRemotePlayer(data) {
        let remote = this.remotePlayers.get(data.id);
        if (!remote) {
            remote = this.createPlayerMesh(data.name || 'Player');
            this.remotePlayers.set(data.id, remote);
            this.scene.add(remote.group);
        }
        remote.targetPos.set(data.x, data.y - 1.2, data.z);
        remote.targetRotY = data.rotY;
        remote.lastSeen = Date.now();
    }

    removeRemotePlayer(id) {
        const remote = this.remotePlayers.get(id);
        if (remote) {
            this.scene.remove(remote.group);
            this.remotePlayers.delete(id);
        }
    }

    createPlayerMesh(name) {
        const group = new THREE.Group();

        const skinMat  = new THREE.MeshLambertMaterial({ color: 0x3a6b35 });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
        head.position.y = 1.4;
        group.add(head);

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), shirtMat);
        body.position.y = 0.8;
        group.add(body);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.25);
        const legL = new THREE.Mesh(legGeo, pantsMat);
        legL.position.set(-0.13, 0.08, 0);
        const legR = new THREE.Mesh(legGeo, pantsMat);
        legR.position.set(0.13, 0.08, 0);
        group.add(legL, legR);

        // Nametag sprite
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = '#55ffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 60);
        ctx.font = 'bold 24px monospace';
        ctx.fillStyle = '#55ffff';
        ctx.textAlign = 'center';
        ctx.fillText(name, 128, 42);

        const tex = new THREE.CanvasTexture(canvas);
        const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        nameSprite.position.y = 1.95;
        nameSprite.scale.set(2.0, 0.5, 1);
        group.add(nameSprite);

        return {
            group,
            nameSprite,
            bubbleSprite: null,
            bubbleTimer: 0,
            targetPos: new THREE.Vector3(),
            targetRotY: 0,
            lastSeen: Date.now()
        };
    }

    update(dt) {
        if (!this.currentUser) return;

        this.updateInterval += dt;
        if (this.updateInterval > 0.08) {
            this.updateInterval = 0;
            this.broadcastMove();
        }

        const now = Date.now();
        for (const [id, remote] of this.remotePlayers.entries()) {
            if (now - remote.lastSeen > 12000) {
                this.removeRemotePlayer(id);
                continue;
            }
            remote.group.position.lerp(remote.targetPos, dt * 10);
            remote.group.rotation.y = THREE.MathUtils.lerp(remote.group.rotation.y, remote.targetRotY, dt * 10);

            // Tick speech bubble timer
            if (remote.bubbleSprite && remote.bubbleTimer > 0) {
                remote.bubbleTimer -= dt;
                if (remote.bubbleTimer <= 0) {
                    remote.group.remove(remote.bubbleSprite);
                    remote.bubbleSprite.material.map.dispose();
                    remote.bubbleSprite.material.dispose();
                    remote.bubbleSprite = null;
                }
            }
        }
    }
}
