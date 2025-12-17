import { Worker, WorkerOptions } from "worker_threads";

export class WorkerPool {
  private workers: Worker[] = [];
  private queue: ((value: void | PromiseLike<void>) => void)[] = [];
  private map: Map<Worker, { resolve: any; reject: any }> = new Map();

  constructor(workerPath: string, poolSize = 10, options?: WorkerOptions) {
    // 初始化 Worker 池
    try {
      for (let i = 0; i < poolSize; i++) {
        const worker = new Worker(workerPath, options);
        worker.on("error", (err) => {
          console.error("Worker运行时错误:", err.message);
        });
        worker.on("message", ({ data, error }: { data?: any; error?: any }) => {
          if (error) {
            this.map.get(worker)?.reject(error);
          } else {
            this.map.get(worker)?.resolve(data);
          }
          this.map.delete(worker);
          // 处理结果并释放 Worker
          if (this.queue.length > 0) {
            this.queue.shift()?.();
          }
          this.workers.push(worker);
        });

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
      this.map.set(worker, {
        resolve,
        reject,
      });
      worker.postMessage({
        data,
      });
    });
  }

  clearWorker() {
    this.workers.forEach((worker) => {
      worker.removeAllListeners();
      worker.terminate();
    });

    this.map.forEach(({ reject }) => {
      reject("Worker 池已销毁");
    });
  }
}
