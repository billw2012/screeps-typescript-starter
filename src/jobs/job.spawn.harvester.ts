import * as BodyPartSpec from "jobs/body.part.spec";
import * as BodySpec from "jobs/body.spec";
import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as SpawnJob from "jobs/job.spawn";
import { job_manager } from "jobs/manager";
import { log } from "log";
import * as CreepMemory from "memory/creep";
import * as RoomMemory from "memory/room";
import { settings } from "settings";

const harvester_body_spec: BodySpec.Data = BodySpec.construct([
    BodyPartSpec.construct(MOVE, 1, 1, 20),
    BodyPartSpec.construct(WORK, 2, 1, 40),
    BodyPartSpec.construct(CARRY, 1, 1, 20)
]);

function need_more_harvesters(room: Room): boolean {
    // Check we don't already have stalled harvesters
    const stalled_harvesters = room.find(FIND_MY_CREEPS, {
            filter: (c: Creep) => CreepMemory.get(c).role === "harvester" && CreepMemory.get(c).stalled
        }).length;
    if (stalled_harvesters) {
        log("spawn", `room ${room.name} has ${stalled_harvesters} stalled harvesters, aborting spawning`);
        return false;
    }
    const sources: Source[] = room.find(FIND_SOURCES);
    const room_energy_cap = sources.reduce((sum: number, source: Source) => sum + source.energyCapacity, 0);
    const energy_per_tick = room_energy_cap / ENERGY_REGEN_TIME;
    const room_rate = RoomMemory.get_stats(room).harvest_rate;
    const desired_rate = energy_per_tick * settings.spawner.harvester_scale;
    log("spawn", "room " + room.name
        + ": room_energy_cap = " + room_energy_cap
        + ", energy_per_tick = " + energy_per_tick
        + ", room_rate = " + room_rate
        + ", desired_rate = " + desired_rate
    );
    return room_rate < desired_rate;
}

export const SPAWN_HAVEST_FACTORY: string = "spawn_harvest_factory";
export const SPAWN_HAVESTER_JOB: string = "spawn_harvester_job";

function should_harvest_room(room: Room): boolean {
    // TODO: later we will have flags or metadata to specify external rooms for harvesting
    return (room.controller as Controller).my;
}

class SpawnHarvestFactory implements JobFactory {
    public assign(job: Job.Data): boolean {
        return SpawnJob.assign(job as SpawnJob.Data);
    }

    public update(job: Job.Data): void {
        SpawnJob.update(job as SpawnJob.Data);
    }

    public generate_new_jobs(active_jobs: Job.Data[]): Job.Data[] {
        const new_jobs: Job.Data[] = [];
        // Create jobs for rooms
        _.forOwn(Game.rooms, (room: Room) => {
            if (should_harvest_room(room)) {
                // Account for already active spawn tasks
                const active_jobs_in_room = _.filter(active_jobs,
                    (job: Job.Data) => job.room === room.name && job.type === SPAWN_HAVESTER_JOB).length;
                // For now we will only spawn one at a time.
                if (active_jobs_in_room === 0 && need_more_harvesters(room)) {
                    const new_job = SpawnJob.construct(
                        SPAWN_HAVESTER_JOB,
                        SPAWN_HAVEST_FACTORY,
                        room.getPositionAt(0, 0) as RoomPosition,
                        settings.jobs.priorities.get(SPAWN_HAVESTER_JOB) as number,
                        SpawnJob.Flags.None,
                        harvester_body_spec,
                        "harvester");
                    new_jobs.push(new_job);
                }
            }
        });
        return new_jobs;
    }
}

job_manager.register_factory(SPAWN_HAVEST_FACTORY, new SpawnHarvestFactory());
