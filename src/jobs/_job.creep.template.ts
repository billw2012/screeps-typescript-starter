/*
import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobCreep from "jobs/job.creep";
import { log } from "log";
import * as CreepMemory from "memory/creep";

// ************************* FILL IN HERE ******************************
export const FACTORY_NAME: string = "XXXX_factory";
export const JOB_NAME: string = "XXXX_job";

// ************************* FILL IN HERE ******************************
// Optional extra memory
interface XXXXMemory extends CreepMemory.Data {
    state: State;
}

function get_mem(creep: Creep, _reset: boolean = false): XXXXMemory {
    const mem = CreepMemory.get(creep) as XXXXMemory;
    if (mem.state === undefined || _reset) {
        mem.state = State.UNKNOWN;
// ************************* FILL IN HERE ******************************
// Init custom memory if it hasn't been set
    }
    return mem;
}

// Factory assign function
function assign(job: Job.Data): boolean {
    return JobCreep.assign(job as JobCreep.Data, (_job: JobCreep.Data, creep: Creep): number => {
// ************************* FILL IN HERE ******************************
// Rating callback: Implement creep rating for job metric here
        return metric;
    }, (_job: JobCreep.Data, creep: Creep): void => {
// ************************* FILL IN HERE ******************************
// Assigned callback: Initialize creep state for the job here
        get_mem(creep, true);
    });
}

enum State {
// ************************* FILL IN HERE ******************************
// Optional job states
    UNKNOWN,
    DONE
}

function log_progress(job: JobCreep.Data, creep: Creep, mem: XXXXMemory, msg: string): void {
    log("job.XXXX", `[${creep.name}|${job.id}|${mem.state}]: ${msg}`);
}

function update_internal(job: JobCreep.Data, creep: Creep): void {
    const mem = get_mem(creep);
// ************************* FILL IN HERE ******************************
// Optional state machine
    switch (mem.state) {
        case State.UNKNOWN: {
            creep.say("🔄 xxxx");
            log_progress(job, creep, mem, "Found source");
            break;
        }
        case State.DONE: {
            job.active = false;
        }
    }
}

function clean_up(creep: Creep): void {
// ************************* FILL IN HERE ******************************
// Cleanup after job, this is called when job.active becomes false,
// e.g. if set manually in update_internal, or in kill
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

// Factory generate new jobs function
function generate_new_jobs(_active_jobs: Job.Data[]): Job.Data[] {
// ************************* FILL IN HERE ******************************
// Optionally clean up broken job-creep links
    if (Game.time % 10) {
        _.forOwn(Game.creeps, (creep: Creep) => {
            const mem = get_mem(creep);
            // IF it is one of our creeps and has a job assigned
            if (mem.role === xxxx && mem.job !== undefined) {
                // If we can't find the assigned job
                if (!_.find(_active_jobs, (job: Job.Data) =>
                        job.type === JOB_NAME && (job as JobCreep.Data).assigned_creep === creep.name)) {
                    log("job.harvest", `Cleaning disconnected job ${mem.job} for creep ${creep.name}`);
                    mem.job = undefined;
                    clean_up(creep);
                }
            }
        });
    }
// ************************* FILL IN HERE ******************************
// Generate jobs
    const new_jobs: Job.Data[] = [];
    _.forOwn(Game.rooms, (room: Room) => {

    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update, kill } as JobFactory;
}
*/
