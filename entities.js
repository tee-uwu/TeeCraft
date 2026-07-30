import * as THREE from 'three';
import { uiIcons } from './textures.js';
import { ITEMS } from './items.js';

let entityIdCounter = 0;

export class XpOrbEntity {
    constructor(x, y, z, amount, scene) {
        this.uid = entityIdCounter++;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 4 + 2,
            (Math.random() - 0.5) * 4
        );
        this.amount = amount;
        this.alive = true;
        this.age = 0;
        this.canPickupTimer = 0.5;

        // Glowing green box
        const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const mat = new THREE.MeshBasicMaterial({ color: 0x4ef24e });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }

    isSolidAt(world, x, y, z) {
        const t = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return t && t !== 'water' && t !== 'leaves' && t !== 'glass';
    }

    update(dt, world, player) {
        this.age += dt;
        if (this.canPickupTimer > 0) this.canPickupTimer -= dt;

        if (this.age > 300) { // Despawn after 5 mins
            this.alive = false;
            return;
        }

        const px = player.camera.position.x;
        const py = player.camera.position.y;
        const pz = player.camera.position.z;

        // Magnetism towards player if close
        const distSq = this.position.distanceToSquared(player.camera.position);
        if (distSq < 36 && this.canPickupTimer <= 0) { // 6 blocks
            const dir = player.camera.position.clone().sub(this.position).normalize();
            this.velocity.add(dir.multiplyScalar(20 * dt)); // Pull force
            
            // Pickup
            if (distSq < 2) {
                player.addXp(this.amount);
                this.alive = false;
                return;
            }
        } else {
            // Gravity and friction
            this.velocity.y -= 20 * dt;
            this.velocity.x *= (1 - 2*dt);
            this.velocity.z *= (1 - 2*dt);
        }

        const nextPos = this.position.clone().add(this.velocity.clone().multiplyScalar(dt));

        if (this.isSolidAt(world, nextPos.x, nextPos.y, nextPos.z)) {
            // Bounce or slide
            if (this.isSolidAt(world, this.position.x, nextPos.y, this.position.z)) {
                this.velocity.y = 0;
                nextPos.y = this.position.y;
            }
            if (this.isSolidAt(world, nextPos.x, this.position.y, this.position.z)) {
                this.velocity.x = 0;
                nextPos.x = this.position.x;
            }
            if (this.isSolidAt(world, this.position.x, this.position.y, nextPos.z)) {
                this.velocity.z = 0;
                nextPos.z = this.position.z;
            }
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);
        this.mesh.rotation.x += dt * 2;
        this.mesh.rotation.y += dt * 3;
    }

    destroy(scene) {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

export class ArrowEntity {
    constructor(x, y, z, dir, speed, owner, scene) {
        this.uid = entityIdCounter++;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = dir.clone().multiplyScalar(speed);
        this.owner = owner;
        this.alive = true;
        this.age = 0;
        this.stuck = false;
        
        this.mesh = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), new THREE.MeshLambertMaterial({color: 0x8a5a2b}));
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.1), new THREE.MeshLambertMaterial({color: 0xcccccc}));
        head.position.z = 0.25;
        this.mesh.add(shaft);
        this.mesh.add(head);
        
        this.mesh.position.copy(this.position);
        
        const axis = new THREE.Vector3(0,0,1);
        this.mesh.quaternion.setFromUnitVectors(axis, dir);
        
        scene.add(this.mesh);
    }
    
    isSolidAt(world, x, y, z) {
        const t = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return t && t !== 'water' && t !== 'leaves' && t !== 'glass';
    }
    
    update(dt, world, player, mobs, onPlayerHit) {
        if (this.stuck) {
            this.age += dt;
            if (this.age > 30) this.alive = false;
            return;
        }
        
        this.age += dt;
        if (this.age > 10) this.alive = false;
        
        this.velocity.y -= 10 * dt;
        
        const nextPos = this.position.clone().add(this.velocity.clone().multiplyScalar(dt));
        
        if (this.isSolidAt(world, nextPos.x, nextPos.y, nextPos.z)) {
            this.position.copy(nextPos);
            this.stuck = true;
            return;
        }
        
        if (this.owner !== 'player') {
            const px = player.camera.position.x;
            const py = player.camera.position.y;
            const pz = player.camera.position.z;
            const feetY = py - player.height;
            if (nextPos.x > px - 0.5 && nextPos.x < px + 0.5 &&
                nextPos.z > pz - 0.5 && nextPos.z < pz + 0.5 &&
                nextPos.y > feetY && nextPos.y < py + 0.5) {
                if (onPlayerHit) onPlayerHit(4, this);
                this.alive = false;
                return;
            }
        }
        
        if (this.owner === 'player') {
            for (const mob of mobs) {
                if (!mob.alive) continue;
                const mPos = mob.position;
                const mh = mob.mesh.userData.height;
                if (nextPos.x > mPos.x - 0.5 && nextPos.x < mPos.x + 0.5 &&
                    nextPos.z > mPos.z - 0.5 && nextPos.z < mPos.z + 0.5 &&
                    nextPos.y > mPos.y && nextPos.y < mPos.y + mh) {
                    mob.takeDamage(5);
                    this.alive = false;
                    
                    mob.velocity.add(this.velocity.clone().normalize().multiplyScalar(4));
                    mob.velocity.y += 2;
                    return;
                }
            }
        }
        
        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);
        
        const dir = this.velocity.clone().normalize();
        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), dir);
    }
    
    destroy(scene) {
        scene.remove(this.mesh);
        this.mesh.traverse(c => {
            if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); }
        });
    }
}

