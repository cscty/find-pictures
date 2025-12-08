import * as vscode from "vscode";
import { imageExtensions } from "../const";
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
