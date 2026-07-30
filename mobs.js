import * as THREE from 'three';

const _tempVec3 = new THREE.Vector3();

export const MOB_DEFS = {
    zombie: { hostile: true, health: 20, damage: 3, speed: 2.6, detectRadius: 16, attackRadius: 1.3, attackCooldown: 1.0, drops: [{ id: 'feather', count: 0, chance: 0 }] },
    skeleton: { hostile: true, health: 20, damage: 3, speed: 2.6, detectRadius: 16, attackRadius: 12.0, attackCooldown: 2.0, drops: [{ id: 'arrow', count: 2, chance: 0.8 }, { id: 'bow', count: 1, chance: 0.1 }] },
    creeper: { hostile: true, health: 20, damage: 15, speed: 2.2, detectRadius: 16, attackRadius: 2.5, attackCooldown: 1.5, drops: [{ id: 'coal', count: 1, chance: 0.5 }] },
    spider: { hostile: true, health: 16, damage: 2, speed: 3.2, detectRadius: 16, attackRadius: 1.5, attackCooldown: 1.0, drops: [{ id: 'stick', count: 1, chance: 0.5 }] },
    pig: { hostile: false, health: 10, damage: 0, speed: 1.4, drops: [{ id: 'raw_porkchop', count: 1, chance: 1 }] },
    cow: { hostile: false, health: 10, damage: 0, speed: 1.3, drops: [{ id: 'raw_beef', count: 1, chance: 1 }] },
    chicken: { hostile: false, health: 4, damage: 0, speed: 1.6, drops: [{ id: 'raw_chicken', count: 1, chance: 1 }, { id: 'feather', count: 1, chance: 0.8 }] },
    sheep: { hostile: false, health: 8, damage: 0, speed: 1.4, drops: [{ id: 'wool', count: 1, chance: 1 }, { id: 'raw_beef', count: 1, chance: 1 }] }
};

function buildMesh(type) {
    const group = new THREE.Group();
    const colors = {
        zombie: { body: 0x3a6b35, head: 0x4a8a44, limb: 0x2f5a2b, extra: 0x1e3a1e },
        skeleton: { body: 0xdddddd, head: 0xeeeeee, limb: 0xcccccc, extra: 0x000000 },
        creeper: { body: 0x55aa55, head: 0x66cc66, limb: 0x448844, extra: 0x000000 },
        spider: { body: 0x222222, head: 0x111111, limb: 0x333333, extra: 0xff0000 },
        pig: { body: 0xf0a6b8, head: 0xf0a6b8, limb: 0xd98ba0, extra: 0x000000 },
        cow: { body: 0xffffff, head: 0x5a3d2b, limb: 0x3d2a1d, extra: 0x000000 },
        chicken: { body: 0xffffff, head: 0xffffff, limb: 0xd9a441, extra: 0xcc3333 },
        sheep: { body: 0xdddddd, head: 0xe0e0e0, limb: 0xaaaaaa, extra: 0x000000 }
    };
    const c = colors[type];
    const bodyMat = new THREE.MeshLambertMaterial({ color: c.body });
    const headMat = new THREE.MeshLambertMaterial({ color: c.head });
    const limbMat = new THREE.MeshLambertMaterial({ color: c.limb });

    const isSpider = type === 'spider';
    const isChicken = type === 'chicken';
    const isSheep = type === 'sheep';
    const scale = (isChicken || isSpider) ? 0.55 : (type === 'zombie' || type === 'skeleton' || type === 'creeper') ? 1.0 : 0.85;

    let bx = 0.5 * scale, by = 0.7 * scale, bz = 0.3 * scale;
    if (isSpider) { bx = 1.2; by = 0.3; bz = 1.0; }
    else if (isSheep) { bz = 0.6 * scale; bx = 0.6 * scale; }

    const body = new THREE.Mesh(new THREE.BoxGeometry(bx, by, bz), bodyMat);
    body.position.y = isSpider ? 0.3 : (0.55 * scale);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.4 * scale, 0.4 * scale), headMat);
    head.position.y = isSpider ? 0.3 : (1.0 * scale);
    if (isSpider) head.position.z = 0.6;
    head.castShadow = true;
    group.add(head);

    if (isChicken) {
        const beak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.15), new THREE.MeshLambertMaterial({ color: 0xe0a010 }));
        beak.position.set(0, 0.95 * scale, 0.27 * scale);
        group.add(beak);
        const comb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: c.extra }));
        comb.position.set(0, 1.22 * scale, 0.1 * scale);
        group.add(comb);
    }
    
    if (isSpider) {
        for (let i=0; i<4; i++) {
            const z = -0.4 + i * 0.25;
            const legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), limbMat);
            legL.position.set(-0.6, 0.2, z);
            group.add(legL);
            const legR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), limbMat);
            legR.position.set(0.6, 0.2, z);
            group.add(legR);
        }
    } else {
        const legPositions = isChicken
            ? [[-0.1, -0.15], [0.1, -0.15]]
            : [[-0.18 * scale, 0.1 * scale], [0.18 * scale, 0.1 * scale], [-0.18 * scale, -0.1 * scale], [0.18 * scale, -0.1 * scale]];

        const legHeight = isChicken ? 0.35 : (type === 'creeper' ? 0.25 : 0.5 * scale);
        legPositions.forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13 * scale, legHeight, 0.13 * scale), limbMat);
            leg.position.set(lx, legHeight / 2, lz);
            leg.castShadow = true;
            group.add(leg);
        });
    }

    group.userData.height = isSpider ? 0.5 : (isChicken ? 0.7 : 0.9 * scale + 0.35 * scale);
    return group;
}

