
/**
 * Specification for a body
 */
import * as BodyPartSpec from "jobs/body.part.spec";
import * as utils from "utils";

export interface Data {
    // Part specs.
    parts: BodyPartSpec.Data[];
    min_cost_cache: number;
}

/**
 * Evaluate total energy cost for the body
 * @param body - body to evaluate
 */
export function construct(parts: BodyPartSpec.Data[]) {
    return {
        min_cost_cache: -1,
        parts
    } as Data;
}

export function calculate_body_cost(body: string[]): number {
    return body.reduce((sum: number, part: string) => sum + BODYPART_COST[part], 0);
}

    // Min possible cost for this body specification.
export function min_cost(this_: Data): number {
    if (this_.min_cost_cache < 0) {
        this_.min_cost_cache = _.reduce(this_.parts,
            (sum: number, p: BodyPartSpec.Data) => sum + BODYPART_COST[p.part] * p.min, 0);
    }
    return this_.min_cost_cache;
}

    /**
     * Attempt to generate a body based on the spec.
     * Returns null if the body can't be made within the energy constraint.
     * @param energy - energy available. If body can't be made within this_ constraint, null is returned.
     */
export function generate(this_: Data, energy: number): string[] | null {
    // Determine total energy to make body at initital ratios
    const energy_total = _.reduce(this_.parts,
        (sum: number, p: BodyPartSpec.Data) => sum + BODYPART_COST[p.part] * p.ratio, 0);
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
        _.forEach(this_.parts, (p) => {
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

        _.forEach(this_.parts, (p) => {
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
