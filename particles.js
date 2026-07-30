import * as THREE from 'three';

const MAX_PARTICLES = 3000;

export class DamageText {
    constructor(x, y, z, text, colorHex = '#ff3333', scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = colorHex;
        ctx.font = 'bold 40px monospace';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(text, 15, 45);
        
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        this.sprite = new THREE.Sprite(mat);
        this.sprite.position.set(x + (Math.random()-0.5)*0.5, y + 0.5, z + (Math.random()-0.5)*0.5);
        this.sprite.scale.set(1.5, 0.75, 1);
        
        this.velocity = new THREE.Vector3((Math.random() - 0.5) * 1.5, 3.5, (Math.random() - 0.5) * 1.5);
        this.age = 0;
        this.maxAge = 0.8;
        this.alive = true;
        scene.add(this.sprite);
    }

    update(dt) {
        this.age += dt;
        if (this.age >= this.maxAge) {
            this.alive = false;
            return;
        }
        this.sprite.position.addScaledVector(this.velocity, dt);
        this.sprite.material.opacity = 1 - (this.age / this.maxAge);
    }

    destroy(scene) {
        scene.remove(this.sprite);
        this.sprite.material.map.dispose();
        this.sprite.material.dispose();
    }
}

export class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.damageTexts = [];
        
        const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        
        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        // We will manually color instances
        const colors = new Float32Array(MAX_PARTICLES * 3);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

        this.particles = [];
        for (let i = 0; i < MAX_PARTICLES; i++) {
            this.particles.push({
                active: false,
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3(),
                color: new THREE.Color(),
                age: 0,
                maxAge: 0,
                ptype: 'normal'
            });
        }

        this.scene.add(this.mesh);
        
        this.dummy = new THREE.Object3D();
    }

    _spawnParticle(x, y, z, vx, vy, vz, colorHex, maxAge) {
        // Find an inactive particle
        let p = null;
        for (let i = 0; i < MAX_PARTICLES; i++) {
            if (!this.particles[i].active) {
                p = this.particles[i];
                break;
            }
        }
        if (!p) return; // Full

        p.active = true;
        p.pos.set(x, y, z);
        p.vel.set(vx, vy, vz);
        p.color.setHex(colorHex);
        p.age = 0;
        p.maxAge = maxAge;
        p.ptype = 'normal';
        return p;
    }

    spawnBlockBreak(x, y, z, type) {
        // Map type to a general color
        let color = 0xffffff;
        if (type === 'dirt' || type === 'wood' || type === 'planks') color = 0x5c4033;
        else if (type === 'grass' || type === 'leaves') color = 0x228b22;
        else if (type === 'stone' || type === 'cobblestone' || type === 'coal_ore' || type === 'iron_ore' || type === 'diamond_ore') color = 0x7d7d7d;
        else if (type === 'sand') color = 0xeadd95;
        
        for (let i = 0; i < 30; i++) {
            this._spawnParticle(
                x + Math.random(),
                y + Math.random(),
                z + Math.random(),
                (Math.random() - 0.5) * 6,
                Math.random() * 5 + 2,
                (Math.random() - 0.5) * 6,
                color,
                0.5 + Math.random() * 0.5
            );
        }
    }

    spawnMobHit(x, y, z) {
        const color = 0xcc0000; // Blood red
        for (let i = 0; i < 15; i++) {
            this._spawnParticle(
                x + (Math.random() - 0.5) * 0.5,
                y + Math.random(),
                z + (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 4,
                Math.random() * 3 + 1,
                (Math.random() - 0.5) * 4,
                color,
                0.3 + Math.random() * 0.3
            );
        }
    }

    spawnDamageText(x, y, z, damageText, colorHex = '#ff3333') {
        this.damageTexts.push(new DamageText(x, y, z, damageText, colorHex, this.scene));
    }

    spawnEnchantBurst(x, y, z) {
        const colors = [0x9d4edd, 0xc084fc, 0x4cc9f0, 0xf72585];
        for (let i = 0; i < 40; i++) {
            const col = colors[Math.floor(Math.random() * colors.length)];
            this._spawnParticle(
                x + (Math.random() - 0.5) * 0.8,
                y + Math.random() * 0.8,
                z + (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 5,
                Math.random() * 4 + 2,
                (Math.random() - 0.5) * 5,
                col,
                0.6 + Math.random() * 0.4
            );
        }
    }

    spawnSplash(x, y, z) {
        const color = 0xa0d8ef; // Foam blue/white
        for (let i = 0; i < 25; i++) {
            this._spawnParticle(
                x + (Math.random() - 0.5) * 0.8,
                y + (Math.random() - 0.5) * 0.2,
                z + (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 4,
                Math.random() * 4 + 2,
                (Math.random() - 0.5) * 4,
                color,
                0.4 + Math.random() * 0.4
            );
        }
    }

    spawnRain(camX, camY, camZ, amount = 15) {
        const color = 0x4a7eb0; 
        for (let i = 0; i < amount; i++) {
            const rx = camX + (Math.random() - 0.5) * 40;
            const ry = camY + 15 + Math.random() * 20;
            const rz = camZ + (Math.random() - 0.5) * 40;
            
            const p = this._spawnParticle(
                rx, ry, rz,
                (Math.random() - 0.5) * 2, // vx
                -25 - Math.random() * 10, // vy
                (Math.random() - 0.5) * 2, // vz
                color,
                1.0 // maxAge (die after falling 25-35 blocks)
            );
            if (p) p.ptype = 'rain';
        }
    }

    update(dt) {
        let count = 0;
        const colorArray = this.mesh.instanceColor.array;
        
        for (let i = 0; i < MAX_PARTICLES; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.age += dt;
            if (p.age >= p.maxAge) {
                p.active = false;
                continue;
            }

            p.vel.y -= 25 * dt; // gravity
            p.pos.addScaledVector(p.vel, dt);

            this.dummy.position.copy(p.pos);
            
            if (p.ptype === 'rain') {
                this.dummy.scale.set(0.2, 5.0, 0.2); // long and thin
            } else {
                const scale = 1 - (p.age / p.maxAge);
                this.dummy.scale.set(scale, scale, scale);
            }
            this.dummy.updateMatrix();

            this.mesh.setMatrixAt(count, this.dummy.matrix);
            
            colorArray[count * 3] = p.color.r;
            colorArray[count * 3 + 1] = p.color.g;
            colorArray[count * 3 + 2] = p.color.b;

            count++;
        }

        this.mesh.count = count;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;

        for (let i = this.damageTexts.length - 1; i >= 0; i--) {
            const dtText = this.damageTexts[i];
            dtText.update(dt);
            if (!dtText.alive) {
                dtText.destroy(this.scene);
                this.damageTexts.splice(i, 1);
            }
        }
    }
}
