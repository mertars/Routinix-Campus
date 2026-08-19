export interface QueueAdapter<T> {
  enqueue(data: T): Promise<string>;
  process(handler: (data: T) => Promise<void>): void;
}
