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
