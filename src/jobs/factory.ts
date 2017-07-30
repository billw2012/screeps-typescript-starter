import { Job } from "jobs/job";

export interface JobFactory {
    generate_new_jobs(active_jobs: Job[]): Job[];
}
