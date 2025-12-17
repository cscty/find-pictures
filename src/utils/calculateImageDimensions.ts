import { imageDimensionsMap } from "../extension";
import { WorkerPool } from "./WorkerPool";
import path from "path";
const workerPool = new WorkerPool(
  path.join(__dirname, "./workers/calculate-image-dimensions-worker")
);

export const calculateImageDimensions = async (images: string[]) => {
  let data: { [key: string]: string } = {};
  const executeTasks = [];
  for (let imagePath of images) {
    executeTasks.push(calculateDimensions(imagePath));
  }
  const results = (await Promise.allSettled(executeTasks)) as {
    status: string;
    value?: {
      width: number;
      height: string;
      error?: unknown;
    };
    reason?: any;
  }[];
  results.forEach((result, i) => {
    const value = result.value as {
      width: number;
      height: string;
      error?: unknown;
    };
    data[images[i]] = `${value.width}-${value.height}`;
    imageDimensionsMap[images[i]] = `${value.width}-${value.height}`;
  });
  workerPool.clearWorker();
  return data;
};

async function calculateDimensions(imagePath: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await workerPool!.execute({
        imagePath,
      });
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}
