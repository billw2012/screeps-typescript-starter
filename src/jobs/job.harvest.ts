import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobCreep from "jobs/job.creep";
import { ROLE_NAME } from "jobs/job.spawn.harvester";
import { log } from "log";
import * as CreepMemory from "memory/creep";
import * as RoomMemory from "memory/room";
import * as Settings from "settings";

export const FACTORY_NAME: string = "harvest_factory";
export const JOB_NAME: string = "harvest_job";
export { ROLE_NAME };

enum State {
    SELECT_SOURCE,
    GO_TO_SOURCE,
    HARVEST,
    DEPOSIT_ANYWHERE,
    DEPOSIT_TO_CONTROLLER
}

const state_update = {
    [State.SELECT_SOURCE]: (job: Job.Data, creep: Creep, mem: HarvesterMemory) => search_for_source(job, creep, mem, () => job.active = false, () => mem.state = State.GO_TO_SOURCE),
    [State.GO_TO_SOURCE]: (_job: Job.Data, creep: Creep, mem: HarvesterMemory) => go_to_source(creep, mem, () => mem.state = State.HARVEST),
    [State.HARVEST]: (_job: Job.Data, creep: Creep, mem: HarvesterMemory) => harvest(creep, mem, () => mem.state = State.DEPOSIT_ANYWHERE, () => mem.state = State.SELECT_SOURCE),
    [State.DEPOSIT_ANYWHERE]: (job: Job.Data, creep: Creep, mem: HarvesterMemory) => deposit_anywhere(creep, mem, () => mem.state = State.DEPOSIT_TO_CONTROLLER, () => job.active = false),
    [State.DEPOSIT_TO_CONTROLLER]: (job: Job.Data, creep: Creep, mem: HarvesterMemory) => deposit_to_controller(creep, () => mem.state = State.DEPOSIT_ANYWHERE, () => job.active = false)
};

interface HarvesterMemory extends CreepMemory.Data {
    state: State;
}

function get_mem(creep: Creep, _reset: boolean = false): HarvesterMemory {
    const mem = CreepMemory.get(creep) as HarvesterMemory;
    if (!mem.state || _reset) {
        mem.state = State.SELECT_SOURCE;
    }
    return mem;
}

export function log_progress(job: JobCreep.Data, creep: Creep, mem: HarvesterMemory, msg: string): void {
    log(job.type, `[${creep.name}|${job.id}|${mem.state}]: ${msg}`);
}

export function select_source(job: Job.Data, _harvester: Creep): Source | undefined {
    const pos = Job.get_pos(job) as RoomPosition;
    if (pos) {
        const sources = pos.lookFor(LOOK_SOURCES);
        if (sources) {
            return sources[0] as Source;
        }
    } else if (job.room) {
        const room = Game.rooms[job.room];
        const sources = room.find(FIND_SOURCES);
        if (sources.length > 0) {
            const rnd_idx = Math.floor(Math.random() * 0.999 * sources.length);
            return sources[rnd_idx] as Source;
        }
    }
    return undefined;
}

export function find_deposit_target(room_name: string): RoomObject | undefined {
    const room = Game.rooms[room_name];
    if (room.controller) {
        return room.controller as RoomObject;
    }
    const my_spawns = room.find(FIND_MY_SPAWNS);
    if (my_spawns && my_spawns.length > 0) {
        return my_spawns[0] as RoomObject;
    }
    const my_structures = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } });
    if (my_structures && my_structures.length > 0) {
        return my_structures[0] as RoomObject;
    }
    const sources = room.find(FIND_SOURCES);
    if (sources && sources.length > 0) {
        return sources[0] as RoomObject;
    }
    return undefined;
}

export function search_for_source(job: Job.Data, creep: Creep, mem: CreepMemory.Data,
                                  state_change_source_not_found: () => void,
                                  state_change_source_found: () => void): void {
    const source = select_source(job, creep);
    if (!source) {
        // log_progress(job, creep, mem, "Couldn't locate source");
        creep.say("😢❗ no source");
        state_change_source_not_found();
        // job.active = false;
        return;
    }
    creep.say("😮 found source");
    mem.target = source.id;
    // mem.state = State.GO_TO_SOURCE;
    mem.stalled = false;
    state_change_source_found();
    // log_progress(job, creep, mem, "Found source");
}

export function go_to_source(creep: Creep, mem: CreepMemory.Data,
                             state_change_at_source: () => void): void {
    const source = Game.getObjectById(mem.target) as Source;
    if (creep.harvest(source) === OK) {
        state_change_at_source();
        creep.say("🔁 harvest");
        // log_progress(job, creep, mem, "At source");
    } else {
        creep.moveTo(source, { visualizePathStyle: Settings.get().path_styles.harvester_outbound as any });
    }
}

