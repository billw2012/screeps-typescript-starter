import { JobFactory } from "jobs/factory";
import * as Job from "jobs/job";
import * as JobCreep from "jobs/job.creep";
import * as Harvester from "jobs/job.harvest";
import { ROLE_NAME } from "jobs/job.spawn.builder";
import { log } from "log";
import * as CreepMemory from "memory/creep";
import * as Settings from "settings";

export const FACTORY_NAME: string = "build_factory";
export const JOB_NAME: string = "build_job";
export { ROLE_NAME };

enum State {
    SELECT_SOURCE,
    GO_TO_SOURCE,
    HARVEST,
    SELECT_TARGET,
    BUILD_TARGET,
    DEPOSIT_TO_CONTROLLER,
    DEPOSIT_ANYWHERE
}

const state_update = {
    [State.SELECT_SOURCE]: (job: Job.Data, creep: Creep, mem: BuilderMemory) =>
        Harvester.search_for_source(job, creep, mem, () => job.active = false, () => mem.state = State.GO_TO_SOURCE),
    [State.GO_TO_SOURCE]: (_job: Job.Data, creep: Creep, mem: BuilderMemory) =>
        Harvester.go_to_source(creep, mem, () => mem.state = State.HARVEST),
    [State.HARVEST]: (_job: Job.Data, creep: Creep, mem: BuilderMemory) =>
        Harvester.harvest(creep, mem, () => mem.state = State.SELECT_TARGET, () => mem.state = State.SELECT_SOURCE),
    [State.SELECT_TARGET]: select_target,
    [State.BUILD_TARGET]: build_target,
    [State.DEPOSIT_TO_CONTROLLER]: (job: Job.Data, creep: Creep, mem: BuilderMemory) =>
        Harvester.deposit_to_controller(creep, () => mem.state = State.DEPOSIT_ANYWHERE, () => job.active = false),
    [State.DEPOSIT_ANYWHERE]: (job: Job.Data, creep: Creep, mem: BuilderMemory) =>
        Harvester.deposit_anywhere(creep, mem, () => mem.state = State.DEPOSIT_TO_CONTROLLER, () => job.active = false),
};

interface BuilderMemory extends CreepMemory.Data {
    state: State;
}

function get_mem(creep: Creep, _reset: boolean = false): BuilderMemory {
    const mem = CreepMemory.get(creep) as BuilderMemory;
    if (!mem.state || _reset) {
        mem.state = State.SELECT_SOURCE;
    }
    return mem;
}

// export function log_progress(job: JobCreep.Data, creep: Creep, mem: BuilderMemory, msg: string): void {
//     log(job.type, `[${creep.name}|${job.id}|${mem.state}]: ${msg}`);
// }

function select_target(job: Job.Data, _creep: Creep, mem: BuilderMemory): void {
    const room = Game.rooms[job.room];
    const sites = _.sortBy(room.find(FIND_MY_CONSTRUCTION_SITES), (site: ConstructionSite) => site.progressTotal - site.progress) as ConstructionSite[];
    if (sites.length === 0) {
        mem.state = State.DEPOSIT_ANYWHERE;
    } else {
        mem.target = sites[0].id;
        mem.state = State.BUILD_TARGET;
    }
}

function build_target(job: Job.Data, creep: Creep, mem: BuilderMemory): void {
    const target = Game.constructionSites[mem.target as string];
    switch (creep.build(target)) {
        case ERR_NOT_ENOUGH_RESOURCES:
            creep.say("💤");
            // log_progress(job, creep, mem, "Done");
            job.active = false;
            break;
        case ERR_NOT_IN_RANGE:
            creep.moveTo(target, { visualizePathStyle: Settings.get().path_styles.builder_inbound as any });
            break;
        case ERR_FULL:
            creep.say("🚫❔ full");
            // log_progress(job, creep, mem, `Target full`);
            break;
        case ERR_INVALID_TARGET:
        case ERR_RCL_NOT_ENOUGH:
            // Site is constructed??
            if (creep.carry.energy as number > 0) {
                mem.state = State.SELECT_TARGET;
            } else {
                job.active = false;
            }
        default:
    }
}

// Factory assign function
function assign(job: Job.Data): boolean {
    return JobCreep.assign(job as JobCreep.Data, (_job: JobCreep.Data, creep: Creep): number => {
        if (CreepMemory.get(creep).role === ROLE_NAME) {
            return 1;
        }
        return 0;
    }, (_job: JobCreep.Data, creep: Creep): void => {
        const mem = get_mem(creep, true);
        // if we are already full then move straight to target selection
        if (creep.carry.energy === creep.carryCapacity) {
            mem.state = State.SELECT_TARGET;
            creep.say("✅ full");
        }
    });
}

function update_internal(job: JobCreep.Data, creep: Creep): void {
    const mem = get_mem(creep);
    state_update[mem.state](job, creep, mem);
}

function clean_up(creep: Creep): void {
    const mem = get_mem(creep);
    delete mem.state;
}

// Factory update function
function update(job_base: Job.Data): void {
    JobCreep.update(job_base as JobCreep.Data, update_internal, clean_up);
}

// Factory update function
function kill(job: Job.Data): boolean {
    return JobCreep.kill(job as JobCreep.Data, clean_up);
}

// Factory generate new jobs function
function generate_new_jobs(_active_jobs: Job.Data[]): Job.Data[] {
    // Generate jobs
    const new_jobs: Job.Data[] = [];
    _.forOwn(Game.rooms, (room: Room) => {
        if (room.find(FIND_MY_CONSTRUCTION_SITES).length > 0) {
            let inactive_builders = 0;
            _.forOwn(Game.creeps, (creep: Creep) => {
                const mem = CreepMemory.get(creep);
                if (creep.my && mem.role === ROLE_NAME && !mem.job) {
                    ++inactive_builders;
                }
            });
            for (let idx = 0; idx < inactive_builders; ++idx) {
                new_jobs.push(JobCreep.construct(JOB_NAME, FACTORY_NAME, room.name, -1, -1));
            }
        }
    });
    return new_jobs;
}

// Compose the factory object
export function get_factory(): JobFactory {
    return { assign, generate_new_jobs, update, kill } as JobFactory;
}