export class ItemEntity {
    constructor(id, count, x, y, z, scene) {
        this.uid = entityIdCounter++;
        this.itemId = id;
        this.count = count;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 4 + 2,
            (Math.random() - 0.5) * 4
        );
        this.onGround = false;
        this.alive = true;
        this.age = 0;
        this.pickupDelay = 1.0; // Seconds before it can be picked up

        const size = 0.25;
        this.mesh = new THREE.Group();

        const iconSrc = uiIcons[id];
        if (iconSrc) {
            const map = new THREE.TextureLoader().load(iconSrc);
            map.magFilter = THREE.NearestFilter;
            map.minFilter = THREE.NearestFilter;
            map.colorSpace = THREE.SRGBColorSpace;
            const mat = new THREE.SpriteMaterial({ map: map, transparent: true });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(size * 1.5, size * 1.5, 1);
            this.mesh.add(sprite);
        } else {
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const cube = new THREE.Mesh(geo, mat);
            this.mesh.add(cube);
        }
        
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }

    isSolidAt(world, x, y, z) {
        const t = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return t && t !== 'water';
    }

    update(dt, world, playerPos) {
        this.age += dt;
        if (this.pickupDelay > 0) this.pickupDelay -= dt;

        this.velocity.y -= 20 * dt;
        if (this.velocity.y < -20) this.velocity.y = -20;

        const newY = this.position.y + this.velocity.y * dt;
        if (this.velocity.y <= 0 && this.isSolidAt(world, this.position.x, newY, this.position.z)) {
            this.position.y = Math.floor(newY) + 1;
            this.velocity.y = 0;
            this.velocity.x *= 0.5;
            this.velocity.z *= 0.5;
            this.onGround = true;
        } else {
            this.position.y = newY;
            this.onGround = false;
        }

        const newX = this.position.x + this.velocity.x * dt;
        if (!this.isSolidAt(world, newX, this.position.y + 0.1, this.position.z)) {
            this.position.x = newX;
        } else {
            this.velocity.x = 0;
        }

        const newZ = this.position.z + this.velocity.z * dt;
        if (!this.isSolidAt(world, this.position.x, this.position.y + 0.1, newZ)) {
            this.position.z = newZ;
        } else {
            this.velocity.z = 0;
        }

        if (this.pickupDelay <= 0) {
            const distSq = this.position.distanceToSquared(playerPos);
            if (distSq < 9) {
                const dir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
                this.velocity.add(dir.multiplyScalar(20 * dt));
            }
        }

        this.mesh.position.copy(this.position);
        this.mesh.position.y += Math.sin(this.age * 3) * 0.1 + 0.1;

        if (this.age > 300) {
            this.alive = false;
        }
    }

    destroy(scene) {
        scene.remove(this.mesh);
        this.mesh.traverse(c => {
            if (c.material && c.material.map) c.material.map.dispose();
            if (c.material) c.material.dispose();
            if (c.geometry) c.geometry.dispose();
        });
    }
}

export class EntityManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.items = [];
        this.arrows = [];
        this.xpOrbs = [];
    }

    spawnArrow(pos, dir, speed, owner) {
        this.arrows.push(new ArrowEntity(pos.x, pos.y, pos.z, dir, speed, owner, this.scene));
    }

    spawnItem(id, count, x, y, z) {
        if (!id || count <= 0) return;
        this.items.push(new ItemEntity(id, count, x, y, z, this.scene));
    }

    spawnXpOrb(x, y, z, amount = 1) {
        this.xpOrbs.push(new XpOrbEntity(x, y, z, amount, this.scene));
    }
    
    update(dt, player, mobs = [], onPlayerHit = null) {
        this.mobsRef = mobs;
        this.onPlayerHitRef = onPlayerHit;
        const playerPos = player.camera.position;
        const headY = playerPos.y;
        const feetY = headY - player.height;

        for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
            const orb = this.xpOrbs[i];
            orb.update(dt, this.world, player);
            if (!orb.alive) {
                orb.destroy(this.scene);
                this.xpOrbs.splice(i, 1);
            }
        }

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            
            if (item.position.distanceToSquared(playerPos) > 4000) {
                item.destroy(this.scene);
                this.items.splice(i, 1);
                continue;
            }

            item.update(dt, this.world, playerPos);

            if (item.pickupDelay <= 0 && item.alive) {
                const ix = item.position.x, iy = item.position.y, iz = item.position.z;
                const px = playerPos.x, pz = playerPos.z;
                
                if (Math.abs(ix - px) < 1.0 && Math.abs(iz - pz) < 1.0 && iy >= feetY - 0.5 && iy <= headY + 0.5) {
                    const leftover = player.inventory.addItem(item.itemId, item.count);
                    if (leftover < item.count) {
                        import('./audio.js').then(m => m.audio.playEat()); 
                        import('./ui.js').then(m => m.ui.refreshAll());
                    }
                    if (leftover === 0) {
                        item.alive = false;
                    } else {
                        item.count = leftover;
                    }
                }
            }

            if (!item.alive) {
                item.destroy(this.scene);
                this.items.splice(i, 1);
            }
        }
        
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const arrow = this.arrows[i];
            arrow.update(dt, this.world, player, mobs, onPlayerHit);
            
            if (!arrow.alive) {
                arrow.destroy(this.scene);
                this.arrows.splice(i, 1);
            }
        }
    }
}
