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

class LogSettings {
  public enabled: Map<string, boolean> = new Map<string, boolean>([
    ["spawn", true],
    ["stats", true],
    ["harvester", true]
  ]);
  public min_level: LogLevel = LogLevel.INFO;
  public is_enabled(tag: string, level: LogLevel): boolean {
    return this.enabled.get(tag) === true && level >= this.min_level;
  }
}

class DebugSettings {
  public log: LogSettings;
}

class HarvesterSettings {
  // tslint:disable-next-line:variable-name
  public rate_measure_period: number = 30;
}

class JobsSettings {
  public priorities: Map<string, number> = new Map<string, number>([
      ["harvest", 1]
    ]);
}

class ProfileSettings {
  public enabled: boolean = false;
}

class SpawnerSettings {
  public harvester_scale: number = 1.5;
  public room_distance_cost_multipler: number = 200;
  public distance_cost_multiplier: number = 1;
  public path_style: any = {
    fill: "transparent",
    lineStyle: "dashed",
    opacity: .1,
    stroke: "#fff",
    strokeWidth: .15
  };
  public move_to_position_range: number = 5;
}

class Settings {
  public debug: DebugSettings;
  public harvester: HarvesterSettings;
  public jobs: JobsSettings;
  public profile: ProfileSettings;
  public spawner: SpawnerSettings;
}

export const settings = new Settings();
