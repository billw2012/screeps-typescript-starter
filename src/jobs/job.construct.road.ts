import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobConstruct from "jobs/job.construct";
import * as RoomMemory from "memory/room";
import * as pos from "pos";
import * as utils from "utils";

export const FACTORY_NAME: string = "construct_road_factory";
export const JOB_NAME: string = "construct_road_job";
export const STRUCTURE_NAME: string = STRUCTURE_ROAD;

// Factory assign function
function assign(this_: Job.Data): boolean {
    return JobConstruct.assign(this_ as JobConstruct.Data);
}

// Factory update function
function update(this_: Job.Data): void {
    JobConstruct.update(this_ as JobConstruct.Data);
}

// Factory generate new jobs function
function generate_new_jobs(_active_jobs: Job.Data[]): Job.Data[] {
    const new_jobs: Job.Data[] = [];
    if (Game.time % 17 === 0) {
        // Create jobs for rooms
        _.forOwn(Game.rooms, (room: Room) => {
            if (room.controller && room.controller.my) {
                const room_metadata = RoomMemory.get_metadata(room);
                if (RoomMemory.is_metadata_ready(room, RoomMemory.MetadataFlags.Roads)) {
                    const active_in_this_room = room.find(FIND_MY_CONSTRUCTION_SITES).length;
                    if (active_in_this_room === 0) {
                        for (let l = 1; l <= room.controller.level; ++l) {
                            // Add the jobs after filtering
                            _.forEach(
                                // Only want to build a few at a time, so take 10 - active_jobs
                                _.take(
                                    // Only interested in road that isn't blocked or already being built
                                    _.filter(room_metadata.roads[l],
                                        (p: pos.Pos) => utils.pos_is_clear(p.x, p.y, room)),
                                    10),
                                (q: pos.Pos) => new_jobs.push(JobConstruct.construct(JOB_NAME, FACTORY_NAME, room.name, q.x, q.y, STRUCTURE_NAME)
                            ));
                        }
                    }
                }
            }
        });
    }
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update } as JobFactory;
}
