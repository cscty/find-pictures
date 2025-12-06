export * from "./WorkerPool";
import Image from "image-js";
import fs from "fs";
import * as vscode from "vscode";
import { imageExtensions } from "../const";

const CONFIG = {
  TARGET_RESIZE_SIZE: 32,
  COLOR_TOLERANCE: 3,
};

export const compareImageJS = (img1: Image, img2: Image) => {
  if (img1.width !== img2.width || img1.height !== img2.height)
    return {
      success: false,
      imageSize: `${img1.width}-${img1.height}`,
    };
  let numDiffPixels = 0;
  const originWidth = img1.width;
  const originHeight = img2.height;
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
    imageSize: `${originWidth}-${originHeight}`,
  };
};

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
      if (imageDimensionsMap?.[origin] !== imageDimensionsMap?.[compare])
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

export const calculateImageSize = async (images: string[]) => {
  let totalSize = 0;
  let data: { [key: string]: number } = {};
  for (let i = 0; i < images.length; i++) {
    const fileStats = fs.statSync(images[i]);
    totalSize += fileStats.size;
    data[images[i]] = fileStats.size;
  }
  return {
    totalSize,
    data,
  };
};

export async function scanWorkspaceImages() {
  const config = vscode.workspace.getConfiguration("find-pictures");

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("请先打开工作区");
    return [];
  }

  const includeDirs: string[] = (config.get("includeDirs") as string[]) || [];
  const excludeDirs: string[] = (config.get("excludeDirs") as string[]) || [];
  const includeGlobs = includeDirs.flatMap((dir) =>
    imageExtensions.map((ext) => `${dir.replace(/\/+$/, "")}/**/*.${ext}`)
  );
  const includeGlob = `{${includeGlobs.join(",")}}`;
  const excludeGlob = `{${excludeDirs.join(",")}}`;

  const imageFiles: string[] = [];
  const files = await vscode.workspace.findFiles(includeGlob, excludeGlob);
  imageFiles.push(...files.map((file) => file.fsPath));
  // 去重处理（不同的包含模式可能匹配到相同的文件）
  return [...new Set(imageFiles)];
}

export async function selectReferenceImage() {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: "选择参考图片",
    filters: {
      images: imageExtensions,
    },
  };

  const fileUris = await vscode.window.showOpenDialog(options);
  return fileUris?.[0]?.fsPath;
}
