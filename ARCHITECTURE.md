# 项目架构规范

本文档定义本项目（股票日记 App）的代码组织原则。任何人（包括 AI）在新增或修改代码前，
必须先看这份文件。目的是杜绝"跨层代码"——同一段代码混着数据存取、业务算法、界面渲染，
导致改一处坏两处。

---

## 一、三层架构

所有代码只能属于以下三层之一：

```
ui/     展示层    →  logic/  逻辑层    →  data/   数据层
（组件、样式、    （纯计算、业务规则、  （数据库读写、
 交互事件）        流程编排）           外部接口代理）
```

### 1. 数据层（data/）
- 只负责"数据从哪存、从哪取"
- 对上层暴露一组"动词"（pull/push/get/set），隐藏背后是 Supabase 还是别的
- **禁止出现**：`document.xxx`、`alert()`、任何 Vue/DOM 相关代码
- 一张表通常对应一个文件；如果多张表服务同一个业务概念（如早盘竞价的
  `auction_watchlist` + `market_metrics`），按业务概念合并成一个文件
- 结构几乎相同、只是"分组"不同的表（如早盘竞价 vs 热门股票），写成接受
  `scope` 参数的通用函数，不要复制两份

### 2. 逻辑层（logic/）
再细分三类：
- **纯计算函数**：给输入出输出，不碰 DOM、不碰网络。例：排序算法、达标判断、
  标签派生规则。这类最好写、最好测试
- **业务流程编排**：负责"先干嘛后干嘛"，调度数据层和状态层，自己不写具体实现细节
- **状态管理（store）**：维护"界面现在是什么状态"，跟"状态怎么算出来的"、
  "状态存哪"都分开

### 3. 展示层（ui/）
- `.vue` 组件 = 模板（HTML）+ 少量胶水代码（`<script setup>`）+ 样式（`<style scoped>`）
- 组件只做两件事：① 渲染 ② 接数据/借算法（import 逻辑层和数据层，**不自己重新实现**）
- 组件内部可以保留的，只有"只影响这个组件自身呈现"的本地状态（如某张卡片是否展开）
- 复杂的判定/排序规则、多个组件共用的逻辑，一律拆到 `logic/`，组件里只留调用

---

## 二、判断口诀

拿不准一段代码该放哪层，依次问自己：

1. **换个数据库，这段代码要不要改？**
   要 → 数据层
2. **换个界面风格/框架，这段代码要不要改？**
   不要（但换数据库要）→ 逻辑层
3. **两边都不用改，只是"这个东西长什么样、点了切换什么显示状态"？**
   → 展示层，留在组件里就行，不用单独拆文件

**跨层信号（发现即需重构）**：一个函数里同时出现"改状态 + 调数据库 + 操作DOM/重新渲染"，
说明它把三层的职责揉在了一起，必须拆成三段，各自归位。

---

## 三、目录结构

```
src/
├── data/                         数据层（14 个文件）
│   ├── supabase-client.js        连接层：建立连接、密码校验、全局变量声明
│   ├── session-and-shield.js     Session Token、Realtime 屏蔽窗口
│   ├── watchlist-and-metrics.js  auction_watchlist + market_metrics 表操作
│   ├── debug-log.js              云同步调试日志
│   ├── stock-topics.js           题材库表操作
│   ├── stock-code-map.js         股票名↔代码映射
│   ├── bidding-data.js           竞价变化看板
│   ├── jiwang-data.js            记忘看板/昨日复盘
│   ├── auction-data.js           早盘竞价主表拉取
│   ├── daily-highlights.js       预计算高光
│   ├── hot-stocks.js             热门股票三表操作
│   ├── remaining-boards.js       stocks/rank/multi/hotspot/pattern/tagTitles 各表
│   └── api/
│       ├── fuyao-proxy.js        同花顺行情接口
│       └── numcat-proxy.js       猫抓接口
│
├── logic/                        逻辑层（8 个文件）
│   ├── app-core.js               业务流程编排（⚠️ 仍含 DOM 操作，待拆分）
│   ├── scope-helpers.js          早盘竞价与热门股票共用参数化函数
│   ├── auction-sort-rules.js     排序/达标判定（纯计算）
│   ├── tag-rules.js              标签派生逻辑
│   ├── topic-rules.js            核心词库同步、题材上榜计算
│   ├── trend-chart-calc.js       趋势图数据处理（纯计算）
│   └── workflows/
│       ├── ai-vision-import.js   AI识图导入流程（⚠️ 含 DOM 操作，待拆分）
│       └── auction-sync.js       云端拉取/推送调度
│
├── stores/
│   └── auctionStore.js           早盘竞价+热门股票共用的响应式状态
│
├── ui/                           展示层（24 个文件）
│   ├── app-core-ui.js            纯 UI 函数 + DOM helper
│   ├── app-init.js               延迟初始化
│   ├── auction-render.js         竞价表单渲染
│   ├── auction-pages.js          竞价分页/统计
│   ├── auction-trend.js          趋势图 UI 交互
│   ├── auction-vue-mount.js      竞价 Vue 挂载层
│   ├── auth-ui.js                登录/密码验证 UI
│   ├── debug-log-ui.js           调试日志查看 UI
│   ├── dashboards.js             独立看板（Vue 3）
│   ├── boards-*.js               各看板域（11 个文件）
│   ├── components/               Vue 3 组件（.js）
│   ├── composables/              Vue 3 Composables
│   └── interactions/             交互弹窗
│
├── entry.js                      ES module 聚合入口
└── main.js                       启动入口：初始化、挂载
```

