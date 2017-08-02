
import { log } from "log";

export interface Data {
    job?: string;
    role?: string;
    stalled: boolean;
    harvest_rate: number;
    home_room: string;
    target?: string;
}

export function construct(home_room: string = "not set", job?: string, role?: string): Data {
    return {
        harvest_rate: 0,
        home_room,
        job,
        role,
        stalled: false,
        target: undefined
    } as Data;
}

export function get(creep: Creep): Data {
    if (!creep.memory.data) {
        log("creep", `Initializing memory of creep ${creep.name} for the first time`);
        creep.memory.data = construct();
    }
    return creep.memory.data as Data;
}
