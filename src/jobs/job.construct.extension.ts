import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobConstruct from "jobs/job.construct";
import * as RoomMemory from "memory/room";
import * as pos from "pos";
import * as utils from "utils";

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

// Factory update function
function update(this_: Job.Data): void {
    JobConstruct.update(this_ as JobConstruct.Data, (_job: JobConstruct.Data): RoomPosition | null => {
        const room = Game.rooms[this_.room];
        const room_metadata = RoomMemory.get_metadata(room);
        if (RoomMemory.is_metadata_ready(room, RoomMemory.MetadataFlags.Extensions)) {
            const spawn = get_first_spawn(room);
            if (spawn) {
                const found_pos = _.find(room_metadata.extensions, (p: pos.Pos) => utils.pos_is_clear(p.x, p.y, room));
                // utils.box_search(spawn.pos.x, spawn.pos.y, (x, y) => check_pos(x, y, room), 1, 2);
                if (found_pos) {
                    return pos.room_pos(found_pos, room);
                }
            }
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
        const under_construction = JobConstruct.get_under_construction(room, STRUCTURE_NAME);
        if (curr.length + under_construction.length < max) {
            new_jobs.push(JobConstruct.construct_auto_pos(JOB_NAME, FACTORY_NAME, room.name, STRUCTURE_NAME));
        }
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update } as JobFactory;
}
