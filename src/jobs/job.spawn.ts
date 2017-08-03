import * as BodySpec from "jobs/body.spec";
import * as Job from "jobs/job";
import * as _ from "lodash";
import { log } from "log";
import * as CreepMemory from "memory/creep";
import * as Settings from "settings";
// import * as utils from "utils";

export enum SpawnerJobState {
    Spawning,
    MovingToPosition,
    Done,
    Failed
}

/**
 * Base of all creep spawn tasks.
 * Searches for best spawner based on:
 * - Distance to spawner.
 * - Energy of spawner above minimum required.
 */

export enum Flags {
    None = 0,
    MoveToPosition = 1 << 1,
    AllowOutOfRoomSpawner = 1 << 2
}

export interface Data extends Job.Data {
    // Spawner assigned to this_ job.
    assigned_spawner: string;

    // Creep name, if undefined it is set to the automatic name by the spawner.
    creep_name?: string;

    // Allow spawners outside the room of the Job.pos to be used.
    flags: Flags;
    body_spec: BodySpec.Data;
    role: string;

    state: SpawnerJobState;
}

export function construct(type: string, factory: string, room: string, x: number, y: number, flags: Flags,
                          body_spec: BodySpec.Data, role: string, priority?: number, ttl?: number): Data {
    const base = Job.construct(type, factory, room, x, y, priority, ttl) as Data;
    base.assigned_spawner = "";
    base.creep_name = undefined;
    base.flags = flags;
    base.body_spec = body_spec;
    base.role = role;
    base.state = SpawnerJobState.Spawning;
    return base;
}

function default_rate(this_: Data, spawn: Spawn): number {
    // Check how much more energy we have than is required
    const energy_diff = spawn.energy - BodySpec.get_min_cost(this_.body_spec);
    // If we don't have the minimum then return failure
    if (energy_diff <= 0) {
        return 0;
    }
    // Check distance to the job request
    const position = Job.get_pos(this_) as RoomPosition;
    let dist = 0;
    // If in a different room then use room distance calcs
    if (position && position.roomName !== spawn.room.name) {
        if (!(this_.flags & Flags.AllowOutOfRoomSpawner)) {
            return 0;
        }
        dist = Game.map.getRoomLinearDistance(position.roomName, spawn.room.name) *
            Settings.get().spawner.room_distance_cost_multipler;
    } else if (position) { // Use pathing inside a single room
        dist = position.findPathTo(spawn.pos).length;
    }
    // Made up equation to balance cost and distance. Use
    return 1 / (dist * Settings.get().spawner.distance_cost_multiplier) + energy_diff;
}

export function assign(this_: Data, rate: (job: Data, spawn: Spawn) => number = default_rate): boolean {
    // Check how many already spawned for this role for this room
    const role_in_room = _.sum(Game.creeps, (creep: Creep) => {
        const mem = CreepMemory.get(creep);
        return (mem.home_room === this_.room && mem.role === this_.role) ? 1 : 0;
    });
    // Clamp against the limit in settings
    if (role_in_room > Settings.get().spawner.per_room_limits[this_.role]) {
        return false;
    }

    let best: { rating: number, spawn?: Spawn } = { rating: 0, spawn: undefined };
    _.forOwn(Game.spawns, (spawn: Spawn) => {
        if (spawn.my && !spawn.spawning) {
            const rating = rate(this_, spawn);
            // Rating of -1 means immediately choose this creep and abort further search
            if (rating === -1) {
                best = { rating: 1, spawn };
                return false;
            } else if (rating > best.rating) {
                best = { rating, spawn };
            }
        }
    });
    if (best.rating > 0) {
        // Assign the creep to this_ job
        const best_spawn = (best.spawn as Spawn);
        const body = BodySpec.generate(this_.body_spec, best_spawn.room.energyAvailable);
        // Its possible to fail to make the body
        if (body) {
            const this_pos = Job.get_pos(this_) as RoomPosition;
            const result = best_spawn.createCreep(body, this_.creep_name, {
                data: CreepMemory.construct(this_pos ? this_pos.roomName : best_spawn.room.name, this_.id, this_.role)
            });
            if (result as string) {
                this_.assigned_spawner = best_spawn.name;
                this_.creep_name = result as string;
                // Set job as active
                this_.active = true;
                return true;
            }
        }
    }
    return false;
}

