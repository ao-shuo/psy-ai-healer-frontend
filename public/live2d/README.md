# Live2D 模型放置说明

把你的 Live2D 模型文件放到这个目录下，然后在页面中加载它。

默认加载路径：
- `/live2d/model.json`

你可以通过 URL 参数指定：
- `/live2d?model=/live2d/xxx/your.model3.json`

注意：
- 本仓库不包含任何 Live2D 商用模型资源，请自行准备可用模型与授权。
- 如果你在本地开发（Vite 5173）访问后端（8080），模型文件会由前端静态资源提供（`public/`）。

## Cubism 2 运行时（必须）

如果你的模型是 **Cubism 2**（常见的 `model.json`），需要额外放置官方运行时文件：
- `/public/live2d/live2d.min.js`

否则页面会提示：
`Could not find Cubism 2 runtime. This plugin requires live2d.min.js to be loaded.`
