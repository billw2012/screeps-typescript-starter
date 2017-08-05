import * as _ from "lodash";
import { log, Settings } from "log";
import * as pos from "pos";
import * as flood from "search.flood";
import * as utils from "utils";

const METADATA_VERSION = 7;

export enum MetadataFlags {
    None = 0,
    SourceSpaceCount = 1 << 0,
    OpenSpaces = 1 << 1,
    Spawns = 1 << 2,
    Extensions = 1 << 3,
    RallyPoints = 1 << 4,
    Roads = 1 << 5,
    Walls = 1 << 6,
    KeepClear = 1 << 7,
    All = SourceSpaceCount | OpenSpaces | RallyPoints | Spawns | Extensions | Roads | Walls | KeepClear
}
const MetadataFlagsBits = 9;

enum FnResult {
    NotFinished,
    Finished,
    SkipTick
}

const METADATA_FUNCTIONS = {
    [MetadataFlags.SourceSpaceCount]: calc_source_spaces,
    [MetadataFlags.OpenSpaces]: scan_for_space,
    [MetadataFlags.Spawns]: calculate_spawns,
    [MetadataFlags.Extensions]: calculate_extensions,
    [MetadataFlags.RallyPoints]: calculate_rally_points,
    [MetadataFlags.Roads]: calculate_roads,
    [MetadataFlags.Walls]: calculate_walls,
    [MetadataFlags.KeepClear]: calculate_keep_clear,
};

export interface SourceSpaces {
    [key: string]: number;
}

export interface MetaData {
    version: number;
    flags: MetadataFlags;
    source_spaces?: SourceSpaces;
    scan?: pos.Pos;
    open_spaces: pos.Pos[][];
    distance_field: number[][];
    keep_clear: boolean[][];
    spawns: pos.Pos[];
    extensions: pos.Pos[];
    rally_points: pos.Pos[];
    roads: pos.Pos[];
    walls: pos.Pos[];
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
        version: METADATA_VERSION,
        walls: [],
    } as MetaData;
}

export function get_metadata(room: Room): MetaData {
    if (!room.memory.metadata) {
        room.memory.metadata = construct_metadata();
    } else if (room.memory.metadata.version !== METADATA_VERSION) {
        const old_ver = room.memory.metadata.version;
        room.memory.metadata = construct_metadata();
        log("metadata", `Updating from ver ${old_ver} to ${METADATA_VERSION}`);
    }
    return room.memory.metadata as MetaData;
}

export function is_metadata_ready(room: Room, type: MetadataFlags): boolean {
    return (get_metadata(room).flags & type) === type;
}

export function get_rally_points(room: Room): pos.Pos[] {
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
                // log("metadata", `Room ${room.name} calculating ${MetadataFlags[flag]} (${flag})`);
                const func: any = METADATA_FUNCTIONS[flag];
                switch (func(md, stats_settings, room)) {
                    case FnResult.Finished:
                        md.flags |= flag;
                        log("metadata", `Room ${room.name} done calculating ${MetadataFlags[flag]}`);
                        break;
                    case FnResult.SkipTick:
                        return;
                    case FnResult.NotFinished:
                        break;
                }
                break;
            }
        }
    }
}

// function clear_room(room: Room): boolean {
//     _.forEach(room.find(FIND_FLAGS, { filter: (obj: Flag) => obj.name.startsWith("Rally point") }), (flag: Flag) => flag.remove());
//     return true;
// }

function calc_source_spaces(md: MetaData, _stats_settings: Settings.StatsSettings, room: Room): FnResult {
    const source_spaces: SourceSpaces = {};
    room.find(FIND_SOURCES).forEach((s: Source) => {
        const terrain = (room.lookForAtArea(LOOK_TERRAIN, s.pos.y - 1, s.pos.x - 1,
            s.pos.y + 1, s.pos.x + 1, true) as LookAtResultWithPos[])
            .filter((t: LookAtResultWithPos) => t.terrain === "wall");
        source_spaces[s.id] = 9 - terrain.length;
    });
    md.source_spaces = source_spaces;
    return FnResult.Finished;
}