function draw_spawn_message(this_: Data, spawner: Spawn): void {
    const percent_complete = (1 - spawner.spawning.remainingTime / spawner.spawning.needTime) * 100;
    spawner.room.visual.text(`🛠️ ${this_.role} ${percent_complete.toFixed(0)}%`,
        spawner.pos.x + 1, spawner.pos.y, { align: "left", opacity: 0.8 });
}

export function update(this_: Data): void {
    switch (this_.state) {
        // Spawning in progress. Can transition to MovingToPositon or Failed.
        case SpawnerJobState.Spawning: {
            const spawner = Game.spawns[this_.assigned_spawner];
            // If something happened to the spawner then we failed this_ job
            if (!spawner) {
                log("job.spawn", `Failed to spawn ${this_.creep_name}: spawner doesn't exist`, Settings.LogLevel.WARNING);
                this_.state = SpawnerJobState.Failed;
                // If spawner is not spawning, or is spawning something else then we should have finished.
            } else if (!spawner.spawning || spawner.spawning.name !== this_.creep_name) {
                // If the actual creep doesn't exist then we failed, not sure how this could happen
                if (!Game.creeps[this_.creep_name as string]) {
                    log("job.spawn", `Failed to spawn ${this_.creep_name}`, Settings.LogLevel.ERROR);
                    this_.state = SpawnerJobState.Failed;
                } else {
                    // Initialize the creeps memory
                    const creep = Game.creeps[this_.creep_name as string];
                    // Change to next state
                    if (this_.flags & Flags.MoveToPosition) {
                        this_.state = SpawnerJobState.MovingToPosition;
                        creep.say(`⏫ ${creep.name} (${this_.role}) moving to position`);
                    } else {
                        this_.state = SpawnerJobState.Done;

                    }
                }
            } else {
                draw_spawn_message(this_, spawner);
            }
            break;
        }
        // Moving the newly created creep within range of Job.pos. Can transition to Failed or Done.
        case SpawnerJobState.MovingToPosition: {
            const creep = Game.creeps[this_.creep_name as string];
            const target_pos = Job.get_pos(this_) as RoomPosition;
            if (creep && target_pos) {
                // If we are in the correct room and within a reasonable distance of
                // the target then call it a job well done.
                if (creep.room.name === target_pos.roomName
                    && creep.pos.inRangeTo(target_pos, Settings.get().spawner.move_to_position_range)) {
                    this_.state = SpawnerJobState.Done;
                } else {
                    // Try a move
                    const move_result = creep.moveTo(target_pos,
                        { visualizePathStyle: Settings.get().path_styles.spawned as any });
                    // If we failed to move for some reason other than being le tired.
                    if (move_result !== OK && move_result !== ERR_TIRED) {
                        log("job.spawn", `${creep.name} failed to move to target position ${JSON.stringify(target_pos)}`, Settings.LogLevel.WARNING);
                        this_.state = SpawnerJobState.Failed;
                        creep.say(`🔺 ${creep.name} failed to move to position`);
                    }
                }
            } else {
                // Dunno what is going on, we failed.
                log("job.spawn", `${creep.name} failed to move to target position: unknown error, creep and/or target_pos are invalid`, Settings.LogLevel.WARNING);
                this_.state = SpawnerJobState.Failed;
                creep.say(`🔺 ${creep.name} failed to move to position`);
            }
            break;
        }
        case SpawnerJobState.Done: {
            const creep = Game.creeps[this_.creep_name as string];
            if (creep) {
                creep.say(`💤 ${creep.name} (${this_.role}) ready`);
                const creep_mem = CreepMemory.get(creep);
                delete creep_mem.job;
            }
            this_.active = false;
            break;
        }
        case SpawnerJobState.Failed: {
            const creep = Game.creeps[this_.creep_name as string];
            if (creep) {
                const creep_mem = CreepMemory.get(creep);
                delete creep_mem.job;
            }
            this_.active = false;
            break;
        }
    }
}

export function kill(this_: Data): boolean {
    // If the assigned_spawner or the creep name isn't set then we can immediately kill
    if (!this_.assigned_spawner || !this_.creep_name) {
        return true;
    }
    const spawn = Game.spawns[this_.assigned_spawner];
    // if the spawn isn't valid, or it isn't spawning the creep we expect then we can kill
    if (!spawn || !spawn.spawning || spawn.spawning.name !== this_.creep_name) {
        return true;
    }
    return false;
}
