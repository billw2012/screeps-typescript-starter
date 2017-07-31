// import * as BodyPartSpec from "jobs/body.part.spec";
// import * as BodySpec from "jobs/body.spec";
// import { JobFactory } from "jobs/factory";
// import * as Job from "jobs/job";
// import * as CreepJob from "jobs/job.creep";
// import * as SpawnJob from "jobs/job.spawn";
// import { job_manager } from "jobs/manager";
// import { log } from "log";
// import * as CreepMemory from "memory/creep";
// import * as RoomMemory from "memory/room";
// import { settings } from "settings";

// const harvester_body_spec: BodySpec.Data = BodySpec.construct([
//     BodyPartSpec.construct(MOVE, 1, 1, 20),
//     BodyPartSpec.construct(WORK, 2, 1, 40),
//     BodyPartSpec.construct(CARRY, 1, 1, 20)
// ]);

// // class SpawnHarvesterJob extends SpawnJob {
// //     public generate_body(available_energy: number): string[] {
// //         // TODO: make it better
// //         if (available_energy < BODYPART_COST[])
// //             return [WORK, MOVE, CARRY];
// //     }

// //     public init_memory(): any {
// //         //
// //     }
// // };

// // class HarvestJob extends CreepJob {
// //     protected update_creep(creep: Creep): void {
// //         throw new Error("Method not implemented.");
// //     }
// //     protected rate(creep: Creep): number {
// //         throw new Error("Method not implemented.");
// //     }
// // }

// function need_more_harvesters(room: Room): boolean {
//     // Check we don't already have stalled harvesters
//     const stalled_harvesters = room.find(FIND_MY_CREEPS, {
//         filter: (c: Creep) => CreepMemory.get(c).role === "harvester" && CreepMemory.get(c).stalled
//     }).length;
//     if (stalled_harvesters) {
//         log("spawn", `room ${room.name} has ${stalled_harvesters} stalled harvesters, aborting spawning`);
//         return false;
//     }
//     const sources: Source[] = room.find(FIND_SOURCES);
//     const room_energy_cap = sources.reduce((sum: number, source: Source) => sum + source.energyCapacity, 0);
//     const energy_per_tick = room_energy_cap / ENERGY_REGEN_TIME;
//     const room_rate = RoomMemory.get_stats(room).harvest_rate;
//     const desired_rate = energy_per_tick * settings.spawner.harvester_scale;
//     log("spawn", "room " + room.name
//         + ": room_energy_cap = " + room_energy_cap
//         + ", energy_per_tick = " + energy_per_tick
//         + ", room_rate = " + room_rate
//         + ", desired_rate = " + desired_rate
//     );
//     return room_rate < desired_rate;
// }

// export const HAVEST_FACTORY: string = "harvest_factor";
// export const SPAWN_HAVESTER: string = "spawn_harvest";
// export const HAVEST_SOURCE: string = "harvest_source";

// function should_harvest_room(room: Room): boolean {
//     // TODO: later we will have flags or metadata to specify external rooms for harvesting
//     return (room.controller as Controller).my;
// }

// function get_assigned_harvesters(source: Source) {
//     return source.room.find(FIND_MY_CREEPS,
//         { filter: (creep: Creep) => creep.memory.target === source.id });
// }

// function required_harvest_jobs(room: Room): number {
//     let count = 0;
//     const room_md = RoomMemory.get_metadata(room);
//     for (const s in room_md.source_spaces) {
//         const source = Game.getObjectById(s) as Source;
//         // Early out on actually having energy to get
//         if (source.energy > 50) {
//             const spaces = room_md.source_spaces[source.id] as number;
//             const assigned_count = get_assigned_harvesters(source).length;
//             if (assigned_count < spaces + 1) {
//                 count++;
//             }
//         }
//     }
//     return count;
// }

// class HarvestFactory implements JobFactory {
//     public assign(job: Job.Data): void {
//         throw new Error("Method not implemented.");
//     }

//     public update(job: Job.Data): void {
//         throw new Error("Method not implemented.");
//     }

//     public generate_new_jobs(active_jobs: Job.Data[]): Job.Data[] {
//         const new_jobs: Job.Data[] = [];
//         // Create jobs for rooms
//         _.forOwn(Game.rooms, (room: Room) => {
//             if (should_harvest_room(room)) {
//                 // Account for already active spawn tasks
//                 const active_jobs_in_room = _.filter(active_jobs,
//                     (job: Job.Data) => job.room === room.name && job.type === SPAWN_HAVESTER).length;
//                 // For now we will only spawn one at a time.
//                 if (active_jobs_in_room === 0 && need_more_harvesters(room)) {
//                     const new_job = SpawnJob.construct(
//                         SPAWN_HAVESTER,
//                         HAVEST_FACTORY,
//                         room.getPositionAt(0, 0) as RoomPosition,
//                         settings.jobs.priorities.get(SPAWN_HAVESTER) as number,
//                         SpawnJob.Flags.None,
//                         harvester_body_spec,
//                         "harvester");
//                     new_jobs.push(new_job);
//                 }
//                 const harvest_job_count = required_harvest_jobs(room);
//                 for (let i = 0; i < harvest_job_count; ++i) {
//                     const new_job = HarvestJob.construct(
//                         SPAWN_HAVESTER,
//                         HAVEST_FACTORY,
//                         room.getPositionAt(0, 0) as RoomPosition,
//                         settings.jobs.priorities.get(SPAWN_HAVESTER) as number,
//                         SpawnJob.Flags.None,
//                         harvester_body_spec,
//                         "harvester");
//                     new_jobs.push(new_job);
//                 }
//             }
//         });
//         return new_jobs;
//     }
// }

// job_manager.register_factory(HAVEST_FACTORY, new HarvestFactory());