function scan_for_space(md: MetaData, stats_settings: Settings.StatsSettings, room: Room): FnResult {
    // Update room "distance fields". i.e. locations of points that have a box of >= x*2+1 size of free space around them
    // Fill up the empty spaces
    while (md.open_spaces.length <= stats_settings.open_space_min) {
        md.open_spaces.push([]);
    }
    // If there is a space of the current size at the current point then add it to the list
    const size = md.open_spaces.length - 1;
    if (!md.scan) {
        md.scan = { x: size, y: size };
        for (let x = 0; x < utils.ROOM_SIZE; ++x) {
            const arr: number[] = [];
            for (let y = 0; y < utils.ROOM_SIZE; ++y) {
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
    if (md.scan.x >= utils.ROOM_SIZE - size) {
        md.scan.x = size;
        ++md.scan.y;
    }
    // If we got to the end of y then go to the next size
    if (md.scan.y >= utils.ROOM_SIZE - size) {
        const center = { x: utils.ROOM_SIZE * 0.5, y: utils.ROOM_SIZE * 0.5 };
        md.open_spaces[md.open_spaces.length - 1] =
            _.sortBy(md.open_spaces[md.open_spaces.length - 1], (p: pos.Pos) => pos.dist_2(p, center));
        md.open_spaces.push([]);
        md.scan.y = size;
        md.scan.x = size;
    }
    if (md.open_spaces.length > stats_settings.open_space_max) {
        return FnResult.Finished;
    }
    return FnResult.NotFinished;
}

interface AvoidSet {
    pos: pos.Pos[];
    size: number;
}

function does_avoid(p: pos.Pos, dist: number, avoid: pos.Pos[]): boolean {
    return !_.find(avoid, (r: pos.Pos) => pos.dist_2(r, p) < dist * dist);
}

function does_avoid_set(p: pos.Pos, size: number, avoid: AvoidSet[]): boolean {
    return !_.find(avoid, (s: AvoidSet) => !does_avoid(p, size + s.size, s.pos));
}

function find_open_spaces(results: pos.Pos[], avoid: AvoidSet[], how_many: number, desired_size: number, md: MetaData, room: Room): void {
    // const results: pos.Pos[] = [];
    for (let size = Math.min(desired_size, md.open_spaces.length - 1); results.length < how_many && size >= 1; ) {
        const space = _.find(md.open_spaces[size], (p: pos.Pos) => {
            // check for existing stuff blocking the area
            return utils.box_is_clear(p.x, p.y, room, size) &&
                does_avoid(p, 2 * desired_size, results) &&
                does_avoid_set(p, desired_size, avoid);
        });
        if (space) {
            results.push(space);
            // room.createFlag(space.x, space.y, `Rally point ${md.rally_points.length}`, COLOR_BLUE, COLOR_WHITE);
        } else {
            --size;
        }
    }
}

function find_objects(room: Room, type: number): pos.Pos[] {
    return _.map(room.find(type), (obj: RoomObject) => ({ x: obj.pos.x, y: obj.pos.y })) as pos.Pos[];
}

function get_avoid_set(md: MetaData, room: Room, settings: Settings.StatsSettings): AvoidSet[] {
    const set: AvoidSet[] = [];
    set.push({
        pos: find_objects(room, FIND_SOURCES),
        size: settings.space_around_sources
    } as AvoidSet);

    if (room.controller) {
        set.push({
            pos: [{ x: room.controller.pos.x, y: room.controller.pos.y } as pos.Pos],
            size: settings.space_around_controllers
        } as AvoidSet);
    }

    if (md.flags & MetadataFlags.Spawns) {
        set.push({
            pos: md.spawns,
            size: settings.space_around_spawns
        });
    }

    return set;
}

function calculate_spawns(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    const flags = room.find(FIND_FLAGS, { filter: (obj: Flag) => obj.name.startsWith("Spawn") });
    if (flags.length > 0) {
        _.forEach(flags, (flag: Flag) => flag.remove());
        return FnResult.SkipTick;
    }
    const existing = _.map(room.find(FIND_MY_SPAWNS), (spawn: Spawn) => ({ x: spawn.pos.x, y: spawn.pos.y })) as pos.Pos[];
    const avoid = get_avoid_set(md, room, settings);
    find_open_spaces(existing, avoid, 3, settings.space_around_spawns, md, room);
    md.spawns = existing;
    _.forEach(existing, (spawn: pos.Pos, idx: number) => room.createFlag(spawn.x, spawn.y, `Spawn ${idx + 1}`, COLOR_GREEN, COLOR_WHITE));
    return FnResult.Finished;
}

function calculate_extensions(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    // Remove flags
    const flags = room.find(FIND_FLAGS, { filter: (obj: Flag) => obj.name.startsWith("Extension") });
    if (flags.length > 0) {
        _.forEach(flags, (flag: Flag) => flag.remove());
        return FnResult.SkipTick;
    }
    // Find existing extensions
    const existing = _.map(room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } }), (spawn: Spawn) => ({ x: spawn.pos.x, y: spawn.pos.y })) as pos.Pos[];
    // Get list of room objects to avoid
    const avoid = get_avoid_set(md, room, settings);
    // Function to add extensions until total reaches "count".
    function add_extensions(p: RoomPosition, count: number) {
        // Box search outwards from "pos", and add an extension if it is on the odd squares (e.g. black on a chess board) the NSEW cross is clear and it avoids the avoid set.
        flood.search(p.x, p.y, (x, y) => utils.no_wall(x, y, room), (x, y) => {
            if ((x + y) % 2 === 1
                && utils.cross_is_clear(x, y, room)
                && does_avoid_set({ x, y }, 0, avoid)
            ) {
                existing.push({ x, y } as pos.Pos);
                if (existing.length === count) {
                    return true;
                }
            }
            return false;
        });
    }
    let spawn_idx = 0;
    add_extensions(room.getPositionAt(md.spawns[spawn_idx].x, md.spawns[spawn_idx].y) as RoomPosition, 40);
    if (md.spawns.length > 1) {
        ++spawn_idx;
    }
    add_extensions(room.getPositionAt(md.spawns[spawn_idx].x, md.spawns[spawn_idx].y) as RoomPosition, 50);
    if (md.spawns.length > 2) {
        ++spawn_idx;
    }
    add_extensions(room.getPositionAt(md.spawns[spawn_idx].x, md.spawns[spawn_idx].y) as RoomPosition, 60);
    md.extensions = existing;
    _.forEach(existing, (spawn: pos.Pos, idx: number) => room.createFlag(spawn.x, spawn.y, `Extension ${idx + 1}`, COLOR_YELLOW, COLOR_WHITE));
    if (existing.length !== 60) {
        log("metadata", `Could not fill extension quota 60 for room ${room.name}, found ${existing.length}`);
    }
    return FnResult.Finished;
}

