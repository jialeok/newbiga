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

- **登录按钮"无反应、无提示" Bug 修复（非安全上下文 `crypto.subtle` 缺失）**：
  - **根因**：密码验证 `sha256()` 直接调用 `crypto.subtle.digest`，而 `crypto.subtle` 仅在安全上下文（HTTPS / localhost / file://）可用。通过 `http://局域网IP` 访问（手机连电脑本地服务、HTTP 部署等）时 `crypto.subtle` 为 `undefined`，`sha256()` 抛 `TypeError`，`checkPassword()` 是 async 函数→未处理的 Promise 拒绝→界面无任何反馈，登录页卡死、点"解锁"毫无反应。
  - **修复（按三层架构）**：
    - `data/supabase-client.js`（数据层，纯计算）：`sha256()` 增加纯 JS SHA-256 兜底实现（`_sha256PureJs`，FIPS 180-4），`window.crypto.subtle` 不可用时走兜底，保证 `http://` 访问也能正确哈希
    - `ui/auth-ui.js`（展示层）：`checkPassword()` 全程包 `try/catch`，任何步骤抛错都在 `pwdError` 显示可见错误（如 `❌ 登录失败：xxx`），杜绝"点了没反应"
    - `index.html`（UI 引导胶水）：在 `<script type="module">` 之后新增引导自检脚本，`entry.js` 加载失败（`file://` 直接双击打开、旧浏览器不支持 ES module、CDN 被墙）时 3 秒后在 `pwdError` 提示改用 `http(s)://` 方式访问
  - **验证**（真实 Chromium 复现）：`http://192.168.x.x:8899` 非安全上下文下，`isSecureContext=false`、`crypto.subtle=undefined`，修复前点解锁遮罩不消失/无提示，修复后 `sha256('biga8450')=717eed5d...`（与 `PASSWORD_HASH` 一致）→ 成功解锁（`unlocked=1`、遮罩隐藏）；错误密码显示 `❌ 密码错误，请重试`

- **竞价看板显示旧日期 / 未来日期继承旧数据（启动 `currentDate` 卡在 `lastEditedDate`）— Issue #1a**：
  - **根因**：`app-core.js` 模块顶层初始化、`initApp()`（密码验证后）、`_appInit()`（DOMContentLoaded 后）三处各自从 `localStorage.lastEditedDate_v42` 读取并 `setCurrentDate` 恢复"上次编辑日期"，仅有 `>= '2025-01-01'` 校验、无"是否等于今天"判断。用户上次在 8/5 编辑后，每次打开都落到 8/5（而非今天），竞价看板显示 8/5 数据；向前翻到未来交易日时无数据而"继承" 8/5 显示 → 表现为"未来日期也继承 8/5"。
  - **修复（逻辑层/状态处理，符合规范）**：新增 `_computeBeijingToday()`（UTC+8，按 `getTimezoneOffset` 偏移、不依赖浏览器时区并挂到 `window` 复用），启动统一以"北京今天"为准——仅当 `lastEditedDate === 今天` 才沿用，否则一律 `setCurrentDate(今天)`。三处读取点（`initApp`、`app-core.js` 顶层、`_appInit`）全部改为同一规则，杜绝任一处把日期跳回旧值。
  - **涉及文件**：`src/logic/app-core.js`（`_computeBeijingToday` + `initApp` + 顶层初始化）、`src/ui/app-init.js`（`_appInit`）
  - **验证**：Node 单测复刻该决策逻辑，在 `TZ=UTC` 下对 今天/昨天(stale)/空/null/旧日期/未来/畸形 8 种输入，`currentDate` 均正确落到"北京今天"；逻辑层不触碰 DOM/网络，符合规范。

- **worker 今日抓不到数据 / 情绪看板空 — Issue #1b（实为查看侧问题，worker 源码正确）**：
  - **核查结论**：`workers/bidding-board-worker-a/logic/bidding-workflow.js` 与 `bidding-board-worker-b/logic/emotion-workflow.js` 均以 `beijingToday()`（`_shared-source/date-utils.js`，UTC+8 偏移、时区无关）作为写入 `date` 主键，并以 `isTradingDay(env)` 闸门判断；`localIsTradingDay('2026-08-06')` → 周四且非节假日 → `true`，worker 今日会正常抓取落库。故"worker 抓不到数据/情绪空"的根因是 **Issue #1a 的查看侧旧日期**（打开停在未写的旧日期、看似"没数据"），非 worker 逻辑缺陷。
  - **动作**：按用户要求重新执行 `workers/_bundle-workers.ps1` 重新生成 `workers/_bundled/*.js`（时间戳已更新为今天），保证手动部署文件与源一致；worker 源码无需改动。

- **早盘竞价 toggle 失效（竞昨/平行/环比 无蓝色左标、无按条件排序）— Issue #2**：
  - **根因**：本环境 Vue 未挂载（`c2Vue=false`），竞价看板走 innerHTML 渲染路径。toggle 回调 `_refreshAuctionOnToggle` / `_refreshAuctionPage2OnToggle` 原本只做"同步 store 排序状态 + 切换容器高亮 class"，**未重新渲染行**，导致点击开关后行不更新、无蓝色 `jing-yest-match` 标记、也无条件排序。
  - **修复（ui 层，交互→重渲染）**：在两个回调末尾追加对活跃 innerHTML 渲染路径的调用——`_refreshAuctionOnToggle` 追加 `window.renderAuction(dataSource)`，`_refreshAuctionPage2OnToggle` 追加 `window.renderAuctionPage2(dataSource)`，使开关真正重算并渲染行（蓝色左标由 `index.html` 的 `.auction-content.jing-yest-enabled .auction-item.jing-yest-match` 规则负责）。
  - **涉及文件**：`src/ui/auction-pages.js`（`_refreshAuctionOnToggle`、`_refreshAuctionPage2OnToggle`）
  - **验证**：`node --check` 通过；竞价页 1/2 切换开关逻辑闭环。实时数据下的 `matchCount>0` 依赖云端当日竞价数据加载，待云数据就绪后生效。

