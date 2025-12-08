import Image from "image-js";
import { compareImageJS } from "./compareImageJS";

export const demoAsync = async (
  imageUrls: string[],
  similarity: number,
  imageDimensionsMap: { [key: string]: string }
) => {
  let n = imageUrls.length;
  let result = [];
  let selectedSet = new Set();
  for (let i = 0; i < n; i++) {
    let origin = imageUrls[i];
    let arr = [origin];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const compare = imageUrls[j];
      if (selectedSet.has(compare)) continue;
      if (
        imageDimensionsMap?.hasOwnProperty(origin) &&
        imageDimensionsMap?.hasOwnProperty(compare) &&
        imageDimensionsMap?.[origin] !== imageDimensionsMap?.[compare]
      )
        continue;
      const img1 = await Image.load(origin);
      const img2 = await Image.load(compare);
      const result = compareImageJS(img1, img2);
      if (Number(result?.similarity) >= similarity) {
        if (!selectedSet.has(origin)) selectedSet.add(origin);
        arr.push(compare);
        selectedSet.add(compare);
      }
    }
    if (arr.length >= 2) result.push(arr);
  }
  return result;
};
