import { ITEMS } from './items.js';

const HOTBAR_SIZE = 9;
const MAIN_SIZE = 27;
export const INVENTORY_SIZE = HOTBAR_SIZE + MAIN_SIZE; // 36, slots 0-8 = hotbar

export class Inventory {
    constructor() {
        this.slots = new Array(INVENTORY_SIZE).fill(null);
        this.armor = new Array(4).fill(null);
    }

    stackSizeFor(id) {
        return (ITEMS[id] && ITEMS[id].stack) || 64;
    }

    // Adds up to `count` of item `id`. Returns leftover count that didn't fit.
    addItem(id, count = 1) {
        if (!id || count <= 0) return count;
        const maxStack = this.stackSizeFor(id);
        let remaining = count;

        // First, top up existing stacks
        for (let i = 0; i < this.slots.length && remaining > 0; i++) {
            const s = this.slots[i];
            if (s && s.id === id && s.count < maxStack) {
                const add = Math.min(maxStack - s.count, remaining);
                s.count += add;
                remaining -= add;
            }
        }
        // Then, fill empty slots
        for (let i = 0; i < this.slots.length && remaining > 0; i++) {
            if (!this.slots[i]) {
                const add = Math.min(maxStack, remaining);
                this.slots[i] = { id, count: add };
                remaining -= add;
            }
        }
        return remaining; // >0 means inventory was full
    }

    hasSpaceFor(id, count = 1) {
        const test = new Inventory();
        test.slots = this.slots.map(s => s ? { ...s } : null);
        return test.addItem(id, count) === 0;
    }

    // Removes up to `count` of item `id` from anywhere. Returns how many were removed.
    removeItem(id, count = 1) {
        let remaining = count;
        for (let i = 0; i < this.slots.length && remaining > 0; i++) {
            const s = this.slots[i];
            if (s && s.id === id) {
                const take = Math.min(s.count, remaining);
                s.count -= take;
                remaining -= take;
                if (s.count <= 0) this.slots[i] = null;
            }
        }
        return count - remaining;
    }

    countItem(id) {
        let total = 0;
        for (const s of this.slots) if (s && s.id === id) total += s.count;
        return total;
    }

    getHotbar() {
        return this.slots.slice(0, HOTBAR_SIZE);
    }

    serialize() {
        return this.slots.map(s => s ? { id: s.id, count: s.count } : null);
    }

    deserialize(data) {
        if (!Array.isArray(data)) return;
        this.slots = new Array(INVENTORY_SIZE).fill(null);
        for (let i = 0; i < Math.min(data.length, INVENTORY_SIZE); i++) {
            this.slots[i] = data[i] ? { id: data[i].id, count: data[i].count } : null;
        }
        
        // Armor (not saved in this simple version, but initialized just in case)
        this.armor = new Array(4).fill(null);
    }
}

export { HOTBAR_SIZE, MAIN_SIZE };