let mobIdCounter = 0;

export class Mob {
    constructor(type, x, y, z, scene, entityManager) {
        this.id = mobIdCounter++;
        this.type = type;
        this.entityManager = entityManager;
        const def = MOB_DEFS[type];
        this.def = def;
        this.health = def.health;
        this.maxHealth = def.health;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.wanderDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        this.wanderTimer = Math.random() * 3;
        this.attackTimer = 0;
        this.hurtFlashTimer = 0;
        this.explosionTimer = 0;
        this.alive = true;
        this.despawnTimer = 0;
        this.loveTimer = 0;

        this.mesh = buildMesh(type);
        this.mesh.position.copy(this.position);
        this.mesh.userData.mob = this;
        scene.add(this.mesh);
    }

    isSolidAt(world, x, y, z) {
        const t = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return t && t !== 'water';
    }

    takeDamage(amount) {
        this.health -= amount;
        this.hurtFlashTimer = 0.2;
        if (this.health <= 0) this.alive = false;
        return this.health <= 0;
    }

    feedWheat() {
        if (!this.def.hostile && this.loveTimer <= 0) {
            this.loveTimer = 30; // 30 seconds of love mode
            this.hurtFlashTimer = 0.1; // visual indicator
            return true;
        }
        return false;
    }

    update(dt, world, playerPos, isNight) {
        const def = this.def;
        const halfW = 0.25;
        const height = this.mesh.userData.height;

        // --- AI ---
        const distToPlayer = this.position.distanceTo(playerPos);
        if (def.hostile && distToPlayer < def.detectRadius) {
            const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
            toPlayer.y = 0;
            toPlayer.normalize();

            if (this.type === 'creeper' && distToPlayer < def.attackRadius) {
                // start exploding
                this.explosionTimer += dt;
                this.mesh.traverse(c => {
                    if (c.isMesh) c.material.emissive = new THREE.Color(this.explosionTimer % 0.2 < 0.1 ? 0xffffff : 0x000000);
                });
                this.velocity.x = 0; this.velocity.z = 0;
                if (this.explosionTimer > 1.5) {
                    this.alive = false;
                    this._pendingExplosion = true;
                }
            } else if (this.type === 'skeleton' && distToPlayer < def.attackRadius) {
                // stop and shoot
                this.velocity.x = 0; this.velocity.z = 0;
                this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
                this.attackTimer -= dt;
                if (this.attackTimer <= 0) {
                    this.attackTimer = def.attackCooldown;
                    const aimDir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
                    this._pendingShoot = aimDir;
                }
            } else {
                this.explosionTimer = 0; // reset if player gets away
                this.mesh.traverse(c => {
                    if (c.isMesh) c.material.emissive = new THREE.Color(0x000000);
                });

                this.velocity.x = toPlayer.x * def.speed;
                this.velocity.z = toPlayer.z * def.speed;
                this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

                this.attackTimer -= dt;
                if (distToPlayer < def.attackRadius && this.attackTimer <= 0 && this.type !== 'creeper' && this.type !== 'skeleton') {
                    this.attackTimer = def.attackCooldown;
                    this._pendingAttack = def.damage;
                    if (this.type === 'spider' && this.onGround) this.velocity.y = 6;
                }
            }
        } else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2 + Math.random() * 3;
                if (Math.random() < 0.3) {
                    this.wanderDir.set(0, 0, 0); // pause
                } else {
                    this.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                }
            }
            const speed = def.speed * 0.5;
            this.velocity.x = this.wanderDir.x * speed;
            this.velocity.z = this.wanderDir.z * speed;
            if (this.wanderDir.lengthSq() > 0.01) {
                this.mesh.rotation.y = Math.atan2(this.wanderDir.x, this.wanderDir.z);
            }
        }

        // --- gravity & simple collision (feet-point based) ---
        this.velocity.y -= 28 * dt;
        if (this.velocity.y < -30) this.velocity.y = -30;

        const newY = this.position.y + this.velocity.y * dt;
        if (this.velocity.y <= 0 && this.isSolidAt(world, this.position.x, newY, this.position.z)) {
            this.position.y = Math.floor(newY) + 1;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.position.y = newY;
            this.onGround = false;
        }

        const newX = this.position.x + this.velocity.x * dt;
        if (!this.isSolidAt(world, newX + Math.sign(this.velocity.x) * halfW, this.position.y + 0.3, this.position.z) &&
            !this.isSolidAt(world, newX + Math.sign(this.velocity.x) * halfW, this.position.y + 1, this.position.z)) {
            this.position.x = newX;
        } else {
            this.velocity.x = 0;
        }

        const newZ = this.position.z + this.velocity.z * dt;
        if (!this.isSolidAt(world, this.position.x, this.position.y + 0.3, newZ + Math.sign(this.velocity.z) * halfW) &&
            !this.isSolidAt(world, this.position.x, this.position.y + 1, newZ + Math.sign(this.velocity.z) * halfW)) {
            this.position.z = newZ;
        } else {
            this.velocity.z = 0;
        }

        // occasional random hop if blocked & on ground (helps mobs get over 1-block ledges)
        if (this.onGround && this.velocity.lengthSq() > 0.01 && Math.random() < 0.01) {
            this.velocity.y = 8;
        }

        this.mesh.position.copy(this.position);

        if (this.hurtFlashTimer > 0) {
            this.hurtFlashTimer -= dt;
            const flash = this.hurtFlashTimer > 0;
            this.mesh.traverse(c => {
                if (c.isMesh) c.material.emissive = flash ? new THREE.Color(this.loveTimer > 0 ? 0xcc0000 : 0x660000) : new THREE.Color(0x000000);
            });
        }

        if (this.loveTimer > 0) {
            this.loveTimer -= dt;
            if (Math.random() < 0.02) this.hurtFlashTimer = 0.1; // occasional heart flash
        }
    }

    consumeAttack() {
        const dmg = this._pendingAttack;
        this._pendingAttack = null;
        return dmg;
    }

    destroy(scene) {
        scene.remove(this.mesh);
        this.mesh.traverse(c => {
            if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); }
        });
    }
}

