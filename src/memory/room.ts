import * as _ from "lodash";
import { log, Settings } from "log";
import * as pos from "pos";
import * as flood from "search.flood";
import * as utils from "utils";

const METADATA_VERSION = 8;

export enum MetadataFlags {
    None = 0,
    SourceSpaceCount = 1 << 0,
    OpenSpaces = 1 << 1,
    Spawns = 1 << 2,
    Extensions = 1 << 3,
    RallyPoints = 1 << 4,
    Exits = 1 << 5,
    Roads = 1 << 6,
    Walls = 1 << 7,
    KeepClear = 1 << 8,
    All = (1 << 9) - 1
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
    [MetadataFlags.Exits]: calculate_exits,
    [MetadataFlags.Roads]: calculate_roads,
    [MetadataFlags.Walls]: calculate_walls,
    [MetadataFlags.KeepClear]: calculate_keep_clear,
};

export interface SourceSpaces {
    [key: string]: number;
}

export enum Edges {
    TOP,
    BOTTOM,
    LEFT,
    RIGHT
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
    // exit points on each edge, top bottom left right
    exits: pos.Pos[][];
    // all positions for all roads for each controller level in room
    // Index is [level][pos]
    roads: pos.Pos[][];
    walls: pos.Pos[];
}

export function construct_metadata(): MetaData {
    return {
        distance_field: [],
        exits: [],
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

    const settings = Settings.get().stats;
    const start_cpu = Game.cpu.getUsed();
    const allowed_cpu = Game.cpu.limit - start_cpu;

    while (md.flags !== MetadataFlags.All && (Game.cpu.getUsed() - start_cpu) / allowed_cpu < settings.scan_cpu_cap) {
        for (let idx = 0; idx < MetadataFlagsBits; ++idx) {
            const flag = 1 << idx;
            if ((md.flags & flag) === 0) {
                // log("metadata", `Room ${room.name} calculating ${MetadataFlags[flag]} (${flag})`);
                const func: any = METADATA_FUNCTIONS[flag];
                switch (func(md, settings, room)) {
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

function calc_source_spaces(md: MetaData, _settings: Settings.StatsSettings, room: Room): FnResult {
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

function scan_for_space(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    // Update room "distance fields". i.e. locations of points that have a box of >= x*2+1 size of free space around them
    // Fill up the empty spaces
    while (md.open_spaces.length <= settings.open_space_min) {
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
    if (md.open_spaces.length > settings.open_space_max) {
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

function remove_flags(room: Room, prefix: string): boolean {
    const flags = room.find(FIND_FLAGS, { filter: (obj: Flag) => obj.name.startsWith(prefix) });
    if (flags.length > 0) {
        _.forEach(flags, (flag: Flag) => flag.remove());
        return true;
    }
    return false;
}

function calculate_spawns(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    if (remove_flags(room, "Spawn")) {
        return FnResult.SkipTick;
    }
    const existing = _.map(room.find(FIND_MY_SPAWNS), (spawn: Spawn) => ({ x: spawn.pos.x, y: spawn.pos.y })) as pos.Pos[];
    const avoid = get_avoid_set(md, room, settings);
    find_open_spaces(existing, avoid, 3, settings.space_around_spawns, md, room);
    md.spawns = existing;
    if (settings.debug_mode) {
        _.forEach(existing, (spawn: pos.Pos, idx: number) => room.createFlag(spawn.x, spawn.y, `Spawn ${idx + 1}`, COLOR_GREEN, COLOR_WHITE));
    }
    return FnResult.Finished;
}

function calculate_extensions(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    if (remove_flags(room, "Extension")) {
        return FnResult.SkipTick;
    }
    // Find existing extensions
    const existing = _.map(room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } }), (spawn: Spawn) => ({ x: spawn.pos.x, y: spawn.pos.y })) as pos.Pos[];
    // Get list of room objects to avoid
    const avoid = get_avoid_set(md, room, settings);
    // Function to add extensions until total reaches "count".
    function add_extensions(p: RoomPosition, count: number) {
        // Box search outwards from "pos", and add an extension if it is on the odd squares (e.g. black on a chess board) the NSEW cross is clear and it avoids the avoid set.
        flood.search(p.x, p.y, (x, y) => utils.no_wall(x, y, room) && utils.not_at_edge(x, y, settings.room_border), (x, y) => {
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
    if (settings.debug_mode) {
        _.forEach(existing, (spawn: pos.Pos, idx: number) => room.createFlag(spawn.x, spawn.y, `Extension ${idx + 1}`, COLOR_YELLOW, COLOR_WHITE));
    }
    if (existing.length !== 60) {
        log("metadata", `Could not fill extension quota 60 for room ${room.name}, found ${existing.length}`);
    }
    return FnResult.Finished;
}

function calculate_rally_points(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    if (remove_flags(room, "Rally")) {
        return FnResult.SkipTick;
    }
    const existing: pos.Pos[] = []; // _.map(room.find(FIND_MY_SPAWNS), (spawn: Spawn) => ({ x: spawn.pos.x, y: spawn.pos.y })) as pos.Pos[];
    const avoid = get_avoid_set(md, room, settings);
    find_open_spaces(existing, avoid, 6, settings.space_around_rally_points, md, room);
    md.rally_points = existing;
    if (settings.debug_mode) {
        _.forEach(existing, (spawn: pos.Pos, idx: number) => room.createFlag(spawn.x, spawn.y, `Rally ${idx + 1}`, COLOR_BLUE, COLOR_WHITE));
    }
    return FnResult.Finished;
}

function calculate_exits(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    // Finding exits:
    // Convert each border into a set of open segments.
    // One exit at the center of each segment.
    // ORDER: TOP, BOTTOM, LEFT, RIGHT
    if (remove_flags(room, "Exit")) {
        return FnResult.SkipTick;
    }

    const edges: any[] = [
        { // TOP
            dir: pos.make_pos(1, 0),
            start: pos.make_pos(0, 0),
        },
        { // BOTTOM
            dir: pos.make_pos(1, 0),
            start: pos.make_pos(0, utils.ROOM_SIZE - 1),
        },
        { // LEFT
            dir: pos.make_pos(0, 1),
            start: pos.make_pos(0, 0),
        },
        { // RIGHT
            dir: pos.make_pos(0, 1),
            start: pos.make_pos(utils.ROOM_SIZE - 1, 0),
        },
    ];
    const all_exits: pos.Pos[][] = [];
    _.forEach(edges, (edge, edge_idx) => {
        const edge_exits: pos.Pos[] = [];
        let in_gap = utils.no_wall(edge.start.x, edge.start.y, room);
        let p = edge.start;
        let curr_gap_start = edge.start;
        for (let n = 0; n < utils.ROOM_SIZE; ++n, p = pos.add(p, edge.dir)) {
            const wall = !utils.no_wall(p.x, p.y, room);
            if (wall && in_gap) {
                const center = pos.mul(pos.add(curr_gap_start, p), 0.5);
                edge_exits.push(center);
                in_gap = false;
            } else if (!wall && !in_gap) {
                curr_gap_start = p;
                in_gap = true;
            }
        }
        all_exits.push(edge_exits);
        if (settings.debug_mode) {
            _.forEach(edge_exits, (edge_pos: pos.Pos, idx: number) => room.createFlag(edge_pos.x, edge_pos.y, `Exit ${edge_idx}:${idx + 1}`, COLOR_PURPLE, COLOR_WHITE));
        }
    });

    md.exits = all_exits;
    return FnResult.Finished;
}

function create_cost_matrix(md: MetaData): CostMatrix {
    const cost_matrix = new PathFinder.CostMatrix();
    _.forEach(md.spawns, (p: pos.Pos) => cost_matrix.set(p.x, p.y, 0xff));
    _.forEach(md.extensions, (p: pos.Pos) => cost_matrix.set(p.x, p.y, 0xff));
    return cost_matrix;
}

function calculate_roads(md: MetaData, settings: Settings.StatsSettings, room: Room): FnResult {
    // Roads:
    // Spawn 1 to all sources
    // Controller to all sources
    // All around expansions
    // Spawn 2 to all sources
    // Spawn 3 to all sources
    // Exits to spawns
    if (remove_flags(room, "Road")) {
        return FnResult.SkipTick;
    }

    const cost_matrix = create_cost_matrix(md);
    const sources: RoomPosition[] = _.map(room.find<Source>(FIND_SOURCES), (s: Source) => s.pos);
    const spawns = _.map(md.spawns, (p: pos.Pos) => room.getPositionAt(p.x, p.y) as RoomPosition);
    // top bottom left right
    const cross_points: pos.Pos[] = [
        { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }
    ];

    const exits =
        // map pos.Pos to RoomPosition
        _.map(
            // flatten out the multiple exits to a flat list of pos
            _.flatten(
                // apply the offsets to the exits so they are within the map bounds and getPositionAt will be valid
                _.zipWith(md.exits, cross_points, (side: pos.Pos[], cross_point: pos.Pos): pos.Pos[] =>
                    _.map(side, (p: pos.Pos): pos.Pos => pos.add(p, cross_point))
                ) as pos.Pos[][]
            ), (p: pos.Pos): RoomPosition => room.getPositionAt(p.x, p.y) as RoomPosition
        );

    // const extensions = _.map(md.extensions, (p: pos.Pos) => room.getPositionAt(p.x, p.y) as RoomPosition);

    const get_path = (from: RoomPosition, to: RoomPosition, range: number) =>
        _.map(PathFinder.search(from, { pos: to, range }, pf_opts).path, (r: RoomPosition) => pos.make_pos(r.x, r.y));
    // const get_path_n_to_1 = (from: RoomPosition[], to: RoomPosition, range: number) =>
    //            _.map(from, (q: RoomPosition) => get_path(q, to, range));
    const get_path_1_to_n = (from: RoomPosition, to: RoomPosition[], range: number) =>
        _.flatten(_.map(to, (q: RoomPosition) => get_path(from, q, range)));
    const pf_opts = { roomCallback: () => cost_matrix };

    // all_roads[0] = get_path_1_to_n(spawns[0], sources, 1);
    const all_roads: pos.Pos[][] = [];
    all_roads.push([]);

    for (let level = 1; level < 9; ++level) {
        const roads = [];
        if (level === 1) {
            if (room.controller) {
                const ctrl = room.controller.pos;
                roads.push(get_path_1_to_n(ctrl, sources, 1));
                roads.push(get_path_1_to_n(ctrl, exits, 1));
            }
        }
        // roads from spawn to sources
        const spawn_count = CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][level];
        if (spawns.length >= spawn_count && spawn_count > CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][level - 1]) {
            roads.push(get_path_1_to_n(spawns[spawn_count - 1], sources, 1));
            roads.push(get_path_1_to_n(spawns[spawn_count - 1], exits, 1));
        }
        // roads around available extensions
        for (let ext = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][level - 1]; ext < CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][level]; ++ext) {
            roads.push(_.map(cross_points, (offs: pos.Pos) => pos.add(offs, md.extensions[ext])));
        }
        all_roads.push(_.flatten(roads));
    }

    if (settings.debug_mode) {
        _.forEach(all_roads, (p: pos.Pos[], i: number) => _.forEach(p, (q: pos.Pos, j: number) =>
            room.createFlag(q.x, q.y, `Road ${i}:${j}`, COLOR_GREY, COLOR_WHITE)
        ));
    }
    md.roads = all_roads;

    return FnResult.Finished;
}

function calculate_walls(_md: MetaData, _settings: Settings.StatsSettings, _room: Room): FnResult {
    // All around edges skipping roads
    return FnResult.Finished;
}

function calculate_keep_clear(_md: MetaData, _settings: Settings.StatsSettings, _room: Room): FnResult {
    // All roads, spaces around all constructions. Use avoid set
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

//     const settings = Settings.get().stats;
//     const start_cpu = Game.cpu.getUsed();
//     const allowed_cpu = Game.cpu.tickLimit - start_cpu;

//     // Update room "distance fields". i.e. locations of points that have a box of >= x*2+1 size of free space around them
//     while (stats.open_spaces.length <= settings.open_space_max && (Game.cpu.getUsed() - start_cpu) / allowed_cpu < settings.scan_cpu_cap) {
//         // Fill up the empty spaces
//         while (stats.open_spaces.length <= settings.open_space_min) {
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
