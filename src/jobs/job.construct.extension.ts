import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobConstruct from "jobs/job.construct";
import { log } from "log";
import * as RoomMemory from "memory/room";
import * as Settings from "settings";

// ************************* FILL IN HERE ******************************
export const FACTORY_NAME: string = "construct_extension_factory";
export const JOB_NAME: string = "construct_extension_job";
export const STRUCTURE_NAME: string = STRUCTURE_EXTENSION;

// Factory assign function
function assign(this_: Job.Data): boolean {
    return JobConstruct.assign(this_ as JobConstruct.Data);
}

// Factory update function
function update(this_: Job.Data): void {
    JobConstruct.update(this_ as JobConstruct.Data, (job: JobConstruct.Data): RoomPosition | null => {
        return null;
    });
}

// Factory generate new jobs function
function generate_new_jobs(active_jobs: Job.Data[]): Job.Data[] {
    const new_jobs: Job.Data[] = [];

    // ************************* FILL IN HERE ******************************
    // Create jobs for rooms
    _.forOwn(Game.rooms, (room: Room) => {
        const max = JobConstruct.get_controller_structure_max(room, STRUCTURE_NAME);
        const curr = JobConstruct.get_controller_structures(room, STRUCTURE_NAME);
        const jobs_in_room = _.sum(active_jobs, (job: Job.Data) => (job.room === room.name) ? 1 : 0);
        const required_jobs = max - curr.length - jobs_in_room;
        for(let idx = 0; idx < required_jobs; ++idx) {
            new_jobs.push(JobConstruct.);
        }
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update } as JobFactory;
}
