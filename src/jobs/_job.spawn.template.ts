/*

import * as BodyPartSpec from "jobs/body.part.spec";
import * as BodySpec from "jobs/body.spec";
import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as SpawnJob from "jobs/job.spawn";
import { log } from "log";
import * as CreepMemory from "memory/creep";
import * as RoomMemory from "memory/room";
import * as Settings from "settings";

// ************************* FILL IN HERE ******************************
export const FACTORY_NAME: string = "spawn_XXXX_factory";
export const JOB_NAME: string = "spawn_XXXX_job";
export const ROLE_NAME: string = "XXXX";

// Body spec
const body_spec: BodySpec.Data = BodySpec.construct([
    // ************************* FILL IN HERE ******************************
    // BodyPartSpec.construct(MOVE, 1, 1, 20),
    // BodyPartSpec.construct(WORK, 2, 1, 40),
    // BodyPartSpec.construct(CARRY, 1, 1, 20)
]);

// Do we need more of these creeps in this room?
function need_more(room: Room): boolean {
    // ************************* FILL IN HERE ******************************

    // // Check we don't already have stalled harvesters
    // const stalled_harvesters = room.find(FIND_MY_CREEPS, {
    //     filter: (c: Creep) => CreepMemory.get(c).role === ROLE_NAME && CreepMemory.get(c).stalled
    // }).length;
    // if (stalled_harvesters) {
    //     log("job.spawn.harvester", `room ${room.name} has ${stalled_harvesters} stalled harvesters, aborting spawning`);
    //     return false;
    // }
    // const sources: Source[] = room.find(FIND_SOURCES);
    // const room_energy_cap = sources.reduce((sum: number, source: Source) => sum + source.energyCapacity, 0);
    // const energy_per_tick = room_energy_cap / ENERGY_REGEN_TIME;
    // const room_rate = RoomMemory.get_stats(room).harvest_rate;
    // const desired_rate = energy_per_tick * Settings.get().spawner.harvester_scale;
    // log("job.spawn.harvester", "room " + room.name
    //     + ": room_energy_cap = " + room_energy_cap
    //     + ", energy_per_tick = " + energy_per_tick
    //     + ", room_rate = " + room_rate
    //     + ", desired_rate = " + desired_rate
    // );
    // return room_rate < desired_rate;
}

// Factory assign function
function assign(job: Job.Data): boolean {
    // ************************* FILL IN HERE ******************************
    // Default might be fine
    return SpawnJob.assign(job as SpawnJob.Data);
}

// Factory update function
function update(job: Job.Data): void {
    // ************************* FILL IN HERE ******************************
    // Default might be fine
    SpawnJob.update(job as SpawnJob.Data);
}

// Factory generate new jobs function
function generate_new_jobs(active_jobs: Job.Data[]): Job.Data[] {
    const new_jobs: Job.Data[] = [];

    // ************************* FILL IN HERE ******************************
    // Create jobs for rooms
    _.forOwn(Game.rooms, (room: Room) => {

    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update } as JobFactory;
}

*/
