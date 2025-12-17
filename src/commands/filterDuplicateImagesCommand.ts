import * as vscode from "vscode";
import { scanWorkspaceImages } from "../utils";
import { filterDuplicateImages } from "../utils";
import { imageDimensionsMap, imageSizeMap } from "../extension";
import fs from "fs";
import path from "path";

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
        fs.writeFileSync(
          path.join(__dirname, "../a.json"),
          JSON.stringify(data)
        );
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

  // 主题颜色函数（和参考版本保持一致）
  const getBackgroundColor = () => "#1E1E1E";
  const getForegroundColor = (opacity = 1) =>
    opacity === 1 ? "#FFFFFF" : `rgba(255, 255, 255, ${opacity})`;
  const getCardBackgroundColor = () => "#2D2D30";
  const getImageContainerColor = () => "#252526";

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
            `已删除分组 ${message.groupIndex}`
          );
          const remainingGroups = document.querySelectorAll(
            ".group-container:not(.deleted)"
          ).length;
          panel.title = `相似图片分组 (共${remainingGroups}组)`;
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

  // 核心：统一hover效果的HTML/CSS
  panel.webview.html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>相似图片</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 16px;
      background-color: ${getBackgroundColor()};
      color: ${getForegroundColor()};
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
    /* 统一的图片卡片样式（和参考版本完全一致） */
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
    }
    .mark-btn {
      position: absolute;
      z-index: 99999;
      top: 8px;
      left: 8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: rgba(0, 0, 0, 0.5);
      border: 2px solid white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .mark-btn.checked {
      background-color: #4CAF50;
    }
    .mark-btn::after {
      content: "✓";
      color: white;
      font-size: 12px;
      opacity: 0;
    }
    .mark-btn.checked::after {
      opacity: 1;
    }
    /* 统一的复制按钮样式（和参考版本一致） */
    .copy-btn {
      position: absolute;
      z-index: 99999;
      top: 8px;
      right: 8px;
      background-color: rgba(0, 0, 0, 0.5);
      color: white;
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
    /* 统一的图片容器样式（和参考版本一致） */
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
      transition: transform 0.3s ease; /* 图片hover放大过渡 */
    }
    /* 图片hover放大效果（和参考版本一致） */
    .image-container img:hover {
      transform: scale(1.05);
    }
    .image-info {
      padding: 12px;
      word-break: break-all; /* 统一换行规则 */
    }
    /* 统一的路径文本样式（和参考版本一致） */
    .image-path {
      font-size: 12px;
      color: ${getForegroundColor(0.7)};
      margin-top: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: white-space 0.2s ease;
    }
    /* 路径hover换行展开（和参考版本一致） */
    .image-path:hover {
      white-space: normal;
    }
  </style>
</head>
<body>
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

    // 删除分组函数
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
          // 更新分组序号
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

    // 复制路径（和参考版本逻辑一致）
    function copyPath(imgId) {
      const path = document.querySelector(\`#card_\${imgId} .image-path\`).textContent.replace('图片地址：', '');
      // 使用原生剪贴板API（和参考版本一致）
      navigator.clipboard.writeText(path).then(() => {
        vscode.postMessage({
          type: 'copyPath',
          id: imgId,
          path: path
        });
      }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败: ' + err.message);
      });
    }

    // 图片加载错误处理（和参考版本一致）
    document.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG') {
        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cGF0aCBkPSJNMTgwIDYwSDEwVjMwSDIwVjIwSDgwVjEwSDIwMEwxODAgNjBNMjAgMTIwaDE2MHYtMzBIMjB2MzBNMTgwIDE4MEg1MFYxMzBIMjB2NzBIMTgwWiIgZmlsbD0iI0ZGRiIvPjxjaXJjbGUgY3g9IjE0MCIgY3k9IjgwIiByPSIyMCIgZmlsbD0iI0ZGRiIvPjwvc3ZnPg==';
        e.target.alt = '图片加载失败';
      }
    }, true);

    // 卡片点击复制（和参考版本一致）
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