export class MobManager {
    constructor(scene, world, entityManager) {
        this.scene = scene;
        this.world = world;
        this.entityManager = entityManager;
        this.mobs = [];
        this.spawnCooldown = 2;
        this.maxMobs = 24;
    }

    findGroundY(x, z) {
        for (let y = 60; y >= 1; y--) {
            const t = this.world.getBlock(Math.floor(x), y, Math.floor(z));
            if (t && t !== 'water') return y + 1;
        }
        return null;
    }

    trySpawn(playerPos, isNight) {
        if (this.mobs.length >= this.maxMobs) return;
        const angle = Math.random() * Math.PI * 2;
        const dist = 14 + Math.random() * 14;
        const x = playerPos.x + Math.cos(angle) * dist;
        const z = playerPos.z + Math.sin(angle) * dist;
        const y = this.findGroundY(x, z);
        if (y === null) return;

        const groundType = this.world.getBlock(Math.floor(x), y - 1, Math.floor(z));
        if (groundType === 'water' || groundType === 'sand') return;

        let type;
        if (isNight) {
            const roll = Math.random();
            type = roll < 0.4 ? 'zombie' : roll < 0.7 ? 'skeleton' : roll < 0.9 ? 'spider' : 'creeper';
        } else {
            const roll = Math.random();
            type = roll < 0.25 ? 'pig' : roll < 0.5 ? 'cow' : roll < 0.75 ? 'chicken' : 'sheep';
        }
        this.mobs.push(new Mob(type, x, y, z, this.scene, this.entityManager));
    }