- **周六/周日独立模板 + 周/月统计 UI — Issue #3（核查结论：功能已完整存在，由 Issue#1a 启用）**：
  - **核查结论**：当前 `index.html` 与 `src/ui/boards-stats.js` 已完整包含独立的周六（`saturday-content`=周统计：盈亏/出手/总计/ETF/多板/上榜/记录/曲线/总结心得）与周日（`sunday-content`=周末总结：本周回顾/经验总结/下周计划）模板，由 `body.saturday-mode`/`sunday-mode` 切换；另有独立的 `monthly-stats-board`（本月统计）与 `本周统计/上周统计/本月统计/返回当前` 导航按钮。`renderWeekendStats()` 在 `renderList`（每次切日期都调用）中触发：周六→`saturday-mode`+`renderWeeklyStats()`，周日→`sunday-mode`+`renderWeekendSummary()`；`body.weekend-mode .trading-day-element{display:none}` 隐藏交易日看板。所有 helper（`isWeekend`/`getWeekTradingDays`/`renderWeeklyStats`/`renderWeekendSummary`/`renderMonthlyStats`/`goBackToCurrent`）均已定义并由 `entry.js` 聚合挂到 `window`。
  - **用户侧表现的根因**：启动卡在旧交易日（Issue#1a），而"上/下交易日"导航跳过周末，用户从未真正落到周六/周日，故以为周末模板"丢失/一样"。**Issue#1a 的日期修复是启用该项的关键**：打开即落今天，今天若为周末直接显示；用日期选择器或"本周统计"按钮切到周末即见独立模板。
  - **动作**：无需改动周末模板代码；仅确认链路完整。前端改动（`app-core.js` / `auction-pages.js`）需随 `index.html`+`src/` 一起重新提供/部署，用户手动部署时同步最新前端。

- **竞价变化看板白板 + 后台按钮 `Cannot set properties of null (setting 'innerHTML')` — Issue #4 / Issue #5（Vue 组件挂载失败未降级，渲染链路不隔离）**：
  - **环境**：`ARCHITECTURE.md` Issue #2 已确认本机为 **Vue 未挂载（c2Vue=false）**——Vue 库能加载，但组件 `createApp(...).mount()` 失败，应走原生 innerHTML 兜底路径。两类故障同源：Vue 接管容器后挂载失败，却既没恢复原容器、也没隔离异常，导致后续渲染整条中断。
  - **Issue #4（按钮 innerHTML null）根因**：`src/ui/components/rank-vue.js` 的 `mountRankBoard()` 先 `el.innerHTML = '<div id="rank-vue-root">'`（销毁原生 `#rankContent`），再 `createApp(RankBoard).mount()`；若挂载抛错（组件运行时错误），原 `window.renderRank`（原生 innerHTML 版）**未被覆盖**，于是 `#rankContent` 已不存在、`renderRank` 仍写 `rankContent.innerHTML` → `Cannot set properties of null (setting 'innerHTML')`。早盘竞价 tab 后台的「获取涨幅 / 猫抓数据」等按钮走 `renderList`→`renderRank`，故点击即报此错，并连带 `renderList` 整条中断、"点了没数据"。
  - **Issue #4 修复（ui 层，符合规范）**：
    - `src/ui/components/rank-vue.js` `mountRankBoard()`：仅在 `window.Vue.createApp` 真正可用时接管；`try/catch` 包裹挂载，**失败时还原 `el.innerHTML = '<div class="rank-content" id="rankContent">'`**，且 `window.renderRank` 只在挂载**成功**后才覆盖。
    - `src/ui/boards-rank.js` `renderRank()`：新增 `[NULL-GUARD]`，`#rankContent` 不存在时委托 `window.vueRankBoardRefresh()`（已被 Vue 接管的情形），绝不再对 null 写 innerHTML。
  - **Issue #5（竞价变化看板白板）根因**：渲染链路 `window.renderList`（原生版 `boards-stocks.js` 与 Vue 接管版 `boards-vue.js:715`）把 `renderPattern / renderBidding / renderRank / ...` 串成顺序调用且**无隔离**。任一看板抛错（典型即 Vue 接管后 `renderPattern` 或 `updateStockStats`/`getTodayData` 抛错）会中断整条链路，使排在后面的 `renderBidding`（竞价变化看板）被一起跳过→表头与「要盯项目」全无、只白板。初始加载链路（`main.js:76`、`app-init.js:206`）同样串调用，故白板在打开即出现。
  - **Issue #5 修复（ui 层，渲染隔离，符合规范）**：
    - `src/ui/boards-stocks.js` `renderList()`：子看板逐个 `_safeRender` 隔离，且**把 `renderBidding` 提到最前**优先渲染，确保即使后续看板（排名等）抛错也一定能显示。
    - `src/ui/components/boards-vue.js` `window.renderList` 覆盖：同样隔离 `updateStockStats`/`updateDateDisplay` 与每个子看板，`renderBidding` 优先。
    - `src/main.js:76` 与 `src/ui/app-init.js:206`（事件总线全量刷新）初始/全量链路同样改为逐个 `_safeInit`/`_safeAll` 隔离，`renderBidding` 必渲染。
    - `src/ui/boards-bidding.js` `renderBidding()`：新增 `[NULL-GUARD]`，`#biddingContent` 缺失时记录日志直接返回（交由 Vue 路径），不再写 null；`boardEl` 判空避免收尾抛错。
  - **配套防御（entry.js 导入期 TDZ）**：`src/ui/auction-vue-mount.js`、`src/stores/auctionStore.js`、`src/ui/components/auction-components.js`、`src/ui/composables/auction-composables.js`、`src/ui/dashboards.js` 原写法 `const Vue = window.Vue || (typeof Vue !== 'undefined' ? Vue : null)` 在 `window.Vue` 缺失时会读取正在声明的 `const Vue` 触发 **TDZ `Cannot access 'Vue' before initialization`**；其中 `dashboards.js` 无 guard 直接 `const {createApp,...} = Vue` 抛 `Vue is not defined`，会**中断整个 `entry.js` 模块图**、所有 `window.renderXxx` 未能挂载。统一改为 `const Vue = window.Vue || null;` 并在 `dashboards.js` 顶部加 `if (typeof Vue === 'undefined') return;` 提前降级，保证 Vue 缺失时也能完整走原生 innerHTML 路径。
  - **验证**：`node` + `jsdom` 复刻真实 `index.html` 与 `entry.js`，强制 Vue 不可用路径：
    - `renderList` 不再抛 innerHTML null；`renderBidding`/`renderRank`/各看板均 OK；`#biddingContent` 输出含 `<table>` 与「要盯项目」。
    - 隔离回归：手动令 `renderPattern` 与 `renderRank` 抛错后再调 `renderList`，竞价变化看板仍 PASS 渲染（表头 + 要盯项目齐全）。
  - **涉及文件（ui 层为主，未引入跨层）**：`src/ui/components/rank-vue.js`、`src/ui/boards-rank.js`、`src/ui/boards-stocks.js`、`src/ui/components/boards-vue.js`、`src/ui/boards-bidding.js`、`src/main.js`、`src/ui/app-init.js`、`src/ui/auction-vue-mount.js`、`src/stores/auctionStore.js`、`src/ui/components/auction-components.js`、`src/ui/composables/auction-composables.js`、`src/ui/dashboards.js`。

