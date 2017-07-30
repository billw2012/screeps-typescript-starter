import {LogLevel, settings} from "settings";

export {LogLevel, settings};

export function log(tag: string, o: any, level: LogLevel = LogLevel.INFO): void {
  if (settings.debug.log.is_enabled(tag, level)) {
    console.log(`${tag}: ${o}`);
  }
}