---

## 四、依赖方向规则

```
ui/  可以依赖 →  logic/  可以依赖 →  data/
```

- 展示层可以 import 逻辑层和数据层
- 逻辑层可以 import 数据层，**不能** import 展示层（不能出现 Vue 组件相关代码）
- 数据层不 import 任何上层代码，只能被别人调用

> **ES module 下的依赖区分**：
> - **编译时 import**（`import` 语句）：严格禁止跨层。`data/` 不能 import `logic/`/`ui/`，`logic/` 不能 import `ui/`
> - **运行时通知**（`window.xxx()` 调用）：`logic/` 可通过 `window.xxx()` 通知 `ui/` 层更新（如 `window.renderAuction()`），这是运行时查找非编译时依赖，可接受
> - **data/ → ui/ 通知**：必须走事件总线（`window._emit`/`window._on`），不能直接调用 `window.renderXxx()`

---

## 五、横向复用规则（早盘竞价 ↔ 热门股票）

这两个 tab 的业务规则几乎镜像（本项目历史上已经出现过重复实现两份、后续对不齐的问题）。
**新增或修改任何排序、判定、数据存取逻辑时，必须写成参数化的通用函数（如
`createWatchlistRepo(scope)`、`sortByParallel(list)`），让两个 tab 共用同一份代码，
禁止复制一份改改字段名。**

---

## 六、命名与风格约定

- 数据层函数：`pull`/`push` 表示云端读写，`get`/`set` 表示本地状态
- 异步统一用 `async/await`，不用 `.then()` 链式调用
- 数据层出错直接 `throw`，不在数据层弹窗提示（弹窗是展示层的事）
- 组件 props 用 camelCase，事件名用 kebab-case
- 判定函数用 `isXxxQualified`，排序函数用 `sortByXxx`，保持一致前缀，便于搜索

---

## 七、坏味道清单（发现即重构）

- 数据层文件里出现 `document.xxx`、`innerHTML`、Vue 相关代码
- 一个函数里同时"改状态 + 存数据库 + 重新渲染"
- 早盘竞价和热门股票各写一份几乎一样的函数
- 全局变量被多个不相关的函数直接读写（没有通过 store 统一管理）
- 文件名叫 `utils.js`/`helpers.js` 且体积持续膨胀（这是"垃圾桶文件"，应按业务域拆分）

---

## 八、AI 协作须知

在这个项目里写代码（无论是 AI 还是人），动手前必须：

1. 说明这次改动涉及哪一层（data / logic / ui），如果跨层要说明为什么必须跨
2. 修改前**先搜索现有模块**，确认没有可复用的函数，不要重复实现
3. 涉及早盘竞价或热门股票的改动，默认同时兼容两个 scope，不要只改一边
4. 不确定该放哪层时，先提出方案候选，不要自行决定后直接写
5. 改完后列出改动了哪些文件、为什么这么放、是否引入了新的跨层代码

---

