import * as Job from "jobs/job";
import * as _ from "lodash";
import { log, Settings } from "log";
import * as CreepMemory from "memory/creep";

export interface Data extends Job.Data {
    assigned_creep: string;
}

export function construct(type: string, factory: string, room: string, x: number, y: number,
                          priority?: number, ttl?: number): Data {
    const base = Job.construct(type, factory, room, x, y, priority, ttl) as Data;
    return base;
}

export function construct_from_pos(type: string, factory: string, pos: RoomPosition,
                                   priority?: number, ttl?: number): Data {
    const base = Job.construct_from_pos(type, factory, pos, priority, ttl) as Data;
    return base;
}

export function assign(this_: Data, rate: (job: Data, creep: Creep) => number, assigned: (job: Data, creep: Creep) => void): boolean {
    let best: { rating: number, creep?: Creep } = { rating: -1, creep: undefined };
    // Find the best creep by rating.
    _.forOwn(Game.creeps, (creep: Creep, _name: string) => {
        // Check creep doesn't have a job already
        if (creep.my && !creep.spawning && !CreepMemory.get(creep).job) {
            const rating = rate(this_, creep);
            // Rating of -1 means immediately choose this creep and abort further search
            if (rating === -1) {
                best = { rating: 1, creep };
                return false;
            } else if (rating > best.rating) {
                best = { rating, creep };
            }
        }
    });

    if (best.rating > 0) {
        const best_creep = best.creep as Creep;
        const creep_mem = CreepMemory.get(best_creep);
        if (creep_mem.job) {
            throw Error(`Attempting to assign job ${this_} to creep ${best_creep.name} when it already has job ${creep_mem.job}`);
        }
        // Assign the creep to this job
        this_.assigned_creep = best_creep.name;
        creep_mem.job = this_.id;
        // Set job as active
        this_.active = true;
        assigned(this_, best_creep);

        log("job.creep", `Assigned job ${this_.id} to creep ${this_.assigned_creep}`);
        return true;
    } else {
        return false;
    }
}

export function update(this_: Data, custom_update: (job: Data, creep: Creep) => void, clean_up: (creep: Creep) => void): void {
    // Check for creep being alive
    const creep = Game.creeps[this_.assigned_creep];
    if (!creep || creep.ticksToLive === 0) {
        log("job.creep", `creep ${this_.assigned_creep} died, job ${this_.id} abandoned`, Settings.LogLevel.ERROR);
        // Dead creep means deactive the job
        this_.active = false;
        if (creep) {
            delete CreepMemory.get(creep).job;
        }
        delete this_.assigned_creep;
    } else {
        try {
            custom_update(this_, creep);
        } catch (err) {
            log("job.creep", `${err.message}: ${creep.name} on job ${this_.id}`, Settings.LogLevel.ERROR);
        }
        if (!this_.active) {
            delete this_.assigned_creep;
            delete CreepMemory.get(creep).job;
            clean_up(creep);
        }
    }
}

export function kill(this_: Data, clean_up: (creep: Creep) => void): boolean {
    // Check for creep being alive
    const creep = Game.creeps[this_.assigned_creep];
    if (creep) {
        creep.say(`🔺cancelled`);
        delete CreepMemory.get(creep).job;
        clean_up(creep);
    } else {
        log("job.creep", `Killing creep job ${this_.id} with no assigned creep, was meant to be ${this_.assigned_creep}`, Settings.LogLevel.ERROR);
    }
    delete this_.assigned_creep;
    return true;
}

// export abstract class CreepJob extends Job {
//     public update(): void {
//         // Check for creep being alive
//         const creep = Game.creeps[this_.assigned_creep];
//         if (!creep || creep.ticksToLive === 0) {
//             // Dead creep means deactive the job
//             this_.active = false;
//             if (creep) {
//                 CreepMemory.get(creep).job = undefined;
//             }
//             this_.assigned_creep = "";
//         } else {
//             this_.update_creep(creep);
//         }
//     }

//     /**
//      * Update job for creep.
//      * @param creep - Creep assigned to this_ job, guaraneteed to be alive and valid
//      */
//     protected abstract update_creep(creep: Creep): void;

//     /**
//      * Rate suitability of the creep for this_ job. Return negative to immediately assign
//      * this_ creep to the job, otherwise all creeps are checked and highed rating is used.
//      * @param creep - Creep to rate.
//      */
//     protected abstract rate(creep: Creep): number;
// }
