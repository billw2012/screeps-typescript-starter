/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('settings');
 * mod.thing == 'a thing'; // true
 */
import { log } from "log";

export enum LogLevel {
    TRACE,
    DEBUG,
    INFO,
    WARNING,
    ERROR
}

export interface PathStyle {
    fill: string;
    lineStyle: string;
    opacity: number;
    stroke: string;
    strokeWidth: number;
}

export interface LogSettings {
    enabled: string[];
    min_level: LogLevel;
}

export interface DebugSettings {
    log: LogSettings;
}

export interface HarvesterSettings {
    rate_measure_period: number;
    controller_downgrade_ticks: number;
}

export interface JobSetting {
    priority: number;
    ttl: number;
}

export interface JobsSettings {
    [key: string]: JobSetting;
    default: JobSetting;
    spawn_builder_job: JobSetting;
    spawn_harvester_job: JobSetting;
    harvest_job: JobSetting;
    stopblocking_job: JobSetting;
}

export interface FactorySetting {
    interval: number;
}

export interface FactorySettings {
    [key: string]: FactorySetting;
    default: FactorySetting;
    harvest_factory: FactorySetting;
    spawn_harvest_factory: FactorySetting;
    spawn_builder_factory: FactorySetting;
    stopblocking_factory: FactorySetting;
    construct_extension_factory: FactorySetting;
}

export interface PathStyles {
    // [key: string]: PathStyle;
    builder_inbound: PathStyle;
    harvester_inbound: PathStyle;
    harvester_outbound: PathStyle;
    spawned: PathStyle;
    stopblocking: PathStyle;
}

export interface ProfileSettings {
    enabled: boolean;
}

export interface SpawnLimits {
    [key: string]: number;
}

export interface SpawnerSettings {
    distance_cost_multiplier: number;
    harvester_scale: number;
    move_to_position_range: number;
    path_style: PathStyle;
    room_distance_cost_multipler: number;
    per_room_limits: SpawnLimits;
}

export interface StatsSettings {
    scan_cpu_cap: number;
    desired_rally_points: number;
    open_space_min: number;
    open_space_max: number;
    space_around_spawns: number;
    space_around_rally_points: number;
    space_around_controllers: number;
    space_around_sources: number;
    room_border: number;
}

export interface ConstructionSettings {
    extension_spacing: number;
}

export interface Settings {
    debug: DebugSettings;
    harvester: HarvesterSettings;
    jobs: JobsSettings;
    factories: FactorySettings;
    path_styles: PathStyles;
    profile: ProfileSettings;
    spawner: SpawnerSettings;
    stats: StatsSettings;
    construct: ConstructionSettings;
}

const CURRENT_VERSION = 26;
export function reset() {
    Memory.settings = {
        version: CURRENT_VERSION,
        // tslint:disable-next-line:object-literal-sort-keys
        debug: {
            log: {
                enabled: [
                    "settings",
                    // "main",
                    // "job.spawn.harvester",
                    // "job.harvest",
                    // "job.creep",
                    // "job.spawn",
                    // "job.construct",
                    // "creep",
                    // "manager",
                    "metadata"
                ],
                min_level: LogLevel.INFO
            }
        },
        harvester: {
            controller_downgrade_ticks: 200,
            rate_measure_period: 30,
        },
        jobs: {
            default: { priority: 1, ttl: 200 },
            harvest_job: { priority: 1, ttl: 200 },
            spawn_builder_job: { priority: 2, ttl: 200 },
            spawn_harvester_job: { priority: 1, ttl: 200 },
            stopblocking_job: { priority: 2, ttl: 50 },
        },
        factories: {
            construct_extension_factory: { interval: 1 },
            default: { interval: 1 },
            harvest_factory: { interval: 1 },
            spawn_builder_factory: { interval: 1 },
            spawn_harvest_factory: { interval: 1 },
            stopblocking_factory: { interval: 1 }
        },
        path_styles: {
            builder_inbound: {
                fill: "transparent",
                lineStyle: "dashed",
                opacity: .1,
                stroke: "#ffa33a",
                strokeWidth: .05
            },
            harvester_inbound: {
                fill: "transparent",
                lineStyle: "dashed",
                opacity: .1,
                stroke: "#5e59ff",
                strokeWidth: .05
            },
            harvester_outbound: {
                fill: "transparent",
                lineStyle: "dashed",
                opacity: .1,
                stroke: "#59ff6f",
                strokeWidth: .05
            },
            spawned: {
                fill: "transparent",
                lineStyle: "dashed",
                opacity: .1,
                stroke: "#fff",
                strokeWidth: .15
            },
            stop_blocking: {
                fill: "transparent",
                lineStyle: "solid",
                opacity: .5,
                stroke: "#ffeb5b",
                strokeWidth: .15
            }
        },
        profile: {
            enabled: false
        },
        spawner: {
            distance_cost_multiplier: 1,
            harvester_scale: 1.5,
            move_to_position_range: 5,
            per_room_limits: {
                builder: 10,
                harvester: 20,
            },
            room_distance_cost_multipler: 200,
        },
        stats: {
            desired_rally_points: 3,
            open_space_max: 6,
            open_space_min: 1,
            room_border: 6,
            scan_cpu_cap: 0.2,
            space_around_controllers: 4,
            space_around_rally_points: 3,
            space_around_sources: 4,
            space_around_spawns: 4,
        },
        construct: {
            extension_spacing: 1
        }
    };
}

export function get() {
    if (!Memory.settings) {
        reset();
        log("settings", "Initialized settings");
    }
    if (Memory.settings.version !== CURRENT_VERSION) {
        const original_ver = Memory.settings.version;
        reset();
        // tslint:disable-next-line:max-line-length
        log("settings", `Reinitialized settings: version changed from ${original_ver} to ${CURRENT_VERSION}`);
    }
    return Memory.settings as Settings;
}

// export const settings = {
//     debug: {
//         log: {
//             enabled: [
//                 "main",
//                 "harvester",
//                 "spawn",
//                 "stats"
//             ],
//             min_level: LogLevel.INFO
//         }
//     },
//     harvester: {
//         rate_measure_period: 30
//     },
//     jobs: {
//         priorities: {
//             harvest: 1,
//             harvest_spawn: 1
//         }
//     },
//     profile: {
//         enabled: false
//     },
//     spawner: {
//         distance_cost_multiplier: 1,
//         harvester_scale: 1.5,
//         move_to_position_range: 5,
//         path_style: {
//             fill: "transparent",
//             lineStyle: "dashed",
//             opacity: .1,
//             stroke: "#fff",
//             strokeWidth: .15
//         },
//         room_distance_cost_multipler: 200
//     }
// } as Settings;
