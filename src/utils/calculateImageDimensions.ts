import { imageDimensionsMap } from "../extension";
import Image from "image-js";
export const calculateImageDimensions = async (images: string[]) => {
  let data: { [key: string]: string } = {};
  for (let i = 0; i < images.length; i++) {
    const img = await Image.load(images[i]);
    data[images[i]] = `${img.width}-${img.height}`;
    imageDimensionsMap[images[i]] = `${img.width}-${img.height}`;
  }
  return data;
};
