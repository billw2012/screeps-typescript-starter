import { ROOM_SIZE } from "memory/room";

/**
 * Clamp x between a and b
 * @param x - value to clamp
 * @param a - min value
 * @param b - max value
 */
export function clamp(x: number, a: number, b: number): number {
    return Math.max(Math.min(x, b), a);
}

export function same_pos(a: RoomPosition, b: RoomPosition): boolean {
    return a.roomName === b.roomName && a.x === b.x && a.y === b.y;
}

export function no_wall_r(x: number, y: number, room_name: string) {
    if (x < 0 || y < 0 || x >= ROOM_SIZE || y >= ROOM_SIZE) {
        return false;
    }
    return Game.map.getTerrainAt(x, y, room_name) !== "wall";
}

export function no_wall(x: number, y: number, room: Room) {
    if (x < 0 || y < 0 || x >= ROOM_SIZE || y >= ROOM_SIZE) {
        return false;
    }
    return Game.map.getTerrainAt(x, y, room.name) !== "wall";
}

export function box_search(from: RoomPosition, pred: (x: number, y: number, room: Room) => boolean, dist_scale: number = 2,
                           dist_min: number = 2, dist_max: number = 20): RoomPosition | null {
    const room = Game.rooms[from.roomName];
    // Boxsearch
    for (let dist = dist_min; dist < dist_max; ++dist) {
        const dists = dist * dist_scale;
        for (let i = -dist; i < dist; ++i) {
            const ii = i * dist_scale;
            const iix = ii + from.x;
            const iiy = ii + from.y;
            // Top side
            if (pred(iix, -dists + from.y, room)) {
                return room.getPositionAt(iix, -dists + from.y);
            }
            // Bottom side
            if (pred(iix, dists + from.y, room)) {
                return room.getPositionAt(iix, dists + from.y);
            }
            // Left side
            if (pred(dists + from.x, iiy, room)) {
                return room.getPositionAt(dists + from.x, iiy);
            }
            // Right side
            if (pred(-dists + from.x, iiy, room)) {
                return room.getPositionAt(-dists + from.x, iiy);
            }
        }
    }
    return null;
}

export function cross_is_clear(x: number, y: number, room: Room) {
    const check_pos = (x_: number, y_: number): boolean =>
        x_ > 1 && x_ < 48 && y_ > 1 && y_ < 48 &&
        no_wall(x_, y_, room) &&
        room.lookForAt(LOOK_STRUCTURES, x_, y_).length === 0 &&
        room.lookForAt(LOOK_CONSTRUCTION_SITES, x_, y_).length === 0;
    return check_pos(x - 1, y) && check_pos(x, y) && check_pos(x + 1, y) && check_pos(x, y - 1) && check_pos(x, y + 1);
}

export function terrain_in_area(x: number, y: number, room: Room, size: number, filter: (t: LookAtResultWithPos) => boolean): LookAtResultWithPos[] {
    return (room.lookForAtArea(LOOK_TERRAIN, y - size, x - size,
        y + size, x + size, true) as LookAtResultWithPos[])
        .filter(filter);
}

export function look_at_area(type: string, x: number, y: number, room: Room, size: number): LookAtResultWithPos[] {
    return room.lookForAtArea(type, y - size, x - size, y + size, x + size, true) as LookAtResultWithPos[];
}

export function box_is_clear(x: number, y: number, room: Room, size: number) {
    return x - size > 1 && x + size < 48 && y - size > 1 && y + size < 48 &&
        terrain_in_area(x, y, room, size, (t: LookAtResultWithPos) => t.terrain === "wall").length === 0 &&
        look_at_area(LOOK_STRUCTURES, x, y, room, size).length === 0 &&
        look_at_area(LOOK_CONSTRUCTION_SITES, x, y, room, size).length === 0;
}
