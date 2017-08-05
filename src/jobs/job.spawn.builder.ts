import * as BodyPartSpec from "jobs/body.part.spec";
import * as BodySpec from "jobs/body.spec";
import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as SpawnJob from "jobs/job.spawn";
import * as CreepMemory from "memory/creep";
import * as Settings from "settings";

export const FACTORY_NAME: string = "spawn_builder_factory";
export const JOB_NAME: string = "spawn_builder_job";
export const ROLE_NAME: string = "builder";

// Body spec
const body_spec: BodySpec.Data = BodySpec.construct([
    BodyPartSpec.construct(MOVE, 1, 1, 20),
    BodyPartSpec.construct(WORK, 1, 1, 20),
    BodyPartSpec.construct(CARRY, 1, 1, 20)
]);

// Do we need more of these creeps in this room?
function how_many_needed(room: Room): number {
    if (room.find(FIND_MY_CONSTRUCTION_SITES).length === 0) {
        return 0;
    }
    const builders_for_room = _.sum(Game.creeps, (creep: Creep) => {
        const mem = CreepMemory.get(creep);
        return mem.home_room === room.name && mem.role === ROLE_NAME ? 1 : 0;
    });
    return builders_for_room - Settings.get().spawner.per_room_limits.builder;
}

// Factory assign function
function assign(job: Job.Data): boolean {
    return SpawnJob.assign(job as SpawnJob.Data);
}

// Factory update function
function update(job: Job.Data): void {
    SpawnJob.update(job as SpawnJob.Data);
}

// Factory generate new jobs function
function generate_new_jobs(active_jobs: Job.Data[]): Job.Data[] {
    const new_jobs: Job.Data[] = [];
    _.forOwn(Game.rooms, (room: Room) => {
        const room_jobs = _.sum(active_jobs, (job: Job.Data) => job.room === room.name ? 1 : 0);
        const jobs_required = room_jobs - how_many_needed(room);
        for (let idx = 0; idx < jobs_required; ++idx) {
            new_jobs.push(SpawnJob.construct(JOB_NAME, FACTORY_NAME, room.name, -1, -1, SpawnJob.Flags.None, body_spec, ROLE_NAME));
        }
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update } as JobFactory;
}
