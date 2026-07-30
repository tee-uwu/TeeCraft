import { RECIPES } from './items.js';

// grid: flat array (row-major) of {id,count}|null, gridSize x gridSize.
// Returns { recipe, resultId, resultCount } or null.
export function matchRecipe(grid, gridSize, atTable) {
    // Bounding box of filled cells
    let minR = gridSize, maxR = -1, minC = gridSize, maxC = -1;
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (grid[r * gridSize + c]) {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }
        }
    }
    if (maxR === -1) return null; // empty grid
    const boxH = maxR - minR + 1;
    const boxW = maxC - minC + 1;

    for (const recipe of RECIPES) {
        if (recipe.needsTable && !atTable) continue;
        if (!recipe.shaped) continue;

        const pattern = recipe.pattern;
        const patH = pattern.length;
        const patW = Math.max(...pattern.map(row => row.length));
        if (patH > gridSize || patW > gridSize) continue;
        if (patH !== boxH || patW !== boxW) continue;

        let ok = true;
        for (let r = 0; r < patH && ok; r++) {
            for (let c = 0; c < patW && ok; c++) {
                const ch = pattern[r][c] || '.';
                const cell = grid[(minR + r) * gridSize + (minC + c)];
                if (ch === '.') {
                    if (cell) ok = false;
                } else {
                    const neededId = recipe.key[ch];
                    if (!cell || cell.id !== neededId) ok = false;
                }
            }
        }
        if (ok) {
            return { recipe, resultId: recipe.result.id, resultCount: recipe.result.count };
        }
    }
    return null;
}

export function consumeGrid(grid) {
    for (let i = 0; i < grid.length; i++) {
        if (grid[i]) {
            grid[i].count--;
            if (grid[i].count <= 0) grid[i] = null;
        }
    }
}
