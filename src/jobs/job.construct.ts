import * as Job from "jobs/job";
import { log } from "log";
import * as Settings from "settings";

export interface Data extends Job.Data {
    // Structure to construct
    structure_type: string;
}

export function construct(type: string, factory: string, room: string, x: number, y: number,
                          structure_type: string, priority?: number, ttl?: number): Data {
    const base = Job.construct(type, factory, room, x, y, priority, ttl) as Data;
    base.structure_type = structure_type;
    return base;
}

export function construct_auto_pos(type: string, factory: string, room: string,
                                   structure_type: string, priority?: number, ttl?: number): Data {
    const base = Job.construct(type, factory, room, -1, -1, priority, ttl) as Data;
    base.structure_type = structure_type;
    return base;
}

export function get_controller_structure_max(room: Room, structure: string): number {
    if (!room.controller || !room.controller.my) {
        return 0;
    }
    return CONTROLLER_STRUCTURES[structure][room.controller.level];
}

export function get_controller_structures(room: Room, structure: string): Structure[] {
    return room.find(FIND_MY_STRUCTURES, { filter: { structureType: structure } });
}

export function get_under_construction(room: Room, structure: string): ConstructionSite[] {
    return room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: structure } });
}

// Factory assign function
export function assign(_job: Data): boolean {
    return true;
}

// Factory update function
export function update(this_: Data, auto_pos?: (job: Data) => RoomPosition | null): void {
    let room_pos: RoomPosition | null = null;
    if (this_.x === -1 && auto_pos) {
        room_pos = auto_pos(this_);
    } else if (this_.x !== -1) {
        room_pos = Job.get_pos(this_);
    }

    if (!room_pos) {
        log("job.construct", `Construct job ${this_.id} failed: couldn't find position`, Settings.LogLevel.ERROR);
    } else {
        const res = Game.rooms[room_pos.roomName].createConstructionSite(room_pos, this_.structure_type);
        if (res !== OK) {
            log("job.construct", `Construct job ${this_.id} of ${this_.structure_type} at ${room_pos.roomName},${room_pos.x},${room_pos.y} failed with code ${res}`, Settings.LogLevel.ERROR);
        }
    }

    this_.active = false;
}