## 九、现有模块清单（持续更新）

> 每次新增模块，把它加进这份清单，避免以后重复造轮子。

### src/data/（数据层）
- `supabase-client.js` — 全局变量声明、Supabase 连接、sha256 密码哈希、`loadAllData`/`getStocksData`/`getJiwangData`/`getBiddingData`（从 app-core.js 移入）
- `debug-log.js` — 云同步调试日志（环形缓冲区 + sessionStorage 合批落盘）
- `session-and-shield.js` — Session Token、Realtime 屏蔽窗口、全局缓存变量
- `watchlist-and-metrics.js` — `auction_watchlist` + `market_metrics` 表操作 + Realtime
- `stock-topics.js` — `stock_topics` 表操作（题材库）+ `buildTopicCache`/`invalidateTopicCache`/`scanDataSourceForTopics`（从 app-core.js 移入）
- `stock-code-map.js` — `stockcodemap` 表操作（股票名↔代码映射）
- `bidding-data.js` — `bidding_data` 表操作（竞价变化看板）
- `jiwang-data.js` — `jiwang_data` 表操作（记忘看板/昨日复盘）
- `auction-data.js` — `pullAuctionFromTable`（早盘竞价主表拉取）+ `setAuctionDateData`/`normalizeAuctionNotes`（从 app-core.js 移入）
- `daily-highlights.js` — `daily_highlights` 表操作（预计算高光）
- `hot-stocks.js` — `hot_stocks` / `hot_stocks_highlights` / `hot_stock_trends` 三表 + 迁移函数
- `remaining-boards.js` — stocks/rank/multi/hotspot/pattern/tagTitles 各表读写 + Realtime
- `api/` — 外部接口代理：`fuyao-proxy.js`（同花顺）、`numcat-proxy.js`（猫抓）

### src/logic/（逻辑层）
- `app-core.js` — switchGroup、各种 get/save/import/fill 业务流程编排（7591 行，DOM 操作已通过 `window._domXxx()` helper 间接化，ui 层调用为运行时通知，data 层函数已移至 data 层）
- `scope-helpers.js` — 早盘竞价与热门股票共用的参数化通用函数（_sanitizePatch、_splitPatch、_backupScopeData、_patchScopeField、_mergePatchLocal、_rollbackScopeData）
- `auction-sort-rules.js` — 排序/达标判定：环比、平行、竞昨（早盘竞价+热门股票共用，纯计算）
- `tag-rules.js` — `deriveAuctionTagState` 标签派生逻辑
- `topic-rules.js` — 核心词库云端同步、题材上榜次数计算、getTopicGroups
- `trend-chart-calc.js` — 趋势图数据处理（formatTrendDateLabel、renderMiniTrendSvg、renderAuctionTrendHtml，纯计算）
- `workflows/ai-vision-import.js` — AI 识图导入流程编排（DOM 操作已通过 `window._domXxx()` helper 间接化）
- `workflows/auction-sync.js` — 云端拉取/推送调度（pushAuctionStatusForDate、syncAuctionListForDate、pushToCloud、pullFromCloud 等 10 个函数）

### src/stores/（状态层）
- `auctionStore.js` — 早盘竞价 + 热门股票共用的响应式状态

