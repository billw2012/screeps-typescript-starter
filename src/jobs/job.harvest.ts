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

interface HarvesterMemory extends CreepMemory.Data {
    state: State;
    // last_transfer_tick: number;
    // rate: number;
}

function get_mem(creep: Creep, _reset: boolean = false): HarvesterMemory {
    const mem = CreepMemory.get(creep) as HarvesterMemory;
    if (!mem.state || _reset) {
        mem.state = State.HS_SEARCHING_FOR_SOURCE;
        // mem.last_transfer_tick = 0;
        // mem.rate = 0;
    }
    return mem;
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
            mem.state = State.HS_GOING_TO_DEPOSIT;
            creep.say("✅ full");
        }
    });
}

enum State {
    HS_SEARCHING_FOR_SOURCE,
    HS_GOING_TO_SOURCE,
    HS_HARVESTING,
    HS_GOING_TO_DEPOSIT,
    HS_GOING_TO_CONTROLLER
}

// function get_assigned_harvesters(source: Source): Creep[] {
//     return source.room.find(FIND_MY_CREEPS, { filter: (creep: Creep) => get_mem(creep).target === source.id });
// }

function select_source_for_havester(job: Job.Data, _harvester: Creep): Source | undefined {
    const pos = Job.get_pos(job) as RoomPosition;
    if (pos) {
        const sources = pos.lookFor(LOOK_SOURCES);
        if (sources) {
            return sources[0] as Source;
        }
    }
    return undefined;

    // const room_md = RoomMemory.get_metadata(harvester.room);
    // for (const s in room_md.source_spaces) {
    //     const source = Game.getObjectById(s) as Source;
    //     // Early out on actually having energy to get
    //     if (source.energy > harvester.carryCapacity) {
    //         const source_spaces = room_md.source_spaces[source.id];
    //         const assigned_count = get_assigned_harvesters(source).length;
    //         if (assigned_count < source_spaces + 1) {
    //             return source;
    //         }
    //     }
    // }
    // return undefined
}

// function get_closest_controller(room: Room): StructureController {

//     const rooms = _.sortBy(
//         _.pick(Game.rooms, (r: Room) => r.name !== room.name && r.controller && r.controller.my),
//             [(s) => s.pos.findPathTo(room.controller).length]
//         );
//     if (rooms.length > 0) {
//         return rooms[0].controller;
//     }
//     return null;
// }
function get_target_in_room(room_name: string): RoomObject | undefined {
    const room = Game.rooms[room_name];
    if (room.controller) {
        return room.controller as RoomObject;
    }
    const my_spawns = room.find(FIND_MY_SPAWNS);
    if (my_spawns && my_spawns.length > 0) {
        return my_spawns[0] as RoomObject;
    }
    const my_structures = room.find(FIND_MY_STRUCTURES);
    if (my_structures && my_structures.length > 0) {
        return my_structures[0] as RoomObject;
    }
    const sources = room.find(FIND_SOURCES);
    if (sources && sources.length > 0) {
        return sources[0] as RoomObject;
    }
    return undefined;
}

function calc_new_rate(_creep: Creep) {
    // const mem = get_mem(creep);
    // const time_diff = Game.time - mem.last_transfer_tick;
    // const ratio = Math.min(1, Settings.get().harvester.rate_measure_period / time_diff);

    // const instant_rate = (creep.carryCapacity / time_diff);
    // log("job.harvest", "havest rate update"
    //     + ": time_diff: " + time_diff
    //     + ", ratio: " + ratio
    //     + ", instant_rate: " + instant_rate
    //     + ", current rate: " + mem.rate
    // );
    // // update the creeps transfer rate
    // mem.rate += mem.rate * (1 - ratio) + instant_rate * ratio;
    // mem.last_transfer_tick = Game.time;
}

function log_progress(job: JobCreep.Data, creep: Creep, mem: HarvesterMemory, msg: string): void {
    log("job.harvest", `[${creep.name}|${job.id}|${mem.state}]: ${msg}`);
}

