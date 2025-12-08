//@ts-check

"use strict";

const path = require("path");

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: "node", // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  entry: {
    extension: "./src/extension.ts",
    "workers/find-pictures-worker": "./src/workers/find-pictures-worker.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
  },
  externals: {
    vscode: "commonjs vscode",
    canvas: "commonjs canvas",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  optimization: {
    splitChunks: false, // 禁用代码分割，避免Worker引用extension的chunk
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
  devtool: "nosources-source-map",
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};
module.exports = [extensionConfig];
