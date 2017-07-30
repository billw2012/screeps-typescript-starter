export interface Data {
    job?: string;
    role?: string;
    stalled: boolean;
    harvest_rate: number;
    home_room: string;
}

export function construct(): Data {
    return {
        harvest_rate: 0,
        home_room: "",
        job: undefined,
        role: undefined,
        stalled: false
    } as Data;
}

export function get(creep: Creep): Data {
    if (!creep.memory.data) {
        creep.memory.data = construct();
    }
    return creep.memory.data as Data;
}
