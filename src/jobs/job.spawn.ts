import * as BodySpec from "jobs/body.spec";
import * as Job from "jobs/job";
import * as _ from "lodash";
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

export function construct(type: string, factory: string, room: string, x: number, y: number, priority: number,
                          flags: Flags, body_spec: BodySpec.Data, role: string): Data {
    const base = Job.construct(type, factory, room, x, y, priority) as Data;
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

export function assign(this_: Data, rate: (job: Data, spawn: Spawn) => number = default_rate ): boolean {
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
            const result = best_spawn.createCreep(body, this_.creep_name);
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

export function update(this_: Data): void {
    switch (this_.state) {
        // Spawning in progress. Can transition to MovingToPositon or Failed.
        case SpawnerJobState.Spawning: {
            const spawner = Game.spawns[this_.assigned_spawner];
            // If something happened to the spawner then we failed this_ job
            if (!spawner) {
                this_.state = SpawnerJobState.Failed;
                // If spawner is not spawning, or is spawning something else then we should have finished.
            } else if (!spawner.spawning || spawner.spawning.name !== this_.creep_name) {
                // If the actual creep doesn't exist then we failed, not sure how this_ could happen
                if (!Game.creeps[this_.creep_name as string]) {
                    this_.state = SpawnerJobState.Failed;
                } else {
                    // Initialize the creeps memory
                    const new_creep = Game.creeps[this_.creep_name as string];
                    const creep_mem = CreepMemory.get(new_creep);
                    creep_mem.role = this_.role;
                    // Set the creeps home room
                    const this_pos = Job.get_pos(this_) as RoomPosition;
                    if (this_pos) {
                        creep_mem.home_room = this_pos.roomName;
                    } else {
                        creep_mem.home_room = spawner.room.name;
                    }
                    // Change to next state
                    if (this_.flags & Flags.MoveToPosition) {
                        this_.state = SpawnerJobState.MovingToPosition;
                    } else {
                        this_.state = SpawnerJobState.Done;
                    }
                }
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
                        { visualizePathStyle: Settings.get().spawner.path_style as any });
                    // If we failed to move for some reason other than being le tired.
                    if (move_result !== OK && move_result !== ERR_TIRED) {
                        this_.state = SpawnerJobState.Failed;
                    }
                }
            } else {
                // Dunno what is going on, we failed.
                this_.state = SpawnerJobState.Failed;
            }
            break;
        }
        case SpawnerJobState.Done: {
            this_.active = false;
            break;
        }
        case SpawnerJobState.Failed: {
            this_.active = false;
            break;
        }
    }
}
