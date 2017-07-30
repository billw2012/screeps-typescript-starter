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
import { Job } from "jobs/job";
import * as _ from "lodash";

/**
 * High level job management:
 * - calls factories to generate new jobs
 * - prioritizes new jobs
 * - attempts to assign new jobs
 * - maintains list of active jobs
 * - culls dead jobs
 */
class JobManager {
    // Registered job factories
    private factories: Map<string, JobFactory> = new Map<string, JobFactory>();
    // Active jobs categorised by type and name
    // private jobs: Map<string, Map<string, Job>> = new Map<string, Map<string, Job>>();
    private jobs: Job[];

    /**
     * Register new job factories by name
     * @param name - Name of the job type generated
     * @param factory - The factory implementation
     */
    public register_factory(name: string, factory: JobFactory) {
        this.factories.set(name, factory);
    }
    /**
     * Perform full update:
     * 1. Cull dead jobs
     * 2. Generate new jobs
     * 3. Sort new jobs by priority
     * 4. Attempt to assign new jobs in priority order
     * 5. Add successfully assigned jobs to the active job list
     */
    public update() {
        // Cull dead jobs
        this.jobs = _.filter(this.jobs, (job: Job) => job.active);
        // _.forOwn(this.jobs, (jobMap: Map<string, Job>, type: string) => {
        //   this.jobs.set(type, _.pick(jobMap, (job: Job) => job.active));
        // });
        let all_new_jobs: Job[] = [];
        // Generate new jobs
        _.forOwn(this.factories, (factory: JobFactory, type: string) => {
            const active_jobs = _.filter(this.jobs, (job: Job) => job.type === type);
            const new_jobs = factory.generate_new_jobs(active_jobs);
            all_new_jobs = all_new_jobs.concat(new_jobs);
        });
        // Prioritize new jobs
        _.sortBy(all_new_jobs, (job: Job) => job.priority);
        // Attempt to assign new jobs. If successfull then insert them into the active job list
        _.forEach(all_new_jobs, (job: Job) => {
            if (job.assign()) {
                this.jobs.push(job);
                // const active_jobs = this.jobs.get(job.type);
                // if (!active_jobs) {
                //   this.jobs.set(job.type, [job]);
                // } else {
                //   active_jobs.push(job);
                // }
            }
        });
    }
}

export const job_manager = new JobManager();