function update_internal(job: JobCreep.Data, creep: Creep): void {
    const mem = get_mem(creep);
    const move_to_target = (target: Creep | Structure) => {
        switch (creep.transfer(target, RESOURCE_ENERGY)) {
            case ERR_NOT_ENOUGH_RESOURCES:
                creep.say("💤");
                calc_new_rate(creep);
                job.active = false;
                log_progress(job, creep, mem, "Done");
                break;
            case ERR_NOT_IN_RANGE:
                creep.moveTo(target, { visualizePathStyle: Settings.get().path_styles.harvester_inbound as any });
                break;
            case ERR_FULL:
                creep.say("🚫❔ full");
                log_progress(job, creep, mem, `Target full`);
                break;
            default:
        }
    };

    // log.log('harvester', 'updating creep ' + creep.name + ' in state ' + JSON.stringify(mem));
    switch (mem.state) {
        case State.HS_SEARCHING_FOR_SOURCE: {
            const source = select_source_for_havester(job, creep);
            if (!source) {
                log_progress(job, creep, mem, "Couldn't locate source");
                creep.say("😢❗ no source");
                job.active = false;
                return;
            }
            creep.say("😮 found source");
            mem.target = source.id;
            mem.state = State.HS_GOING_TO_SOURCE;
            mem.stalled = false;
            log_progress(job, creep, mem, "Found source");
            break;
        }
        case State.HS_GOING_TO_SOURCE: {
            const source = Game.getObjectById(mem.target) as Source;
            if (creep.harvest(source) === OK) {
                mem.state = State.HS_HARVESTING;
                creep.say("🔁 harvest");
                log_progress(job, creep, mem, "At source");
            } else {
                creep.moveTo(source, { visualizePathStyle: Settings.get().path_styles.harvester_outbound as any });
            }
            break;
        }
        case State.HS_HARVESTING: {
            const target_source = Game.getObjectById(mem.target) as Source;
            if (creep.carry.energy === creep.carryCapacity) {
                mem.state = State.HS_GOING_TO_DEPOSIT;
                creep.say("✅ full");
                log_progress(job, creep, mem, "Capacity full");
                mem.target = undefined;
            } else if (creep.harvest(target_source) === ERR_NOT_ENOUGH_RESOURCES) {
                mem.state = State.HS_SEARCHING_FOR_SOURCE;
                creep.say("❎❔ source empty");
                log_progress(job, creep, mem, "Source empty");
                mem.target = undefined;
            }
            break;
        }
        case State.HS_GOING_TO_DEPOSIT: {
            let target;
            if (creep.room.name !== mem.home_room) {
                target = get_target_in_room(mem.home_room);
                log_progress(job, creep, mem, "Out of home room, rerouting");
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
                    log_progress(job, creep, mem, "Couldn't find a spawn or extension, reverting to room controller");
                    mem.state = State.HS_GOING_TO_CONTROLLER;
                }
            } else {
                move_to_target(target);
            }
            break;
        }
        case State.HS_GOING_TO_CONTROLLER: {
            if (!creep.room.controller || !creep.room.controller.my) {
                mem.state = State.HS_GOING_TO_DEPOSIT;
            } else {
                move_to_target(creep.room.controller);
            }
        }
    }
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

// import * as BodyPartSpec from "jobs/body.part.spec";
// import * as BodySpec from "jobs/body.spec";
// import { JobFactory } from "jobs/factory";
// import * as Job from "jobs/job";
// import * as CreepJob from "jobs/job.creep";
// import * as SpawnJob from "jobs/job.spawn";
// import { job_manager } from "jobs/manager";
// import { log } from "log";
// import * as CreepMemory from "memory/creep";
// import * as RoomMemory from "memory/room";
// import { settings } from "settings";

// const harvester_body_spec: BodySpec.Data = BodySpec.construct([
//     BodyPartSpec.construct(MOVE, 1, 1, 20),
//     BodyPartSpec.construct(WORK, 2, 1, 40),
//     BodyPartSpec.construct(CARRY, 1, 1, 20)
// ]);

// // class SpawnHarvesterJob extends SpawnJob {
// //     public generate_body(available_energy: number): string[] {
// //         // TODO: make it better
// //         if (available_energy < BODYPART_COST[])
// //             return [WORK, MOVE, CARRY];
// //     }

// //     public init_memory(): any {
// //         //
// //     }
// // };

// // class HarvestJob extends CreepJob {
// //     protected update_creep(creep: Creep): void {
// //         throw new Error("Method not implemented.");
// //     }
// //     protected rate(creep: Creep): number {
// //         throw new Error("Method not implemented.");
// //     }
// // }

