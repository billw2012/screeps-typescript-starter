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

export function construct(type: string, factory: string,
                          room: string, x: number, y: number, priority: number): Data {
    return {
        factory,
        id: `${type}:${room}:${x}:${y}:${priority}:${Math.random()}`,
        priority,
        room,
        type,
        x,
        y
    } as Data;
}

export function get_pos(this_: Data) {
    return Game.rooms[this_.room].getPositionAt(this_.x, this_.y);
}