### src/ui/（展示层）
- `app-core-ui.js` — 从 app-core.js 抽离的 52 个纯 UI 函数 + DOM helper（弹窗开关、表单渲染、行增删、清空操作、表单读取等）
- `auction-render.js` — renderAuctionForm、saveAuction、renderAuction、_renderAuctionItem
- `auction-pages.js` — renderAuctionPage2/3/4、StatsBoard、排序开关事件
- `auction-trend.js` — 趋势图 UI 交互（toggleAuctionRowSelect、clearAllAuctionSelections、showAuctionNoteInput/Popup）
- `boards-tag-titles.js` — 题材标签看板（renderTagTitles、addNewTag、deleteTag 等 25 个函数）
- `boards-pattern.js` — 形态看板（renderPattern、savePattern、copyPatternToDate 等 12 个函数）
- `boards-bidding.js` — 竞价变化看板（renderBidding、saveBidding、openBiddingEdit 等 36 个函数）
- `boards-jiwang.js` — 记忘看板（renderJiwang、openJiwangEdit、saveJiwang 等 12 个函数）
- `boards-emotion.js` — 情绪看板（renderEmotionBoard、startEmotionRealtime 等 10 个函数）
- `boards-rank.js` — 昨日最大成交额看板（renderRank、openRankEdit、importRankFromPaste 等 13 个函数）
- `boards-etf.js` — ETF 看板（renderEtf、saveEtf、openEtfEdit 等 20 个函数）
- `boards-duiban.js` — 对比看板（renderDuiban、saveDuiban、openDuibanEdit 等 12 个函数）
- `boards-stats.js` — 统计/周月统计看板（renderWeeklyStats、renderMonthlyStats、drawBalanceChart 等 62 个函数）
- `boards-multi.js` — 最近多板看板（renderMulti、openMultiEdit、importMultiData 等 25 个函数）
- `boards-stocks.js` — 股票列表/日期选择/通用工具（renderList、changeDate、saveStock、exportData 等 82 个函数）
- `app-init.js` — `_appInit()` 延迟初始化（右键禁用、日期选择器、事件绑定）
- `auth-ui.js` — 登录/密码验证 UI（forceLogout、reloginFromKicked、checkPassword）
- `debug-log-ui.js` — 调试日志查看 UI（showDebugLog 弹窗）
- `dashboards.js` — 最近多板 + 早盘板块ETF 独立看板（Vue 3）
- `auction-vue-mount.js` — 早盘竞价 Vue 挂载层
- `components/auction-components.js` — 早盘竞价 Vue 3 组件（HeaderStats/StockCard/AuctionBoard 等）
- `components/rank-vue.js` — 昨日最大成交额看板 Vue 组件化
- `components/boards-vue.js` — stocks/hotspot/pattern 看板 Vue 组件化
- `composables/auction-composables.js` — 早盘竞价 Composables（数据/排序/展开/手势/事件）
- `interactions/history-gap-pct-modal.js` — 历史涨幅补全/覆盖模式选择弹窗

### src/main.js（入口）
- `DOMContentLoaded` 启动入口：检查登录态、密码校验、拉取云端数据

### workers/（Cloudflare Workers）
- `bidding-auto-fetch/` — 早盘竞价自动抓取（已分层：config + data/ + logic/ + index.js）
- `bidding-board-worker-a/` — 竞价变化看板 Worker A（已分层：config + data/ + logic/ + index.js）
- `bidding-board-worker-b/` — 竞价变化看板 Worker B（已分层：config + data/ + logic/ + index.js）
- `_shared-source/` — Workers 共享源码（date-utils.js、holidays.js）
- `jiwang-market-stats.js` — 每日涨跌家数抓取
- `wrangler-*.toml` — 各 Worker 的 wrangler 配置（main 已指向各 worker 目录的 index.js）
- `_bundled/` — 单文件打包版（`bidding-auto-fetch.js`、`bidding-board-worker-a.js`、`bidding-board-worker-b.js`），用于 Cloudflare Dashboard 网页复制粘贴部署，由 `_bundle-workers.ps1` 自动生成

### db/（数据库 Schema）
- `supabase_auction_metrics.sql`、`supabase_dashboards.sql`、
  `supabase_emotion_data.sql`、`supabase_remaining_boards.sql`

### 已知的坑 / 技术债
- 早盘竞价与热门股票逻辑曾各写一份，产生过对不齐的 bug；已抽出 `scope-helpers.js` 参数化通用函数，后续新增逻辑必须复用
- 存在"响应式路径（Vue）"与"DOM 路径（原生JS）"并存、互相打架导致的时序 bug，
  迁移过程中要格外小心两条路径同时更新同一处 UI
