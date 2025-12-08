import * as vscode from "vscode";
import { imageExtensions } from "../const";
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
