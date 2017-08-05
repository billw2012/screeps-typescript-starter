import * as _ from "lodash";
import * as pos from "pos";
import * as utils from "utils";

function have_visited(grid: boolean[], x: number, y: number): boolean {
    return grid[y * utils.ROOM_SIZE + x];
}

function mark_visited(grid: boolean[], x: number, y: number): void {
    grid[y * utils.ROOM_SIZE + x] = true;
}

// const FLOOD_SEARCH_OFFSETS: pos.Pos[] = [
//     { x: -1, y: -1 },
//     { x: 0, y: -1 },
//     { x: 1, y: -1 },
//     { x: -1, y: 0 },
//     { x: 1, y: 0 },
//     { x: -1, y: 1 },
//     { x: 0, y: 1 },
//     { x: 1, y: 1 },
// ];

// function search_internal(grid: boolean[], x: number, y: number, in_area: (x: number, y: number) => boolean, is_done: (x: number, y: number) => boolean): pos.Pos | null {
//     if (have_visited(grid, x, y)) { return null; }
//     mark_visited(grid, x, y);
//     if (!in_area(x, y)) { return null; }
//     if (is_done(x, y)) { return pos.make_pos(x, y); }

//     return _.find(FLOOD_SEARCH_OFFSETS, (offs: pos.Pos) => search_internal(grid, x + offs.x, y + offs.y, in_area, is_done));
// }

const FLOOD_SEARCH_OFFSETS_QUAD: pos.Pos[] = [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
];
export function search(x: number, y: number, in_area: (x: number, y: number) => boolean, is_done: (x: number, y: number) => boolean): pos.Pos | null {
    const grid: boolean[] = [];
    grid.fill(false, 0, utils.ROOM_SIZE * utils.ROOM_SIZE);
    const queue: pos.Pos[] = [pos.make_pos(x, y)];
    while (queue.length !== 0) {
        const p = queue.shift() as pos.Pos;
        if (!have_visited(grid, p.x, p.y)) {
            mark_visited(grid, p.x, p.y);
            if (in_area(p.x, p.y)) {
                if (is_done(p.x, p.y)) { return p; }
                _.forEach(FLOOD_SEARCH_OFFSETS_QUAD, (offs: pos.Pos) => queue.push(pos.add(p, offs)));
            }
        }
    }
    return null;
}
