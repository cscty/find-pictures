import * as vscode from "vscode";
import { scanWorkspaceImages } from "../utils";
import { filterDuplicateImages } from "../utils";
import { imageDimensionsMap, imageSizeMap } from "../extension";

export function registerFilterDuplicateImagesCommand(
  context: vscode.ExtensionContext
) {
  const disposable = vscode.commands.registerCommand(
    "find-pictures.filter-duplicate-images",
    async () => {
      const config = vscode.workspace.getConfiguration("find-pictures");
      const similarity = config.get("similarity") as number;
      try {
        const allImages = await scanWorkspaceImages();
        const data = await filterDuplicateImages(
          allImages,
          similarity,
          imageDimensionsMap
        );
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
      } catch (error: any) {
        vscode.window.showErrorMessage(`操作失败: ${error.message}`);
      }
    }
  );
  context.subscriptions.push(disposable);
}

async function showImages(similarImageGroups: string[][]): Promise<void> {
  if (
    !similarImageGroups.length ||
    similarImageGroups.every((group) => !group.length)
  ) {
    vscode.window.showInformationMessage("暂无相似图片分组");
    return;
  }

  const totalImages = similarImageGroups.flat().length;
  const panel = vscode.window.createWebviewPanel(
    "imageGallery",
    `相似图片分组 (共${similarImageGroups.length}组 / 总计${totalImages}张)`,
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots:
        vscode.workspace.workspaceFolders?.map((f) => f.uri) || [],
    }
  );

  // 主题颜色函数（适配VS Code主题）
  const getBackgroundColor = () => {
    const config = vscode.workspace.getConfiguration(
      "workbench.colorCustomizations"
    );
    return config.get("editor.background") || "#1E1E1E";
  };
  const getForegroundColor = (opacity = 1) => {
    const config = vscode.workspace.getConfiguration(
      "workbench.colorCustomizations"
    );
    const baseColor = config.get("editor.foreground") || "#FFFFFF";
    return opacity === 1 ? baseColor : `rgba(255, 255, 255, ${opacity})`;
  };
  const getCardBackgroundColor = () => {
    const config = vscode.workspace.getConfiguration(
      "workbench.colorCustomizations"
    );
    return config.get("editorWidget.background") || "#2D2D30";
  };
  const getImageContainerColor = () => {
    const config = vscode.workspace.getConfiguration(
      "workbench.colorCustomizations"
    );
    return config.get("panel.background") || "#252526";
  };

  interface ImageItem {
    id: string;
    path: string;
    uri: string;
  }
  interface GroupItem {
    groupIndex: number;
    groupId: string;
    images: ImageItem[];
  }

  const groupedImages: GroupItem[] = [];
  let imageIdCounter = 0;
  similarImageGroups.forEach((group, groupIndex) => {
    const groupId = `group_${groupIndex}`;
    const images: ImageItem[] = group.map((imgPath) => {
      const safeId = `img_${imageIdCounter++}`;
      return {
        id: safeId,
        path: imgPath,
        uri: panel.webview.asWebviewUri(vscode.Uri.file(imgPath)).toString(),
      };
    });
    groupedImages.push({ groupIndex: groupIndex + 1, groupId, images });
  });

  // 处理Webview消息
  panel.webview.onDidReceiveMessage(async (message) => {
    try {
      switch (message.type) {
        case "copyPath": {
          await vscode.env.clipboard.writeText(message.path);
          vscode.window.showInformationMessage(`已复制路径: ${message.path}`);
          break;
        }
        case "deleteGroup": {
          console.log(`删除分组: ${message.groupId}`);
          vscode.window.showInformationMessage(
            `已标记分组 ${message.groupIndex} 为删除`
          );
          const remainingGroups =
            document.querySelectorAll?.(".group-container:not(.deleted)")
              ?.length || similarImageGroups.length - 1;
          panel.title = `相似图片分组 (共${remainingGroups}组)`;
          break;
        }
        case "copySimilarImageGroups": {
          // 复制数组：VS Code剪贴板适配，增加大数据量判断
          try {
            const arrayStr = JSON.stringify(similarImageGroups, null, 2);
            // 检测数据大小（VS Code剪贴板建议不超过5MB）
            const byteLength = Buffer.from(arrayStr).length;
            const maxSafeSize = 5 * 1024 * 1024; // 5MB

            if (byteLength > maxSafeSize) {
              // 大数据量：询问是否导出文件
              const exportChoice = await vscode.window.showWarningMessage(
                `数据量较大(${Math.round(
                  byteLength / 1024
                )}KB)，复制可能失败！`,
                "导出为JSON文件",
                "仍尝试复制"
              );

              if (exportChoice === "导出为JSON文件") {
                await exportJsonFile(similarImageGroups);
                return;
              }
            }

            await vscode.env.clipboard.writeText(arrayStr);
            vscode.window.showInformationMessage(
              "已复制相似图片分组数组到剪贴板"
            );
          } catch (err) {
            vscode.window.showErrorMessage(
              `复制失败：${(err as Error).message}`
            );
            // 复制失败自动提示导出
            const exportChoice = await vscode.window.showErrorMessage(
              "复制失败，是否导出为JSON文件？",
              "是",
              "否"
            );
            if (exportChoice === "是") {
              await exportJsonFile(similarImageGroups);
            }
          }
          break;
        }
        case "exportSimilarImageGroups": {
          // 导出JSON文件（VS Code原生文件选择对话框）
          await exportJsonFile(similarImageGroups);
          break;
        }
        default: {
          console.log("未知消息类型:", message.type);
        }
      }
    } catch (err) {
      console.error("消息处理失败:", err);
    }
  });

  // 导出JSON文件核心函数（VS Code插件版）
  async function exportJsonFile(data: string[][]) {
    // 1. 弹出文件保存对话框（VS Code原生API）
    const uri = await vscode.window.showSaveDialog({
      title: "导出相似图片分组JSON",
      defaultUri: vscode.workspace.workspaceFolders?.length
        ? vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders[0].uri,
            `相似图片分组_${Date.now()}.json`
          )
        : vscode.Uri.file(`相似图片分组_${Date.now()}.json`),
      filters: {
        JSON文件: ["json"],
        所有文件: ["*"],
      },
    });

    if (!uri) {
      vscode.window.showInformationMessage("已取消导出");
      return;
    }

    // 2. 写入文件（VS Code文件系统API，兼容大文件）
    try {
      const content = JSON.stringify(data, null, 2);
      // 使用VS Code的fs API（兼容远程工作区）
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
      vscode.window.showInformationMessage(`JSON文件已导出：${uri.fsPath}`);

      // 可选：打开导出的文件
      const openChoice = await vscode.window.showInformationMessage(
        "文件导出成功，是否打开该文件？",
        "打开",
        "取消"
      );
      if (openChoice === "打开") {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`导出文件失败：${(err as Error).message}`);
    }
  }

  // 核心HTML/CSS（适配VS Code插件）
  panel.webview.html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>相似图片</title>
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto);
      margin: 0;
      padding: 16px;
      background-color: ${getBackgroundColor()};
      color: ${getForegroundColor()};
      font-size: var(--vscode-font-size, 13px);
    }
    /* 操作按钮容器（移到顶部第一行） */
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid ${getForegroundColor(0.2)};
    }
    .action-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .action-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .copy-btn-icon::before {
      content: "📋";
    }
    .export-btn-icon::before {
      content: "💾";
    }
    .group-container {
      margin-bottom: 24px;
      transition: all 0.3s ease;
    }
    .group-container.deleted {
      opacity: 0;
      height: 0;
      margin: 0;
      padding: 0;
      pointer-events: none;
    }
    .group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 0 0 16px 0;
      padding: 8px 0;
      border-bottom: 1px solid ${getForegroundColor(0.2)};
    }
    .group-title {
      font-size: 16px;
      font-weight: 600;
    }
    .group-actions {
      display: flex;
      gap: 8px;
    }
    .group-btn {
      background: rgba(0,0,0,0.5);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .group-btn:hover {
      background: rgba(0,0,0,0.7);
    }
    /* 恢复删除按钮原有颜色 */
    .delete-btn {
      background: rgba(220,0,0,0.6);
    }
    .delete-btn:hover {
      background: rgba(220,0,0,0.8);
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }
    .gallery.hidden {
      display: none;
    }
    /* 图片卡片样式（适配VS Code主题） */
    .image-card {
      background-color: ${getCardBackgroundColor()};
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease;
      position: relative;
      cursor: pointer;
      border: 2px solid transparent;
    }
    .image-card:hover {
      transform: translateY(-4px);
      border-color: var(--vscode-focusBorder);
    }
    .mark-btn {
      position: absolute;
      z-index: 99999;
      top: 8px;
      left: 8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: var(--vscode-widget-background);
      border: 2px solid var(--vscode-foreground);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .mark-btn.checked {
      background-color: var(--vscode-button-success-background);
    }
    .mark-btn::after {
      content: "✓";
      color: var(--vscode-button-success-foreground);
      font-size: 12px;
      opacity: 0;
    }
    .mark-btn.checked::after {
      opacity: 1;
    }
    /* 复制按钮样式（VS Code主题适配） */
    .copy-btn {
      position: absolute;
      z-index: 99999;
      top: 8px;
      right: 8px;
      background-color: var(--vscode-widget-background);
      color: var(--vscode-foreground);
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s ease;
      cursor: pointer;
    }
    .image-card:hover .copy-btn {
      opacity: 1;
    }
    /* 图片容器样式 */
    .image-container {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${getImageContainerColor()};
      padding: 16px;
    }
    .image-container img {
      object-fit: contain;
      max-width: 100%;
      max-height: 200px;
      transition: transform 0.3s ease;
    }
    .image-container img:hover {
      transform: scale(1.05);
    }
    .image-info {
      padding: 12px;
      word-break: break-all;
    }
    .image-path {
      font-size: 12px;
      color: ${getForegroundColor(0.7)};
      margin-top: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: white-space 0.2s ease;
    }
    .image-path:hover {
      white-space: normal;
    }
  </style>
</head>
<body>
  <!-- 操作按钮容器移到页面顶部第一行 -->
  <div class="action-buttons">
    <button class="action-btn" onclick="copySimilarImageGroups()">
      <span class="copy-btn-icon"></span>复制数据
    </button>
    <button class="action-btn" onclick="exportSimilarImageGroups()">
      <span class="export-btn-icon"></span>导出JSON文件
    </button>
  </div>

  ${groupedImages
    .map(
      (group) => `
    <div class="group-container" id="group_${group.groupId}">
      <div class="group-header">
        <div class="group-title">相似图片组 ${group.groupIndex} (共${
        group.images.length
      }张)</div>
      <div class="group-actions">
          <button class="group-btn hide-btn" onclick="toggleHide('${
            group.groupId
          }')">隐藏该组</button>
          <button class="group-btn delete-btn" onclick="deleteGroup('${
            group.groupId
          }', '${group.groupIndex}')">删除该组</button>
        </div>
      </div>
      <div class="gallery" id="gallery_${group.groupId}">
        ${group.images
          .map(
            (img) => `
          <div class="image-card" data-path="${img.path}" id="card_${img.id}">
            <div class="mark-btn" onclick="toggleMark('${img.id}'); event.stopPropagation()"></div>
            <button class="copy-btn" onclick="copyPath('${img.id}'); event.stopPropagation()">复制路径</button>
            <div class="image-container">
              <img src="${img.uri}" alt="图片预览" loading="lazy">
            </div>
            <div class="image-info">
              <div class="image-path">图片地址：${img.path}</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `
    )
    .join("")}

  <script>
    const vscode = acquireVsCodeApi();
    
    // 状态管理
    const markStates = {};
    const hideStates = {};
    ${groupedImages
      .map((group) => `hideStates['${group.groupId}'] = false;`)
      .join("\n    ")}
    ${groupedImages
      .flatMap((g) => g.images)
      .map((img) => `markStates['${img.id}'] = false;`)
      .join("\n    ")}

    // 复制数组（VS Code插件版）
    function copySimilarImageGroups() {
      vscode.postMessage({
        type: 'copySimilarImageGroups'
      });
    }

    // 导出JSON文件（VS Code插件版）
    function exportSimilarImageGroups() {
      vscode.postMessage({
        type: 'exportSimilarImageGroups'
      });
    }

    // 删除分组
    function deleteGroup(groupId, groupIndex) {
      const groupEl = document.getElementById('group_' + groupId);
      if (groupEl) {
        groupEl.classList.add('deleted');
        
        vscode.postMessage({
          type: 'deleteGroup',
          groupId: groupId,
          groupIndex: groupIndex
        });

        setTimeout(() => {
          groupEl.remove();
          updateGroupNumbers();
        }, 300);
      }
    }

    // 更新分组序号
    function updateGroupNumbers() {
      const remainingGroups = document.querySelectorAll('.group-container:not(.deleted)');
      remainingGroups.forEach((groupEl, newIndex) => {
        const titleEl = groupEl.querySelector('.group-title');
        const imgCountMatch = titleEl.textContent.match(/共(\\d+)张/);
        const imgCount = imgCountMatch ? imgCountMatch[1] : 0;
        titleEl.textContent = \`相似图片组 \${newIndex + 1} (共\${imgCount}张)\`;
        
        const deleteBtn = groupEl.querySelector('.delete-btn');
        const originalGroupId = groupEl.id.replace('group_', '');
        deleteBtn.onclick = () => deleteGroup(originalGroupId, newIndex + 1);
      });
    }

    // 隐藏分组
    function toggleHide(groupId) {
      hideStates[groupId] = !hideStates[groupId];
      const gallery = document.getElementById('gallery_' + groupId);
      const btn = document.querySelector(\`.hide-btn[onclick*="\${groupId}"]\`);
      
      if (hideStates[groupId]) {
        gallery.classList.add('hidden');
        btn.textContent = '显示该组';
      } else {
        gallery.classList.remove('hidden');
        btn.textContent = '隐藏该组';
      }
    }

    // 标记图片
    function toggleMark(imgId) {
      markStates[imgId] = !markStates[imgId];
      const markBtn = document.querySelector(\`.mark-btn[onclick*="\${imgId}"]\`);
      const card = document.getElementById('card_' + imgId);
      
      if (markStates[imgId]) {
        markBtn.classList.add('checked');
        card.classList.add('marked');
      } else {
        markBtn.classList.remove('checked');
        card.classList.remove('marked');
      }
    }

    // 复制路径
    function copyPath(imgId) {
      const path = document.querySelector(\`#card_\${imgId} .image-path\`).textContent.replace('图片地址：', '');
      vscode.postMessage({
        type: 'copyPath',
        id: imgId,
        path: path
      });
    }

    // 图片加载错误处理
    document.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG') {
        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cGF0aCBkPSJNMTgwIDYwSDEwVjMwSDIwVjIwSDgwVjEwSDIwMEwxODAgNjBNMjAgMTIwaDE2MHYtMzBIMjB2MzBNMTgwIDE4MEg1MFYxMzBIMjB2NzBIMTgwWiIgZmlsbD0iI0ZGRiIvPjxjaXJjbGUgY3g9IjE0MCIgY3k9IjgwIiByPSIyMCIgZmlsbD0iI0ZGRiIvPjwvc3ZnPg==';
        e.target.alt = '图片加载失败';
      }
    }, true);

    // 卡片点击复制
    document.addEventListener('click', function(e) {
      if (e.target.closest('.image-card') && !e.target.closest('.mark-btn') && !e.target.closest('.copy-btn')) {
        const imgId = e.target.closest('.image-card').id.replace('card_', '');
        copyPath(imgId);
      }
    });
  </script>
</body>
</html>
  `;
}
