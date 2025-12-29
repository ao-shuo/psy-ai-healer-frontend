# Live2D 模型放置说明

把你的 Live2D 模型文件放到这个目录下，然后在页面中加载它。

默认页面：`/live2d`

你可以通过 URL 参数指定模型：
- `/live2d?model=/live2d/xxx/your.model3.json`

本仓库当前已包含一个可用的公开模型（工作区根目录的 `mao_pro_en` 已复制到这里）：
- `/live2d?model=/live2d/mao_pro_en/mao_pro.model3.json`

注意：
- 本仓库不包含任何 Live2D 商用模型资源，请自行准备可用模型与授权。
- 本项目前端使用 `easy-live2d`（Cubism 5 / model3.json 体系）进行渲染。

## Cubism 5 Core（easy-live2d 必须）

`easy-live2d` 需要你从 Live2D 官网下载 **Live2D Cubism SDK for Web**，并把 Core 放到前端静态目录。

请放置文件：
- `public/live2d/Core/live2dcubismcore.js`

并确保入口页面已引入：
- `index.html` 中：`/live2d/Core/live2dcubismcore.js`

## Cubism 2（可选：如果你仍在使用 model.json）

如果你的模型是 **Cubism 2**（常见 `model.json`），通常需要 Cubism 2 运行时（例如 `live2d.min.js`）。
但本项目的默认实现面向 Cubism 5（`*.model3.json`）。建议优先使用 Cubism 5 模型。