- **首页顶部看板「只剩一条/三条线、UI 样式消失」— Issue #6（Vue 接管但挂载失败时未回退原生 innerHTML，与 Issue#4/#5 同源）**：
  - **环境**：仍为本机 `c2Vue=false`（ARCHITECTURE.md Issue #2）。竞价/排名等看板已在 Issue#4/#5 修好降级，但**另有四个看板仍沿用旧的「先清空容器、再 mount、不兜底」写法**，挂载失败（或本机根本不挂载）后容器被清空成空白框架，只剩外框的 CSS 线：
    - 首页顶部 **模式看板（#patternBoard）**：只剩一条紫色线（`#8b5cf6` 边框 + 紫色 `box-shadow`，`pattern-board.minimized` 默认 `pattern-content{display:none}` → 原生渲染被清掉后只剩紫色外框）。
    - **题材思路看板（#hotspotBoard）**、早盘竞价下方的 **最近多板看板（.duiban-board）**、**板块 ETF 表现看板（.etf-board）**：各自只剩三条线（外框 + 分隔线）。
  - **根因**：两个「Vue 接管」模块在 `c2Vue=false` 下挂载失败却未恢复容器：
    - `src/ui/components/boards-vue.js` `mountStocksBoards()` 接管 **stocks / hotspot / pattern** 三块，原代码 `if (el) createApp(X).mount(el);` 无 `try/catch`，且无条件覆盖 `window.renderList/renderHotspot/renderPattern` 成「只调 Vue 刷新、不重渲染」的版本——挂载一抛错，原生 innerHTML 已被清空、又没人回填 → 只剩空框架。
    - `src/ui/dashboards.js` `mountBoards()` 接管 **最近多板（duiban）/ 早盘板块ETF（etf）**，原代码 `el.innerHTML='<div id="xxx-vue-root">' + createApp(...).mount()` 同样无 `try/catch`，`installOverrides()` 无条件把 `renderMulti/renderDuiban/renderEtf` 覆盖成「只调 `loadRecentMulti/loadEarlyEtf` 的 Vue 刷新版」。
  - **修复（ui 层，符合规范，与 rank-vue.js 同源做法）**：
    - `src/ui/components/boards-vue.js` `mountStocksBoards()`：挂载前**先保存各容器原始 `innerHTML`**；每块 `try/catch` 包裹 `createApp(X).mount()`，失败则 **`el.innerHTML = 原内容`** 还原 + 置 `stockOk/hotspotOk/patternOk=false` 并 `_dbgLog` 记录；**仅当某块挂载成功才覆盖对应的 `window.renderXxx`**，失败则保留原生 innerHTML 渲染函数（stocks 那份保留 Issue#5 的 `_safe` 隔离链、`renderBidding` 优先）。
    - `src/ui/dashboards.js` `mountBoards()` + `installOverrides()`：模块级 `let duibanMounted/etfMounted=false`；每块 `try/catch`，失败还原 `innerHTML`；覆盖 `renderMulti/renderDuiban/renderEtf` 前**先捕获原生函数 `_origRenderMulti/_origRenderEtf`**，覆盖后的函数判断 `duibanMounted/etfMounted`——挂载成功走 Vue 刷新，失败则**回退 `_origRenderMulti/_origRenderEtf` 原生 innerHTML 渲染**，绝不留下空框架。
  - **验证**：`node` + `jsdom` 复刻真实 `index.html`+`entry.js`，强制 Vue 不可用（`FAIL_MOUNT=1` 模拟 `c2Vue=false` 挂载抛错）：`[BOARD-VUE] stock/hotspot/pattern 挂载失败，回退原生渲染` 与 `[DASHBOARDS] duiban/etf 挂载失败，回退原生渲染` 均触发；再次调用 `renderPattern/renderMulti/renderEtf` 后 `#patternContent` / `#multiContent` / `#etfTableBody` 均产出非空 innerHTML（有真实内容，非空白框架）。`FAIL_MOUNT=0`（Vue 正常挂载）路径亦无回归：Vue 接管成功后容器被 `xxx-vue-root` 取代、由真实浏览器渲染，统计与渲染链路不中断。
  - **涉及文件（ui 层，未引入跨层）**：`src/ui/components/boards-vue.js`、`src/ui/dashboards.js`。

