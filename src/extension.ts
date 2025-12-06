import * as vscode from "vscode";
import { imageExtensions } from "./const";
import { WorkerPool } from "./utils";
import { demoAsync, scanWorkspaceImages } from "./utils";
import fs from "fs";
import path from "path";
import { registerFindPicturesCommand } from "./commands/findPicturesCommand";
import { registerCalculateImageSizeCommand } from "./commands/calculateImageSizeCommand";
export let imageDimensionsMap: { [key: string]: string } = {};
export let imageSizeMap: { [key: string]: number } = {};
export function activate(context: vscode.ExtensionContext) {
  registerFindPicturesCommand(context);
  registerCalculateImageSizeCommand(context);

  const demo = vscode.commands.registerCommand(
    "find-pictures.demoAsync",
    async () => {
      const config = vscode.workspace.getConfiguration("find-pictures");
      const similarity = config.get("similarity") as number;
      try {
        const allImages = await scanWorkspaceImages();
        const data = await demoAsync(allImages, similarity, imageDimensionsMap);
        const flatData = data.map((v) => v.slice(1)).flat(Infinity) as string[];
        let totalSize = 0;
        flatData.forEach((v) => (totalSize += imageSizeMap[v]));
        vscode.window.showInformationMessage(
          `${data.length}组相似图片，可优化${
            flatData.length
          }张${totalSize}B = ${(totalSize / 1024).toFixed(2)}KB = ${(
            totalSize /
            1024 /
            1024
          ).toFixed(2)}M`
        );
        showImages(data);
        fs.writeFileSync(
          path.join(__dirname, "../a.json"),
          JSON.stringify(data)
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`操作失败: ${error.message}`);
      }
    }
  );

  context.subscriptions.push(demo);
}

export function deactivate() {}

