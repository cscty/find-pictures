export * from "./WorkerPool";
import Image from "image-js";
const CONFIG = {
  TARGET_RESIZE_SIZE: 32,
  COLOR_TOLERANCE: 3,
};

export const compareImageJS = async (img1: Image, img2: Image) => {
  if (img1.width !== img2.width || img1.height !== img2.height)
    return {
      success: false,
    };
  let numDiffPixels = 0;
  if (
    img1.width >= CONFIG.TARGET_RESIZE_SIZE &&
    img2.width >= CONFIG.TARGET_RESIZE_SIZE
  ) {
    img1 = img1.resize({
      width: CONFIG.TARGET_RESIZE_SIZE,
      height: CONFIG.TARGET_RESIZE_SIZE,
    });
    img2 = img2.resize({
      width: CONFIG.TARGET_RESIZE_SIZE,
      height: CONFIG.TARGET_RESIZE_SIZE,
    });
  }

  for (let i = 0; i < img1.width; i++) {
    for (let j = 0; j < img1.height; j++) {
      const img1Pixel = img1.getPixelXY(i, j);
      const img2Pixel = img2.getPixelXY(i, j);

      // 比较 RGB 值，忽略 Alpha 通道
      const isSimilar =
        Math.abs(img1Pixel[0] - img2Pixel[0]) <= CONFIG.COLOR_TOLERANCE &&
        Math.abs(img1Pixel[1] - img2Pixel[1]) <= CONFIG.COLOR_TOLERANCE &&
        Math.abs(img1Pixel[2] - img2Pixel[2]) <= CONFIG.COLOR_TOLERANCE;
      if (isSimilar) numDiffPixels++;
    }
  }
  return {
    success: true,
    similarity: numDiffPixels / (img1.width * img1.height),
  };
};
