import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const extensionConfig = {
  entry: {
    extension: "./src/extension.ts",
    "workers/find-pictures-worker": "./src/workers/find-pictures-worker.ts",
    "workers/calculate-image-dimensions-worker":
      "./src/workers/calculate-image-dimensions-worker.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
  },

  resolve: {
    extensions: [".ts", ".js"],
  },
  externals: {
    vscode: "commonjs vscode",
    canvas: "commonjs canvas",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  mode: "production",
  target: "node",
};

export default [extensionConfig];