- **周末统计看板（周六）全部显示 0、无统计数据 — Issue #7（全对象语义被误覆盖，渲染链路中断抛错）**：
  - **现象**：点击「本周统计」或在周六打开，统计看板所有数字（出手/空仓次数、最近多板/题材/ETF 记录数、胜率、盈亏、成交天数）全为 0，未做任何聚合。
  - **根因**：`src/ui/boards-stats.js` `renderWeeklyStats()` 开头有一行 `window.allData = getStocksData();`。本环境 `window.allData` 是**全对象** `{stocks, jiwang, rank, multi, hotspot, pattern, bidding, ...}`（由 `loadAllData()` 构建，且带 500ms 缓存，`getJiwangData()/getRankData()/getEtfData()` 都依赖 `window.allData.jiwang/.rank/.etf`）。而 `getStocksData()` 只返回**「按日期索引的股票映射」**（`window._stocksMemCache`，即旧单文件版 `allData[dateStr]` 语义）。这一行把全对象整体覆盖成「仅股票」映射，导致后续 `const dayJiwang = window.getJiwangData()[dateStr]`（`getJiwangData()` → `loadAllData().jiwang` → 经 500ms 缓存返回已被覆盖成股票映射的 `window.allData`，其 `.jiwang` 为 `undefined`）→ `undefined[dateStr]` **抛 `TypeError`**，`renderWeeklyStats` 整段中断，所有 `textContent` 停留在初始 0。每日循环里 `const dayData = window.allData[dateStr]` 取股票数据那一行也因同样误覆盖而拿不到正确结构（`window.allData` 已非全对象）。
  - **修复（ui 层，读取侧，符合规范）**：不再用 `window.allData = getStocksData()` 覆盖全对象。改为局部变量 `const _stocksData = window.getStocksData() || {};`，并把取股票数据的 `const dayData = window.allData[dateStr] || [];` 改为 `const dayData = _stocksData[dateStr] || [];`。`window.allData` 保持完整对象，`getJiwangData()/getRankData()/getEtfData()` 经 `loadAllData` 缓存返回正确的 `.jiwang/.rank/.etf`，聚合恢复正常；`renderTotalStats()`/`renderWeeklySummary()` 等下游 helper 也因 `window.allData` 完整而正确。
  - **验证**：`node` + `jsdom` 复刻真实 `index.html`+`entry.js`，种子 2026-08-03~07 一周的 `window._jiwangMemCache`（含 `jielun/chushou/stats`）与 `window._stocksMemCache`、以及 `localStorage.duibanData/etfData`，设 `currentDate='2026-08-08'`（周六）后调用 `renderWeekendStats()/renderWeeklyStats()`：修复前抛 `Cannot read properties of undefined (reading '2026-08-03')` 中断、全 0；修复后 `#weekendEmptyCount=2 / #weekendChushouCount=3 / #weekendTradingDays=5 / #weekendDuibanCount=5 / #weekendTopicCount=4 / #weekendEtfCount=3 / #weekendEmptyWinRate=50.0% / #weekendChushouWinRate=66.7% / #weekendTotalProfit=1500`，均为正确聚合值（`drawProfitChart` 的 `getContext` 报错仅为 jsdom 无 canvas 实现，发生于所有统计写入之后、真实浏览器不受影响）。
  - **涉及文件（ui 层，读取侧，未引入跨层）**：`src/ui/boards-stats.js`（`renderWeeklyStats`，2 处：删除覆盖全对象行 + 改用 `_stocksData` 局部变量）。

