export interface Pos {
    x: number;
    y: number;
}

export function dist_2(a: Pos, b: Pos): number {
    const abx = a.x - b.x;
    const aby = a.y - b.y;
    return abx * abx + aby * aby;
}

export function add(a: Pos, b: Pos): Pos {
    return make_pos(a.x + b.x, a.y + b.y);
}

export function sub(a: Pos, b: Pos): Pos {
    return make_pos(a.x - b.x, a.y - b.y);
}

export function get_pos(p: RoomPosition): Pos {
    return {x: p.x, y: p.y};
}

export function make_pos(x: number, y: number): Pos {
    return {x, y};
}

export function room_pos(p: Pos, room: Room): RoomPosition | null {
    return room.getPositionAt(p.x, p.y);
}

export function same_pos(a: Pos, b: Pos): boolean {
    return a.x === b.x && a.y === b.y;
}
