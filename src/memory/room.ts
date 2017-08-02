import * as _ from "lodash";
import { log } from "log";
import * as CreepMemory from "memory/creep";

export const ROOM_SIZE = 50;

export interface MetaData {
    source_spaces: any;
}

export function construct_metadata(room: Room): MetaData {
    const source_spaces: any = {};
    room.find(FIND_SOURCES).forEach((s: Source) => {
        const terrain = (room.lookForAtArea(LOOK_TERRAIN, s.pos.y - 1, s.pos.x - 1,
            s.pos.y + 1, s.pos.x + 1, true) as LookAtResultWithPos[])
            .filter((t: LookAtResultWithPos) => t.terrain === "wall");
        // log.log("room_metadata", "room " +
        // room.name + " source " + s.id + " has " + terrain.length + " blockers");
        source_spaces[s.id] = 9 - terrain.length;
    });
    log("metadata", `room ${room.name} metadata = ${JSON.stringify(source_spaces)}`);
    return { source_spaces } as MetaData;
}

export function get_metadata(room: Room): MetaData {
    if (!room.memory.metadata) {
        room.memory.metadata = construct_metadata(room);
    }
    return room.memory.metadata as MetaData;
}

export interface Stats {
    harvest_rate: number;
}

export function construct_stats(): Stats {
    return { harvest_rate: 0 } as Stats;
}

export function get_stats(room: Room): Stats {
    if (!room.memory.stats) {
        room.memory.stats = construct_stats();
        update_stats(room);
    }
    return room.memory.stats as Stats;
}

export function update_stats(room: Room) {
    const stats = get_stats(room);
    const havesters = room.find(FIND_MY_CREEPS, { filter: (c: Creep) => CreepMemory.get(c).role === "harvester" });
    stats.harvest_rate = _.reduce(havesters, (sum: number, c: Creep) => sum + CreepMemory.get(c).harvest_rate, 0);
    log("stats", `room ${room.name} stats = ${JSON.stringify(stats)}`);
}
