export interface Data {
    type: string;
    factory: string;
    id: string;
    priority: number;
    active: boolean;
    x: number;
    y: number;
    room: string;
}

export function construct(type: string, factory: string, pos: RoomPosition, priority: number): Data {
    return {
        factory,
        id: `${type}:${location}:${priority}:${Math.random()}`,
        priority,
        room: pos.roomName,
        type,
        x: pos.x,
        y: pos.y
    } as Data;
}

export function get_pos(this_: Data) {
    return Game.rooms[this_.room].getPositionAt(this_.x, this_.y);
}
