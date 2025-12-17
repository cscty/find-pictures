import Image from "image-js";
import { compareImageJS } from "../utils";
import { WorkerBase } from "../utils";
import { workerData } from "worker_threads";
let imageDimensionsMap: { [key: string]: string } = workerData;
const PathImageMap = new Map<string, Image>();
export class FindPicturesWorker extends WorkerBase {
  protected async postMessage({
    imagePath,
    referencePath,
  }: {
    imagePath: string;
    referencePath: string;
  }) {
    try {
      if (
        PathImageMap.has(referencePath) &&
        imageDimensionsMap.hasOwnProperty(imagePath) &&
        PathImageMap.get(referencePath)?.width +
          "-" +
          PathImageMap.get(referencePath)?.height !==
          imageDimensionsMap[imagePath]
      ) {
        return {
          success: false,
          imageSize: imageDimensionsMap[imagePath],
        };
      }
      const referenceImage = (
        PathImageMap.has(referencePath)
          ? PathImageMap.get(referencePath)
          : await Image.load(referencePath)
      ) as Image;
      const image = await Image.load(imagePath);

      if (!PathImageMap.has(referencePath))
        PathImageMap.set(referencePath, referenceImage);
      try {
        const result = compareImageJS(image, referenceImage);
        return result;
      } catch (error) {
        throw error;
      }
    } catch (error) {
      console.log(error);
    }
  }
}

new FindPicturesWorker();
