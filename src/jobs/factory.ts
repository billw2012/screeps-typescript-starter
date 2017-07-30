import * as Job from "jobs/job";

export interface JobFactory {
    generate_new_jobs(active_jobs: Job.Data[]): Job.Data[];
    assign(job: Job.Data): boolean;
    update(job: Job.Data): void;
}
