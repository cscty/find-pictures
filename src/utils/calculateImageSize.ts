import fs from "fs";
import { imageSizeMap } from "../extension";
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
