import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobCreep from "jobs/job.creep";
import { log, Settings } from "log";
import * as CreepMemory from "memory/creep";
import { ROOM_SIZE } from "memory/room";
import { same_pos } from "utils";

export const FACTORY_NAME: string = "stopblocking_factory";
export const JOB_NAME: string = "stopblocking_job";

interface StopBlockingMemory extends CreepMemory.Data {
    state: State;
    target_x: number;
    target_y: number;
}

function get_mem(creep: Creep, reset: boolean = false): StopBlockingMemory {
    const mem = CreepMemory.get(creep) as StopBlockingMemory;
    if (!mem.state || reset) {
        mem.state = State.UNKNOWN;
    }
    return mem;
}

// function get_blocked_things(creep: Creep): LookAtResultWithPos[] {
//     return creep.room.lookForAtArea(LOOK_STRUCTURES, creep.pos.y - 1, creep.pos.x - 1,
//         creep.pos.y + 1, creep.pos.x + 1, true) as LookAtResultWithPos[];
// }

function get_blocking_creeps(pos: RoomPosition): Creep[] {
    const room = Game.rooms[pos.roomName] as Room;
    return _.map(room.lookForAtArea(LOOK_CREEPS, pos.y - 1, pos.x - 1,
        pos.y + 1, pos.x + 1, true) as LookAtResultWithPos[], (l: LookAtResultWithPos) => l.creep as Creep);
}

// Factory assign function
function assign(job: Job.Data): boolean {
    return JobCreep.assign(job as JobCreep.Data, (_job: JobCreep.Data, creep: Creep): number => {
        const blocked_pos = Job.get_pos(job) as RoomPosition;
        if (same_pos(blocked_pos, creep.pos)) {
            return 1;
        }
        return 0;
    }, (_job: JobCreep.Data, creep: Creep): void => {
        get_mem(creep, true);
    });
}

enum State {
    UNKNOWN,
    MOVING,
    DONE,
    FAILED
}

function log_progress(job: JobCreep.Data, creep: Creep, mem: StopBlockingMemory, msg: string): void {
    log("job.stopblocking", `[${creep.name}|${job.id}|${mem.state}]: ${msg}`);
}

function is_unblocked(x: number, y: number, roomName: string) {
    if (x < 0 || y < 0 || x >= ROOM_SIZE || y >= ROOM_SIZE) {
        return false;
    }
    return Game.map.getTerrainAt(x, y, roomName) !== "wall";
}

function get_free_space(from: RoomPosition): RoomPosition | null {
    const dist_scale = 2;
    const room = Game.rooms[from.roomName];
    // Boxsearch
    for (let dist = 2; dist < 20; ++dist) {
        const dists = dist * dist_scale;
        for (let i = -dist; i < dist; ++i) {
            const ii = i * dist_scale;
            const iix = ii + from.x;
            const iiy = ii + from.y;
            // Top side
            if (is_unblocked(iix, -dists + from.y, from.roomName)) {
                return room.getPositionAt(iix, -dists + from.y);
            }
            // Bottom side
            if (is_unblocked(iix, dists + from.y, from.roomName)) {
                return room.getPositionAt(iix, dists + from.y);
            }
            // Left side
            if (is_unblocked(dists + from.x, iiy, from.roomName)) {
                return room.getPositionAt(dists + from.x, iiy);
            }
            // Right side
            if (is_unblocked(-dists + from.x, iiy, from.roomName)) {
                return room.getPositionAt(-dists + from.x, iiy);
            }
        }
    }
    return null;
}

function update_internal(job: JobCreep.Data, creep: Creep): void {
    const mem = get_mem(creep);
    switch (mem.state) {
        case State.UNKNOWN: {
            const free_space = get_free_space(Job.get_pos(job) as RoomPosition) as RoomPosition;
            if (!free_space) {
                log("job.stopblocking", "Couldn't find free space to move to!", Settings.LogLevel.WARNING);
                creep.say("🔺no space");
            } else {
                mem.target_x = free_space.x;
                mem.target_y = free_space.y;
                mem.state = State.MOVING;
                log_progress(job, creep, mem, "Found target");
                creep.say("⌦");
            }
            break;
        }
        case State.MOVING: {
            const room = Game.rooms[job.room];
            const target_pos = room.getPositionAt(mem.target_x, mem.target_y) as RoomPosition;
            if (!creep.pos.inRangeTo(target_pos, 1)) {
                const move_result = creep.moveTo(target_pos, { visualizePathStyle: Settings.get().path_styles.stopblocking as any });
                if (move_result !== OK && move_result !== ERR_TIRED) {
                    mem.state = State.FAILED;
                }
            } else {
                mem.state = State.DONE;
            }
            break;
        }
        case State.DONE: {
            creep.say("💤");
            job.active = false;
            break;
        }
        case State.FAILED: {
            creep.say("🔺failed");
            job.active = false;
            break;
        }
    }
}

function clean_up(creep: Creep): void {
    // ************************* FILL IN HERE ******************************
    // Cleanup after job, this is called when job.active becomes false,
    // e.g. if set manually in update_internal, or in kill
    const mem = get_mem(creep);
    delete mem.state;
    delete mem.target_x;
    delete mem.target_y;
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
    // if (Game.time % 10) {
    //     _.forOwn(Game.creeps, (creep: Creep) => {
    //         const mem = get_mem(creep);
    //         // IF it is one of our creeps and has a job assigned
    //         if (mem.role === xxxx && mem.job !== undefined) {
    //             // If we can't find the assigned job
    //             if (!_.find(_active_jobs, (job: Job.Data) =>
    //                     job.type === JOB_NAME && (job as JobCreep.Data).assigned_creep === creep.name)) {
    //                 log("job.harvest", `Cleaning disconnected job ${mem.job} for creep ${creep.name}`);
    //                 mem.job = undefined;
    //                 clean_up(creep);
    //             }
    //         }
    //     });
    // }
    // ************************* FILL IN HERE ******************************
    // Generate jobs
    const new_jobs: Job.Data[] = [];
    const unblock = (objs: RoomObject[]) => {
        _.forEach(objs, (obj: RoomObject) => {
            const blockers = get_blocking_creeps(obj.pos);
            _.forEach(blockers, (blocker: Creep) => {
                new_jobs.push(Job.construct_from_pos(JOB_NAME, FACTORY_NAME, blocker.pos));
            });
        });
    };
    _.forOwn(Game.rooms, (room: Room) => {
        // unblock spawns
        unblock(room.find(FIND_MY_SPAWNS));
        // unblock sources
        unblock(room.find(FIND_SOURCES));
        // const things = get_blocked_things(creep);
        // return things.length > 0 ? 1 : 0;
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update, kill } as JobFactory;
}
