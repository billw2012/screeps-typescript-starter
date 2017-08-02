export interface Data {
    type: string;
    factory: string;
    id: string;
    priority: number;
    active: boolean;
    x: number;
    y: number;
    room: string;
    created: number;
    ttl: number;
}

export function construct(type: string, factory: string,
                          room: string, x: number, y: number, priority?: number,
                          ttl?: number): Data {
    const created = Game.time;
    return {
        created,
        factory,
        id: `${type}:${room}:${x}:${y}:${priority}:${created}:${Math.random()}`,
        priority,
        room,
        ttl,
        type,
        x,
        y
    } as Data;
}

export function construct_from_pos(type: string, factory: string,
                                   pos: RoomPosition, priority?: number,
                                   ttl?: number): Data {
    const created = Game.time;
    return {
        created,
        factory,
        id: `${type}:${pos.roomName}:${pos.x}:${pos.y}:${priority}:${created}:${Math.random()}`,
        priority,
        room: pos.roomName,
        ttl,
        type,
        x: pos.x,
        y: pos.y
    } as Data;
}
export function get_pos(this_: Data) {
    return Game.rooms[this_.room].getPositionAt(this_.x, this_.y);
}