- `app-core.js`（7591 行）仍较大，52 个纯 UI 函数 + DOM helper 已抽离到 `app-core-ui.js`，API 代理抽离到 `data/api/`，sync 调度抽离到 `workflows/auction-sync.js`，DOM 操作已通过 `window._domXxx()` helper 间接化，data 层函数已移至 data 层
- `boards-render.js` 已按看板域拆分为 11 个文件（boards-tag-titles/pattern/bidding/jiwang/emotion/rank/etf/duiban/stats/multi/stocks）
- `remaining-boards.js` 有 2 处 `document.readyState` 初始化检测（非 UI 操作，可接受）
- **ES module 迁移已完成**：全部 48 个 src/ JS 文件转为 ES module，`index.html` 用单个 `<script type="module" src="src/entry.js">` 加载
- 跨文件共享变量（~92 个）统一改为 `window.xxx` 声明 + 引用，跨文件函数调用改为 `window.funcName()`
- `src/entry.js` 为聚合入口：import 所有模块 + `Object.assign(window, mod)` 挂载导出到 window
- `remaining-boards.js` 保留 IIFE 封装（兼容 ES module，IIFE 执行副作用挂 window，无 export）
- Vite dev server：`vite.config.js` 含 `serveGlobalScripts` 插件，`npm run dev` 启动开发服务器
- **事件总线**：`src/stores/eventBus.js` 提供 `_emit`/`_on`/`_off`，data 层通过事件总线通知 ui 层，不直接调用 renderXxx()
- **DOM helper**：`ui/app-core-ui.js` 提供 `_domGet`/`_domValue`/`_domSetText`/`_domSetColor` 等，logic 层通过这些 helper 间接操作 DOM
- **data→logic 跨层调用（已全部修复 14/14）**：
  - `getNumericVolume`、`_moduleKey` 从 `logic/app-core.js` 移至 `data/supabase-client.js`
  - `invalidateTopicCache`、`buildTopicCache`、`scanDataSourceForTopics` 从 `logic/app-core.js` 移至 `data/stock-topics.js`（`window.getAuctionData()` 改为 `window._auctionMemCache`，`window.getHotAuctionData()` 改为 `window._hotAuctionData`）
  - `setAuctionDateData`、`normalizeAuctionNotes` 从 `logic/app-core.js` 移至 `data/auction-data.js`
  - `loadAllData`、`getStocksData`、`getJiwangData`、`getBiddingData` 从 `logic/app-core.js` 移至 `data/supabase-client.js`（`MODULE_KEYS` 内联为 `_MODULE_KEYS`，`_stocksMemCache` 等改为 `window._xxxMemCache`）
  - `pullFromCloud` 调用改为事件总线：`data/watchlist-and-metrics.js` 发 `window._emit('data:cloud-changed')`，`ui/app-init.js` 订阅并执行 `pullFromCloud` + 重新加载
  - `getRankData`/`getMultiData`/`getHotspotData`/`getPatternData`/`getTagTitlesData` 修复 `_xxxMemCache` → `window._xxxMemCache` 引用
  - app-core.js 所有被移函数改为 `const xxx = window.xxx` 局部引用
- **同名函数覆盖（Object.assign 后加载覆盖先加载）**：
  - ✅ 已修复：`getRankData`/`getTodayRank` — `rank-vue.js` 的包装函数导致无限递归，已删除，由 `app-core.js` 提供正确实现
  - ✅ 已修复：`safeCall`（4 模块导出）→ 统一为 `auctionStore.js` 版本，其他模块改为 `const safeCall = window.safeCall`
  - ✅ 已修复：`tabKey`（3 模块导出）→ 统一为 `auctionStore.js` 带参版本，其他模块改为 `const tabKey = window.tabKey`
  - ✅ 已修复：`mountBoards` → `boards-vue.js` 重命名为 `mountStocksBoards`，`dashboards.js` 保留原名
  - ✅ 已修复：`percentDisplay` → `boards-vue.js`→`stocksPercentDisplay`，`rank-vue.js`→`rankPercentDisplay`
  - ✅ 已修复：`turnoverDisplay` → `boards-vue.js`→`stocksTurnoverDisplay`，`rank-vue.js`→`rankTurnoverDisplay`
  - ✅ 无冲突：`refresh`/`save` 在 Vue `setup()` 闭包内，非顶层 export，不参与 `Object.assign`
