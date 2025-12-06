import path from "path";
import * as vscode from "vscode";
import {
  scanWorkspaceImages,
  selectReferenceImage,
  WorkerPool,
} from "../utils";
// import { imageDimensionsMap } from "../extension";
let imageDimensionsMap: { [key: string]: string } = {};
let workerPool: WorkerPool | undefined;
export function registerFindPicturesCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "find-pictures.find-pictures",
    async () => {
      console.log(1);
      workerPool = new WorkerPool(
        path.join(__dirname, "./workers/find-pictures-worker"),
        undefined,
        {
          workerData: imageDimensionsMap,
        }
      );
      console.log(2);
      try {
        // 1. 选择参考图片
        const referenceImage = await selectReferenceImage();
        if (!referenceImage) return;
        // 2. 扫描工作区图片
        const allImages = await scanWorkspaceImages();
        if (allImages.length === 0) {
          vscode.window.showInformationMessage("工作区中未找到图片文件");
          return;
        }

        // 3. 查找相似图片
        const start = Date.now();
        const similarImages = await findSimilarImages(
          referenceImage,
          allImages
        );

        // 4. 显示结果
        showSimilarImages(similarImages || []);
        vscode.window.showInformationMessage(
          `查找到${similarImages.length}张图片，耗时${
            (Date.now() - start) / 1000
          }s`
        );
      } catch (error: any) {
        console.log(error);
        vscode.window.showErrorMessage(`操作失败: ${error.message}`);
      }
    }
  );
  context.subscriptions.push(disposable);
}

async function showSimilarImages(similarImages: string[]) {
  if (similarImages.length === 0) {
    vscode.window.showInformationMessage("未找到相似图片");
    return;
  }

  // 创建Webview面板
  const panel = vscode.window.createWebviewPanel(
    "imageGallery",
    `相似图片 (${similarImages.length}张)`,
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  // 准备图片资源的URI
  const imageUris = similarImages.map((path: string) => {
    return {
      path,
      uri: panel.webview.asWebviewUri(vscode.Uri.file(path)).toString(),
    };
  });

  // 设置Webview内容
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

          .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 16px;
          }

          .image-card {
            background-color: ${getCardBackgroundColor()};
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
            position: relative;
            cursor: pointer;
          }

          .image-card:hover {
            transform: translateY(-4px);
          }

          .copy-button {
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
          }

          .image-card:hover .copy-button {
            opacity: 1;
          }

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
          }

          .image-path:hover {
            white-space: normal;
          }

          .loading {
            text-align: center;
            padding: 20px;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div class="gallery">
          ${imageUris
            .map(
              ({ uri, path }) => `
                <div class="image-card" data-path="${path}">
                  <button class="copy-button" data-path="${path}">复制路径</button>
                  <div class="image-container">
                    <img src="${uri}" alt="图片预览" loading="lazy">
                  </div>
                  <div class="image-info">
                    <div class="image-path">图片地址：${path}</div>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          // 图片加载错误处理
          document.addEventListener('error', (e) => {
            if (e.target.tagName === 'IMG') {
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cGF0aCBkPSJNMTgwIDYwSDEwVjMwSDIwVjIwSDgwVjEwSDIwMEwxODAgNjBNMjAgMTIwaDE2MHYtMzBIMjB2MzBNMTgwIDE4MEg1MFYxMzBIMjB2NzBIMTgwWiIgZmlsbD0iI0ZGRiIvPjxjaXJjbGUgY3g9IjE0MCIgY3k9IjgwIiByPSIyMCIgZmlsbD0iI0ZGRiIvPjwvc3ZnPg==';
              e.target.alt = '图片加载失败';
            }
          }, true);

          // 添加复制按钮点击事件
          document.querySelectorAll('.image-card').forEach(card => {
            card.addEventListener('click', function(e){
              const path = this.getAttribute('data-path');
              copyToClipboard(path);
            });
          });

          // 复制到剪贴板函数
          function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
              // 通知VS Code复制成功（可选）
              vscode.postMessage({
                type: 'copySuccess',
                path: text
              });
            }).catch(err => {
              console.error('复制失败:', err);
              alert('复制失败: ' + err);
            });
          }
        </script>
      </body>
      </html>
    `;

  // 监听Webview消息（在VS Code插件代码中）
  panel.webview.onDidReceiveMessage((message) => {
    if (message.type === "copySuccess") {
      vscode.window.showInformationMessage(`已复制路径: ${message.path}`);
    }
  });
  // 辅助函数：根据VS Code主题获取颜色
  function getBackgroundColor() {
    // 实际实现中应通过Webview通信获取主题颜色
    return "#1E1E1E"; // 默认深色主题
  }

  function getForegroundColor(opacity = 1) {
    return opacity === 1 ? "#FFFFFF" : `rgba(255, 255, 255, ${opacity})`;
  }

  function getCardBackgroundColor() {
    return "#2D2D30";
  }

  function getImageContainerColor() {
    return "#252526";
  }
}

async function findSimilarImages(referencePath: string, imagePaths: string[]) {
  const config = vscode.workspace.getConfiguration("find-pictures");
  const similarity = config.get("similarity") as number;
  const similarImages: string[] = [];
  console.log(similarImages, "1");
  // 显示进度通知
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "正在查找相似图片...",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const total = imagePaths.length;
        let arr = [];
        for (let i = 0; i < total; i++) {
          const currentPath = imagePaths[i];

          arr.push(compareImages(currentPath, referencePath));
        }
        console.log(similarImages, "5");

        const results = (await Promise.allSettled(arr)) as {
          status: string;
          value?: {
            similarity: number;
            imageSize: string;
          };
          reason?: any;
        }[];
        console.log();
        results.forEach((result, i) => {
          imageDimensionsMap[imagePaths[i]] = result?.value
            ?.imageSize as string;
          if (Number(result?.value?.similarity) >= similarity)
            similarImages.push(imagePaths[i]);
        });
      } catch (error) {
        console.log(error);
      }
    }
  );

  return similarImages;
}

async function compareImages(imagePath: string, referencePath: string) {
  console.log(1);
  return new Promise(async (resolve, reject) => {
    try {
      const result = await workerPool!.execute({
        imagePath,
        referencePath,
      });
      console.log(result, "看起来一个都没有执行成功");
      resolve(result);
    } catch (error) {
      console.log(error, "看起来一个都没有执行失败");

      reject(error);
    }
  });
}
