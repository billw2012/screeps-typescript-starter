
/**
 * Requirements for a body part type
 */
export interface Data {
    // Part name
    part: string;
    // Ratio of this part relative to baseline.
    ratio: number;
    // Min number of this part allowed.
    min: number;
    // Max number of this part allowed
    max: number;
}

export function construct(part: string, ratio: number = 1, min: number = 0, max: number = 50): Data {
    return {
        max,
        min,
        part,
        ratio
    } as Data;
}