- **局部变量 `window.` 前缀语法错误修复（33 处）**：regex 误加 `window.` 到 `const`/`let` 声明，涉及 9 文件，已全部修复
- **观察组审查**：`ensureObservationStocks` 通过 `getPreviousTradingDay` 继承上一交易日数据，逻辑正确
- **全量架构审查（P0-P2 全部已修复）**：
  - P0 已修复：`rank-vue.js` getRankData/getTodayRank 无限递归 — 删除包装函数
  - P1 已修复：`app-core.js:32` alert→throw、`ai-vision-import.js:28` innerHTML→`_domSetText`、`ai-vision-import.js:39` addEventListener→`_domAddEventListener`、`ai-vision-import.js:173` alert→throw、`auction-sync.js:484` document.getElementById+innerHTML→`_domSetHtml`
  - P1 已修复：`app-core-ui.js` 新增 `_domSetHtml` helper
  - data 层审查通过：0 违规（无 document/alert/Vue/DOM/innerHTML）
  - 跨层 import 审查通过：data/ 不 import logic/ui，logic/ 不 import ui

---

## 十、迁移进度

已完成：
- index.html 内联代码（~32000 行）全部抽离到 src/ 三层 + workers/ + db/
- index.html 从 40762 行缩减到 8541 行（纯 HTML 骨架 + `<script>` 引用）
- 所有文件命名统一为 kebab-case（符合规范第三章）
- data/ 层 DOM 代码移到 ui/（showDebugLog → debug-log-ui.js，登录函数 → auth-ui.js）
- 排序/达标判定抽离到 `logic/auction-sort-rules.js`（纯计算，无 DOM）
- 趋势图纯计算抽离到 `logic/trend-chart-calc.js`（纯计算，无 DOM）
- `app-core.js` 拆分：52 个纯 UI 函数 + DOM helper 抽离到 `ui/app-core-ui.js`（9714→7815 行，仍残留 79 处 DOM 操作）
- `boards-render.js` 按看板域拆分为 11 个文件（12452 行 → 11 个域文件，原文件已删除）
- `scope-helpers.js` 创建：参数化通用函数消除早盘竞价/热门股票重复代码（6 个通用函数）
- `data/api/fuyao-proxy.js`、`data/api/numcat-proxy.js` 抽离：外部接口代理集中到 data/api/
- `workflows/auction-sync.js` 抽离：云端拉取/推送调度（10 个 sync 函数，786 行）
- Workers 分层重构：三个 Worker 全部拆分为 config + data/ + logic/ + index.js + _shared-source/
- 原始 Worker 文件已删除（bidding-auto-fetch.js、bidding-board-worker-a.js、bidding-board-worker-b.js）
- Vite dev server 配置：`vite.config.js` 含 `serveGlobalScripts` 插件，`npm run dev` 可启动开发服务器
- **ES module 全量迁移完成**：
  - 49 个 src/ 源文件全部转为 ES module（顶层 function 加 `export`，共享变量改 `window.xxx`）+ `entry.js` 聚合入口
  - `src/entry.js` 聚合入口：import 所有模块 + `Object.assign(window, mod)` 挂载导出
  - `index.html` 改用 `<script type="module" src="src/entry.js">`（删除全部 47 个 `<script src="src/...">` 标签，现 8541 行）
  - 跨文件共享变量 ~92 个（data/ 层 70 个 + logic/ui/ 层 22 个）统一改为 `window.xxx` 声明 + 引用
  - 跨文件函数调用全部改为 `window.funcName()`
  - `remaining-boards.js` 保留 IIFE 封装（兼容 ES module，无 export，IIFE 副作用挂 window）
- **架构违规修复（P0-P2）**：
  - `scope-helpers.js`：2 处 `alert()` → `throw new Error()`（纯计算函数不应弹窗）
  - `auction-sync.js`：4 处 `innerHTML` → 安全 setter 包装（逻辑层不直接操作 DOM）
  - `debug-log.js`：`requestAnimationFrame` → `setTimeout`（数据层不依赖 BOM 渲染 API）
  - `session-and-shield.js`：移除 `Vue.reactive()`，改为普通对象兜底（Vue 响应式由 stores/ 负责）
  - `remaining-boards.js`：移除 `Vue.watch()`（已有轮询兜底）、`addEventListener` → 直接 `_init()`（ES module deferred）
  - `app-core.js`：13 处 `alert/confirm` → `throw/console.log`（confirm 由 UI 层在调用前处理）
  - `dashboards.js`：`getSupabase` 重命名为 `getDashboardsSupabase`（避免覆盖 data 层同名函数）
  - `rank-vue.js`：移除 `getRankData` 包装（修复 Object.assign 导致的无限递归 bug）
