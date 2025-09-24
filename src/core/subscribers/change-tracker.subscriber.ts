import {
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from "typeorm";

export type ChangeReporter = (tableName: string) => void;

export class ChangeTrackerSubscriber implements EntitySubscriberInterface {
  constructor(private readonly report: ChangeReporter) {}

  afterInsert(event: InsertEvent<unknown>): void | Promise<any> {
    this.notify(event);
  }

  afterUpdate(event: UpdateEvent<unknown>): void | Promise<any> {
    this.notify(event);
  }

  afterRemove(event: RemoveEvent<unknown>): void | Promise<any> {
    this.notify(event);
  }

  private notify(event: { metadata: { tableName: string } }): void {
    this.report(event.metadata.tableName);
  }
}
