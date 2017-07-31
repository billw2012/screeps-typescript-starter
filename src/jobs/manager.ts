/*

room jobs / global jobs

********************
PERHAPS EFFICENCY OF CREEP ALLOCATION ISN'T IMPORTANT IF YOU CAN SPAM THEM EASILY
EFFICENCY OF RESOURCE ACQUISITION FOR UPGRADES MIGHT BE PARAMOUNT.
This implies keeping specialized creeps and not worrying about idlers, focusing on
optimial resource extraction, e.g. most efficient miners, maximum throughput etc.
*******************

Jobs can all be per room. Resolve selecting creeps outside of room when there
isn't one in the room. That is part of the suitiability criteria of a creep for the job.

room metrics:
    energy generated per tick
    energy storage capacity
    energy stored

room jobs:
    energy to spawn:
        number of jobs =

    deposit resource
    upgrade controller

algorithm:
    for each room
        clear all non active jobs
        spawn new jobs
        for each active job
            update
            check status
            delete if complete
        for each new job in priority order
            if can assign appropriate creep
                mark active

*/
import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as _ from "lodash";
import { log } from "log";

/**
 * High level job management:
 * - calls factories to generate new jobs
 * - prioritizes new jobs
 * - attempts to assign new jobs
 * - maintains list of active jobs
 * - culls dead jobs
 */

// Registered job factories
// private factories: Map<string, JobFactory> = new Map<string, JobFactory>();

// Active jobs categorised by type and name
// private jobs: Map<string, Map<string, Job>> = new Map<string, Map<string, Job>>();
function get_jobs(): Job.Data[] {
    return Memory.jobs;
}

function set_jobs(jobs: Job.Data[]) {
    Memory.jobs = jobs;
}

// /**
//  * Register new job factories by name
//  * @param name - Name of the job type generated
//  * @param factory - The factory implementation
//  */
// public register_factory(name: string, factory: JobFactory) {
//     this.factories.set(name, factory);
// }

function get_factory_for_job(factories: any, job: Job.Data): JobFactory {
    return factories[job.factory] as JobFactory;
}
/**
 * Perform full update:
 * 1. Update jobs
 * 2. Cull dead jobs
 * 3. Generate new jobs
 * 4. Sort new jobs by priority
 * 5. Attempt to assign new jobs in priority order
 * 6. Add successfully assigned jobs to the active job list
 */
export function update(factories: any) {
    let jobs = get_jobs();
    // Update live jobs
    _.forEach(jobs, (job: Job.Data) => get_factory_for_job(factories, job).update(job));

    // Cull dead jobs
    jobs = _.filter(jobs, (job: Job.Data) => job.active);
    let all_new_jobs: Job.Data[] = [];

    // Generate new jobs
    _.forOwn(factories, (factory: JobFactory, type: string) => {
        const active_jobs = _.filter(jobs, (job: Job.Data) => job.type === type);
        const new_jobs = factory.generate_new_jobs(active_jobs);
        if (new_jobs.length > 0) {
            log("manager", `Factory ${type} generated ${new_jobs.length} jobs this tick`);
            all_new_jobs = all_new_jobs.concat(new_jobs);
        }
    });

    // Prioritize new jobs
    _.sortBy(all_new_jobs, (job: Job.Data) => job.priority);

    // Attempt to assign new jobs. If successfull then insert them into the active job list
    _.forEach(all_new_jobs, (job: Job.Data) => {
        if (get_factory_for_job(factories, job).assign(job)) {
            jobs.push(job);
        }
    });

    set_jobs(jobs);
}
