import { JobFactory } from "jobs/factory";
import { CreepJob, Job } from "jobs/job.creep";
import { BodyPartSpec, BodySpec, SpawnFlags, SpawnJob } from "jobs/job.spawn";
import { log } from "log";
import { CreepMemory } from "memory/creep";
import { RoomStats } from "memory/room";
import { settings } from "settings";

const harvester_body_spec: BodySpec = new BodySpec([
    new BodyPartSpec(MOVE, 1, 1, 20),
    new BodyPartSpec(WORK, 2, 1, 40),
    new BodyPartSpec(CARRY, 1, 1, 20)
]);
// class SpawnHarvesterJob extends SpawnJob {
//     public generate_body(available_energy: number): string[] {
//         // TODO: make it better
//         if (available_energy < BODYPART_COST[])
//             return [WORK, MOVE, CARRY];
//     }

//     public init_memory(): any {
//         //
//     }
// };

class HarvestJob extends CreepJob {
    protected update_creep(creep: Creep): void {
        throw new Error("Method not implemented.");
    }
    protected rate(creep: Creep): number {
        throw new Error("Method not implemented.");
    }

}

function need_more_harvesters(room: Room): boolean {
    // Check we don't already have stalled harvesters
    const stalled_harvesters = room.find(FIND_MY_CREEPS, {
            filter: (c: Creep) => CreepMemory.get(c).role === "harvester" && CreepMemory.get(c).stalled
        }).length;
    if (stalled_harvesters) {
        log("spawn", `room ${room.name} has ${stalled_harvesters} stalled harvesters, aborting spawning`);
        return false;
    }
    const sources: Source[] = room.find(FIND_SOURCES);
    const room_energy_cap = sources.reduce((sum: number, source: Source) => sum + source.energyCapacity, 0);
    const energy_per_tick = room_energy_cap / ENERGY_REGEN_TIME;
    const room_rate = RoomStats.get(room).harvest_rate;
    const desired_rate = energy_per_tick * settings.spawner.harvester_scale;
    log("spawn", "room " + room.name
        + ": room_energy_cap = " + room_energy_cap
        + ", energy_per_tick = " + energy_per_tick
        + ", room_rate = " + room_rate
        + ", desired_rate = " + desired_rate
    );
    return room_rate < desired_rate;
}

class HarvestFactory implements JobFactory {
    public generate_new_jobs(active_jobs: Job[]): Job[] {
        const new_jobs: Job[] = [];
        _.forOwn(Game.rooms, (room: Room) => {
            if (need_more_harvesters(room)) {
                const new_job = new SpawnJob(
                    "spawn_harvester",
                    room.getPositionAt(0, 0).pos,
                    settings.jobs.priorities.harvest,
                    SpawnFlags.None,
                    harvester_body_spec,
                    "harvester");
                new_jobs.push(new_job);
            }
        });
        return new_jobs;
    }
}
