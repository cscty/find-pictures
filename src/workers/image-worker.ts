import Image from "image-js";
import { compareImageJS } from "../utils";
import { WorkerBase } from "../utils/WorkerBase";
export const PathImageMap = new Map<string, Image>();

class ImageWorker extends WorkerBase {
  protected async postMessage({
    imagePath,
    referencePath,
  }: {
    imagePath: string;
    referencePath: string;
  }) {
    const referenceImage = (
      PathImageMap.has(referencePath)
        ? PathImageMap.get(referencePath)
        : await Image.load(referencePath)
    ) as Image;
    const image = await Image.load(imagePath);

    if (!PathImageMap.has(referencePath))
      PathImageMap.set(referencePath, referenceImage);
    try {
      const result = await compareImageJS(image, referenceImage);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

// 初始化 worker
new ImageWorker();
