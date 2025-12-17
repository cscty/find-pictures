import * as vscode from "vscode";
import { registerFindPicturesCommand } from "./commands/findPicturesCommand";
import { registerCalculateImageSizeCommand } from "./commands/calculateImageSizeCommand";
import { registerFilterDuplicateImagesCommand } from "./commands/filterDuplicateImagesCommand";
import { scanWorkspaceImages } from "./utils";
import { calculateImageDimensions } from "./utils";
import { calculateImageSize } from "./utils";
export let imageDimensionsMap: { [key: string]: string } = {};
export let imageSizeMap: { [key: string]: number } = {};
export function activate(context: vscode.ExtensionContext) {
  scanWorkspaceImages().then(async (images) => {
    await calculateImageSize(images);
    await calculateImageDimensions(images);
    vscode.window.showInformationMessage("find-pictures初始化完成");
  });
  registerFindPicturesCommand(context);
  registerCalculateImageSizeCommand(context);
  registerFilterDuplicateImagesCommand(context);
}