export function harvest(creep: Creep, mem: CreepMemory.Data,
                        state_change_full: () => void,
                        state_change_not_enough_resources: () => void): void {
    const target_source = Game.getObjectById(mem.target) as Source;
    if (creep.carry.energy === creep.carryCapacity) {
        state_change_full();
        creep.say("✅ full");
        // log_progress(job, creep, mem, "Capacity full");
        mem.target = undefined;
    } else if (creep.harvest(target_source) === ERR_NOT_ENOUGH_RESOURCES) {
        state_change_not_enough_resources();
        creep.say("❎❔ source empty");
        // log_progress(job, creep, mem, "Source empty");
        mem.target = undefined;
    }
}

export function transfer_or_move_to_target(target: Structure, creep: Creep): boolean {
    switch (creep.transfer(target, RESOURCE_ENERGY)) {
        case ERR_NOT_ENOUGH_RESOURCES:
            creep.say("💤");
            // log_progress(job, creep, mem, "Done");
            return true;
        case ERR_NOT_IN_RANGE:
            creep.moveTo(target, { visualizePathStyle: Settings.get().path_styles.harvester_inbound as any });
            break;
        case ERR_FULL:
            creep.say("🚫❔ full");
            // log_progress(job, creep, mem, `Target full`);
            break;
        default:
    }
    return false;
}

export function deposit_anywhere(creep: Creep, mem: CreepMemory.Data,
                                 state_change_target_not_found: () => void,
                                 state_change_empty: () => void): void {
    let target;
    if (creep.room.name !== mem.home_room) {
        target = find_deposit_target(mem.home_room);
        // log_progress(job, creep, mem, "Out of home room, rerouting");
    } else {
        target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
            filter: (structure: any) => {
                return (structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_SPAWN) &&
                    structure.energy < structure.energyCapacity;
            }
        });
    }
    if (!target) {
        if (creep.room.controller && creep.room.controller.my) {
            // log_progress(job, creep, mem, "Couldn't find a spawn or extension, reverting to room controller");
            state_change_target_not_found();
        }
    } else if (transfer_or_move_to_target(target, creep)) {
        state_change_empty();
    }
}

export function deposit_to_controller(creep: Creep, state_change_no_controller: () => void, state_change_empty: () => void): void {
    if (!creep.room.controller || !creep.room.controller.my) {
        state_change_no_controller();
    } else if (transfer_or_move_to_target(creep.room.controller, creep)) {
        state_change_empty();
    }
}

// Factory assign function
function assign(job: Job.Data): boolean {
    return JobCreep.assign(job as JobCreep.Data, (_job: JobCreep.Data, creep: Creep): number => {
        if (CreepMemory.get(creep).role === ROLE_NAME) {
            return 1;
        }
        return 0;
    }, (_job: JobCreep.Data, creep: Creep): void => {
        const mem = get_mem(creep, true);
        if (creep.carry.energy === creep.carryCapacity) {
            mem.state = State.DEPOSIT_ANYWHERE;
            creep.say("✅ full");
        }
    });
}

function update_internal(job: JobCreep.Data, creep: Creep): void {
    const mem = get_mem(creep);
    state_update[mem.state](job, creep, mem);
}

function clean_up(creep: Creep): void {
    const mem = get_mem(creep);
    delete mem.state;
}

// Factory update function
function update(job_base: Job.Data): void {
    JobCreep.update(job_base as JobCreep.Data, update_internal, clean_up);
}

// Factory update function
function kill(job: Job.Data): boolean {
    return JobCreep.kill(job as JobCreep.Data, clean_up);
}

function should_harvest_room(room: Room): boolean {
    // TODO: later we will have flags or metadata to specify external rooms for harvesting
    return (room.controller as Controller).my;
}

function get_assigned_harvesters(source: Source) {
    return source.room.find(FIND_MY_CREEPS,
        { filter: (creep: Creep) => get_mem(creep).target === source.id });
}

function create_harvest_jobs(room: Room, jobs: Job.Data[]): void {
    const room_md = RoomMemory.get_metadata(room);
    if (RoomMemory.is_metadata_ready(room, RoomMemory.MetadataFlags.SourceSpaceCount) && room_md.source_spaces) {
        for (const s in room_md.source_spaces) {
            const source = Game.getObjectById(s) as Source;
            // Early out on actually having energy to get
            if (source.energy > 0) {
                const spaces = room_md.source_spaces[source.id] as number;
                const assigned_count = get_assigned_harvesters(source).length;
                for (let idx = 0; idx < spaces + 1 - assigned_count; ++idx) {
                    jobs.push(JobCreep.construct_from_pos(JOB_NAME, FACTORY_NAME, source.pos));
                }
            }
        }
    }
}

// Factory generate new jobs function
function generate_new_jobs(_active_jobs: Job.Data[]): Job.Data[] {
    // Generate jobs
    const new_jobs: Job.Data[] = [];
    _.forOwn(Game.rooms, (room: Room) => {
        if (should_harvest_room(room)) {
            create_harvest_jobs(room, new_jobs);
        }
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update, kill } as JobFactory;
}
