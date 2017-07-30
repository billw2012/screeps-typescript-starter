export class CreepMemory {
    public static get(creep: Creep): CreepMemory {
        if (!creep.memory.data) {
            creep.memory.data = new CreepMemory();
        }
        return creep.memory.data as CreepMemory;
    }

    public job?: string;
    public role?: string;
    public stalled: boolean = false;
    public harvest_rate: number = 0;
    public home_room: string;
}
