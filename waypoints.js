import * as THREE from 'three';

export class WaypointManager {
    constructor(scene) {
        this.scene = scene;
        this.waypoints = [];
        this.lastDistUpdate = 0;
        this.load();
    }

    addWaypoint(name, x, y, z, color = '#38bdf8', type = 'custom') {
        if (type === 'death') {
            this.removeDeathWaypoint();
        }

        const wp = {
            id: Date.now() + '_' + Math.floor(Math.random() * 1000),
            name,
            x: Math.round(x),
            y: Math.round(y),
            z: Math.round(z),
            color,
            type,
            sprite: null
        };

        wp.sprite = this._createSprite(wp, 0);
        this.waypoints.push(wp);
        this.save();
        return wp;
    }

    removeDeathWaypoint() {
        const deathWps = this.waypoints.filter(w => w.type === 'death');
        for (const w of deathWps) {
            this.removeWaypoint(w.id);
        }
    }

    removeWaypoint(id) {
        const idx = this.waypoints.findIndex(w => w.id === id);
        if (idx !== -1) {
            const wp = this.waypoints[idx];
            if (wp.sprite) {
                this.scene.remove(wp.sprite);
                if (wp.sprite.material.map) wp.sprite.material.map.dispose();
                wp.sprite.material.dispose();
            }
            this.waypoints.splice(idx, 1);
            this.save();
        }
    }

    _createSprite(wp, dist) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = wp.color;
        ctx.font = 'bold 26px monospace';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.textAlign = 'center';
        const icon = wp.type === 'death' ? '💀' : '📍';
        ctx.fillText(`${icon} ${wp.name} (${dist}m)`, 128, 40);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(wp.x + 0.5, wp.y + 1.5, wp.z + 0.5);
        sprite.scale.set(3.0, 0.75, 1);
        sprite.renderOrder = 999;
        this.scene.add(sprite);
        return sprite;
    }

    update(dt, playerPos) {
        this.lastDistUpdate += dt;
        if (this.lastDistUpdate < 0.2) return; // 5 FPS text update for distance
        this.lastDistUpdate = 0;

        for (const wp of this.waypoints) {
            if (!wp.sprite) continue;
            const dist = Math.round(Math.sqrt((wp.x - playerPos.x)**2 + (wp.y - playerPos.y)**2 + (wp.z - playerPos.z)**2));
            
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = wp.color;
            ctx.font = 'bold 26px monospace';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 6;
            ctx.textAlign = 'center';
            const icon = wp.type === 'death' ? '💀' : '📍';
            ctx.fillText(`${icon} ${wp.name} (${dist}m)`, 128, 40);

            if (wp.sprite.material.map) wp.sprite.material.map.dispose();
            wp.sprite.material.map = new THREE.CanvasTexture(canvas);
            wp.sprite.material.map.needsUpdate = true;
        }
    }

    save() {
        try {
            const data = this.waypoints.map(w => ({
                id: w.id, name: w.name, x: w.x, y: w.y, z: w.z, color: w.color, type: w.type
            }));
            localStorage.setItem('teecraft_waypoints', JSON.stringify(data));
        } catch (e) {}
    }

    load() {
        try {
            const raw = localStorage.getItem('teecraft_waypoints');
            if (!raw) return;
            const data = JSON.parse(raw);
            for (const w of data) {
                const wp = { ...w, sprite: null };
                wp.sprite = this._createSprite(wp, 0);
                this.waypoints.push(wp);
            }
        } catch (e) {}
    }
}
