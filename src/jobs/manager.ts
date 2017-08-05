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
import { log, Settings } from "log";

function get_jobs(): Job.Data[] {
    return Memory.jobs;
}

function set_jobs(jobs: Job.Data[]) {
    Memory.jobs = jobs;
}

function get_factory_for_job(factories: any, job: Job.Data): JobFactory {
    return factories[job.factory] as JobFactory;
}

interface JobStats {
    job_duration: any;
}

function get_job_stats(): JobStats {
    if (!Memory.job_stats) {
        Memory.job_stats = {
            job_duration: {}
        };
    }
    return Memory.job_stats as JobStats;
}

function update_job_duration(type: string, age: number) {
    const durations = get_job_stats().job_duration;
    if (!durations[type]) {
        durations[type] = age;
    } else {
        durations[type] = durations[type] * 0.9 + age * 0.1;
    }
}

function update_job_stats(job: Job.Data) {
    if (!job.active) {
        update_job_duration(job.type, Game.time - job.created);
    }
}
/**
 * Perform full update:
 * 1. Update jobs
 * 2. Kill expired jobs
 * 3. Cull dead jobs
 * 4. Generate new jobs
 * 5. Sort new jobs by priority
 * 6. Attempt to assign new jobs in priority order
 * 7. Add successfully assigned jobs to the active job list
 */

function get_ttl(job: Job.Data): number {
    if (!job.ttl) {
        const setting = Settings.get().jobs[job.type];
        if (!setting || !setting.ttl) {
            return Settings.get().jobs.default.ttl;
        } else {
            return setting.ttl;
        }
    } else {
        return job.ttl;
    }
}

function get_priority(job: Job.Data): number {
    if (!job.priority) {
        const setting = Settings.get().jobs[job.type];
        if (!setting || !setting.priority) {
            return Settings.get().jobs.default.priority;
        } else {
            return setting.priority;
        }
    } else {
        return job.priority;
    }
}

function get_interval(factory_settings: Settings.FactorySettings, factory_name: string): number {
    if (!factory_settings[factory_name]) {
        return factory_settings.default.interval;
    } else {
        return factory_settings[factory_name].interval;
    }
}

interface Factories {
    [key: string]: JobFactory;
}

export function update(factories: Factories) {
    let jobs = get_jobs();

    // Update live jobs
    _.forEach(jobs, (job: Job.Data) => get_factory_for_job(factories, job).update(job));

    // Kill expired jobs
    _.forEach(jobs, (job: Job.Data) => {
        // Might already be done...
        if (job.active) {
            const ttl = get_ttl(job);
            if (Game.time - job.created > ttl) {
                if (get_factory_for_job(factories, job).kill(job)) {
                    log("manager", `Killed expired job ${job.id}`, Settings.LogLevel.WARNING);
                    job.active = false;
                }
            }
        }
    });

    // Update job stats
    _.forEach(jobs, update_job_stats);

    // Cull dead jobs
    jobs = _.filter(jobs, (job: Job.Data) => job.active);

    let all_new_jobs: Job.Data[] = [];

    const factory_settings = Settings.get().factories;
    // Generate new jobs
    _.forOwn(factories, (factory: JobFactory, factory_name: string) => {
        if (Game.time % get_interval(factory_settings, factory_name) === 0) {
            const active_jobs = _.filter(jobs, (job: Job.Data) => job.factory === factory_name);
            const new_jobs = factory.generate_new_jobs(active_jobs);
            if (new_jobs.length > 0) {
                log("manager", `Factory ${factory_name} generated ${new_jobs.length} jobs this tick`);
                all_new_jobs = all_new_jobs.concat(new_jobs);
            }
        }
    });

    // Prioritize new jobs
    _.sortBy(all_new_jobs, (job: Job.Data) => get_priority(job));

    // Attempt to assign new jobs. If successfull then insert them into the active job list.
    _.forEach(all_new_jobs, (job: Job.Data) => {
        if (get_factory_for_job(factories, job).assign(job)) {
            jobs.push(job);
        }
    });

    set_jobs(jobs);
}
