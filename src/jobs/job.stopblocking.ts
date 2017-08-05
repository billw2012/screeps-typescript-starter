import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobCreep from "jobs/job.creep";
import { log, Settings } from "log";
import * as CreepMemory from "memory/creep";
import * as RoomMemory from "memory/room";
import * as Utils from "utils";

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

function get_blocking_creeps(pos: RoomPosition): Creep[] {
    const room = Game.rooms[pos.roomName] as Room;
    return _.map(room.lookForAtArea(LOOK_CREEPS, pos.y - 1, pos.x - 1,
        pos.y + 1, pos.x + 1, true) as LookAtResultWithPos[], (l: LookAtResultWithPos) => l.creep as Creep);
}

// Factory assign function
function assign(job: Job.Data): boolean {
    return JobCreep.assign(job as JobCreep.Data, (_job: JobCreep.Data, creep: Creep): number => {
        const blocked_pos = Job.get_pos(job) as RoomPosition;
        if (Utils.same_pos(blocked_pos, creep.pos)) {
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

function update_internal(job: JobCreep.Data, creep: Creep): void {
    const mem = get_mem(creep);
    switch (mem.state) {
        case State.UNKNOWN: {
            const room = Game.rooms[job.room];
            const rally_points = RoomMemory.get_rally_points(room);
            // const free_space = Utils.box_search(Job.get_pos(job) as RoomPosition, Utils.no_wall) as RoomPosition;
            if (rally_points.length === 0) {
                log("job.stopblocking", "Couldn't find rally point to move to!", Settings.LogLevel.WARNING);
                creep.say("🔺no space");
            } else {
                const rnd_ptr = Math.round(Math.random() * (rally_points.length - 1));
                mem.target_x = rally_points[rnd_ptr].x;
                mem.target_y = rally_points[rnd_ptr].y;
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
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update, kill } as JobFactory;
}
