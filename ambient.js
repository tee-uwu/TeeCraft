import * as THREE from 'three';

// ─── Ambient Birds ────────────────────────────────────────────────────────────
const BIRD_COUNT = 12;

class Bird {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();

        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
        const wingMat = new THREE.MeshLambertMaterial({ color: 0x16213e });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.5), bodyMat);
        this.group.add(body);

        // Wings (two flat quads)
        this.wingL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.28), wingMat);
        this.wingL.position.set(-0.42, 0, 0);
        this.group.add(this.wingL);

        this.wingR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.28), wingMat);
        this.wingR.position.set(0.42, 0, 0);
        this.group.add(this.wingR);

        this.group.scale.setScalar(0.5 + Math.random() * 0.5);
        scene.add(this.group);

        this.reset();
        this.flapTimer = Math.random() * Math.PI * 2;
        this.speed = 4 + Math.random() * 4;
    }

    reset(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + Math.random() * 80;
        const baseX = playerPos ? playerPos.x : 0;
        const baseZ = playerPos ? playerPos.z : 0;
        this.group.position.set(
            baseX + Math.cos(angle) * radius,
            55 + Math.random() * 30,
            baseZ + Math.sin(angle) * radius
        );
        this.dir = new THREE.Vector3(
            (Math.random() - 0.5),
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5)
        ).normalize();
    }

    update(dt, playerPos) {
        this.flapTimer += dt * 4;
        const flapAngle = Math.sin(this.flapTimer) * 0.5;
        this.wingL.rotation.z =  flapAngle;
        this.wingR.rotation.z = -flapAngle;

        this.group.position.addScaledVector(this.dir, this.speed * dt);
        this.group.lookAt(
            this.group.position.x + this.dir.x,
            this.group.position.y + this.dir.y,
            this.group.position.z + this.dir.z
        );

        // Occasional direction change
        if (Math.random() < 0.005) {
            this.dir.x += (Math.random() - 0.5) * 0.4;
            this.dir.z += (Math.random() - 0.5) * 0.4;
            this.dir.normalize();
        }

        // Reset if too far from player
        const dx = this.group.position.x - playerPos.x;
        const dz = this.group.position.z - playerPos.z;
        if (dx * dx + dz * dz > 300 * 300) this.reset(playerPos);
    }

    destroy() {
        this.scene.remove(this.group);
    }
}

// ─── Volumetric Clouds ───────────────────────────────────────────────────────
const CLOUD_COUNT = 18;

class Cloud {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();

        const mat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.82
        });

        // Build cloud from overlapping boxes for a fluffy look
        const puffs = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < puffs; i++) {
            const w = 6 + Math.random() * 10;
            const h = 2 + Math.random() * 3;
            const d = 5 + Math.random() * 8;
            const puff = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            puff.position.set(
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 6
            );
            this.group.add(puff);
        }

        scene.add(this.group);
        this.reset();
        this.speed = 1.5 + Math.random() * 2.5;
        this.dir = new THREE.Vector3((Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5), 0, (Math.random() - 0.5) * 0.2).normalize();
    }

    reset(playerPos) {
        const baseX = playerPos ? playerPos.x : 0;
        const baseZ = playerPos ? playerPos.z : 0;
        this.group.position.set(
            baseX + (Math.random() - 0.5) * 300,
            90 + Math.random() * 30,
            baseZ + (Math.random() - 0.5) * 300
        );
    }

    update(dt, playerPos) {
        this.group.position.addScaledVector(this.dir, this.speed * dt);
        const dx = this.group.position.x - playerPos.x;
        const dz = this.group.position.z - playerPos.z;
        if (Math.abs(dx) > 220 || Math.abs(dz) > 220) this.reset(playerPos);
    }

    destroy() {
        this.scene.remove(this.group);
    }
}

// ─── Manager ─────────────────────────────────────────────────────────────────
export class AmbientManager {
    constructor(scene) {
        this.birds  = Array.from({ length: BIRD_COUNT }, () => new Bird(scene));
        this.clouds = Array.from({ length: CLOUD_COUNT }, () => new Cloud(scene));
    }

    update(dt, playerPos) {
        for (const b of this.birds)  b.update(dt, playerPos);
        for (const c of this.clouds) c.update(dt, playerPos);
    }
}
