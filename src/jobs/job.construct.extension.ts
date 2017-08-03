import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobConstruct from "jobs/job.construct";
import * as Utils from "utils";

// ************************* FILL IN HERE ******************************
export const FACTORY_NAME: string = "construct_extension_factory";
export const JOB_NAME: string = "construct_extension_job";
export const STRUCTURE_NAME: string = STRUCTURE_EXTENSION;

// Factory assign function
function assign(this_: Job.Data): boolean {
    return JobConstruct.assign(this_ as JobConstruct.Data);
}

function get_first_spawn(room: Room): Spawn | null {
    const spawns = room.find(FIND_MY_SPAWNS) as Spawn[];
    if (!spawns || spawns.length === 0) {
        return null;
    }
    return spawns[0];
}

function check_pos(x: number, y: number, room: Room): boolean {
    return Utils.cross_is_clear(x, y, room);
}

// Factory update function
function update(this_: Job.Data): void {
    JobConstruct.update(this_ as JobConstruct.Data, (_job: JobConstruct.Data): RoomPosition | null => {
        const room = Game.rooms[this_.room];
        const spawn = get_first_spawn(room);
        if (spawn) {
            return Utils.box_search(spawn.pos, check_pos, 1, 2);
        }
        return null;
    });
}

// Factory generate new jobs function
function generate_new_jobs(_active_jobs: Job.Data[]): Job.Data[] {
    const new_jobs: Job.Data[] = [];

    // Create jobs for rooms
    _.forOwn(Game.rooms, (room: Room) => {
        const max = JobConstruct.get_controller_structure_max(room, STRUCTURE_NAME);
        const curr = JobConstruct.get_controller_structures(room, STRUCTURE_NAME);
        if (curr.length < max) {
            new_jobs.push(JobConstruct.construct_auto_pos(JOB_NAME, FACTORY_NAME, room.name, STRUCTURE_NAME));
        }
        // const jobs_in_room = _.sum(active_jobs, (job: Job.Data) => (job.room === room.name) ? 1 : 0);
        // const required_jobs = max - curr.length - jobs_in_room;
        // for (let idx = 0; idx < required_jobs; ++idx) {
        //    new_jobs.push(JobConstruct.construct_auto_pos(JOB_NAME, FACTORY_NAME, room.name, STRUCTURE_NAME));
        // }
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update } as JobFactory;
}
