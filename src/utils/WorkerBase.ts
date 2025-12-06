import { parentPort } from "worker_threads";
console.log(111);
export abstract class WorkerBase {
  constructor() {
    console.log(12345);
    this.setupMessageHandler();
  }

  private setupMessageHandler() {
    parentPort!.on("message", async ({ data, workerId }) => {
      console.log("有听到吗");

      try {
        const result = await this.postMessage(data);
        parentPort?.postMessage({ data: result, workerId });
      } catch (error: any) {
        console.log("没有执行吗");
        parentPort?.postMessage({ error, workerId });
      }
    });
  }

  // 子类必须实现此方法处理具体任务
  protected abstract postMessage(data: any): Promise<any>;
}
