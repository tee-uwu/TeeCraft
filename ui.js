import { uiIcons } from './textures.js';
import { ITEMS, FOOD } from './items.js';
import { matchRecipe, consumeGrid } from './crafting.js';
import { audio } from './audio.js';
import { getCurrentUser, signIn, signUp, signOut, loadProgressFromCloud } from './auth.js';

const HOTBAR_SIZE = 9;

class UI {
    constructor() {
        this.player = null;
        this.world = null;
        this.screen = 'none'; // none | inventory | crafting_table | furnace
        this.craft2 = new Array(4).fill(null);
        this.craft3 = new Array(9).fill(null);
        this.heldItem = null;
        this.activeFurnacePos = null;
        this.activeFurnaceEntity = null;
        this.activeChestEntity = null;
        this.isInventoryOpen = false; // kept for main.js pointer-lock compatibility

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initDOM());
        } else {
            this.initDOM();
        }
    }

    attach(player) {
        this.player = player;
        this.world = player.world;
        this.renderHotbar();
    }

    // ---------------------------------------------------------------
    // DOM setup
    // ---------------------------------------------------------------
    initDOM() {
        this.hotbarEl = document.getElementById('hotbar');
        this.inventoryEl = document.getElementById('inventory-screen');
        this.craftingTableEl = document.getElementById('crafting-table-screen');
        this.furnaceEl = document.getElementById('furnace-screen');
        this.chestEl = document.getElementById('chest-screen');
        this.enchantEl = document.getElementById('enchanting-screen');
        this.settingsEl = document.getElementById('settings-screen');
        this.deathEl = document.getElementById('death-screen');
        this.blocker = document.getElementById('blocker');
        this.crosshair = document.getElementById('crosshair');
        this.cursorItemEl = document.getElementById('cursor-item');
        this.miningBarEl = document.getElementById('mining-progress');
        this.miningBarFillEl = document.getElementById('mining-progress-fill');
        this.heartsEl = document.getElementById('hearts');
        this.hungerEl = document.getElementById('hunger');
        this.breathEl = document.getElementById('breath-bar');

        this.xpBarContainer = document.getElementById('xp-bar-container');
        this.xpBarFill = document.getElementById('xp-bar-fill');
        this.xpLevelText = document.getElementById('xp-level-text');
        this.underwaterOverlay = document.getElementById('underwater-overlay');

        this.waypointEl = document.getElementById('waypoint-screen');
        this.coordsPosEl = document.getElementById('coords-pos');
        this.coordsFacingEl = document.getElementById('coords-facing');
        this.coordsDebugEl = document.getElementById('coords-debug');
        this.wpNameInput = document.getElementById('wp-name-input');
        this.addWpBtn = document.getElementById('add-wp-btn');
        this.wpListEl = document.getElementById('wp-list');

        this._buildHotbar();
        this._buildInventoryScreen();
        this._buildCraftingTableScreen();
        this._buildFurnaceScreen();
        this._buildChestScreen();
        this._buildEnchantingScreen();
        this._buildWaypointScreen();
        this._buildVitals();

        const accountBtn = document.getElementById('account-btn');
        if (accountBtn) {
            accountBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openAuthModal();
            });
        }
        this.initAuthHandlers();

        document.getElementById('settings-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openSettings();
        });
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            this.closeAllScreens();
        });

        this.tooltipEl = document.getElementById('tooltip');

        document.addEventListener('mousemove', (e) => {
            if (this.heldItem && this.cursorItemEl) {
                this.cursorItemEl.style.left = (e.clientX + 8) + 'px';
                this.cursorItemEl.style.top = (e.clientY + 8) + 'px';
            }
            if (this.tooltipEl && !this.tooltipEl.classList.contains('hidden')) {
                this.tooltipEl.style.left = (e.clientX + 16) + 'px';
                this.tooltipEl.style.top = (e.clientY + 16) + 'px';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.anyScreenOpen()) return;
            if (e.code.startsWith('Digit') && e.code !== 'Digit0') {
                const num = parseInt(e.code.replace('Digit', ''));
                if (num >= 1 && num <= 9 && this.player) {
                    this.player.activeSlot = num - 1;
                    this.renderHotbar();
                }
            }
        });

        document.addEventListener('wheel', (e) => {
            if (this.anyScreenOpen() || !this.player) return;
            const cur = this.player.activeSlot;
            this.player.activeSlot = e.deltaY > 0 ? (cur + 1) % HOTBAR_SIZE : (cur - 1 + HOTBAR_SIZE) % HOTBAR_SIZE;
            this.renderHotbar();
        });

        const respawnBtn = document.getElementById('respawn-btn');
        if (respawnBtn) respawnBtn.addEventListener('click', () => {
            this.player.respawn();
            this.player.controls.lock();
        });
    }

    _buildHotbar() {
        for (let i = 0; i < HOTBAR_SIZE; i++) {
            const slot = document.createElement('div');
            slot.className = 'slot';
            if (i === 0) slot.classList.add('active');

            const num = document.createElement('div');
            num.className = 'slot-number';
            num.textContent = i + 1;
            slot.appendChild(num);

            const img = document.createElement('img');
            slot.appendChild(img);

            const count = document.createElement('div');
            count.className = 'slot-count';
            slot.appendChild(count);

            this.hotbarEl.appendChild(slot);
        }
    }

    _buildVitals() {
        for (let i = 0; i < 10; i++) {
            const h = document.createElement('span');
            h.className = 'heart full';
            h.textContent = '\u2764';
            this.heartsEl.appendChild(h);
            const d = document.createElement('span');
            d.className = 'drumstick full';
            d.textContent = '\uD83C\uDF56';
            this.hungerEl.appendChild(d);
        }
        for (let i = 0; i < 10; i++) {
            const b = document.createElement('span');
            b.className = 'bubble full';
            b.textContent = '\u25CB';
            this.breathEl.appendChild(b);
        }
    }

    _makeSlotEl(kind, index, isOutput = false) {
        const el = document.createElement('div');
        el.className = 'inv-slot2' + (isOutput ? ' output-slot' : '');
        const img = document.createElement('img');
        el.appendChild(img);
        const count = document.createElement('div');
        count.className = 'slot-count';
        el.appendChild(count);
        const badge = document.createElement('div');
        badge.className = 'enchant-badge';
        el.appendChild(badge);

        el.addEventListener('click', () => this.handleSlotClick(kind, index, isOutput));
        el.addEventListener('mouseenter', () => this._showItemTooltip(el._item));
        el.addEventListener('mouseleave', () => this._hideItemTooltip());

        el._img = img;
        el._count = count;
        el._badge = badge;
        return el;
    }

    _buildGridSection(container, title, gridSize, gridKind, outputKind) {
        const wrap = document.createElement('div');
        wrap.className = 'craft-section';
        if (title) {
            const h = document.createElement('h3');
            h.textContent = title;
            wrap.appendChild(h);
        }
        const row = document.createElement('div');
        row.className = 'craft-row';

        const grid = document.createElement('div');
        grid.className = `craft-grid grid-${gridSize}`;
        const els = [];
        for (let i = 0; i < gridSize * gridSize; i++) {
            const el = this._makeSlotEl(gridKind, i);
            grid.appendChild(el);
            els.push(el);
        }
        row.appendChild(grid);

        const arrow = document.createElement('div');
        arrow.className = 'craft-arrow';
        arrow.textContent = '\u2192';
        row.appendChild(arrow);

        const outEl = this._makeSlotEl(outputKind, 0, true);
        outEl.classList.add('craft-output');
        row.appendChild(outEl);

        wrap.appendChild(row);
        container.appendChild(wrap);
        return { els, outEl };
    }

    _buildInvGrid(container) {
        const grid = document.createElement('div');
        grid.className = 'main-inv-grid';
        const els = [];
        for (let i = HOTBAR_SIZE; i < HOTBAR_SIZE + 27; i++) {
            const el = this._makeSlotEl('inv', i);
            grid.appendChild(el);
            els.push(el);
        }
        container.appendChild(grid);

        const hotbarRow = document.createElement('div');
        hotbarRow.className = 'main-inv-grid hotbar-mirror';
        for (let i = 0; i < HOTBAR_SIZE; i++) {
            const el = this._makeSlotEl('inv', i);
            hotbarRow.appendChild(el);
            els.push(el);
        }
        container.appendChild(hotbarRow);
        return els;
    }

    _buildInventoryScreen() {
        const closeHint = document.createElement('p');
        closeHint.className = 'close-hint';
        closeHint.textContent = 'Press E or Esc to close';

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.gap = '30px';
        
        const armorWrap = document.createElement('div');
        armorWrap.className = 'craft-section';
        const armorH = document.createElement('h3');
        armorH.textContent = 'Armor';
        armorWrap.appendChild(armorH);
        const armorGrid = document.createElement('div');
        armorGrid.style.display = 'grid';
        armorGrid.style.gridTemplateRows = 'repeat(4, 44px)';
        armorGrid.style.gap = '2px';
        this.armorEls = [];
        for (let i = 0; i < 4; i++) {
            const el = this._makeSlotEl('armor', i);
            armorGrid.appendChild(el);
            this.armorEls.push(el);
        }
        armorWrap.appendChild(armorGrid);
        topRow.appendChild(armorWrap);

        const { els: craftEls, outEl } = this._buildGridSection(topRow, 'Crafting', 2, 'craft2', 'craftOutput2');
        this.craft2Els = craftEls;
        this.craft2OutEl = outEl;

        this.inventoryEl.appendChild(topRow);
        this.invEls = this._buildInvGrid(this.inventoryEl);
        this.inventoryEl.appendChild(closeHint);
    }

    _buildCraftingTableScreen() {
        const title = document.createElement('h2');
        title.textContent = 'Crafting Table';
        this.craftingTableEl.appendChild(title);

        const { els, outEl } = this._buildGridSection(this.craftingTableEl, null, 3, 'craft3', 'craftOutput3');
        this.craft3Els = els;
        this.craft3OutEl = outEl;

        this.craft3InvEls = this._buildInvGrid(this.craftingTableEl);
        const hint = document.createElement('p');
        hint.className = 'close-hint';
        hint.textContent = 'Press E or Esc to close';
        this.craftingTableEl.appendChild(hint);
    }

    _buildFurnaceScreen() {
        const title = document.createElement('h2');
        title.textContent = 'Furnace';
        this.furnaceEl.appendChild(title);

        const row = document.createElement('div');
        row.className = 'furnace-row';

        const leftCol = document.createElement('div');
        leftCol.className = 'furnace-col';
        this.furnaceInputEl = this._makeSlotEl('furnaceInput', 0);
        this.furnaceFuelEl = this._makeSlotEl('furnaceFuel', 0);
        const fuelLabel = document.createElement('div');
        fuelLabel.className = 'furnace-flame';
        fuelLabel.id = 'furnace-flame';
        leftCol.appendChild(this.furnaceInputEl);
        leftCol.appendChild(fuelLabel);
        leftCol.appendChild(this.furnaceFuelEl);
        this.furnaceFlameEl = fuelLabel;

        const arrow = document.createElement('div');
        arrow.className = 'craft-arrow furnace-progress-wrap';
        const progress = document.createElement('div');
        progress.className = 'furnace-progress';
        this.furnaceProgressEl = document.createElement('div');
        this.furnaceProgressEl.className = 'furnace-progress-fill';
        progress.appendChild(this.furnaceProgressEl);
        arrow.appendChild(progress);

        this.furnaceOutputEl = this._makeSlotEl('furnaceOutput', 0, true);
        this.furnaceOutputEl.classList.add('craft-output');

        row.appendChild(leftCol);
        row.appendChild(arrow);
        row.appendChild(this.furnaceOutputEl);
        this.furnaceEl.appendChild(row);

        this.furnaceInvEls = this._buildInvGrid(this.furnaceEl);
        const hint = document.createElement('p');
        hint.className = 'close-hint';
        hint.textContent = 'Press E or Esc to close';
        this.furnaceEl.appendChild(hint);
    }

    _buildChestScreen() {
        const title = document.createElement('h2');
        title.textContent = 'Chest';
        this.chestEl.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'main-inv-grid'; // 9x3
        this.chestGridEls = [];
        for (let i = 0; i < 27; i++) {
            const el = this._makeSlotEl('chest', i);
            grid.appendChild(el);
            this.chestGridEls.push(el);
        }
        this.chestEl.appendChild(grid);

        this.chestInvEls = this._buildInvGrid(this.chestEl);
        const hint = document.createElement('p');
        hint.className = 'close-hint';
        hint.textContent = 'Press E or Esc to close';
        this.chestEl.appendChild(hint);
    }

    _buildEnchantingScreen() {
        const title = document.createElement('h2');
        title.textContent = 'Enchanting Table';
        this.enchantEl.appendChild(title);

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '20px';
        row.style.alignItems = 'center';
        row.style.marginBottom = '16px';

        this.enchantSlotEl = this._makeSlotEl('enchant', 0);
        row.appendChild(this.enchantSlotEl);

        const btnCol = document.createElement('div');
        btnCol.className = 'enchant-row';
        this.enchantBtns = [];
        for (let i = 1; i <= 3; i++) {
            const btn = document.createElement('button');
            btn.className = 'enchant-btn disabled';
            btn.textContent = `Option ${i} (Requires Level ${i})`;
            btn.addEventListener('click', () => this.applyEnchantment(i));
            btnCol.appendChild(btn);
            this.enchantBtns.push(btn);
        }
        row.appendChild(btnCol);
        this.enchantEl.appendChild(row);

        this.enchantInvEls = this._buildInvGrid(this.enchantEl);
        const hint = document.createElement('p');
        hint.className = 'close-hint';
        hint.textContent = 'Press E or Esc to close';
        this.enchantEl.appendChild(hint);
    }

    // ---------------------------------------------------------------
    // Slot data access
    // ---------------------------------------------------------------
    _getSlotRef(kind, index) {
        switch (kind) {
            case 'inv': return { get: () => this.player.inventory.slots[index], set: (v) => { this.player.inventory.slots[index] = v; } };
            case 'armor': return { get: () => this.player.inventory.armor[index], set: (v) => { this.player.inventory.armor[index] = v; } };
            case 'craft2': return { get: () => this.craft2[index], set: (v) => { this.craft2[index] = v; } };
            case 'craft3': return { get: () => this.craft3[index], set: (v) => { this.craft3[index] = v; } };
            case 'furnaceInput': return { get: () => this.activeFurnaceEntity && this.activeFurnaceEntity.input, set: (v) => { if (this.activeFurnaceEntity) this.activeFurnaceEntity.input = v; } };
            case 'furnaceFuel': return { get: () => this.activeFurnaceEntity && this.activeFurnaceEntity.fuel, set: (v) => { if (this.activeFurnaceEntity) this.activeFurnaceEntity.fuel = v; } };
            case 'chest': return { get: () => this.activeChestEntity && this.activeChestEntity.items[index], set: (v) => { if (this.activeChestEntity) this.activeChestEntity.items[index] = v; } };
            case 'enchant': return { get: () => this.enchantItem, set: (v) => { this.enchantItem = v; } };
            default: return { get: () => null, set: () => {} };
        }
    }

    handleSlotClick(kind, index, isOutput) {
        if (!this.player) return;
        const maxStack = (id) => (ITEMS[id] && ITEMS[id].stack) || 64;

        if (kind === 'craftOutput2' || kind === 'craftOutput3') {
            const gridSize = kind === 'craftOutput2' ? 2 : 3;
            const grid = kind === 'craftOutput2' ? this.craft2 : this.craft3;
            const atTable = kind === 'craftOutput3';
            const match = matchRecipe(grid, gridSize, atTable);
            if (!match) return;
            if (this.heldItem && (this.heldItem.id !== match.resultId || this.heldItem.count + match.resultCount > maxStack(match.resultId))) return;
            consumeGrid(grid);
            if (this.heldItem) this.heldItem.count += match.resultCount;
            else this.heldItem = { id: match.resultId, count: match.resultCount };
            audio.playCraft();
            this.refreshAll();
            return;
        }

        if (kind === 'furnaceOutput') {
            if (!this.activeFurnaceEntity || !this.activeFurnaceEntity.output) return;
            const out = this.activeFurnaceEntity.output;
            if (this.heldItem && (this.heldItem.id !== out.id || this.heldItem.count + out.count > maxStack(out.id))) return;
            if (this.heldItem) this.heldItem.count += out.count;
            else this.heldItem = { id: out.id, count: out.count };
            this.activeFurnaceEntity.output = null;
            audio.playPop();
            this.refreshAll();
            return;
        }

        const ref = this._getSlotRef(kind, index);
        const current = ref.get();

        if (!this.heldItem) {
            if (current) {
                this.heldItem = current;
                ref.set(null);
            }
        } else if (!current) {
            ref.set(this.heldItem);
            this.heldItem = null;
        } else if (current.id === this.heldItem.id) {
            const space = maxStack(current.id) - current.count;
            const move = Math.min(space, this.heldItem.count);
            current.count += move;
            this.heldItem.count -= move;
            if (this.heldItem.count <= 0) this.heldItem = null;
        } else {
            ref.set(this.heldItem);
            this.heldItem = current;
        }

        this.refreshAll();
    }

    // ---------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------
    _renderSlotEl(el, item) {
        el._item = item;
        if (item && ITEMS[item.id]) {
            el._img.src = uiIcons[item.id] || '';
            el._img.style.display = 'block';
            el._count.textContent = item.count > 1 ? item.count : '';
            if (item.enchantments && Object.keys(item.enchantments).length > 0) {
                el.classList.add('enchanted-glint');
                const key = Object.keys(item.enchantments)[0];
                const lvl = item.enchantments[key];
                const shortKey = key === 'efficiency' ? 'Eff' : 'Shp';
                if (el._badge) el._badge.textContent = `${shortKey} ${lvl}`;
            } else {
                el.classList.remove('enchanted-glint');
                if (el._badge) el._badge.textContent = '';
            }
        } else {
            el._img.style.display = 'none';
            el._count.textContent = '';
            el.classList.remove('enchanted-glint');
            if (el._badge) el._badge.textContent = '';
        }
    }

    _showItemTooltip(item) {
        if (!item || !ITEMS[item.id] || !this.tooltipEl) return;
        let html = `<div class="title">${ITEMS[item.id].name}</div>`;
        if (item.enchantments) {
            for (const [k, v] of Object.entries(item.enchantments)) {
                const name = k === 'efficiency' ? 'Efficiency' : 'Sharpness';
                html += `<div class="ench">${name} ${v}</div>`;
            }
        }
        this.tooltipEl.innerHTML = html;
        this.tooltipEl.classList.remove('hidden');
    }

    _hideItemTooltip() {
        if (this.tooltipEl) this.tooltipEl.classList.add('hidden');
    }

    renderHotbar() {
        if (!this.hotbarEl || !this.player) return;
        const slots = this.hotbarEl.children;
        for (let i = 0; i < HOTBAR_SIZE; i++) {
            const slotEl = slots[i];
            slotEl.classList.toggle('active', i === this.player.activeSlot);
            const item = this.player.inventory.slots[i];
            const img = slotEl.querySelector('img');
            const count = slotEl.querySelector('.slot-count');
            let badge = slotEl.querySelector('.enchant-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'enchant-badge';
                slotEl.appendChild(badge);
            }
            if (item && ITEMS[item.id]) {
                img.src = uiIcons[item.id] || '';
                img.style.display = 'block';
                count.textContent = item.count > 1 ? item.count : '';
                if (item.enchantments && Object.keys(item.enchantments).length > 0) {
                    slotEl.classList.add('enchanted-glint');
                    const key = Object.keys(item.enchantments)[0];
                    const lvl = item.enchantments[key];
                    const shortKey = key === 'efficiency' ? 'Eff' : 'Shp';
                    badge.textContent = `${shortKey} ${lvl}`;
                } else {
                    slotEl.classList.remove('enchanted-glint');
                    badge.textContent = '';
                }
            } else {
                img.style.display = 'none';
                count.textContent = '';
                slotEl.classList.remove('enchanted-glint');
                badge.textContent = '';
            }
        }
    }

    updateXpBar() {
        if (!this.player) return;
        if (this.player.xp > 0 || this.player.level > 0) {
            this.xpBarContainer.style.display = 'block';
            const pct = (this.player.xp / this.player.getXpNeeded()) * 100;
            this.xpBarFill.style.width = pct + '%';
            if (this.player.level > 0) {
                this.xpLevelText.style.display = 'block';
                this.xpLevelText.textContent = this.player.level;
            } else {
                this.xpLevelText.style.display = 'none';
            }
        } else {
            this.xpBarContainer.style.display = 'none';
            this.xpLevelText.style.display = 'none';
        }
    }

    refreshAll() {
        this.renderHotbar();
        this._renderCursorItem();

        if (this.screen === 'inventory') {
            this.craft2Els.forEach((el, i) => this._renderSlotEl(el, this.craft2[i]));
            const match2 = matchRecipe(this.craft2, 2, false);
            this._renderSlotEl(this.craft2OutEl, match2 ? { id: match2.resultId, count: match2.resultCount } : null);
            if (this.armorEls) this.armorEls.forEach((el, i) => this._renderSlotEl(el, this.player.inventory.armor[i]));
            this._renderMirroredInv(this.invEls);
        } else if (this.screen === 'crafting_table') {
            this.craft3Els.forEach((el, i) => this._renderSlotEl(el, this.craft3[i]));
            const match3 = matchRecipe(this.craft3, 3, true);
            this._renderSlotEl(this.craft3OutEl, match3 ? { id: match3.resultId, count: match3.resultCount } : null);
            this._renderMirroredInv(this.craft3InvEls);
        } else if (this.screen === 'furnace') {
            this._renderFurnaceScreen();
            this._renderMirroredInv(this.furnaceInvEls);
        } else if (this.screen === 'chest') {
            const items = this.activeChestEntity ? this.activeChestEntity.items : [];
            this.chestGridEls.forEach((el, i) => this._renderSlotEl(el, items[i]));
            this._renderMirroredInv(this.chestInvEls);
        } else if (this.screen === 'enchanting') {
            this._renderEnchantingScreen();
        }
    }

    _renderMirroredInv(els) {
        // els order: 27 main slots (index 9..35) then 9 hotbar slots (index 0..8)
        if (!this.player) return;
        for (let i = 0; i < 27; i++) this._renderSlotEl(els[i], this.player.inventory.slots[i + HOTBAR_SIZE]);
        for (let i = 0; i < HOTBAR_SIZE; i++) this._renderSlotEl(els[27 + i], this.player.inventory.slots[i]);
    }

    _renderFurnaceScreen() {
        const e = this.activeFurnaceEntity;
        this._renderSlotEl(this.furnaceInputEl, e ? e.input : null);
        this._renderSlotEl(this.furnaceFuelEl, e ? e.fuel : null);
        this._renderSlotEl(this.furnaceOutputEl, e ? e.output : null);
        const frac = e ? Math.min(1, e.progress / 3.5) : 0;
        this.furnaceProgressEl.style.width = (frac * 100) + '%';
        this.furnaceFlameEl.classList.toggle('lit', !!(e && e.burnRemaining > 0));
    }

    _renderCursorItem() {
        if (!this.cursorItemEl) return;
        if (this.heldItem && ITEMS[this.heldItem.id]) {
            this.cursorItemEl.style.display = 'block';
            this.cursorItemEl.querySelector('img').src = uiIcons[this.heldItem.id] || '';
            this.cursorItemEl.querySelector('.slot-count').textContent = this.heldItem.count > 1 ? this.heldItem.count : '';
        } else {
            this.cursorItemEl.style.display = 'none';
        }
    }

    tick(dt) {
        if (this.screen === 'furnace') this._renderFurnaceScreen();
    }

    // ---------------------------------------------------------------
    // Screen management
    // ---------------------------------------------------------------
    anyScreenOpen() {
        return this.screen !== 'none';
    }

    _returnHeldAndGrids() {
        if (!this.player) return;
        const inv = this.player.inventory;
        if (this.heldItem) { inv.addItem(this.heldItem.id, this.heldItem.count); this.heldItem = null; }
        for (let i = 0; i < this.craft2.length; i++) {
            if (this.craft2[i]) { inv.addItem(this.craft2[i].id, this.craft2[i].count); this.craft2[i] = null; }
        }
        for (let i = 0; i < this.craft3.length; i++) {
            if (this.craft3[i]) { inv.addItem(this.craft3[i].id, this.craft3[i].count); this.craft3[i] = null; }
        }
    }

    openInventory() {
        this.screen = 'inventory';
        this.isInventoryOpen = true;
        this.inventoryEl.classList.remove('hidden');
        this.crosshair.style.display = 'none';
        this.hotbarEl.style.zIndex = '20';
        this.refreshAll();
    }

    openCraftingTable() {
        this.screen = 'crafting_table';
        this.isInventoryOpen = true;
        this.craftingTableEl.classList.remove('hidden');
        this.crosshair.style.display = 'none';
        this.hotbarEl.style.zIndex = '20';
        this.refreshAll();
    }

    openFurnace(x, y, z) {
        this.activeFurnacePos = { x, y, z };
        this.activeFurnaceEntity = this.world.getFurnaceAt(x, y, z);
        this.screen = 'furnace';
        this.isInventoryOpen = true;
        this.furnaceEl.classList.remove('hidden');
        this.crosshair.style.display = 'none';
        this.hotbarEl.style.zIndex = '20';
        this.refreshAll();
    }

    openChest(x, y, z) {
        this.activeChestEntity = this.world.getChestAt(x, y, z);
        if (!this.activeChestEntity) return;
        this.screen = 'chest';
        this.isInventoryOpen = true;
        this.chestEl.classList.remove('hidden');
        this.crosshair.style.display = 'none';
        this.hotbarEl.style.zIndex = '20';
        this.refreshAll();
    }

    openSettings() {
        this.screen = 'settings';
        this.isInventoryOpen = true;
        this.settingsEl.classList.remove('hidden');
        this.crosshair.style.display = 'none';
        this.hotbarEl.style.zIndex = '20';
    }

    openEnchantingTable() {
        this.screen = 'enchanting';
        this.isInventoryOpen = true;
        this.enchantEl.classList.remove('hidden');
        this.crosshair.style.display = 'none';
        this.hotbarEl.style.zIndex = '20';
        this.refreshAll();
    }

    applyEnchantment(cost) {
        if (!this.player || this.player.level < cost || !this.enchantItem) return;
        const item = this.enchantItem;
        if (!ITEMS[item.id] || ITEMS[item.id].category !== 'tool') return;

        this.player.level -= cost;
        this.updateXpBar();

        if (!item.enchantments) item.enchantments = {};
        if (item.id.includes('sword') || item.id.includes('axe')) {
            item.enchantments.sharpness = cost;
        } else {
            item.enchantments.efficiency = cost;
        }

        audio.playLevelUp();
        if (this.player && this.player.particleManager) {
            const p = this.player.camera.position;
            this.player.particleManager.spawnEnchantBurst(p.x, p.y - 0.5, p.z);
        }
        this.refreshAll();
    }

    _renderEnchantingScreen() {
        this._renderSlotEl(this.enchantSlotEl, this.enchantItem);
        this._renderMirroredInv(this.enchantInvEls);

        const item = this.enchantItem;
        const canEnchant = item && ITEMS[item.id] && ITEMS[item.id].category === 'tool';

        for (let i = 1; i <= 3; i++) {
            const btn = this.enchantBtns[i - 1];
            if (!canEnchant) {
                btn.className = 'enchant-btn disabled';
                btn.textContent = `Option ${i} (Requires Tool)`;
            } else {
                const cost = i;
                const enchName = (item.id.includes('sword') || item.id.includes('axe')) ? `Sharpness ${i}` : `Efficiency ${i}`;
                const hasLevel = this.player && this.player.level >= cost;
                btn.className = 'enchant-btn' + (hasLevel ? '' : ' disabled');
                btn.textContent = `${enchName} (Cost: ${cost} Lvl)`;
            }
        }
    }

    _buildWaypointScreen() {
        if (!this.addWpBtn) return;
        this.addWpBtn.addEventListener('click', () => {
            if (!this.player || !this.player.waypointManager) return;
            const name = (this.wpNameInput.value || '').trim() || 'Waypoint';
            const pos = this.player.camera.position;
            this.player.waypointManager.addWaypoint(name, pos.x, pos.y - this.player.height, pos.z);
            this.wpNameInput.value = '';
            this.renderWaypointList();
        });
    }

    openWaypointScreen() {
        this.screen = 'waypoint';
        this.isInventoryOpen = true;
        this.waypointEl.classList.remove('hidden');
        this.crosshair.style.display = 'none';
        this.hotbarEl.style.zIndex = '20';
        this.renderWaypointList();
    }

    renderWaypointList() {
        if (!this.wpListEl || !this.player || !this.player.waypointManager) return;
        this.wpListEl.innerHTML = '';
        const waypoints = this.player.waypointManager.waypoints;
        if (waypoints.length === 0) {
            this.wpListEl.innerHTML = '<div style="color:#aaa; font-size:13px; text-align:center; padding:10px;">No waypoints saved yet.</div>';
            return;
        }
        for (const wp of waypoints) {
            const item = document.createElement('div');
            item.className = 'wp-item';
            const icon = wp.type === 'death' ? '💀' : '📍';
            item.innerHTML = `
                <div>
                    <span style="font-weight:bold; color:${wp.color}">${icon} ${wp.name}</span>
                    <span style="color:#aaa; font-size:12px; margin-left:6px;">(${wp.x}, ${wp.y}, ${wp.z})</span>
                </div>
            `;
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Remove';
            delBtn.addEventListener('click', () => {
                this.player.waypointManager.removeWaypoint(wp.id);
                this.renderWaypointList();
            });
            item.appendChild(delBtn);
            this.wpListEl.appendChild(item);
        }
    }

    toggleDebugCoords() {
        if (!this.coordsDebugEl) return;
        this.coordsDebugEl.classList.toggle('hidden');
    }

    updateCoords(player, mobManager, entityManager) {
        if (!player || !this.coordsPosEl) return;
        const pos = player.camera.position;
        this.coordsPosEl.textContent = `XYZ: ${Math.floor(pos.x)} / ${Math.floor(pos.y - player.height)} / ${Math.floor(pos.z)}`;

        import('./three.module.js').then ? null : null; // Direction check via THREE Vector
        const dir = player.camera.getWorldDirection(new (player.camera.position.constructor)());
        let facing = 'North (-Z)';
        if (Math.abs(dir.x) > Math.abs(dir.z)) {
            facing = dir.x > 0 ? 'East (+X)' : 'West (-X)';
        } else {
            facing = dir.z > 0 ? 'South (+Z)' : 'North (-Z)';
        }
        this.coordsFacingEl.textContent = `Facing: ${facing}`;

        if (!this.coordsDebugEl.classList.contains('hidden')) {
            const cx = Math.floor(pos.x / 16);
            const cz = Math.floor(pos.z / 16);
            const mobCount = mobManager ? mobManager.mobs.length : 0;
            const itemCount = entityManager ? entityManager.items.length + entityManager.xpOrbs.length : 0;
            this.coordsDebugEl.textContent = `Chunk: ${cx}, ${cz} | Mobs: ${mobCount} | Entities: ${itemCount}`;
        }
    }

    closeAllScreens() {
        this._returnHeldAndGrids();
        this.screen = 'none';
        this.isInventoryOpen = false;
        this.activeFurnacePos = null;
        this.activeFurnaceEntity = null;
        this.inventoryEl.classList.add('hidden');
        this.craftingTableEl.classList.add('hidden');
        this.furnaceEl.classList.add('hidden');
        this.chestEl.classList.add('hidden');
        this.enchantEl.classList.add('hidden');
        if (this.waypointEl) this.waypointEl.classList.add('hidden');
        this.settingsEl.classList.add('hidden');
        this.crosshair.style.display = 'block';
        this._renderCursorItem();
        this.refreshAll();
    }

    // Legacy alias used by main.js
    closeInventory() { this.closeAllScreens(); }

    // ---------------------------------------------------------------
    // HUD: vitals, mining, death
    // ---------------------------------------------------------------
    updateVitals(health, hunger, breath, underwater) {
        if (!this.heartsEl) return;
        const heartEls = this.heartsEl.children;
        for (let i = 0; i < 10; i++) {
            const val = Math.max(0, Math.min(2, health - i * 2));
            heartEls[i].className = 'heart ' + (val >= 2 ? 'full' : val === 1 ? 'half' : 'empty');
        }
        const hungerEls = this.hungerEl.children;
        for (let i = 0; i < 10; i++) {
            const val = Math.max(0, Math.min(2, hunger - i * 2));
            hungerEls[i].className = 'drumstick ' + (val >= 2 ? 'full' : val === 1 ? 'half' : 'empty');
        }
        if (this.breathEl) {
            this.breathEl.style.display = underwater ? 'flex' : 'none';
            const bubbleEls = this.breathEl.children;
            const bubbleCount = Math.ceil((breath / 15) * 10);
            for (let i = 0; i < 10; i++) {
                bubbleEls[i].className = 'bubble ' + (i < bubbleCount ? 'full' : 'empty');
            }
        }
        if (this.underwaterOverlay) {
            if (underwater) this.underwaterOverlay.classList.remove('hidden');
            else this.underwaterOverlay.classList.add('hidden');
        }
    }

    setMiningProgress(frac) {
        if (!this.miningBarEl) return;
        if (frac <= 0) {
            this.miningBarEl.style.display = 'none';
        } else {
            this.miningBarEl.style.display = 'block';
            this.miningBarFillEl.style.width = (frac * 100) + '%';
        }
    }

    openAuthModal() {
        this.closeAllScreens();
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.screen = 'auth';
            this.checkAuthStatus();
        }
    }

    async checkAuthStatus() {
        const user = await getCurrentUser();
        const infoDiv = document.getElementById('auth-user-info');
        const formDiv = document.getElementById('auth-form');
        const emailDisp = document.getElementById('auth-email-display');
        const authTitle = document.getElementById('auth-title');
        const accountBtn = document.getElementById('account-btn');

        if (user) {
            if (authTitle) authTitle.textContent = 'Account Profile';
            if (infoDiv) infoDiv.classList.remove('hidden');
            if (formDiv) formDiv.classList.add('hidden');
            if (emailDisp) emailDisp.textContent = user.email;
            if (accountBtn) accountBtn.textContent = 'Account 👤 (Logged In)';
        } else {
            if (authTitle) authTitle.textContent = 'Account Login';
            if (infoDiv) infoDiv.classList.add('hidden');
            if (formDiv) formDiv.classList.remove('hidden');
            if (accountBtn) accountBtn.textContent = 'Account 👤';
        }
    }

    initAuthHandlers() {
        const form = document.getElementById('auth-form');
        const signupBtn = document.getElementById('auth-signup-btn');
        const logoutBtn = document.getElementById('auth-logout-btn');
        const msgDiv = document.getElementById('auth-msg');

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('auth-email').value;
                const password = document.getElementById('auth-password').value;
                if (msgDiv) msgDiv.textContent = 'Signing in...';
                const { data, error } = await signIn(email, password);
                if (error) {
                    if (msgDiv) msgDiv.textContent = error.message;
                } else {
                    if (msgDiv) msgDiv.textContent = '';
                    this.checkAuthStatus();
                    const cloudSave = await loadProgressFromCloud();
                    if (cloudSave) {
                        localStorage.setItem('teecraft_save_v1', JSON.stringify(cloudSave));
                        alert('Cloud save loaded! Reloading world with your saved progress...');
                        location.reload();
                    }
                }
            });
        }

        if (signupBtn) {
            signupBtn.addEventListener('click', async () => {
                const email = document.getElementById('auth-email').value;
                const password = document.getElementById('auth-password').value;
                if (!email || !password) {
                    if (msgDiv) msgDiv.textContent = 'Please enter email & password';
                    return;
                }
                if (msgDiv) msgDiv.textContent = 'Creating account...';
                const { data, error } = await signUp(email, password);
                if (error) {
                    if (msgDiv) msgDiv.textContent = error.message;
                } else {
                    if (msgDiv) msgDiv.textContent = 'Account created successfully!';
                    this.checkAuthStatus();
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await signOut();
                this.checkAuthStatus();
            });
        }
    }

    showDeathScreen() {
        this.deathEl.classList.remove('hidden');
        this.crosshair.style.display = 'none';
        this.hotbarEl.style.display = 'none';
    }

    hideDeathScreen() {
        this.deathEl.classList.add('hidden');
        this.crosshair.style.display = 'block';
        this.hotbarEl.style.display = 'flex';
    }
}

export const ui = new UI();
