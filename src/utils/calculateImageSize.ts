import fs from "fs";
import { imageSizeMap } from "../extension";
// 这里不用多线程。因为statSync性能开销极低，多个异步stat同时执行会有线程成本。
export const calculateImageSize = async (images: string[]) => {
  let totalSize = 0;
  let data: { [key: string]: number } = {};
  for (let i = 0; i < images.length; i++) {
    const fileStats = fs.statSync(images[i]);
    totalSize += fileStats.size;
    data[images[i]] = fileStats.size;
    imageSizeMap[images[i]] = fileStats.size;
  }

  return {
    totalSize,
    data,
  };
};
