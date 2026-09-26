# PIM 前端重建实施计划 v0.3（页面设计细化版）

## 已锁定决策
- 形态：React 19 SPA + 双壳（Capacitor 7 Android APK / Tauri 2 Windows）；壳加载 API 同源伺服的 SPA；`window.pimAndroid` 桥用 Capacitor 插件按 03 §6 契约实现。
- 组件栈：Tailwind 4 + shadcn/ui + TanStack Query/Table/Virtual；图表 ECharts 5；日历 FullCalendar v6；地图 Leaflet 1.9（瓦片走 /api/v1/tiles）；编辑器 TipTap 2；表单 RHF+zod；Toast sonner+自研去重；自研 apiFetch（Bearer、解包、401 单飞刷新、HTML 识别、409/412 白名单）。
- 视觉（定稿）：浅色效率单主题 · 效率蓝 #2563EB · 柔和描边风（卡片 12px 圆角+1px 边+极浅阴影）· 紧凑密度（表格行 40/36px）· 浅色同底侧边栏（#F8FAFC+右边框，行高 36px，选中 #EFF6FF+#1D4ED8+左缘 3px 指示条）。
- 设计 tokens（写入 styles/tokens.css 唯一颜色来源）：Slate 中性系（bg#FFF/surface#F8FAFC/surface-2#F1F5F9/border#E2E8F0/divider#EEF2F6/text #0F172A→#94A3B8）；语义三件套 ok#16A34A/warn#D97706/crit#DC2626/info#0EA5E9/neutral#64748B（实色+soft 底+边框）；热力 5 档 ramp #F1F5F9→#1D4ED8；手机生活分类 8 色固定映射；图表 10 色序列；服务端图层色（任务段#22C55E/习惯#A855F7/可用#0EA5E9/AI#F97316）为准。字体 Inter+Noto Sans SC（@fontsource 本地）+JetBrains Mono；字阶 24/16/14/13/12+metric 28 tabular-nums。断点 <640 手机（抽屉导航/表格卡片化/56px 顶条/FAB）、640–1279 平板（64px 图标栏）、≥1280 桌面（232px 侧边栏）。动效 120/200/240ms，reduced-motion 全禁。README 22 个"形式"词汇全部落为 ui 原语。

## 页面清单（40+ 路由，导航 16 项分 5 组：工作=今日/日历/工作台/任务/确认；洞察=电脑记录/浏览器使用/手机记录/历史位置；收集=快速记录/文件；治理=数据中心/提醒/报告/习惯；系统=设置+状态点）
逐页功能按规格 02 模块清单实现，结构性变化三处：
1. **新增 /setup 首启向导**与 **/settings/server 服务器设置**：API 地址为一等配置。存储 localStorage `pim.apiBase`（空=同源）；测试连接=GET /api/version；保存后清令牌+queryClient.clear()→/login；最近 5 条地址历史；入口 4 处（壳内无地址强制 /setup、设置卡、侧边栏底部常显当前服务器、登录页"更换服务器"）；所有 URL 统一走 lib/apiBase.ts 的 apiUrl() 拼接（含瓦片/下载/Graph 上传例外逻辑）。
2. **新增 /settings/microsoft 合并页**：Outlook 日历同步与 OneDrive 文件绑定放一起，双 Tab+顶部共享状态条；各自 Client ID 字段并排（后端本独立存储，提示可同 ID）；共享 DeviceCodeFlow 组件（Outlook 3s / OneDrive 5s 轮询）；文件页未绑定引导、工作台状态卡、日历重授权横幅统一跳 `?tab=outlook|onedrive`。
3. **侧边栏分组展示**（16 项不变）+ 手机抽屉同构。

其余页面（今日/日历/工作台/任务/确认中心/PC 记录/浏览器使用/手机记录/历史位置/设备管理/快速记录/文件/数据中心/提醒/报告/习惯/状态/8 个设置子页/应用知识库/审计/端点外壳/展览馆/Android 内嵌×2/登录/404）严格按 01+02 规格的模块×形式×接口×数据行为实现：轮询注册表（标准昼夜 5/30min、延迟、固定 10s/5s/3s、条件 2s、60s、30s+45s）、URL 即状态、localStorage pim.* 登记、三态成对、破坏性确认三档（影响预览/输入确认/两步武装）、上传双通道引擎（≤4MB multipart、>4MB Graph 会话 10MiB 分片 Content-Range/nextExpectedRanges 续传且分片 PUT 无认证头、>2GB 拒绝）、下载 download-url+window.open（>100MB 确认）、cursor 分页（轨迹原始点）、ICS 导入导出、数字枚举归一化、业务日 04:00 工具、CSV 带 BOM。

## 标准文档（P0 产出）
docs/DESIGN.md（上述设计系统全文+组件尺寸+图表主题+动效）、docs/CONVENTIONS.md（queryKey 工厂与失效清单、轮询注册表、apiBase 约定、URL 状态、localStorage 键、枚举归一化、CORS 与壳网络通道注意事项）。

## 目录
src/{app, api, lib(含 apiBase/polling/业务日/storage), components/{ui,viz}, features/<域>/{pages,components,hooks,queries}, embed/android, styles} + android/(Capacitor+PimBridge 插件) + src-tauri/。

## 六阶段
P0 骨架与标准：脚手架+tokens+原语第一批+apiFetch/apiBase/轮询/枚举归一化+路由与认证+登录+响应式外壳+**/setup 与 /settings/server（API 地址功能最先落地）**+Capacitor/Tauri 接入。
P1 核心闭环：今日、日历（拖选/拖放排期/收件箱侧板/Outlook 冲突 UI）、任务、确认中心。
P2 计划与记录：工作台、提醒、报告、习惯、快速记录（TipTap）、数据中心、审计。
P3 分析驾驶舱：PC 记录（甘特/热力/108 键矩阵/标注队列/生产力）、浏览器使用、手机记录（含存活视图）、历史位置（Leaflet+cursor 分页）、设备管理、状态页。
P4 文件与设置域：OneDrive 三栏+上传引擎、/settings/microsoft 合并页、其余设置子页、应用知识库、端点外壳、/embed/android×2+桥。
P5 壳与打磨：APK/安装包、懒加载、全页渲染截图视觉验收、三态复查。

## 验证
vitest：apiFetch 刷新单飞/HTML 识别、apiBase 拼接与切换清缓存、业务日、轮询注册表、枚举归一化、DeviceCodeFlow 轮询状态机。手工矩阵：Windows Chrome/Edge、Android 手机(<640)、平板横屏(≥1024)、壳内真机。坑位自检：双态端点、PagedResult.totalCount、outlook batches 字段 total、409/412、302 下载、/status/ 尾斜杠、token 15min/refresh 7 天轮换、429 Retry-After、CORS 白名单。

## 首批命令
pnpm create vite（React+TS）→ 安装 tailwind/shadcn/tanstack/echarts/fullcalendar/leaflet/tiptap/sonner/zod/@fontsource → capacitor add android → tauri init。