# MiniJAM Website

MiniJAM 官网静态站点。原生 HTML + CSS + JavaScript，无构建工具、无运行时依赖。

## 目录结构

```text
.
├── .github/
│   └── workflows/
│       └── deploy-pages.yml   # 手动触发的 GitHub Pages 部署
├── site/                      # 唯一部署目录
│   ├── index.html             # 首页（Hero 动效 + 路线图）
│   ├── favicon.ico
│   ├── genesis/
│   │   └── index.html         # Genesis Pool 占位页
│   └── assets/
│       ├── minijam-logo.svg   # MiniJAM Logo
│       ├── styles.css         # 全站样式
│       └── app.js             # Canvas 粒子/曲线动画
└── README.md
```

## 本地预览

在仓库根目录运行：

```bash
python3 -m http.server 4173 --directory site
```

浏览器打开：

- 首页：http://localhost:4173/
- Genesis 页面：http://localhost:4173/genesis/

不要直接双击 `index.html` 作为唯一测试方式——相对路径与目录入口行为和 HTTP 服务不同。

## 部署（GitHub Pages）

部署通过 GitHub Actions 手动触发，普通提交不会自动发布。

一次性仓库设置（管理员执行）：

1. 打开仓库 `Settings` → `Pages`。
2. 在 `Build and deployment` 下将 `Source` 设置为 `GitHub Actions`。

发布流程：

1. 打开仓库 `Actions`。
2. 选择 `Deploy GitHub Pages` 工作流。
3. 点击 `Run workflow`，选择默认分支并确认。
4. 部署完成后，从 `github-pages` environment 或 workflow 输出中打开站点 URL。

工作流只上传 `site/` 目录，不创建 `gh-pages` 分支，也不向仓库回写生成文件。

## 自定义域名（可选）

确认公开域名后：

1. 在 GitHub Pages 设置中填写 Custom domain 并按提示配置 DNS。
2. 开启 Enforce HTTPS。
3. 将域名写入 `site/CNAME`。

在此之前不要创建 `CNAME` 文件。

## 技术说明

- 无框架、无 npm、无外部 CDN/字体，所有资源随站点一起发布。
- Canvas 动画遵循 `prefers-reduced-motion`，页面不可见时自动暂停。
- 所有站内链接使用相对路径，兼容 GitHub Project Pages（`https://<org>.github.io/<repo>/`）。
