import * as vscode from "vscode";
import { calculateImageSize, scanWorkspaceImages } from "../utils";
import { imageSizeMap } from "../extension";
export function registerCalculateImageSizeCommand(
  context: vscode.ExtensionContext
) {
  const disposable = vscode.commands.registerCommand(
    "find-pictures.calculate-image-size",
    async () => {
      try {
        const allImages = await scanWorkspaceImages();
        const { totalSize, data } = await calculateImageSize(allImages);
        for (let key in data) imageSizeMap[key] = data[key];

        vscode.window.showInformationMessage(
          `项目共有${allImages.length}张图片，大小为${totalSize}B = ${(
            totalSize / 1024
          ).toFixed(2)}KB = ${(totalSize / 1024 / 1024).toFixed(2)}M`
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`操作失败: ${error.message}`);
      }
    }
  );
  context.subscriptions.push(disposable);
}
