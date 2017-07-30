import { Job } from "jobs/job";
import * as _ from "lodash";
import { CreepMemory } from "memory/creep";
import { settings } from "settings";
import * as utils from "utils";

export enum SpawnerJobState {
    Spawning,
    MovingToPosition,
    Done,
    Failed
}

/**
 * Requirements for a body part type
 */
export class BodyPartSpec {
    // Part name
    public part: string;
    // Ratio of this part relative to baseline.
    public ratio: number;
    // Min number of this part allowed.
    public min: number = 0;
    // Max number of this part allowed
    public max: number = 50;

    constructor(part: string, ratio: number = 1, min: number = 0, max: number = 50) {
        this.part = part;
        this.ratio = ratio;
        this.min = min;
        this.max = max;
    }
}

/**
 * Specification for a body
 */
export class BodySpec {
    /**
     * Evaluate total energy cost for the body
     * @param body - body to evaluate
     */
    public static calculate_body_cost(body: string[]): number {
        return body.reduce((sum: number, part: string) => sum + BODYPART_COST[part], 0);
    }

    // Part specs.
    public parts: BodyPartSpec[];

    private min_cost_cache: number = -1;
    // Min possible cost for this body specification.
    public get min_cost(): number {
        if (this.min_cost_cache < 0) {
            this.min_cost_cache = _.reduce(this.parts,
                (sum: number, p: BodyPartSpec) => sum + BODYPART_COST[p.part] * p.min, 0);
        }
        return this.min_cost_cache;
    }

    constructor(parts: BodyPartSpec[]) {
        this.parts = parts;
    }

    /**
     * Attempt to generate a body based on the spec.
     * Returns null if the body can't be made within the energy constraint.
     * @param energy - energy available. If body can't be made within this constraint, null is returned.
     */
    public generate(energy: number): string[] | null {
        // Determine total energy to make body at initital ratios
        const energy_total = _.reduce(this.parts,
            (sum: number, p: BodyPartSpec) => sum + BODYPART_COST[p.part] * p.ratio, 0);
        // How much can we scale up the initial ratios by and stay within the energy limit?
        const energy_scalar = energy / energy_total;

        // First narrow down what scalar keeps us below energy and max part count budget
        let curr_scalar = energy_scalar;
        let iteration = 0;
        let found_a_good_scalar = false;
        do {
            ++iteration;
            let curr_parts = 0;
            let curr_energy = 0;
            _.forEach(this.parts, (p) => {
                // How many parts should we be making here?
                const new_part_count = utils.clamp(Math.floor(p.ratio * curr_scalar), p.min, p.max);
                // Keep track of energy cost
                curr_energy += BODYPART_COST[p.part] * new_part_count;
                curr_parts += new_part_count;
            });
            // Ratio of currently added parts to max allowed parts.
            // If this is > 1 then we need to reduce the number of parts, which we do by scaling down
            // the ratio scalar by the ratio of parts/allowed parts.
            const parts_ratio = curr_parts / 50;
            // Ratio of currently required energy to max allowed energy.
            // If this is > 1 then we need to reduce the number of parts, which we do by scaling down
            // the ratio scalar by the ratio of energy/allowed energy.
            const energy_ratio = curr_energy / energy;
            // Choose the "worst" ratio so we can scale down by it.
            const max_ratio = Math.max(parts_ratio, energy_ratio);
            if (max_ratio > 1) {
                curr_scalar = curr_scalar / max_ratio;
            } else {
                found_a_good_scalar = true;
                break;
            }
        } while (iteration < 5);

        if (found_a_good_scalar) {
            const body: string[] = [];

            _.forEach(this.parts, (p) => {
                // How many parts should we be making here?
                const new_part_count = utils.clamp(Math.floor(p.ratio * curr_scalar), p.min, p.max);
                // Append the parts
                for (let i = 0; i < new_part_count; ++i) {
                    body.push(p.part);
                }
            });
            return body;
        }
        return null;
    }
}

/**
 * Base of all creep spawn tasks.
 * Searches for best spawner based on:
 * - Distance to spawner.
 * - Energy of spawner above minimum required.
 */

export enum SpawnFlags {
    None = 0,
    MoveToPosition = 1 << 1,
    AllowOutOfRoomSpawner = 1 << 2
}

export class SpawnJob extends Job {
    // Spawner assigned to this job.
    public assigned_spawner: string;
    // Creep name, if undefined it is set to the automatic name by the spawner.
    public creep_name?: string;

    // Allow spawners outside the room of the Job.pos to be used.
    protected flags: SpawnFlags;
    protected body_spec: BodySpec;
    protected role: string;

