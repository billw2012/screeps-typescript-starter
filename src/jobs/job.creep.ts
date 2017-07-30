import * as Job from "jobs/job";
import * as _ from "lodash";
import * as CreepMemory from "memory/creep";

export interface Data extends Job.Data {
    assigned_creep: string;
}

export function assign(this_: Data, rate: (job: Data, creep: Creep) => number): boolean {
    let best: { rating: number, creep?: Creep } = { rating: 0, creep: undefined };
    // Find the best creep by rating.
    _.forOwn(Game.creeps, (creep: Creep, _name: string) => {
        // Check creep doesn't have a job already
        if (creep.my && !CreepMemory.get(creep).job) {
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
        // Assign the creep to this job
        this_.assigned_creep = (best.creep as Creep).name;
        CreepMemory.get(best.creep as Creep).job = this_.id;
        // Set job as active
        this_.active = true;
        return true;
    } else {
        return false;
    }
}

export function update(this_: Data) {
    // Check for creep being alive
    const creep = Game.creeps[this_.assigned_creep];
    if (!creep || creep.ticksToLive === 0) {
        // Dead creep means deactive the job
        this_.active = false;
        if (creep) {
            CreepMemory.get(creep).job = undefined;
        }
        this_.assigned_creep = "";
    }
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
