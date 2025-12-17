import { WorkerBase } from "../utils";
import fs from "fs";
import sizeOf from "image-size";

export class CalculateImageDimensionsWorker extends WorkerBase {
  protected async postMessage({ imagePath }: { imagePath: string }) {
    try {
      const image = await getImageSize(imagePath);
      return {
        width: image.width,
        height: image.height,
      };
    } catch (error) {
      return {
        width: 0,
        height: 0,
        error,
      };
    }
  }
}

new CalculateImageDimensionsWorker();

async function getImageSize(imgPath: string) {
  try {
    const buffer = fs.readFileSync(imgPath);
    const uint8Arr = new Uint8Array(buffer);
    const dimensions = sizeOf(uint8Arr);
    return { width: dimensions.width, height: dimensions.height };
  } catch (error) {
    return { width: 0, height: 0, error };
  }
}
