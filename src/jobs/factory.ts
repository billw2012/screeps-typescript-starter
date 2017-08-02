import * as Job from "jobs/job";

export interface JobFactory {
    // Generate new jobs for this tick, these are discarded if not assigned the same tick
    generate_new_jobs(active_jobs: Job.Data[]): Job.Data[];
    // Attempt to assign the job
    assign(job: Job.Data): boolean;
    // Update the job state
    update(job: Job.Data): void;
    // Return true if the job was successfully killed
    kill(job: Job.Data): boolean;
}