    update(dt, playerPos, isNight, onPlayerHit) {
        this.spawnCooldown -= dt;
        if (this.spawnCooldown <= 0) {
            this.spawnCooldown = 3 + Math.random() * 4;
            this.trySpawn(playerPos, isNight);
        }

        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const mob = this.mobs[i];
            const dist = mob.position.distanceTo(playerPos);

            // Despawn passive/hostile mobs that wander too far, or zombies at daybreak far from player
            if (dist > 48) {
                mob.destroy(this.scene);
                this.mobs.splice(i, 1);
                continue;
            }

            mob.update(dt, this.world, playerPos, isNight);

            if (!mob.def.hostile && mob.loveTimer > 0 && mob.alive) {
                // Find a partner
                for (const other of this.mobs) {
                    if (other !== mob && other.type === mob.type && other.loveTimer > 0 && other.alive) {
                        if (mob.position.distanceTo(other.position) < 2) {
                            // Breed!
                            mob.loveTimer = 0;
                            other.loveTimer = 0;
                            const baby = new Mob(mob.type, mob.position.x, mob.position.y, mob.position.z, this.scene, this.entityManager);
                            baby.mesh.scale.set(0.5, 0.5, 0.5); // make it small
                            this.mobs.push(baby);
                            break;
                        } else {
                            // Move towards partner
                            _tempVec3.subVectors(other.position, mob.position).normalize();
                            mob.wanderDir.copy(_tempVec3);
                            mob.wanderTimer = 1;
                        }
                    }
                }
            }

            const atk = mob.consumeAttack();
            if (atk && onPlayerHit) onPlayerHit(atk, mob);

            if (!mob.alive) {
                mob.destroy(this.scene);
                this.mobs.splice(i, 1);
            }
            
            if (mob._pendingExplosion) {
                this.explode(mob.position, 4, this.world, this.entityManager);
                if (mob.position.distanceTo(playerPos) < 5 && onPlayerHit) onPlayerHit(mob.def.damage, mob);
            }
            if (mob._pendingShoot) {
                const arrowPos = mob.position.clone();
                arrowPos.y += mob.mesh.userData.height * 0.8;
                this.entityManager.spawnArrow(arrowPos, mob._pendingShoot, 20, mob);
                mob._pendingShoot = null;
            }
        }
    }

    explode(pos, radius, world, entityManager) {
        const cx = Math.floor(pos.x);
        const cy = Math.floor(pos.y);
        const cz = Math.floor(pos.z);
        for (let bx = -radius; bx <= radius; bx++) {
            for (let by = -radius; by <= radius; by++) {
                for (let bz = -radius; bz <= radius; bz++) {
                    if (bx*bx + by*by + bz*bz <= radius*radius) {
                        const type = world.getBlock(cx+bx, cy+by, cz+bz);
                        if (type && type !== 'bedrock' && type !== 'water') {
                            world.setBlock(cx+bx, cy+by, cz+bz, null);
                            if (Math.random() < 0.1) {
                                entityManager.spawnItem(type, 1, cx+bx+0.5, cy+by+0.5, cz+bz+0.5);
                            }
                        }
                    }
                }
            }
        }
    }

    getMeshes() {
        return this.mobs.map(m => m.mesh);
    }

    findMobByMesh(mesh) {
        let obj = mesh;
        while (obj) {
            if (obj.userData && obj.userData.mob) return obj.userData.mob;
            obj = obj.parent;
        }
        return null;
    }

    removeAll() {
        for (const mob of this.mobs) mob.destroy(this.scene);
        this.mobs = [];
    }
}
