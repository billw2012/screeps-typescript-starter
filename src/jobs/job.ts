export abstract class Job {
  public type: string;
  public id: string;
  public priority: number = 100;
  public active: boolean = false;
  public get pos(): RoomPosition | null {
    return Game.rooms[this.room].getPositionAt(this.x, this.y);
  }

  private x: number;
  private y: number;
  private room: string;

  constructor(type: string, pos: RoomPosition, priority: number) {
    this.type = type;
    this.room = pos.roomName;
    this.x = pos.x;
    this.y = pos.y;
    this.priority = priority;
    this.id = `${type}:${location}:${priority}:${Math.random()}`;
  }

  public abstract assign(): boolean;
  public abstract update(): void;
}