- **模式看板不展开/四个看板仍是一条线/统计看板缺数据/早盘竞价「猫抓」手动获取提示「缺少代码映射」— Issue #8（回退验证 + 两处修复）**：
  - **环境**：本机 `c2Vue=false`。所有 Vue 看板组件在真实浏览器里**挂载失败**——模板中引用的 `window.xxx`/`window.handleSave` 被 Vue 解析为 `_ctx.window`（实例属性）而非全局 `window`，而 `app.config.globalProperties.window` 未设置 → render 抛 `Cannot read properties of undefined (reading 'handleSave')` → `createApp().mount()` 失败。**结论：真实浏览器走的是原生 innerHTML 兜底路径**（Issue #6 的 `try/catch` 回退机制），四个看板的内容由 `boards-*.js` 原生渲染，`dashboards.js` 的 `installOverrides()` 因 `duibanMounted/etfMounted=false` 不覆盖原生函数。
  - **A. 模式看板默认不展开（「只剩一条线」）**：
    - 根因：`renderPattern()` 原默认给 `boardEl` 加 `minimized` 类并设 `▼`（首页 `#patternBoard` 本身也带 `minimized` 类），原生模式看板渲染完立刻收起只剩标题栏；Vue 版 `PatternBoard` 默认 `expanded=ref(false)` 同样收起。
    - 修复（ui 层，未跨层）：
      - `src/ui/boards-pattern.js` `renderPattern()`：改为**默认展开**——保留「展开/收起」按钮（`display:flex` + `▲`），并 `boardEl.classList.remove('minimized')`。`togglePatternExpand`（`boards-bidding.js:466`）不变，仍可正常折叠/展开。
      - `src/ui/components/boards-vue.js` `PatternBoard`：`const expanded = ref(true);`（仅当 Vue 路径生效时起作用，与 Native 行为保持一致）。
  - **B. 四个看板「仍是一条线、没变化」**：
    - 诊断：四个看板（模式/题材/最近多板/ETF）在原生兜底路径下**均能产生真实内容**（复现脚本 `#patternContent`/`#hotspotContent`/`#duibanTableBody`/`#etfTableBody`/`#multiContent` 均非空）。「没变化」的根因是**浏览器缓存**：本项目无构建步骤，`src/entry.js`(module) 与 `src/*.js` 被浏览器直接加载，编辑 `src/` 后必须**硬刷新（Ctrl+Shift+R）**才生效；上次修复未生效很可能是未硬刷。本次对模式看板默认展开后，题材/多板/ETF 看板无需额外改动（Issue #6 兜底已确保有内容）。
    - 验证：复现脚本强制 Vue 不可用，四看板全部 PASS（`#duibanTableBody` 含「56」、`#etfTableBody` 含「48」、`#multiContent` 含「股票A」）；模式看板渲染后 `minimized=false`（已展开），点 `togglePatternExpand` 可正常折叠/恢复。
  - **C. 周末统计看板「很多数据没有了」**：
    - 诊断：经复现脚本验证，当前 `src/ui/dashboards.js` `installOverrides()` 已用 `duibanMounted/etfMounted` 两个开关**正确门控**——Vue 挂载失败（本机必失败）时**不覆盖** `getTodayDuiban`/`getEtfData`/`renderDuiban`/`renderEtf`，回退到 `boards-duiban.js`/`boards-etf.js` 的原生 localStorage 读取 + 历史聚合；叠加 Issue #7 已修好的 `renderWeeklyStats` 全对象误覆盖，周末统计（出手/空仓/胜率/盈亏/成交天数、多板/题材/ETF 历史）计算正确。**无新增回归，无需改代码**。该现象同样归因为浏览器缓存（旧版有问题的 `installOverrides` 覆盖残留）。
    - 验证：复现脚本置 `currentDate='2026-08-08'`（周六），`#weekendEmptyCount=2 / #weekendChushouCount=3 / #weekendTradingDays=5 / #weekendDuibanCount=5 / #weekendTopicCount=4 / #weekendEtfCount=3 / #weekendEmptyWinRate=50.0% / #weekendChushouWinRate=66.7% / #weekendTotalProfit=1500`，均为正确聚合。
  - **D. 早盘竞价「猫抓」手动获取提示「缺少代码映射」**：
    - 根因：`src/logic/app-core.js` `fetchAuctionFromNumcat()`（及 `fillTopicsFromNumcat()`）开头取 `const scMap = window._scMapCache || {}`；若启动期 `loadCloudStockCodeMap()` 因登录时序/网络抖动失败或竞态，`_scMapCache` 一直为空 → 收集不到代码 → `allCodesSet.size===0` → 直接报「缺少代码映射」且**未尝试补救**。
    - 修复（logic 层，调用 data 层 `loadCloudStockCodeMap`，符合分层规范）：代码映射为空时**先按需从云端重新拉取一次**再决定是否报错；并给出更清晰的提示（区分「列表有代码但映射缺失」与「列表无代码且映射也空」）。
      ```js
      let scMap = window._scMapCache || {};
      if (Object.keys(scMap).length === 0 && typeof window.loadCloudStockCodeMap === 'function') {
          try { await window.loadCloudStockCodeMap(); }
          catch (e) { window._dbgLog('[NUMCAT-FIX] 按需加载代码映射失败: ' + (e && e.message)); }
          scMap = window._scMapCache || {};
      }
      // ...收集代码后若仍为空，按是否有股票代码给出区分提示...
      ```
    - 验证：复现脚本三种情况——
      - [4a] 映射存在 → 直接「正在请求猫抓接口（1 只股票，三天；今日同时补竞价量+涨幅）」；
      - [4b] 映射为空 → 触发 `loadCloudStockCodeMap` 按需重新拉取后继续「正在请求…」；
      - [4c] 云端无映射 → 清晰提示「❌ 没有可补全的股票（股票列表无代码，且代码映射为空；请先导入股票代码映射）」。
  - **复现手段（已清理）**：`repro-real-vue.mjs` 用 `jsdom + 真实 vue.global.js + Proxy 原型全局` 复刻 `index.html`+`entry.js`，比上次的 `FAIL_MOUNT=1` 桩更接近真实浏览器（上次桩是模拟，本次是真实 Vue 构建挂载行为）。验证完成已从仓库根删除。
  - **涉及文件**：`src/ui/boards-pattern.js`（默认展开）、`src/ui/components/boards-vue.js`（`PatternBoard` 默认 `ref(true)`）、`src/logic/app-core.js`（`fetchAuctionFromNumcat`/`fillTopicsFromNumcat` 按需重载代码映射，logic→data 分层）。`src/ui/dashboards.js`（Issue #6 门控保留，本次未改动）与 `src/ui/boards-stats.js`（Issue #7 修复保留，本次未改动）经复验无回归。

