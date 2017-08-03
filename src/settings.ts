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

interface PathStyle {
    fill: string;
    lineStyle: string;
    opacity: number;
    stroke: string;
    strokeWidth: number;
}

interface LogSettings {
    enabled: string[];
    min_level: LogLevel;
}

interface DebugSettings {
    log: LogSettings;
}

interface HarvesterSettings {
    rate_measure_period: number;
}

interface JobSetting {
    priority: number;
    ttl: number;
}

interface JobsSettings {
    [key: string]: JobSetting;
    default: JobSetting;
    harvest_spawn: JobSetting;
    harvest: JobSetting;
    stopblocking: JobSetting;
}

interface FactorySetting {
    interval: number;
}

interface FactorySettings {
    [key: string]: FactorySetting;
    default: FactorySetting;
    harvest_factory: FactorySetting;
    spawn_harvest_factory: FactorySetting;
    spawn_builder_factory: FactorySetting;
    stopblocking_factory: FactorySetting;
    construct_extension_factory: FactorySetting;
}

interface PathStyles {
    // [key: string]: PathStyle;
    harvester_inbound: PathStyle;
    harvester_outbound: PathStyle;
    spawned: PathStyle;
    stopblocking: PathStyle;
}

interface ProfileSettings {
    enabled: boolean;
}

interface SpawnLimits {
    [key: string]: number;
}
interface SpawnerSettings {
    distance_cost_multiplier: number;
    harvester_scale: number;
    move_to_position_range: number;
    path_style: PathStyle;
    room_distance_cost_multipler: number;
    per_room_limits: SpawnLimits;
}

interface Settings {
    debug: DebugSettings;
    harvester: HarvesterSettings;
    jobs: JobsSettings;
    factories: FactorySettings;
    path_styles: PathStyles;
    profile: ProfileSettings;
    spawner: SpawnerSettings;
}

const CURRENT_VERSION = 15;
export function reset() {
    Memory.settings = {
        version: CURRENT_VERSION,
        // tslint:disable-next-line:object-literal-sort-keys
        debug: {
            log: {
                enabled: [
                    "settings",
                    "main",
                    "job.spawn.harvester",
                    "job.harvest",
                    "job.creep",
                    "job.construct",
                    "creep",
                    "manager"
                ],
                min_level: LogLevel.INFO
            }
        },
        harvester: {
            rate_measure_period: 30
        },
        jobs: {
            default: { priority: 1, ttl: 200 },
            harvest: { priority: 1, ttl: 200 },
            harvest_spawn: { priority: 1, ttl: 200 },
            stopblocking: { priority: 2, ttl: 50 },
        },
        factories: {
            construct_extension_factory:  { interval: 1 },
            default: { interval: 1 },
            harvest_factory:  { interval: 1 },
            spawn_builder_factory:  { interval: 1 },
            spawn_harvest_factory:  { interval: 1 },
            stopblocking_factory:  { interval: 1 }
        },
        path_styles: {
            harvester_inbound: {
                fill: "transparent",
                lineStyle: "dashed",
                opacity: .1,
                stroke: "#00ffff",
                strokeWidth: .05
            },
            harvester_outbound: {
                fill: "transparent",
                lineStyle: "dashed",
                opacity: .1,
                stroke: "#00ff00",
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
                stroke: "#ff5050",
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
