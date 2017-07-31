/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('settings');
 * mod.thing == 'a thing'; // true
 */
export enum LogLevel {
    TRACE,
    DEBUG,
    INFO,
    WARNING,
    ERROR
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

interface JobPriorities {
    harvest_spawn: number;
    harvest: number;
}

interface JobsSettings {
    priorities: JobPriorities;
}

interface ProfileSettings {
    enabled: boolean;
}

interface PathStyle {
    fill: string;
    lineStyle: string;
    opacity: number;
    stroke: string;
    strokeWidth: number;
}

interface SpawnerSettings {
    distance_cost_multiplier: number;
    harvester_scale: number;
    move_to_position_range: number;
    path_style: PathStyle;
    room_distance_cost_multipler: number;
}

interface Settings {
    debug: DebugSettings;
    harvester: HarvesterSettings;
    jobs: JobsSettings;
    profile: ProfileSettings;
    spawner: SpawnerSettings;
}

export function reset() {
    Memory.settings = {
        version: __REVISION__,
        // tslint:disable-next-line:object-literal-sort-keys
        debug: {
            log: {
                enabled: [
                    "main",
                    "job.spawn.harvester",
                    "manager"
                ],
                min_level: LogLevel.INFO
            }
        },
        harvester: {
            rate_measure_period: 30
        },
        jobs: {
            priorities: {
                harvest: 1,
                harvest_spawn: 1
            }
        },
        profile: {
            enabled: false
        },
        spawner: {
            distance_cost_multiplier: 1,
            harvester_scale: 1.5,
            move_to_position_range: 5,
            path_style: {
                fill: "transparent",
                lineStyle: "dashed",
                opacity: .1,
                stroke: "#fff",
                strokeWidth: .15
            },
            room_distance_cost_multipler: 200
        }
    };
}
export function get() {
    if (!Memory.settings || Memory.settings.version !== __REVISION__) {
        reset();
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