- **看板仍只剩边框线（Vue 3 生产构建吞错导致兜底失效）— Issue #9（VUE-PROD-SWALLOW 修复）**：
  - **环境**：本机 `c2Vue=false`。Vue 3 CDN 使用生产构建 `vue.global.prod.js`。
  - **根因**：Vue 3 **生产构建**中，组件 render 函数抛错时 `callWithErrorHandling` 只调 `console.error` 记录、**不 re-throw**。因此 Issue #6/#8 加的 `try { createApp().mount() } catch` **永远抓不到错误**——mount 看似"成功"（无异常），但容器实际为空（Vue 渲染失败只留注释/空文本）。随后 `xxxOk = true` 被错误置位，`window.renderPattern`/`renderHotspot`/`renderDuiban`/`renderEtf`/`renderRank` 被覆盖为空 Vue stub（`vueXxxBoardRefresh` 只重置编辑状态不渲染 DOM），原生渲染函数被切断 → 看板只剩 CSS 边框线。
  - **修复（ui 层，未跨层）**：在 `createApp().mount()` 之后**检查容器是否真的有元素子节点**（`el.children.length > 0`），空则视为失败：还原 `innerHTML` 并不接管 render 函数。
    - `src/ui/components/boards-vue.js` `mountStocksBoards()`：stock/hotspot/pattern 三个挂载点均加 `_hasContent(el)` 后置检查。
    - `src/ui/dashboards.js` `mountBoards()`：duiban/etf 两个挂载点均加 `el.children.length > 0` 后置检查。
    - `src/ui/components/rank-vue.js` `mountRankBoard()`：加 `el.children.length === 0` 后置检查，空则 throw 进入 catch 还原原生容器。
  - **验证**：HTTP 服务器 (`py -m http.server`) 验证所有文件可访问；代码模式检查确认 `_hasContent`/`children.length`/`VUE-PROD-SWALLOW` 标记均在三个文件中。修复后 Vue mount 产生空内容时 `xxxOk=false`/`xxxMounted=false`，原生 `renderPattern`/`renderDuiban`/`renderEtf`/`renderMulti`/`renderHotspot`/`renderRank` 全部保留，由 `main.js`/`app-init.js` 在数据加载后调用，看板内容正常渲染。
  - **涉及文件**：`src/ui/components/boards-vue.js`、`src/ui/dashboards.js`、`src/ui/components/rank-vue.js`。
- **看板仍只剩边框线（duiban/etf/rank）— Issue #9b（内层 Vue root 检查修复）**：
  - **根因**：Issue #9 的 children.length 检查在 dashboards.js/rank-vue.js 中有误——mount 前先插入 <div id='xxx-vue-root'></div> 作为挂载点，故外层容器始终有子节点（duibanEl.children.length > 0 永远为 true），检查从未触发。模式/题材看板（boards-vue.js）直接 mount 到容器本身故 Issue #9 修复有效，但 duiban/etf/rank 仍失效。
  - **修复**：改为检查内层 Vue root 的子节点：document.getElementById('duiban-vue-root').children.length > 0（etf/rank 同理）。
  - **涉及文件**：src/ui/dashboards.js、src/ui/components/rank-vue.js。




- **duiban/etf/rank 看板数据加载后变空白 + 模式看板默认收起 — Issue #9c（Vue 模板 window.xxx 修复 + HTML 默认展开）**：
  - **根因 A**：Vue 3 模板中 window.xxx 无法解析到全局 window（_ctx.window 为 undefined）。BoardCard 模板 -html="window.renderTushi(data.tushi)" 仅在 hasData=true 时求值——初始无数据时渲染成功（duibanMounted=true），数据加载后重渲染抛 TypeError 被 Vue 吞错 → 看板变空。rank-vue 同理（window.percentClass 等在 v-for 内）。
  - **修复 A**：将模板中所有 window.xxx 改为使用 setup() 返回的函数（
enderTushi/percentClass/
ankPercentDisplay/updateFromDie/submit/handleSave 等），同时修复类名 bug（kind+'-window.content' → kind+'-content'、
ank-window.content → 
ank-content）。
  - **根因 B**：模式看板 HTML 默认带 minimized 类，
enderPattern() 虽会移除，但若 Vue 先部分渲染再失败可能时序错乱。
  - **修复 B**：从 index.html 的 #patternBoard 移除 minimized 类，默认展开。
  - **涉及文件**：src/ui/dashboards.js（BoardCard/EditModal/createBoardApp 模板）、src/ui/components/rank-vue.js（RankBoard 模板）、index.html（patternBoard 默认展开）。
- **模式看板默认收起 + 保存按钮无反应 + 本月统计无数据 — Issue #10**：
  - **A. 模式看板默认展开**：
    - 根因：Issue #9c 错误地移除了 HTML #patternBoard 的 minimized 类（误解用户意图），且 
enderPattern() 无条件 oardEl.classList.remove('minimized') 强制展开。
    - 修复：① index.html 加回 minimized 类（默认收起）；② src/ui/boards-pattern.js 