function calculate_rally_points(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    const flags = room.find(FIND_FLAGS, { filter: (obj: Flag) => obj.name.startsWith("Rally") });
    if (flags.length > 0) {
        _.forEach(flags, (flag: Flag) => flag.remove());
        return FnResult.SkipTick;
    }
    const existing: pos.Pos[] = []; // _.map(room.find(FIND_MY_SPAWNS), (spawn: Spawn) => ({ x: spawn.pos.x, y: spawn.pos.y })) as pos.Pos[];
    const avoid = get_avoid_set(md, room, settings);
    find_open_spaces(existing, avoid, 6, settings.space_around_rally_points, md, room);
    md.rally_points = existing;
    _.forEach(existing, (spawn: pos.Pos, idx: number) => room.createFlag(spawn.x, spawn.y, `Rally ${idx + 1}`, COLOR_BLUE, COLOR_WHITE));
    return FnResult.Finished;
}

function calculate_roads(_md: MetaData, _stats_settings: Settings.StatsSettings, _room: Room): FnResult {
    return FnResult.Finished;
}

function calculate_walls(_md: MetaData, _stats_settings: Settings.StatsSettings, _room: Room): FnResult {
    return FnResult.Finished;
}

function calculate_keep_clear(_md: MetaData, _stats_settings: Settings.StatsSettings, _room: Room): FnResult {
    return FnResult.Finished;
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
//         if (stats.scan_x >= utils.ROOM_SIZE - size) {
//             stats.scan_x = size;
//             ++stats.scan_y;
//         }
//         // If we got to the end of y then go to the next size
//         if (stats.scan_y >= utils.ROOM_SIZE - size) {
//             stats.open_spaces.push([]);
//             stats.scan_y = size;
//             stats.scan_x = size;
//         }
//     }
//     stats.last_updated = Game.time;
// }