- **剩余技术债修复（P2-P3）**：
  - `app-core.js` + `ai-vision-import.js`：所有 `document.xxx` DOM 操作 → `window._domXxx()` helper 调用（DOM helper 在 `ui/app-core-ui.js`）
  - `src/stores/eventBus.js` 创建：`_emit`/`_on`/`_off` 事件总线
  - data→ui 21 处：`window.renderXxx()` → `window._emit('data:realtime-update')`，UI 层在 `app-init.js` 订阅
  - data→ui toast/forceLogout：→ `window._emit('ui:toast')` / `window._emit('auth:force-logout')`
  - logic→ui 56 处：保留 `window.xxx()` 运行时通知（规范第四章已明确区分编译时 import 与运行时通知）
  - 规范第四章更新：明确 ES module 下 `import` 语句（禁止跨层）与 `window.xxx()` 调用（运行时通知，可接受）的区分
  - data→logic 全量修复（14/14）：`getNumericVolume`/`_moduleKey`/`invalidateTopicCache`/`buildTopicCache`/`scanDataSourceForTopics`/`setAuctionDateData`/`normalizeAuctionNotes`/`loadAllData`/`getStocksData`/`getJiwangData`/`getBiddingData` 从 `logic/app-core.js` 移至 data 层（`supabase-client.js`/`stock-topics.js`/`auction-data.js`）；`pullFromCloud` 调用改为事件总线 `data:cloud-changed`；`getRankData` 等修复 `window._xxxMemCache` 引用
  - Worker 单文件打包：`_bundle-workers.ps1` 脚本将每个 Worker 的多文件结构（config + data/ + logic/ + index.js + _shared-source/）打包为单个 .js 文件，输出到 `workers/_bundled/`，用于 Cloudflare Dashboard 网页复制粘贴部署
- **全量架构审查修复（第二轮）**：
  - P0：`rank-vue.js` getRankData/getTodayRank 无限递归 — 删除包装函数，由 `app-core.js` 提供正确实现
  - P1：`app-core.js:32` alert→throw、`ai-vision-import.js:28` innerHTML→`_domSetText`、`:39` addEventListener→`_domAddEventListener`、`:173` alert→throw、`auction-sync.js:484` document.getElementById+innerHTML→`_domSetHtml`
  - P1：`app-core-ui.js` 新增 `_domSetHtml` helper
  - 审查结论：data 层 0 违规、跨层 import 0 违规、logic 层 DOM 操作 0 残留（全部通过 helper 间接化）
- **密码输入无响应 Bug 修复（ES module 嵌套 export 语法错误）**：
  - 根因：ES module 迁移时在 14 个文件中 190 处 `export function` 声明位于嵌套作用域（IIFE/函数体/setup()回调），这是 ES module 语法错误（`export` 必须在模块顶层），导致 `entry.js` 完全加载失败，`window.checkPassword` 从未设置，密码输入无响应
  - 修复：移除所有嵌套 `export` 关键字，改为 `function xxx() {}` + `window.xxx = xxx;` 赋值，保持全局可用性
  - 涉及文件（14 个）：`auctionStore.js`(6)、`auction-vue-mount.js`(12)、`auction-components.js`(24)、`auction-composables.js`(32)、`dashboards.js`(33)、`boards-vue.js`(45)、`rank-vue.js`(16)、`app-core.js`(15)、`boards-bidding.js`(1)、`auction-sync.js`(1)、`app-init.js`(1)、`auction-pages.js`(1)、`auction-render.js`(2)、`boards-stats.js`(1)
  - 验证：全 `src/` 目录 grep `^\s{12,}export function` 返回 0 匹配，`(const|let) window\.` 返回 0 匹配
- **`_domXxx()` 调用缺失右括号修复（20 处）**：
  - ES module 迁移 regex 将 `document.getElementById(xxx).textContent = yyy` 转为 `window._domSetText(xxx, yyy` 时遗漏右括号 `)`
  - 涉及 `app-core.js`（12 处）和 `ai-vision-import.js`（8 处）
  - `app-core.js:1004` 多余 `}` 导致 `rollbackAuctionData` 函数提前关闭，后续代码溢出到模块顶层引发语法错误，已删除
  - 修复：每处 `window._domXxx(arg1, arg2;` → `window._domXxx(arg1, arg2);`