// function need_more_harvesters(room: Room): boolean {
//     // Check we don't already have stalled harvesters
//     const stalled_harvesters = room.find(FIND_MY_CREEPS, {
//         filter: (c: Creep) => CreepMemory.get(c).role === "harvester" && CreepMemory.get(c).stalled
//     }).length;
//     if (stalled_harvesters) {
//         log("spawn", `room ${room.name} has ${stalled_harvesters} stalled harvesters, aborting spawning`);
//         return false;
//     }
//     const sources: Source[] = room.find(FIND_SOURCES);
//     const room_energy_cap = sources.reduce((sum: number, source: Source) => sum + source.energyCapacity, 0);
//     const energy_per_tick = room_energy_cap / ENERGY_REGEN_TIME;
//     const room_rate = RoomMemory.get_stats(room).harvest_rate;
//     const desired_rate = energy_per_tick * settings.spawner.harvester_scale;
//     log("spawn", "room " + room.name
//         + ": room_energy_cap = " + room_energy_cap
//         + ", energy_per_tick = " + energy_per_tick
//         + ", room_rate = " + room_rate
//         + ", desired_rate = " + desired_rate
//     );
//     return room_rate < desired_rate;
// }

// export const HAVEST_FACTORY: string = "harvest_factor";
// export const SPAWN_HAVESTER: string = "spawn_harvest";
// export const HAVEST_SOURCE: string = "harvest_source";

// function should_harvest_room(room: Room): boolean {
//     // TODO: later we will have flags or metadata to specify external rooms for harvesting
//     return (room.controller as Controller).my;
// }

// function get_assigned_harvesters(source: Source) {
//     return source.room.find(FIND_MY_CREEPS,
//         { filter: (creep: Creep) => mem.target === source.id });
// }

// function required_harvest_jobs(room: Room): number {
//     let count = 0;
//     const room_md = RoomMemory.get_metadata(room);
//     for (const s in room_md.source_spaces) {
//         const source = Game.getObjectById(s) as Source;
//         // Early out on actually having energy to get
//         if (source.energy > 50) {
//             const spaces = room_md.source_spaces[source.id] as number;
//             const assigned_count = get_assigned_harvesters(source).length;
//             if (assigned_count < spaces + 1) {
//                 count++;
//             }
//         }
//     }
//     return count;
// }

// class HarvestFactory implements JobFactory {
//     public assign(job: Job.Data): void {
//         throw new Error("Method not implemented.");
//     }

//     public update(job: Job.Data): void {
//         throw new Error("Method not implemented.");
//     }

//     public generate_new_jobs(active_jobs: Job.Data[]): Job.Data[] {
//         const new_jobs: Job.Data[] = [];
//         // Create jobs for rooms
//         _.forOwn(Game.rooms, (room: Room) => {
//             if (should_harvest_room(room)) {
//                 // Account for already active spawn tasks
//                 const active_jobs_in_room = _.filter(active_jobs,
//                     (job: Job.Data) => job.room === room.name && job.type === SPAWN_HAVESTER).length;
//                 // For now we will only spawn one at a time.
//                 if (active_jobs_in_room === 0 && need_more_harvesters(room)) {
//                     const new_job = SpawnJob.construct(
//                         SPAWN_HAVESTER,
//                         HAVEST_FACTORY,
//                         room.getPositionAt(0, 0) as RoomPosition,
//                         settings.jobs.priorities.get(SPAWN_HAVESTER) as number,
//                         SpawnJob.Flags.None,
//                         harvester_body_spec,
//                         "harvester");
//                     new_jobs.push(new_job);
//                 }
//                 const harvest_job_count = required_harvest_jobs(room);
//                 for (let i = 0; i < harvest_job_count; ++i) {
//                     const new_job = HarvestJob.construct(
//                         SPAWN_HAVESTER,
//                         HAVEST_FACTORY,
//                         room.getPositionAt(0, 0) as RoomPosition,
//                         settings.jobs.priorities.get(SPAWN_HAVESTER) as number,
//                         SpawnJob.Flags.None,
//                         harvester_body_spec,
//                         "harvester");
//                     new_jobs.push(new_job);
//                 }
//             }
//         });
//         return new_jobs;
//     }
// }

// job_manager.register_factory(HAVEST_FACTORY, new HarvestFactory());