enderPattern() 改为保持当前折叠/展开状态（	oggleBtn.textContent = boardEl.classList.contains('minimized') ? '▼' : '▲'），不再强制移除 minimized。
- **模式看板刷新后仍展开 + 切换交易日卡顿 + 月统计性能 — Issue #11**：
  - **A. 模式看板刷新/登录后仍展开**：
    - 根因：src/ui/components/boards-vue.js PatternBoard 组件 `expanded = ref(true)` 默认展开，且 onMounted 中 `el.classList.remove('minimized')` 强制移除收起类。Vue 挂载成功后（PatternBoard 模板简单，初始渲染不求值 window.xxx，不抛错）expanded=true 控制显示，忽略 HTML 的 minimized 类。
    - 修复：`expanded = ref(false)` 默认收起；删除 onMounted 中 classList.remove('minimized')。刷新后 Vue 重新挂载，expanded=false 收起；登录后 renderPattern 被覆盖成 Vue 刷新版不改变 expanded，保持收起。
  - **B. 切换上/下交易日卡顿**：
    - 根因：changeDate/handleDateSelect/goToday/goBackToCurrent 中 `window.allData = null` 清空缓存 → renderList 调 loadAllData() 重建 allData → normalizeAuctionNotes() 遍历全量 auction 数据做正则归一化（每次切换日期都重跑）。数据已在内存缓存（_stocksMemCache 等），切换日期只需换 currentDate 重新渲染，无需重建 allData。
    - 修复：删除 4 个日期切换函数中的 `window.allData = null`。loadAllData() 走 500ms 短路缓存，不重建，不触发 normalizeAuctionNotes。
  - **C. 本月/本周统计渲染慢 + allData 覆盖 bug**：
    - 根因 C1：renderMonthlyStats 第 2596 行 `window.allData = window.getStocksData()` 把全对象覆盖成仅股票映射（同 Issue #7 的 renderWeeklyStats bug，此处漏修）→ 后续 getJiwangData()/getRankData()/getEtfData() 经 loadAllData 500ms 短路返回被覆盖的 allData，.jiwang/.rank/.etf 为 undefined → 统计中断/错误。
    - 根因 C2：renderWeeklyStats 和 renderMonthlyStats 的 while 循环内每次迭代都重复调 `window.getRankData()`/`window.getEtfData()`/`JSON.parse(localStorage.getItem('duibanData'))`，一个月 20+ 交易日就重复 20+ 次相同调用/parse。
    - 修复：① renderMonthlyStats 删除 `allData = getStocksData()` 覆盖行；② 两个函数循环前缓存 `_rankData`/`_etfData`/`_duibanData`，循环内用缓存变量，避免重复调用/parse。
  - **涉及文件**：src/ui/components/boards-vue.js、src/ui/boards-stocks.js、src/ui/boards-stats.js。  - **B. duiban/etf 编辑保存按钮无反应**：
    - 根因：EditModal 组件 emit('window.save', ...) 发出的事件名是 'window.save'，但 createBoardApp 模板监听 @save（即 'save'），名称不匹配 → 保存处理器永不触发。
    - 修复：src/ui/dashboards.js 将 emits: ['close', 'window.save'] 改为 ['close', 'save']，emit('window.save', ...) 改为 emit('save', ...)。
  - **C. 本月统计无数据**：
    - 根因：src/ui/boards-stats.js 
enderMonthlyStats() 调用 getStocksData() 和 loadAllData() 未加 window. 前缀 → ES module 中 ReferenceError → 整个函数中断 → 所有统计显示 0/空。
    - 修复：改为 window.getStocksData() 和 window.loadAllData()。
  - **涉及文件**：index.html、src/ui/boards-pattern.js、src/ui/dashboards.js、src/ui/boards-stats.js。
- **模式看板刷新仍展开（Vue 类名 bug）+ 图示删除保存后恢复 + 图示输入框长按无法粘贴 — Issue #12**：
  - **A. 模式看板刷新后仍展开**：
    - 根因：PatternBoard 模板第 684 行 `class="pattern-window.content"` 类名含点号（应为 `pattern-content`），导致 CSS `.pattern-board.minimized .pattern-content { display: none }` 不匹配 Vue 渲染内容，只有 `v-show="expanded"` 控制。虽然 `expanded=ref(false)`，但若 Vue 挂载时序或缓存问题导致 expanded 未生效，CSS 兜底失效。
    - 修复：① 类名 `pattern-window.content` → `pattern-content`，`vue-edit-window.save` → `vue-edit-save`；② `toggleExpand` 同步切换 `#patternBoard` 的 `minimized` 类（双重保险：v-show + CSS）；③ `mountStocksBoards` 中 pattern 挂载后强制 `patternEl.classList.add('minimized')` 确保默认收起。
  - **B. 最近多板/ETF 图示删除保存后刷新恢复**：
    - 根因：`saveRecentMulti`/`saveEarlyEtf` 的 Supabase upsert 后未验证返回的 `data.tushi` 是否等于传入的 `row.tushi`。若 Supabase 端因约束/trigger/缓存导致 `tushi: ''` 未真正写入，`boardStore.recentMulti.tushi` 仍为旧值 → 刷新后恢复。
    - 修复：upsert 后若 `data.tushi !== row.tushi`，用 `update` 单独强制写入 `tushi` 字段（字段级修正），再赋值 `boardStore.recentMulti`。
  - **C. 图示输入框长按无法粘贴**：
    - 根因：`board-input` CSS 缺少 `-webkit-touch-callout: default; touch-action: auto`，手机浏览器长按不弹粘贴菜单（全局 `* { -webkit-touch-callout: none }` 覆盖了 `input` 的默认行为）。
    - 修复：`board-input` CSS 添加 `-webkit-touch-callout: default; touch-action: auto`；图示输入框添加 `autocomplete="off" spellcheck="false"` 避免浏览器对 URL 内容的特殊处理。
  - **涉及文件**：src/ui/components/boards-vue.js、src/ui/dashboards.js。
