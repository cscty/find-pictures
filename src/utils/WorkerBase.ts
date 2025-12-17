import { parentPort } from "worker_threads";
export abstract class WorkerBase {
  constructor() {
    this.setupMessageHandler();
  }

  private setupMessageHandler() {
    parentPort!.on("message", async ({ data }) => {
      try {
        const result = await this.postMessage(data);
        parentPort?.postMessage({ data: result });
      } catch (error: any) {
        parentPort?.postMessage({ error });
      }
    });
  }

  // 子类必须实现此方法处理具体任务
  protected abstract postMessage(data: any): Promise<any>;
}
