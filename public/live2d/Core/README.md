# Cubism Core 放置说明

本项目前端使用 `easy-live2d`（Cubism 5）渲染 Live2D，需要 **Live2D Cubism Core**。

你需要从官方 **Live2D Cubism SDK for Web** 下载包中找到：

- `Core/live2dcubismcore.js`

然后复制到本目录，最终路径必须是：

- `public/live2d/Core/live2dcubismcore.js`

验证方式（启动前端 dev server 后）：

- 在浏览器打开 `http://localhost:5173/live2d/Core/live2dcubismcore.js`
  - 能看到一段 JS 内容（不是 404），说明文件已被 Vite 正常托管

注意：
- 该文件属于 Live2D 官方 SDK 组件，本仓库不内置。
