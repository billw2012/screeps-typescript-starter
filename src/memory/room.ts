import * as _ from "lodash";
import { log } from "log";
import { CreepMemory } from "memory/creep";

export class RoomMetadata {
    public static get(room: Room): RoomMetadata {
        if (!room.memory.metadata) {
            room.memory.metadata = new RoomMetadata(room);
        }
        return room.memory.metadata as RoomMetadata;
    }
    /**
     * Number of unblocked spaces adjacent to each source.
     * Useful to determine how many harvesters could operate at the same time.
     */
    public source_spaces: Map<string, number>;

    constructor(room: Room) {
        this.source_spaces = new Map<string, number>();

        room.find(FIND_SOURCES).forEach((s: Source) => {
            const terrain = (room.lookForAtArea(LOOK_TERRAIN, s.pos.y - 1, s.pos.x - 1,
                s.pos.y + 1, s.pos.x + 1, true) as LookAtResultWithPos[])
                .filter((t: LookAtResultWithPos) => t.terrain === "wall");
            // log.log("room_metadata", "room " +
            // room.name + " source " + s.id + " has " + terrain.length + " blockers");
            this.source_spaces.set(s.id, 9 - terrain.length);
        });
        log("metadata", `room ${room.name} metadata = ${JSON.stringify(this)}`);
    }
}

export class RoomStats {
    public static get(room: Room): RoomStats {
        if (!room.memory.stats) {
            room.memory.stats = new RoomStats(room);
        }
        return room.memory.stats as RoomStats;
    }

    public static update(room: Room) {
        const stats = RoomStats.get(room);
        const havesters = room.find(FIND_MY_CREEPS, { filter: (c: Creep) => CreepMemory.get(c).role === "harvester" });
        stats.harvest_rate = _.reduce(havesters, (sum: number, c: Creep) => sum + CreepMemory.get(c).harvest_rate, 0);
        log("stats", `room ${room.name} stats = ${JSON.stringify(stats)}`);
    }

    public harvest_rate: number = 0;

    public constructor(room: Room) {
        RoomStats.update(room);
    }
}
