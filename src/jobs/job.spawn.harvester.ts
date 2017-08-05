import * as BodyPartSpec from "jobs/body.part.spec";
import * as BodySpec from "jobs/body.spec";
import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as SpawnJob from "jobs/job.spawn";
import { log } from "log";
import * as CreepMemory from "memory/creep";
import * as RoomMemory from "memory/room";
import * as Settings from "settings";

export const FACTORY_NAME: string = "spawn_harvest_factory";
export const JOB_NAME: string = "spawn_harvester_job";
export const ROLE_NAME: string = "harvester";

// Body spec
const body_spec: BodySpec.Data = BodySpec.construct([
    BodyPartSpec.construct(MOVE, 1, 1, 20),
    BodyPartSpec.construct(WORK, 2, 1, 40),
    BodyPartSpec.construct(CARRY, 1, 1, 20)
]);

// Do we need more of these creeps in this room?
function need_more(room: Room): boolean {
    // Check we don't already have stalled harvesters
    const stalled_harvesters = room.find(FIND_MY_CREEPS, {
        filter: (c: Creep) => {
            const mem = CreepMemory.get(c);
            return mem.role === ROLE_NAME && (mem.stalled || !mem.job);
        }
    }).length;
    if (stalled_harvesters > 0) {
        log("job.spawn.harvester", `room ${room.name} has ${stalled_harvesters} stalled harvesters, aborting spawning`);
        return false;
    }
    return true;
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
// TODO:
// Merge harvester and builder
// Fix spawning energy usage logic - if there are enough creeps then don't spawn until full energy
// Extension and road placement
// Switch dontblock to idle operation

function should_harvest_room(room: Room): boolean {
    // TODO: later we will have flags or metadata to specify external rooms for harvesting
    return (room.controller as Controller).my;
}

// Factory assign function
function assign(job: Job.Data): boolean {
    return SpawnJob.assign(job as SpawnJob.Data);
}

// Factory update function
function update(job: Job.Data): void {
    SpawnJob.update(job as SpawnJob.Data);
}

// Factory update function
function kill(job: Job.Data): boolean {
    return SpawnJob.kill(job as SpawnJob.Data);
}

// Factory generate new jobs function
function generate_new_jobs(active_jobs: Job.Data[]): Job.Data[] {
    const new_jobs: Job.Data[] = [];
    // Create jobs for rooms
    _.forOwn(Game.rooms, (room: Room) => {
        if (should_harvest_room(room)) {
            // Account for already active spawn tasks
            const active_jobs_in_room = _.filter(active_jobs,
                (job: Job.Data) => job.room === room.name && job.type === JOB_NAME).length;
            // For now we will only spawn one at a time.
            if (active_jobs_in_room === 0 && need_more(room)) {
                const new_job = SpawnJob.construct(
                    JOB_NAME,
                    FACTORY_NAME,
                    room.name,
                    -1, -1,
                    SpawnJob.Flags.None,
                    body_spec,
                    ROLE_NAME);
                new_jobs.push(new_job);
            }
        }
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update, kill } as JobFactory;
}
