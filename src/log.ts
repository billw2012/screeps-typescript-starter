import * as _ from "lodash";
import * as Settings from "settings";

export { Settings };

export function log(tag: string, o: any, level: Settings.LogLevel = Settings.LogLevel.INFO): void {
    if (Settings.get().debug.log.min_level <= level && _.contains(Settings.get().debug.log.enabled, tag)) {
        const msg = `${Settings.LogLevel[level]}.${tag}: ${o}`;
        console.log(msg);
    }
}