async function showImages(similarImageGroups: string[][]) {
  // 空数据处理
  if (
    !similarImageGroups.length ||
    similarImageGroups.every((group) => !group.length)
  ) {
    vscode.window.showInformationMessage("未找到相似图片");
    return;
  }

  // 创建Webview面板
  const totalImages = similarImageGroups.flat().length;

  const panel = vscode.window.createWebviewPanel(
    "imageGallery",
    `相似图片分组 (共${similarImageGroups.length}组 / 总计${totalImages}张)`,
    vscode.ViewColumn.Two
  );

  // 预处理所有图片URI（按分组整理）
  const groupedImageUris = similarImageGroups.map((group, groupIndex) => ({
    groupIndex: groupIndex + 1, // 分组序号从1开始
    images: group.map((path: string) => ({
      path,
      uri: panel.webview.asWebviewUri(vscode.Uri.file(path)).toString(),
    })),
  }));

  // 设置Webview内容
  panel.webview.html = getWebviewContent(groupedImageUris);

  // 监听Webview消息（复制成功回调）
  panel.webview.onDidReceiveMessage((message) => {
    if (message.type === "copySuccess") {
      vscode.window.showInformationMessage(`已复制路径: ${message.path}`);
    }
  });

  // 辅助函数：生成Webview HTML内容
  function getWebviewContent(
    groupedImages: {
      groupIndex: number;
      images: { path: string; uri: string }[];
    }[]
  ) {
    // 根据VS Code实际主题动态获取颜色（简化版，可扩展）
    const isDarkTheme =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const colors = {
      background: isDarkTheme ? "#1E1E1E" : "#FFFFFF",
      foreground: isDarkTheme ? "#FFFFFF" : "#333333",
      foregroundLight: isDarkTheme
        ? "rgba(255,255,255,0.7)"
        : "rgba(0,0,0,0.7)",
      cardBg: isDarkTheme ? "#2D2D30" : "#F5F5F5",
      imageContainerBg: isDarkTheme ? "#252526" : "#EEEEEE",
      divider: isDarkTheme ? "#373737" : "#E0E0E0",
      groupTitleBg: isDarkTheme ? "#323233" : "#E8E8E8",
    };

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>相似图片分组</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 20px;
      background-color: ${colors.background};
      color: ${colors.foreground};
    }

    /* 分组容器样式 */
    .group-container {
      margin-bottom: 32px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid ${colors.divider};
    }

    /* 分组标题样式 */
    .group-title {
      padding: 12px 16px;
      background-color: ${colors.groupTitleBg};
      font-size: 16px;
      font-weight: 600;
      border-bottom: 1px solid ${colors.divider};
    }

    /* 图片画廊样式 */
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
      padding: 16px;
    }

    /* 图片卡片样式 */
    .image-card {
      background-color: ${colors.cardBg};
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease;
      position: relative;
      cursor: pointer;
      overflow: hidden;
    }

    .image-card:hover {
      transform: translateY(-4px);
    }

    /* 复制按钮样式 */
    .copy-button {
      position: absolute;
      z-index: 999;
      top: 8px;
      right: 8px;
      background-color: rgba(0, 0, 0, 0.6);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s ease;
      cursor: pointer;
    }

    .image-card:hover .copy-button {
      opacity: 1;
    }

    /* 图片容器样式 */
    .image-container {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${colors.imageContainerBg};
      padding: 16px;
      height: 200px;
    }

    .image-container img {
      object-fit: contain;
      max-width: 100%;
      max-height: 100%;
      transition: transform 0.3s ease;
    }

    .image-container img:hover {
      transform: scale(1.05);
    }

    /* 图片信息样式 */
    .image-info {
      padding: 12px;
      word-break: break-all;
    }

    .image-path {
      font-size: 12px;
      color: ${colors.foregroundLight};
      margin-top: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .image-path:hover {
      white-space: normal;
    }

    /* 空分组样式 */
    .empty-group {
      padding: 20px;
      text-align: center;
      color: ${colors.foregroundLight};
      font-size: 14px;
    }
  </style>
</head>
<body>
  ${groupedImages
    .map(
      (group) => `
    <div class="group-container">
      <div class="group-title">相似图片组 ${group.groupIndex} (共${
        group.images.length
      }张)</div>
      ${
        group.images.length > 0
          ? `
        <div class="gallery">
          ${group.images
            .map(
              ({ uri, path }) => `
            <div class="image-card" data-path="${path}">
              <button class="copy-button" data-path="${path}">复制路径</button>
              <div class="image-container">
                <img src="${uri}" alt="相似图片 ${path}" loading="lazy">
              </div>
              <div class="image-info">
                <div class="image-path">${path}</div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      `
          : `
        <div class="empty-group">该分组无图片</div>
      `
      }
    </div>
  `
    )
    .join("")}

  <script>
    // 获取VS Code API
    const vscode = acquireVsCodeApi();

    // 图片加载失败处理
    document.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG') {
        // 替换为加载失败占位图（SVG）
        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cGF0aCBkPSJNMTgwIDYwSDEwVjMwSDIwVjIwSDgwVjEwSDIwMEwxODAgNjBNMjAgMTIwaDE2MHYtMzBIMjB2MzBNMTgwIDE4MEg1MFYxMzBIMjB2NzBIMTgwWiIgZmlsbD0iI0ZGRiIvPjxjaXJjbGUgY3g9IjE0MCIgY3k9IjgwIiByPSIyMCIgZmlsbD0iI0ZGRiIvPjwvc3ZnPg==';
        e.target.alt = '图片加载失败';
      }
    }, true);

    // 复制路径功能
    document.querySelectorAll('.copy-button').forEach(button => {
      button.addEventListener('click', (e) => {
        // 阻止事件冒泡（避免触发卡片点击）
        e.stopPropagation();
        const path = button.getAttribute('data-path');
        copyToClipboard(path);
      });
    });

    // 点击卡片复制路径（备选方案）
    document.querySelectorAll('.image-card').forEach(card => {
      card.addEventListener('click', () => {
        const path = card.getAttribute('data-path');
        copyToClipboard(path);
      });
    });

    // 剪贴板复制函数
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        // 通知VS Code复制成功
        vscode.postMessage({
          type: 'copySuccess',
          path: text
        });
      }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制：' + text);
      });
    }
  </script>
</body>
</html>
    `;
  }
}
