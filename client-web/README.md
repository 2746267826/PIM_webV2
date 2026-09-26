# PIM 前端（client-web）

基于 `../frontend-rebuild-spec/` 重建的 PIM 前端：一套 React 19 SPA，服务 Windows 与 Android（手机/平板），双壳分发（Capacitor Android / Tauri Windows）。

## 文档

- [docs/DESIGN.md](docs/DESIGN.md) —— 视觉规范（浅色效率 · 效率蓝 · 柔和描边 · 紧凑密度），tokens 唯一来源 `src/styles/tokens.css`
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) —— 工程约定（网络层/轮询/枚举/URL 状态/坑位自检清单）

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（/api 代理 → http://localhost:5858）
npm run test         # vitest 单测
npm run build        # tsc + vite build → dist/
node scripts/mock-api.mjs   # P0 视觉走查用 mock API（:5858，仅登录/会话/状态/版本）
```

### Android 壳（Capacitor）

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug   # 产物 ~9.2MB
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

本机构建要求（已验证通过）：
- `ANDROID_HOME` 指向 `%LOCALAPPDATA%\Android\Sdk`
- `JAVA_HOME` 需指向**完整 JDK**（默认 Adoptium 是 JRE 无 javac；已验证用 Android Studio 自带 `C:\Program Files\Android\Android Studio\jbr`，JDK 21）
- 本沙箱网络需 JVM 代理：`-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=12000 -Dhttp.proxyHost=... -Dhttp.proxyPort=...`（仓库同时配置了阿里云镜像作为无代理环境的回退）

完整命令：

```bash
cd android && JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" \
  ./gradlew assembleDebug -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=12000 -Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=12000
```

壳内首次启动会进入 `/setup` 填写 API 地址（`lib/apiBase.ts`，存 `pim.apiBase`）。

### Windows 壳（Tauri）

依赖 Rust 工具链（本机未装 cargo，P5 阶段接入）：`npm run build && npx tauri build`。

## 目录

```
src/app        路由/守卫/外壳/providers/nav
src/api        域 client + 类型（apiFetch 401 单飞刷新）
src/lib        apiBase / polling / enums / businessDay / storage / notify
src/components/ui    设计系统原语
src/features/<域>    pages / components / hooks / queries
src/embed/android    无壳内嵌页 + pimAndroid 桥（P4）
android/       Capacitor Android 工程
```

## 实施阶段

P0 骨架与标准 ✅ → P1 今日/日历/任务/确认 → P2 工作台/提醒/报告/习惯/快速记录/数据中心 → P3 PC/浏览器/手机/位置/设备/状态 → P4 文件/设置域/知识库/内嵌+桥 → P5 双壳与打磨。