    protected state: SpawnerJobState = SpawnerJobState.Spawning;

    constructor(type: string, pos: RoomPosition, priority: number,
                flags: SpawnFlags,
                body_spec: BodySpec,
                role: string) {
        super(type, pos, priority);
        this.flags = flags;
        this.body_spec = body_spec;
        this.role = role;
    }

    public assign(): boolean {
        let best: { rating: number, spawn?: Spawn } = { rating: 0, spawn: undefined };
        _.forOwn(Game.spawns, (spawn: Spawn) => {
            if (spawn.my && !spawn.spawning) {
                const rating = this.rate(spawn);
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
            // Assign the creep to this job
            const best_spawn = (best.spawn as Spawn);
            const body = this.body_spec.generate(best_spawn.room.energyAvailable);
            // Its possible to fail to make the body
            if (body) {
                const result = best_spawn.createCreep(body, this.creep_name);
                if (result as string) {
                    this.assigned_spawner = best_spawn.name;
                    this.creep_name = result as string;
                    // Set job as active
                    this.active = true;
                    return true;
                }
            }
        }
        return false;
    }

    public update(): void {
        switch (this.state) {
            // Spawning in progress. Can transition to MovingToPositon or Failed.
            case SpawnerJobState.Spawning: {
                const spawner = Game.spawns[this.assigned_spawner];
                // If something happened to the spawner then we failed this job
                if (!spawner) {
                    this.state = SpawnerJobState.Failed;
                    // If spawner is not spawning, or is spawning something else then we should have finished.
                } else if (!spawner.spawning || spawner.spawning.name !== this.creep_name) {
                    // If the actual creep doesn't exist then we failed, not sure how this could happen
                    if (!Game.creeps[this.creep_name as string]) {
                        this.state = SpawnerJobState.Failed;
                    } else {
                        // Initialize the creeps memory
                        const new_creep = Game.creeps[this.creep_name as string];
                        const creep_mem = CreepMemory.get(new_creep);
                        creep_mem.role = this.role;
                        // Set the creeps home room
                        if (this.pos) {
                            creep_mem.home_room = (this.pos as RoomPosition).roomName;
                        } else {
                            creep_mem.home_room = spawner.room.name;
                        }
                        // Change to next state
                        if (this.flags & SpawnFlags.MoveToPosition) {
                            this.state = SpawnerJobState.MovingToPosition;
                        } else {
                            this.state = SpawnerJobState.Done;
                        }
                    }
                }
                break;
            }
            // Moving the newly created creep within range of Job.pos. Can transition to Failed or Done.
            case SpawnerJobState.MovingToPosition: {
                const creep = Game.creeps[this.creep_name as string];
                const target_pos = this.pos as RoomPosition;
                if (creep && target_pos) {
                    // If we are in the correct room and within a reasonable distance of
                    // the target then call it a job well done.
                    if (creep.room.name === target_pos.roomName
                        && creep.pos.inRangeTo(target_pos, settings.spawner.move_to_position_range)) {
                        this.state = SpawnerJobState.Done;
                    } else {
                        // Try a move
                        const move_result = creep.moveTo(target_pos,
                            { visualizePathStyle: settings.spawner.path_style });
                        // If we failed to move for some reason other than being le tired.
                        if (move_result !== OK && move_result !== ERR_TIRED) {
                            this.state = SpawnerJobState.Failed;
                        }
                    }
                } else {
                    // Dunno what is going on, we failed.
                    this.state = SpawnerJobState.Failed;
                }
                break;
            }
            case SpawnerJobState.Done: {
                this.active = false;
                break;
            }
            case SpawnerJobState.Failed: {
                this.active = false;
                break;
            }
        }
    }

    protected rate(spawn: Spawn): number {
        // Check how much more energy we have than is required
        const energy_diff = spawn.energy - this.body_spec.min_cost;
        // If we don't have the minimum then return failure
        if (energy_diff <= 0) {
            return 0;
        }
        // Check distance to the job request
        const position = this.pos as RoomPosition;
        let dist = 0;
        // If in a different room then use room distance calcs
        if (position && position.roomName !== spawn.room.name) {
            if (!(this.flags & SpawnFlags.AllowOutOfRoomSpawner)) {
                return 0;
            }
            dist = Game.map.getRoomLinearDistance(position.roomName, spawn.room.name) *
                settings.spawner.room_distance_cost_multipler;
        } else { // Use pathing inside a single room
            dist = position.findPathTo(spawn.pos).length;
        }
        // Made up equation to balance cost and distance. Use
        return 1 / (dist * settings.spawner.distance_cost_multiplier) + energy_diff;
    }
}
