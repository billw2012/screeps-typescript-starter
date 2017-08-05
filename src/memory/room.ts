import * as _ from "lodash";
import { log, Settings } from "log";
// import * as CreepMemory from "memory/creep";
import * as utils from "utils";

export const ROOM_SIZE = 50;

export interface Pos {
    x: number;
    y: number;
}

export function dist_2(a: Pos, b: Pos): number {
    const abx = a.x - b.x;
    const aby = a.y - b.y;
    return abx * abx + aby * aby;
}

export enum MetadataFlags {
    None = 0,
    SourceSpaceCount = 1 << 0,
    OpenSpaces = 1 << 1,
    RallyPoints = 1 << 2,
    Spawns = 1 << 3,
    Extensions = 1 << 4,
    Roads = 1 << 5,
    Walls = 1 << 6,
    KeepClear = 1 << 7,
    All = SourceSpaceCount | OpenSpaces | RallyPoints | Spawns | Extensions | Roads | Walls | KeepClear
}
const MetadataFlagsBits = 8;

const METADATA_FUNCTIONS = {
    [MetadataFlags.SourceSpaceCount]: calc_source_spaces,
    [MetadataFlags.OpenSpaces]: scan_for_space,
    [MetadataFlags.RallyPoints]: calculate_rally_points,
    [MetadataFlags.Spawns]: calculate_spawns,
    [MetadataFlags.Extensions]: calculate_extensions,
    [MetadataFlags.Roads]: calculate_roads,
    [MetadataFlags.Walls]: calculate_walls,
    [MetadataFlags.KeepClear]: calculate_keep_clear,
};

export interface SourceSpaces {
    [key: string]: number;
}

export interface MetaData {
    flags: MetadataFlags;
    source_spaces?: SourceSpaces;
    scan?: Pos;
    open_spaces: Pos[][];
    distance_field: number[][];
    keep_clear: boolean[][];
    rally_points: Pos[];
    spawns: Pos[];
    extensions: Pos[];
    roads: Pos[];
    walls: Pos[];
}

export function construct_metadata(): MetaData {
    return {
        distance_field: [],
        extensions: [],
        flags: MetadataFlags.None,
        keep_clear: [],
        open_spaces: [],
        rally_points: [],
        roads: [],
        scan: undefined,
        source_spaces: undefined,
        spawns: [],
        walls: [],
    } as MetaData;
}

export function get_metadata(room: Room): MetaData {
    if (!room.memory.metadata) {
        room.memory.metadata = construct_metadata();
        clear_room(room);
    }
    return room.memory.metadata as MetaData;
}

export function is_metadata_ready(room: Room, type: MetadataFlags): boolean {
    return (get_metadata(room).flags & type) === type;
}

export function get_rally_points(room: Room): Pos[] {
    const md = get_metadata(room);
    if (md.flags & MetadataFlags.RallyPoints) {
        return md.rally_points;
    }
    return [];
}

// TODO:
// Add keep clear grid to stop idlers from blocking routes:
//   path find routes to all edges, sources and controllers from spawns and flag them in the grid.
//   flag areas around spawn and sources.
// Replace stopblocking with idle job for all creeps without jobs to move off the keep clear grid.
// All building should be done on checker board pattern.
export function update_metadata(room: Room) {
    const md = get_metadata(room);
    // const havesters = room.find(FIND_MY_CREEPS, { filter: (c: Creep) => CreepMemory.get(c).role === "harvester" });
    // stats.harvest_rate = _.reduce(havesters, (sum: number, c: Creep) => sum + CreepMemory.get(c).harvest_rate, 0);
    // log("stats", `room ${room.name} stats = ${JSON.stringify(stats)}`);

    if (md.flags === MetadataFlags.All) {
        return;
    }

    const stats_settings = Settings.get().stats;
    const start_cpu = Game.cpu.getUsed();
    const allowed_cpu = Game.cpu.limit - start_cpu;

    while (md.flags !== MetadataFlags.All && (Game.cpu.getUsed() - start_cpu) / allowed_cpu < stats_settings.scan_cpu_cap) {
        for (let idx = 0; idx < MetadataFlagsBits; ++idx) {
            const flag = 1 << idx;
            if ((md.flags & flag) === 0) {
                log("metadata", `Room ${room.name} calculating ${MetadataFlags[flag]} (${flag})`);
                const func: any = METADATA_FUNCTIONS[flag];
                if (func(md, stats_settings, room)) {
                    md.flags |= flag;
                    log("metadata", `Room ${room.name} done calculating ${MetadataFlags[flag]}`);
                }
                break;
            }
        }
    }
}

function clear_room(room: Room): boolean {
    _.forEach(room.find(FIND_FLAGS, { filter: (obj: Flag) => obj.name.startsWith("Rally point") }), (flag: Flag) => flag.remove());
    return true;
}

function calc_source_spaces(md: MetaData, _stats_settings: Settings.StatsSettings, room: Room): boolean {
    const source_spaces: SourceSpaces = {};
    room.find(FIND_SOURCES).forEach((s: Source) => {
        const terrain = (room.lookForAtArea(LOOK_TERRAIN, s.pos.y - 1, s.pos.x - 1,
            s.pos.y + 1, s.pos.x + 1, true) as LookAtResultWithPos[])
            .filter((t: LookAtResultWithPos) => t.terrain === "wall");
        source_spaces[s.id] = 9 - terrain.length;
    });
    md.source_spaces = source_spaces;
    return true;
}