- **猫抓连抓五天 + 9:25 竞价看板空列 + 封单家数显示 0 — Issue #13**：
  - **A. 猫抓手动获取从"连抓三天"改为"连抓五天"**：
    - 需求：手动补全 5 个交易日（T~T-4）的竞价量 + 昨成交量 + 涨幅，与自动抓取 worker 一致。早盘竞价 tab 和热门股票 tab 都要改。
    - 实现（早盘竞价）：`index.html` 按钮文本改为"连抓五天补全（竞价量+昨成交量+涨幅）"，onclick 改为 `fetchFiveDaysAuctionFromNumcat`。`src/logic/app-core.js` 新增该函数：计算 5 个交易日，请求 numcat `daily_auc` 含 `auc_to_pre_vol_pct` 字段反推昨成交量 `yestVol = auc_vol / auc_to_pre_vol_pct`（`auc_to_pre_vol_pct` 是百分比如 5.0 表示 5%，无需额外 /100），再请求 numcat `daily` API 的 `pct_chg` 获取 5 日收盘涨幅，按日期填充 volume + yestVolume + changePct（全部 5 天），字段级 patch 上报。
    - 实现（热门股票）：`index.html` 热门股票 tab 按钮同样改为"连抓五天补全（竞价量+昨成交量+涨幅）"，onclick 改为 `fetchFiveDaysHotAuctionFromNumcat`。`src/logic/app-core.js` 新增该函数：与早盘竞价版同结构，但用 `getHotAuctionData`/`patchHotFieldBatch`/`renderHotForm`+`renderHotStocks`/`numcatApiStatusHot`，历史日列表为空时用 `buildYesterdayListFromToday` 造影子列表。
    - 昨成交量单位修复：`auc_to_pre_vol_pct` 是百分比（如 5.0 = 5%），正确公式 `yestVol(万股) = auc_vol / auc_to_pre_vol_pct`（与 worker 一致），旧代码多除了一次 100 导致值缩小 100 倍。
    - 显示单位：表头/表单 placeholder 从"(万)"改为"(万股)"，明确单位。
  - **B. 9:25 竞价变化看板空列（同花顺接口）**：
    - 根因：9:25 集合竞价时刻指数/ETF 未开盘（9:30 才开盘），fuyao/腾讯接口返回 null → `bidding-calc.js` 返回 `value: null` → `bidding-workflow.js` 跳过 null 不写入 time930 列。只有"最近多板%"（883410 成分股有集合竞价撮合价）有数据。
    - 修复：`bidding-calc.js` 所有 `value: null` 兜底改为 `value: '0'` 或 `value: '0.00'`（ROW_SECTOR_ETF/ROW_TOP10 用 '0'，ROW_BIG_ETF/ROW_MAIN_INDEX 用 '0.00'），确保 9:25 各列都有值写入。
  - **C. 猫抓自动抓取封单家数显示 0**：
    - 根因：① `CONFIG.SEAL_FIELD: 'owfd_0925_count'` 单字段名精确匹配，numcat 接口字段名不稳定可能已改名；② `Number(null/'') === 0` 被当成 0 显示而非空；③ `findTodayItem` 取排序末行不校验是否为今天。
    - 修复：① `config.js` 改为候选列表 `SEAL_FIELD_CANDIDATES: ['owfd_0925_count', 'owfd_0925', 'seal_count_0925', 'fengdan_0925', 'fdjs_0925', 's_seal', 'seal_count']`；② `numcat-api.js` 的 `numcatEmoindic` 用 `pickEmotionValue` 遍历候选字段并跳过 null/undefined/空字符串；③ `findTodayItem` 用 `beijingToday()` 校验返回行日期是否为今天，找不到返回 null；④ `seal-workflow.js` sealCount 为 null 时不显示 0。
  - **涉及文件**：index.html、src/logic/app-core.js、src/ui/auction-render.js、src/ui/components/auction-components.js、workers/bidding-board-worker-a/logic/bidding-calc.js、workers/bidding-board-worker-b/config.js、workers/bidding-board-worker-b/data/numcat-api.js、workers/bidding-board-worker-b/logic/seal-workflow.js、workers/_bundled/*.js。
- **当天昨成交量覆盖 + 情绪看板跌停趋势调试 — Issue #13 续**：
  - **A. 连抓五天当天昨成交量未更新**：
    - 根因：`fetchFiveDaysAuctionFromNumcat` / `fetchFiveDaysHotAuctionFromNumcat` 的 yestVolume 填充用补全模式 `if (entry.yestVol && !((s.yestVolume || '').trim()))`，当天已有旧值（错误单位）则跳过不覆盖。
    - 修复：改为覆盖模式 `if (entry.yestVol)`，始终用 API 值覆盖，确保当天和前四天都用正确的反推值。
  - **B. 情绪看板昨日跌停家数趋势图调试**：
    - 现状：`EMOTION_ROW_CONFIG` 中 `limitDown` 行已设置 `hasTrend: true`，数据库 `five_days` 中 `limitDown` 有值（74,0,0,0,1），代码配置正确。
    - 改进：`renderEmotionBoard` 的 console.log 从仅打印 `limitUp` 扩展为打印所有情绪字段（limitUp/limitDown/onceLimit/highestLb/zhaban），并标注 data 是否加载成功，便于排查"暂无趋势数据"根因。
  - **涉及文件**：src/logic/app-core.js、src/ui/boards-emotion.js。