import * as THREE from 'three';
import { supabase, getCurrentUser } from './auth.js';

export class MultiplayerManager {
    constructor(scene, world, player) {
        this.scene = scene;
        this.world = world;
        this.player = player;
        this.remotePlayers = new Map(); // userId -> { mesh, nameTag, targetPos, targetRot, lastSeen }
        this.channel = null;
        this.currentUser = null;
        this.updateInterval = 0;

        this.init();
    }

    async init() {
        this.currentUser = await getCurrentUser();
        if (!this.currentUser || !supabase) return;

        const userId = this.currentUser.id;
        const userName = this.currentUser.email ? this.currentUser.email.split('@')[0] : 'Player';

        // Connect to Supabase Realtime Channel
        this.channel = supabase.channel('teecraft_multiplayer', {
            config: {
                presence: { key: userId }
            }
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

        // Listen for presence sync (players joining / leaving)
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

    broadcastMove() {
        if (!this.channel || !this.currentUser) return;
        const pos = this.player.camera.position;
        const rot = this.player.camera.rotation;

        this.channel.send({
            type: 'broadcast',
            event: 'player-move',
            payload: {
                id: this.currentUser.id,
                name: this.currentUser.email ? this.currentUser.email.split('@')[0] : 'Player',
                x: pos.x,
                y: pos.y,
                z: pos.z,
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
            payload: {
                id: this.currentUser.id,
                x, y, z, blockType, action
            }
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

        // Steve / Alex Body Parts
        const skinMat = new THREE.MeshLambertMaterial({ color: 0x3a6b35 });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.4;
        group.add(head);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        const body = new THREE.Mesh(bodyGeo, shirtMat);
        body.position.y = 0.8;
        group.add(body);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.25);
        const legL = new THREE.Mesh(legGeo, pantsMat);
        legL.position.set(-0.13, 0.08, 0);
        const legR = new THREE.Mesh(legGeo, pantsMat);
        legR.position.set(0.13, 0.08, 0);
        group.add(legL);
        group.add(legR);

        // Floating 3D Name Tag Canvas Sprite
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = '#55ffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 60);
        ctx.font = 'bold 24px monospace';
        ctx.fillStyle = '#55ffff';
        ctx.textAlign = 'center';
        ctx.fillText(name, 128, 42);

        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const nameSprite = new THREE.Sprite(spriteMat);
        nameSprite.position.y = 1.95;
        nameSprite.scale.set(2.0, 0.5, 1);
        group.add(nameSprite);

        return {
            group,
            targetPos: new THREE.Vector3(),
            targetRotY: 0,
            lastSeen: Date.now()
        };
    }

    update(dt) {
        if (!this.currentUser) return;

        // Broadcast player location every 100ms
        this.updateInterval += dt;
        if (this.updateInterval > 0.08) {
            this.updateInterval = 0;
            this.broadcastMove();
        }

        // Interpolate remote player positions smoothly
        const now = Date.now();
        for (const [id, remote] of this.remotePlayers.entries()) {
            if (now - remote.lastSeen > 12000) {
                this.removeRemotePlayer(id);
                continue;
            }

            remote.group.position.lerp(remote.targetPos, dt * 10);
            remote.group.rotation.y = THREE.MathUtils.lerp(remote.group.rotation.y, remote.targetRotY, dt * 10);
        }
    }
}