function scan_for_space(md: MetaData, stats_settings: Settings.StatsSettings, room: Room): boolean {
    // Update room "distance fields". i.e. locations of points that have a box of >= x*2+1 size of free space around them
    // Fill up the empty spaces
    while (md.open_spaces.length <= stats_settings.open_space_min) {
        md.open_spaces.push([]);
    }
    // If there is a space of the current size at the current point then add it to the list
    const size = md.open_spaces.length - 1;
    if (!md.scan) {
        md.scan = { x: size, y: size };
        for (let x = 0; x < ROOM_SIZE; ++x) {
            const arr: number[] = [];
            for (let y = 0; y < ROOM_SIZE; ++y) {
                arr.push(0);
            }
            md.distance_field.push(arr);
        }
    }
    if (utils.terrain_in_area(md.scan.x, md.scan.y, room, size, (t: LookAtResultWithPos) => t.terrain === "wall").length === 0) {
        md.open_spaces[size].push({ x: md.scan.x, y: md.scan.y });
        md.distance_field[md.scan.x][md.scan.y] = size;
    }
    // Move along in x
    ++md.scan.x;
    // If we got to the end of x then roll over and move down one
    if (md.scan.x >= ROOM_SIZE - size) {
        md.scan.x = size;
        ++md.scan.y;
    }
    // If we got to the end of y then go to the next size
    if (md.scan.y >= ROOM_SIZE - size) {
        const center = { x: ROOM_SIZE * 0.5, y: ROOM_SIZE * 0.5 };
        md.open_spaces[md.open_spaces.length - 1] =
            _.sortBy(md.open_spaces[md.open_spaces.length - 1], (p: Pos) => dist_2(p, center));
        md.open_spaces.push([]);
        md.scan.y = size;
        md.scan.x = size;
    }
    return md.open_spaces.length > stats_settings.open_space_max;
}

function calculate_rally_points(md: MetaData, stats_settings: Settings.StatsSettings, room: Room): boolean {
    md.rally_points = [];
    for (let size = md.open_spaces.length - 1; md.rally_points.length < stats_settings.desired_rally_points && size >= 1; ) {
        const space = _.find(md.open_spaces[size], (pos: Pos) => {
            // check for existing stuff blocking the area
            return utils.box_is_clear(pos.x, pos.y, room, size) && !_.find(md.rally_points, (r: Pos) =>
                dist_2(r, pos) < size * size);
        });
        if (space) {
            md.rally_points.push(space);
            room.createFlag(space.x, space.y, `Rally point ${md.rally_points.length}`, COLOR_BLUE, COLOR_WHITE);
        } else {
            --size;
        }
    }
    return true;
}

function calculate_spawns(_md: MetaData, _stats_settings: Settings.StatsSettings, _room: Room): boolean {
    return true;
}

function calculate_extensions(_md: MetaData, _stats_settings: Settings.StatsSettings, _room: Room): boolean {
    return true;
}

function calculate_roads(_md: MetaData, _stats_settings: Settings.StatsSettings, _room: Room): boolean {
    return true;
}

function calculate_walls(_md: MetaData, _stats_settings: Settings.StatsSettings, _room: Room): boolean {
    return true;
}

function calculate_keep_clear(_md: MetaData, _stats_settings: Settings.StatsSettings, _room: Room): boolean {
    return true;
}

export function update_all_room_metadata() {
    _.forOwn(Game.rooms, update_metadata);
}

export interface Stats {
    last_updated: number;
    harvest_rate: number;
}

export function construct_stats(): Stats {
    return {
        harvest_rate: 0,
        last_updated: 0,

    } as Stats;
}

export function get_stats(room: Room): Stats {
    if (!room.memory.stats) {
        room.memory.stats = construct_stats();
    }
    return room.memory.stats;
}

// export function update_stats(room: Room) {
//     const stats = get_stats(room);
//     // const havesters = room.find(FIND_MY_CREEPS, { filter: (c: Creep) => CreepMemory.get(c).role === "harvester" });
//     // stats.harvest_rate = _.reduce(havesters, (sum: number, c: Creep) => sum + CreepMemory.get(c).harvest_rate, 0);
//     // log("stats", `room ${room.name} stats = ${JSON.stringify(stats)}`);

//     const stats_settings = Settings.get().stats;
//     const start_cpu = Game.cpu.getUsed();
//     const allowed_cpu = Game.cpu.tickLimit - start_cpu;

//     // Update room "distance fields". i.e. locations of points that have a box of >= x*2+1 size of free space around them
//     while (stats.open_spaces.length <= stats_settings.open_space_max && (Game.cpu.getUsed() - start_cpu) / allowed_cpu < stats_settings.scan_cpu_cap) {
//         // Fill up the empty spaces
//         while (stats.open_spaces.length <= stats_settings.open_space_min) {
//             stats.open_spaces.push([]);
//         }
//         // If there is a space of the current size at the current point then add it to the list
//         const size = stats.open_spaces.length - 1;
//         if (stats.scan_x === -1) {
//             stats.scan_x = size;
//             stats.scan_y = size;
//         }
//         if (utils.terrain_in_area(stats.scan_x, stats.scan_y, room, size, (t: LookAtResultWithPos) => t.terrain === "wall").length === 0) {
//             stats.open_spaces[size].push({ x: stats.scan_x, y: stats.scan_y });
//             // if (size > 3) {
//             // room.createFlag(stats.scan_x, stats.scan_y, undefined, size);
//             // }
//         }
//         // Move along in x
//         ++stats.scan_x;
//         // If we got to the end of x then roll over and move down one
//         if (stats.scan_x >= ROOM_SIZE - size) {
//             stats.scan_x = size;
//             ++stats.scan_y;
//         }
//         // If we got to the end of y then go to the next size
//         if (stats.scan_y >= ROOM_SIZE - size) {
//             stats.open_spaces.push([]);
//             stats.scan_y = size;
//             stats.scan_x = size;
//         }
//     }
//     stats.last_updated = Game.time;
// }
