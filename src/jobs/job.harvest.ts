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
    ASSIGNED,
    SELECT_SOURCE,
    GO_TO_SOURCE,
    HARVEST,
    SELECT_TARGET,
    BUILD_TARGET,
    DEPOSIT_TO_TARGET
}

const state_update = {
    [State.ASSIGNED]: (_job: Job.Data, creep: Creep, mem: HarvesterMemory) => assigned(creep, () => mem.state = State.SELECT_TARGET, () => mem.state = State.SELECT_SOURCE),
    [State.SELECT_SOURCE]: (job: Job.Data, creep: Creep, mem: HarvesterMemory) => search_for_source(job, creep, mem, () => job.active = false, () => mem.state = State.GO_TO_SOURCE),
    [State.GO_TO_SOURCE]: (_job: Job.Data, creep: Creep, mem: HarvesterMemory) => go_to_source(creep, mem, () => mem.state = State.HARVEST),
    [State.HARVEST]: (_job: Job.Data, creep: Creep, mem: HarvesterMemory) => harvest(creep, mem, () => mem.state = State.SELECT_TARGET, () => mem.state = State.SELECT_SOURCE),
    [State.SELECT_TARGET]: (job: Job.Data, _creep: Creep, mem: HarvesterMemory) => select_target(job, mem, () => mem.state = State.DEPOSIT_TO_TARGET, () => mem.state = State.BUILD_TARGET),
    [State.BUILD_TARGET]: (job: Job.Data, creep: Creep, mem: HarvesterMemory) => build_target(creep, mem, () => job.active = false, () => mem.state = State.SELECT_TARGET),
    [State.DEPOSIT_TO_TARGET]: (job: Job.Data, creep: Creep, mem: HarvesterMemory) => deposit_to_target(creep, mem, () => mem.state = State.SELECT_TARGET, () => job.active = false)
};

interface HarvesterMemory extends CreepMemory.Data {
    state: State;
}

function get_mem(creep: Creep, _reset: boolean = false): HarvesterMemory {
    const mem = CreepMemory.get(creep) as HarvesterMemory;
    if (!mem.state || _reset) {
        mem.state = State.ASSIGNED;
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

function select_target(job: Job.Data, mem: CreepMemory.Data, state_change_deposit_to_target: () => void, state_change_build_target: () => void): void {
    // Target selection:
    // If controller downgrade in less than x ticks then controller
    // Otherwise empty extension
    // Otherwise empty spawn
    // Otherwise build
    // Otherwise controller
    const room = Game.rooms[job.room];
    const settings = Settings.get().harvester;
    if (room.controller && room.controller.my && room.controller.ticksToDowngrade < settings.controller_downgrade_ticks) {
        mem.target = room.controller.id;
        state_change_deposit_to_target();
        return;
    }
    const extensions = room.find(FIND_MY_STRUCTURES, { filter: (str: Structure) => str.structureType === STRUCTURE_EXTENSION && (str as StructureExtension).energy < (str as StructureExtension).energyCapacity }) as StructureExtension[];
    if (extensions.length > 0) {
        mem.target = extensions[0].id;
        state_change_deposit_to_target();
        return;
    }
    const spawns = room.find(FIND_MY_SPAWNS, { filter: (spawn: Spawn) => spawn.energy < spawn.energyCapacity }) as Spawn[];
    if (spawns.length > 0) {
        mem.target = spawns[0].id;
        state_change_deposit_to_target();
        return;
    }
    const sites = _.sortBy(room.find(FIND_MY_CONSTRUCTION_SITES), (site: ConstructionSite) => site.progressTotal - site.progress) as ConstructionSite[];
    if (sites.length > 0) {
        mem.target = sites[0].id;
        state_change_build_target();
        return;
    }
    if (room.controller && room.controller.my) {
        mem.target = room.controller.id;
        state_change_deposit_to_target();
        return;
    }
}

function build_target(creep: Creep, mem: CreepMemory.Data, state_change_done: () => void, state_change_failed: () => void): void {
    const target = Game.constructionSites[mem.target as string];
    switch (creep.build(target)) {
        case ERR_NOT_ENOUGH_RESOURCES:
            creep.say("💤");
            // log_progress(job, creep, mem, "Done");
            state_change_done();
            break;
        case ERR_NOT_IN_RANGE:
            creep.moveTo(target, { visualizePathStyle: Settings.get().path_styles.builder_inbound as any });
            break;
        case ERR_FULL:
            creep.say("🚫❔ full");
            // log_progress(job, creep, mem, `Target full`);
            break;
        case ERR_INVALID_TARGET:
        case ERR_RCL_NOT_ENOUGH:
            // Site is constructed??
            if (creep.carry.energy as number > 0) {
                state_change_failed();
            } else {
                state_change_done();
            }
        default:
    }
}

export function deposit_to_target(creep: Creep, mem: CreepMemory.Data, state_change_failed: () => void, state_change_done: () => void): void {
    const target = Game.structures[mem.target as string];
    if (!target) {
        state_change_failed();
    } else {
        switch (creep.transfer(target, RESOURCE_ENERGY)) {
            case ERR_NOT_ENOUGH_RESOURCES:
                creep.say("💤");
                state_change_done();
                // log_progress(job, creep, mem, "Done");
                break;
            case ERR_NOT_IN_RANGE:
                creep.moveTo(target, { visualizePathStyle: Settings.get().path_styles.harvester_inbound as any });
                break;
            case ERR_FULL:
                creep.say("🚫❔ full");
                state_change_failed();
                // log_progress(job, creep, mem, `Target full`);
                break;
            default:
                break;
        }
    }
}

export function assigned(creep: Creep, state_change_full: () => void, state_change_not_full: () => void): void {
    if (creep.carry.energy === creep.carryCapacity) {
        state_change_full();
        creep.say("✅ full");
    } else {
        state_change_not_full();
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
        mem.state = State.ASSIGNED;
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
        {
            filter: (creep: Creep) => {
                const mem = get_mem(creep);
                return mem.role === ROLE_NAME && mem.target === source.id;
            }
        });
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
