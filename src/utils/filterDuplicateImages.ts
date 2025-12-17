import Image from "image-js";
import { compareImageJS } from "./compareImageJS";
import * as vscode from "vscode";

export const filterDuplicateImages = async (
  imageUrls: string[],
  similarity: number,
  imageDimensionsMap: Record<string, string> = {}
): Promise<string[][]> => {
  const duplicateGroups: string[][] = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "筛选项目重复图片中...",
      cancellable: true,
    },
    async (progress, token) => {
      const duplicateGroupsResult: string[][] = [];
      const imageCache: { url: string; image: Image }[] = [];
      for (const url of imageUrls) {
        try {
          const image = await Image.load(url);
          imageCache.push({ url, image });
        } catch (error) {
          console.warn(`图片加载失败，跳过该图片: ${url}`, error);
        }
      }
      let increment = 100 / imageCache.length;

      const selectedSet = new Set<string>();

      const cacheLength = imageCache.length;
      for (let i = 0; i < cacheLength; i++) {
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve(undefined);
            progress.report({
              increment,
              message: `处理进度${i + 1}/${imageCache.length}`,
            });
          }, 0);
        });

        const { url: originUrl, image: originImage } = imageCache[i];
        if (selectedSet.has(originUrl)) continue;

        const currentGroup: string[] = [originUrl];
        selectedSet.add(originUrl);
        const originDimension = imageDimensionsMap[originUrl];

        for (let j = i + 1; j < cacheLength; j++) {
          if (token.isCancellationRequested) {
            return [];
          }
          const { url: compareUrl, image: compareImage } = imageCache[j];
          if (selectedSet.has(compareUrl)) continue;

          const compareDimension = imageDimensionsMap[compareUrl];
          if (
            originDimension &&
            compareDimension &&
            originDimension !== compareDimension
          ) {
            continue;
          }

          try {
            const compareResult = compareImageJS(originImage, compareImage);
            const currentSimilarity = Number(compareResult?.similarity);
            if (currentSimilarity >= similarity) {
              currentGroup.push(compareUrl);
              selectedSet.add(compareUrl);
            }
          } catch (error) {
            console.warn(`图片对比失败: ${originUrl} vs ${compareUrl}`, error);
          }
        }

        if (currentGroup.length >= 2) {
          duplicateGroupsResult.push(currentGroup);
        }
      }
      return duplicateGroupsResult;
    }
  );

  return duplicateGroups;
};
