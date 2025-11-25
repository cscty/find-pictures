import { compareImageJS } from "../utils";
import { WorkerBase } from "../utils/WorkerBase";

class ImageWorker extends WorkerBase {
  protected async postMessage({
    imagePath1,
    imagePath2,
  }: {
    imagePath1: string;
    imagePath2: string;
  }) {
    try {
      const result = await compareImageJS(imagePath1, imagePath2);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

// 初始化 worker
new ImageWorker();
