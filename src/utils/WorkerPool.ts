import { Worker, WorkerOptions } from "worker_threads";
let id = 0;
export class WorkerPool {
  private workers: Worker[] = [];
  private queue: ((value: void | PromiseLike<void>) => void)[] = [];
  private map: Map<number, { resolve: any; reject: any }> = new Map();

  constructor(workerPath: string, poolSize = 10, options?: WorkerOptions) {
    // 初始化 Worker 池
    console.log("没纸小");
    try {
      for (let i = 0; i < poolSize; i++) {
        console.log("没有new Worker的感觉", workerPath);
        const worker = new Worker(workerPath, options);
        worker.on(
          "message",
          ({
            data,
            error,
            workerId,
          }: {
            data?: any;
            error?: any;
            workerId: number;
          }) => {
            if (error) {
              this.map.get(workerId)?.reject(error);
            } else {
              this.map.get(workerId)?.resolve(data);
            }
            this.map.delete(workerId);
            // 处理结果并释放 Worker
            if (this.queue.length > 0) {
              this.queue.shift()?.();
            }
            this.workers.push(worker);
          }
        );

        this.workers.push(worker);
      }
    } catch (error) {
      console.log("worker初始化问题", error);
    }
  }

  // 执行任务
  execute(data: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
      // 若有空闲 Worker，立即执行
      if (this.workers.length <= 0) {
        await new Promise((resolve) => this.queue.push(resolve));
      }

      const worker = this.workers.pop()!;
      const workerId = id++;
      this.map.set(workerId, {
        resolve,
        reject,
      });
      console.log("有post吗？");
      worker.postMessage({
        workerId,
        data,
      });
    });
  }
}
