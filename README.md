# 中期观察 2026

Public five-language election dashboard, static HTML/CSS/JS with vendored Three.js 0.186.1 (MIT).

## Preview
Run `python -m http.server 8765 --directory dist` from the project directory. No build or dependencies needed. The data files are `dist/data/seats.json` (official incumbent roster) and `dist/data/evidence.json` (public ratings, polls, historical snapshots, news, methodology, sources).

## Updating safely
Reuse the exact project ID in `.openai/hosting.json`; never create a replacement Site. Refresh the Site's Git credential through Sites, open/pull the existing source repository, edit the two data files from verified public-only sources, run `node --check dist/app.js`, validate seat totals and uniqueness, preview/QA, package the exact committed source, save a version, and deploy. Preserve public audience. Never add private conversations, credentials, personal notes, unverified forecasts or synthetic historical snapshots.

Preserve a chronological evidence history: acquisition timestamps do not equal poll fieldwork dates. Do not overwrite previous raw poll shares just because the margin is unchanged. RCP ratings are publisher categorical assessments, not this dashboard's calibrated probabilities. The 348 individually unmapped House seats are unknown, not tossups and not inferred from incumbents. Current119thCongress incumbents are not a2026candidate roster after redistricting.

No runtime API keys. Public viewers fetch same-origin JSON. News and reference links open the original public source. The Site is a snapshot and is not realtime; automatic research publication is managed separately.

## Restoring in a future execution workspace
Call Sites `get_site` for project `appgprj_6ad966862adc8191b18b98a69d5e2d94`, then `create_source_repository_write_credential` for that same ID. Supply its complete credential through stdin to the installed `site-workflow.mjs` helper in an empty working directory, omitting `archivePath`; it opens the persistent source. Never persist or print the credential. Repository branch is `main`. Expected public URL is https://midterm-observatory-2026.aeieli.chatgpt.site.

## Data contract
- seats.json: `asOf` ISO UTC, sources[{url,description,sourceDate}], counts.senate/house, seats[{seatId,chamber,state,district,class,incumbent,currentParty,caucus,contested2026,special,source,forecast:null,vacant}]. Always100Senate+435House, unique seatId. Preserve vacant/null party.
- evidence.json: `asOf` ISO UTC, ratings[{chamber,state,district,rating,provider,source,asOf,publishedAt,electionType}], summary.{senate,house}{dem,tossup,rep,provider,source}, history[{date,dem,rep,margin,source,kind,note}], ratingChanges[{date,state,chamber,before,after,provider,source,kind,note}], polls[{id,state,pollster,fieldStart,fieldEnd,sample,sampleType,dem,rep,margin,moe,mode,weighting,source,asOf,note}], news[{date,title,summary,status,interpretation,source,kind}], methodology[{title,text}], sources[{title,url}], coverage{senateRatings,houseRatings,houseUnmappedSolid,limitations}.
- Rating enum: solid-D, likely-D, lean-D, tossup, lean-R, likely-R, solid-R. Missing is unknown, not tossup. Do not edit raw prior snapshots except explicitly documented corrections. Append new daily snapshot once per source/day; journal the retrieval time and original source. Current generic-ballot graph uses the latest14observations, not a fabricated14day sequence.
- Historical 2026-10-20 snapshot is recovered with its provenance limitation. 2026-10-21 saved; 2026-10-22 refreshed. These are generic-ballot snapshots, not seat forecasts.
- Three.js is primary. WebGL-disabled devices automatically receive a keyboard-accessible SVG diagram from exactly the same roster/ratings. Do not report that as verified WebGL rendering. Browser validation in this environment reports GPU disabled.

## Parliament 3D studio (visual redesign)
`dist/parliament.js` owns the real Three.js WebGL scene: modeled velvet cushions and inset backrests, seams/nameplates, brass arm/leg frames, tiered radial risers, rectangular chamber cutaway, upper galleries, walnut and marble rostrum, flag, desks and microphones, shadow lighting and tone mapping. OrbitControls is vendored under the Three.js MIT license. `app.js` owns evidence joins, accessible list and profile drawer, passing exact seat data into the scene. Do not replace real scene with primitive dots or treat the 2D fallback as 3D verification.

Scene controls: select Senate/House; choose forecast categorical ratings/current incumbent party/rating-change halo mode; drag to orbit, wheel/pinch to zoom, +/−, top view and reset. Clicking a modeled chair focuses camera and opens source-backed profile. Contested seats always have dashed plinth outlines; non-up seats keep incumbent party. A change halo means a sourced rating event exists, not a fabricated daily probability. Reduced-motion preference disables staggered entrance. Rebuild disposes obsolete geometries/materials without disposing shared architectural/velvet materials.

`dist/data/senate_profiles.json` and `house_profiles.json` follow `{asOf,profiles:[{seatId,incumbent:{name,role,background,source},candidates:[{name,party,background,source,polls:[{pollster,share,fieldStart,fieldEnd,source,sampleType}]}],forecast:{voteShare:null,winProbability:null,note},note}]}`. Incumbents are not automatically 2026 nominees. Poll percentages are labeled original polling, not model vote share. Missing model output remains unavailable. Profile sources must be public; no personal/private chat material. Refresh incumbent and contender evidence separately, preserve fieldwork dates and source specificity.

## Plenary display layout and ID cards
The display is a conventional plenary/speech chamber illustration, not an exact assigned-desk map. Senate rows [16,19,30,35] put all 35 contested seats in the front two rows and all 65 non-up seats behind. House has no fixed individual seats; its 435 represented mandates are not a physical chair census. Color modes preserve positions. Figures are deliberately abstract, not individual likenesses. Retained figures show current party; contested figures use whole-body holograms with selected rating/current-party colors. Vacant contested mandates use abstract election-seat symbols, never invented incumbents. The center aisle uses separate angular sectors, never point clamping.

ID card schema adds incumbent.portrait {url,source,rightsSource,credit/attribution,usageAllowed,usageNote}, honors [{title,source,attribution}], policyPositions and majorAchievements [{text,source,attribution}]. Render photos only when usageAllowed is explicitly true; public availability alone does not authorize reuse. Missing honors or policy evidence means not yet verified, not none. Attribute office-authored claims. Do not infer biography from party or transplant current incumbents to redrawn candidate districts.

Verification: the previous detailed-chair version was rendered successfully by a real WebGL browser, while the cloud browser disables WebGL. Later architecture/figure work is checked through source-derived offline 3D geometry previews, not falsely described as actual browser GPU testing. A supported browser should recheck desktop and portrait views, switches, figure counts, clicks and profile image loading after updates.

## Leadership and power reference data
`leadership.json` separates current presiding officers from conditional party-control scenarios. House center is current Speaker; Senate center is Vice President as President of the Senate, while side figures are potential majority-party leaders, not predicted Senate presidents. Dashed standing figures and text buttons open source-backed conditions, never candidate probabilities. `powers.json` stores 13 sourced procedural categories, real denominators, caveats and nominal full-chamber reference thresholds. The selector shows current party-seat distribution, not committed votes. Only `gauge.showSeatLine:true` categories draw a reference line; introduction and quorum are not partisan unlocks. Ordinary passage, cloture, veto overrides and special constitutional procedures are distinct. Preserve source and caveat fields when updating.

## Five-language publication contract
First visits default to English without painting untranslated Chinese. Explicit user choices are stored with `midterm-language-explicit`; legacy stored preferences receive a one-time confirmation because the old initializer saved Chinese automatically. A supported browser language is offered in a nonblocking banner. The explicit language selector supports English, French, Spanish, and Japanese; preference stays in browser localStorage, with no external translation service or private data transmission. `dist/locales/catalog.json` contains stable source IDs, and each locale JSON maps every ID to a translated text. `i18n.js` retains original text-node/accessible-attribute values, translates dynamic profile/news/procedure content, and restores the original on language changes. Original public source URLs, politician names, dates and numerical evidence are preserved. `lang`, localized timestamps and number formatting follow the selected language. The research translation notice is distinct from an original-source claim.

Every daily source-content update must add new displayed source texts to the catalog without renumbering old IDs and add translations in all four locale JSON files. Never call language coverage complete when a catalog key is absent. Validate all locale keys, recheck selected profile biography/policy/honors, all power controls/denominators, news, methodology, and accessible labels in every language before publishing. Do not machine-fill unknown facts or drop legal/procedural caveats during translation. Chinese remains authoritative for internal source matching, while original linked evidence is authoritative for research facts.

Power controls use inline SVG icons plus localized short labels in a responsive ARIA tablist. Arrow keys and Home/End select tabs; active tab controls the associated power panel. They are not icon-only and do not use a textual dropdown.

## Cloudflare Worker + D1（仅准备，手动运行）

Cloudflare 运行方式保留现有 `dist/` 前端、3D 和原始数据文件，由 `src/worker.js` 提供只读 API，`ASSETS` 提供静态文件，`DB` 绑定 D1。只有 `/api/*` 优先进入 Worker；缺失 JS/JSON 返回 404，不启用 SPA fallback。现有 Sites 托管配置保持不变。

### 当前数据与历史如何保存

- `documents` / `document_chunks` 按 SHA256 保存不可变 JSON，原始字节每 32 KiB 一块，以 base64 存储；Worker 在 JavaScript 中拼接并核对序号、字节数和 hash。不把大 JSON 塞入单行，也不使用 SQL `group_concat`。单条生成 SQL 小于 100,000 bytes；读取接口对单文档设置 16 MiB 上限。
- `snapshots` / `snapshot_documents` 记录真实导入文件集、Git 提交和各文件原始 `asOf` / `verifiedAt`。相同内容可跨版本复用；文档和快照不会被覆盖。
- `history_events` / `snapshot_events` 保留原始观测、评级变动、民调和新闻记录的版本、来源及日期类型。`fieldStart` / `fieldEnd` 是调查期，`publishedAt` 是来源发布日期；`imported_at` / `activated_at` 是数据库导入和本站发布时点，不能互相代替。
- 现有 2026-10-20、21、22 三条通用票记录仅是三个历史观测点，**不是三份完整参众院数据库**。20 日记录原有的恢复来源局限说明保留。不会复制今天的人物和评级去伪造过去完整快照。
- 先写不可变内容和 manifest，再从 D1 读回每个字节核验。`publish` 在兼容 Worker 部署成功后，才用单条受保护 SQL 切换 `publication` 指针；对应发布标记由同一 SQL 的触发器原子记录。D1 与 Worker 部署不是跨服务事务。中断或失败保留旧 current，不做破坏性回滚；重复执行幂等，旧版本不能覆盖更新的 current。

前端从 `/api/current` 获取一次 snapshot ID，所有资料和语言都按同一 ID 读取。任一数据/语言请求失败时，整批回退到静态 JSON。回退先固定读取一份 `dist/static-manifest.json`，再验证全部 11 个资料和语言文件的字节数与 SHA256，完整通过后才使用并显示五语言的“静态文件快照”提示。跨部署请求读到不一致文件、清单缺失或校验失败时，明确显示错误，不接受混合数据；刷新可重试。纯静态 Sites 无需 API，但必须连同清单发布整个 `dist/`。历史图读取已发布历史观测；历史 API 明确返回日期类型和覆盖缺口。

### GitHub PROD 配置

工作流使用 `environment: PROD`，支持 `main` 上的手动 `workflow_dispatch`（默认 `validate`），以及研究 JSON、译文和发布清单变化的受限 `main push`。没有 PR 或 schedule 触发器。GitHub 权限仅为 `contents: read`，checkout 不保留 Git 凭据；并发组串行执行。Actions 固定提交 SHA，Wrangler 固定为 `4.151.3`。PROD 现有审核保护保持不变；如果以后要求人工批准，自动发布会等待批准，不绕过保护。

自动路径在生产 secret 步骤之前检查本次 push 的完整差异，仅允许新增或修改 `dist/data/*.json`、`dist/locales/*.json` 和 `dist/static-manifest.json` 的普通文件。代码、workflow、迁移、删除、软链接、强制推送及分支创建均拒绝自动发布。进入生产步骤后，在任何 D1 写入之前，以及部署之前，再检查 **D1 已发布 source_commit 到候选 HEAD 的完整差异**，防止先前未部署的代码被之后的数据提交夹带上线。自动路径只能执行 `publish`，不能 bootstrap、migrate 或选择其他操作；首次上线及非数据变更继续明确手动发布。

远程操作开始前，以及导入校验完成、部署 Worker 之前，都会确认 checkout SHA、本次 `GITHUB_SHA` 和实时远端 `main` 一致。部署前还检查候选快照序号不落后于 current，且候选源码包含已发布源码的 Git 历史；不可确定时停止。A 发布、B 发布后重跑 A 会在部署前被拒绝，不会先回退代码再由数据库拒绝回退。最后的原子 current 切换保护仍保留。检查通过之后发生的 Git 提交或 Cloudflare 外部操作不受跨服务事务锁保护；所有正式发布应通过同一并发受控工作流。当前公开仓库用不带持久凭据的 `git ls-remote` 读取 main；若读取失败则停止，不跳过检查。

| PROD 设置 | 名称 | 用途 |
| --- | --- | --- |
| Environment secret | `CF_DEPLOY` | 正式运行时映射为 `CLOUDFLARE_API_TOKEN`，仅供受保护的部署/数据库操作使用。 |
| Environment secret | `CLOUDFLARE_ACCOUNT_ID` | 按用户指定保留为 secret；运行时验证 32 位十六进制格式，不回显、不写入生成配置。 |
| Environment variable | `CLOUDFLARE_D1_DATABASE_ID` | 用户选定数据库的 UUID；生产配置生成器验证格式，拒绝本地全零占位 ID。 |

没有读取、输出或保存上述 secret 的值。首次上线已经通过既有身份完成 D1 创建、迁移和 Worker 发布；以后具体操作的权限仍以实际返回结果为准。数据库 UUID 未配置时，除显式 `bootstrap` 外的远程操作会失败，不会静默创建或选择其他数据库。脚本不会扩权、创建凭据、切换账户或开通付费计划。Worker 和数据库名称均为 `midterm-observatory-2026`。

### 首次手动运行顺序

在 **Actions → Cloudflare data and deployment → Run workflow** 选择 **main**，再选择操作：

| operation | 明确执行的动作 |
| --- | --- |
| `validate`（默认） | 测试、语言/语法检查和无生产凭据的 Wrangler dry run；不写 Cloudflare。 |
| `bootstrap` | 先查询并复用同名项目 D1；只有缺失时才**实际创建远程数据库**，随后再次查询确认 UUID。配置 UUID 与同名库不符时停止；创建结果不确定时只读检查，不重复创建。不会顺便迁移、导入或部署。 |
| `migrate` | 对已配置 UUID 的远程 D1 应用 `migrations/` 中尚未执行的兼容迁移；不会切 current。 |
| `publish` | 导入并读回校验 → 部署兼容 Worker/静态资源 → 切换 current → 回读确认。迁移需事先显式完成。 |
| `sync-data` | 对已经部署兼容 Worker 的应用，仅导入/校验/发布数据版本，不部署前端代码。前端或 API 代码变化时用 `publish`。 |

先配置两个 PROD secrets。如果尚无数据库，明确运行 `bootstrap`，再把确认的 UUID 填入 PROD variable `CLOUDFLARE_D1_DATABASE_ID`；已有适用数据库时复用其确认的 UUID。授权的维护任务可通过 GitHub CLI/API 完成变量配置，无需新增 Cloudflare 凭据。随后分别运行 `migrate`、`publish`。CLI 中 `d1 create` 即使没有 `--remote` 也会创建远端库，所以本地脚本拒绝 bootstrap；所有远程操作还必须显式带 `--remote`，通过 main 和事件/操作门禁。

**首次公开部署已于 2026-10-22 完成：** [公开网站](https://midterm-observatory-2026.aeliieli.workers.dev)、[创建 D1](https://github.com/aeieli/midterm-observatory-2026/actions/runs/39722436519)、[迁移](https://github.com/aeieli/midterm-observatory-2026/actions/runs/39722537219)、[首次发布](https://github.com/aeieli/midterm-observatory-2026/actions/runs/39722612549)。未修改自定义域名或 DNS，未开通付费计划。正式运行失败会返回非零状态；数据激活完成后运行摘要记录快照与 Git SHA。部署时点和数据库导入时点不代表重新核验了研究事实，原始证据日期保持不变。

### 每日更新路径

每日公开研究先更新经过核验的 `dist/data/` 和完整四语言译文，保留原始来源和时间字段；运行 `python3 scripts/build_static_manifest.py --write`，将新清单与数据原子提交到 `main`。通过 GitHub 连接器写入同样可以触发 push，不依赖维护者的 Mac 在线。CI 拒绝过期清单和任何夹带的非研究文件，通过后自动 `publish`，同时更新 D1 和静态回退文件。相同内容重用，新增/更正观测追加保留，缺少历史证据时不补造。来源访问失败时，研究任务不能推进 `asOf` 或编造观测；没有新研究提交时不会定时重部署旧数据。工作流负责验证和发布，真实研究由既有每日研究任务完成，不在这里用 cron 代替研究。

代码、workflow、迁移等非数据变更需要明确手动发布；发布完成后才能让后续数据提交沿用新的源码基线。授权维护任务可调用：

```sh
gh workflow run deploy-cloudflare.yml --ref main -f operation=publish
```

### 只读 API

| 请求 | 返回 |
| --- | --- |
| `GET /api/current` | 当前已发布快照 ID、公开源码提交、原始证据时间和存储/发布时点。 |
| `GET /api/seats?snapshot=<id>` | 指定快照的席位 JSON。 |
| `GET /api/documents/data/evidence.json?snapshot=<id>` | 白名单数据或 `locales/*.json` 的指定版本；不支持任意路径。 |
| `GET /api/history?snapshot=<id>&kind=generic-ballot-snapshot&limit=50` | 已发布历史记录、日期类型和覆盖说明；limit 最大 100，before 可指定初始日期过滤 YYYY-MM-DD。 |

历史分页使用响应的 `nextCursor` 作为后续请求的 `cursor`，保留相同 snapshot、kind 和 before；`nextCursor: null` 表示结束。游标同时包含日期、快照序号和事件 ID，匹配完整排序，因此同一天超过 100 条记录也不会漏掉或重复。不要用上一页最后一天作为下一页的 before。

API 仅接受 GET/HEAD；没有 SQL 执行接口、无认证写接口或数据库管理入口。数据库未准备好或内容校验失败返回 503，静态文件仍可读取。不会向浏览者返回 account ID、数据库 UUID、部署 token 或内部错误细节。

### 自定义域名配置位

当前使用 `workers_dev: true`，公开地址使用账户既有的 `aeliieli.workers.dev` 子域。尚未设置自定义域名；用户确认完整主机名及其 Cloudflare zone 后，可在 `wrangler.jsonc` 顶层加入下列配置，并用实际主机名替换占位文本：

```json
"routes": [
  { "pattern": "<已确认的完整主机名>", "custom_domain": true }
]
```

该示例不在当前有效配置中。未来实际部署 `custom_domain` 配置会涉及路由、DNS 和证书，需要明确域名授权及对应 zone 权限；脚本不会自动扩大现有 token 权限。

### 本地验证（不访问生产 D1）

使用 Node.js 22+、Python 3；Wrangler 通过 npm 获取固定版本，缓存可复用。所有生成配置、SQL、日志和本地数据库留在被忽略的 `.wrangler/`。本地模式会移除继承的 Cloudflare 认证环境变量；不会设置 `remote: true`。

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.mjs
python3 scripts/cloudflare-ci.py validate
python3 scripts/cloudflare-ci.py migrate
python3 scripts/cloudflare-ci.py sync-data
# 可选本地 Worker：先生成本地配置，再显式 --local
npm exec --yes --package=wrangler@4.151.3 -- wrangler dev --local --config .wrangler/generated.json
```

测试覆盖幂等导入、原始历史保留、Unicode/引号、超 2 MB 文档、缺块、中断导入、旧 current 保留、部署前拒绝旧工作流/旧源码/旧快照、同日大量记录分页、API 只读边界和静态清单完整性（包括同字节数但内容改变的跨版本文件）。Dry run 不能证明生产权限、数据库存在或域名可用。实际部署后仍需在真实 URL 检查五语言、3D、资料、历史、静态回退和 404。

官方参考：[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)、[D1 迁移](https://developers.cloudflare.com/d1/reference/migrations/)、[D1 Wrangler 命令](https://developers.cloudflare.com/d1/wrangler-commands/)、[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

## Seat comparison and camera controls
The paired current-term and post-2026 charts use the same caucus accounting. Purple borders preserve independent party identity; retained Senate seats are distinct from Solid ratings. Unmapped House ratings remain unknown. The publisher’s whole-chamber aggregate stays in its own labeled summary and is never assigned to individual seats. Category accumulation is not a confidence interval or a probability.

Voting outlines are separate neutral rulers on the same seat scale. They assume the full chamber participates in the procedure’s actual denominator; vacancy-adjusted examples are explicitly conditional, and the original rules, exceptions, source links, bill introduction, and quorum remain available. The top tabs show only meaningful voting procedures.

The 3D camera supports full azimuth rotation, a front panorama, overhead view, reset, 30-degree orbit buttons, and zoom. Foreground rear/side architecture and the rostrum fade according to camera direction. Multi-pointer gestures and drags do not select a member; a single tap does. Color changes preserve the camera.

## Contested-seat holograms and evidence coverage
All 35 contested Senate mandates and all 435 House mandates use translucent whole-body figures with procedural scan lines. The 65 retained Senate mandates use solid figures. Figures symbolize mandates, not likenesses or verified nominees; an incumbent vacancy is never filled by an invented person. Purple identity markers retain independent affiliation. The original weave and walnut textures are generated locally with Canvas; no third-party artwork is added. Instancing and cached hologram materials keep the 435-seat scene practical; matrices stop updating after the entrance animation. Hover, selection, camera presets and foreground-wall clearing remain available.

`election-visual.js` distinguishes categorical ratings from a sourced probability model. Probability bands are accepted only from an explicit, verified 2026 `winProbability` forecast with a model name, public source, timestamp and finite party probabilities summing to one. Poll shares and Solid/Likely/Lean categories never generate percentages. No seat-level model is available in this edition. Neutral holograms represent unknown ratings, including the 348 unmapped House ratings.

`profile-evidence.js` audits candidate records separately from incumbent records. An official printed-ballot list does not establish completeness for separately filed write-in candidates. Biography, policy, achievement, honor and portrait evidence have separate counts and gaps. Portraits require verified identity, explicit reuse permission and linked rights evidence; `assetReady:false` is never displayed. A missing or failed image uses an explicitly non-photographic symbol. Campaign and office-authored claims retain attribution. The downloadable per-chamber gap audit is generated locally from the same pinned data snapshot.

`news-impact.js` keeps attention priority, geographic scope, evidence quality and political interpretation separate. News retains fieldwork/event dates, publication precision, review timestamps and a next-check trigger. Interpretation cards separate source facts, possible effects, counterevidence/unknowns and next checks. All six annotated stories retain an unchanged control judgment. A reported, stayed order is not shown as an independently verified effective order; filing a motion is not winning it. `evidence.asOf` remains the original research snapshot time; annotation review and profile research times are separate.

When publishing a UI that needs new catalog strings, `data-loader.js` checks compatibility before accepting an older API snapshot. During the short code/data activation interval it can use the complete hash-verified static release; it never mixes old API research with new static documents. Existing D1 history and deployment gates remain unchanged.

### October 22 profile and hologram verification
The final profile import retains 1,187 House candidate records and 123 Senate printed-ballot candidates, with Senate write-ins listed separately and non-exhaustively. House field tranches 06 and 07 update exact candidate IDs only. Source-linked biography, policy and image coverage is computed from actual fields. Images require explicit identity/reuse evidence plus asset and visual checks; permission metadata alone is insufficient.

There are 35 hologram figures and 65 retained solid figures in the Senate. The House has 433 hologram incumbent figures and two neutral vacancy rings, covering all 435 contested mandates. Independent identity accessories also use translucent materials when contested. No current source supplies a complete numerical win-probability model; no percentages are inferred from ratings or polls.

### Neutral seating finish
Both chambers use dedicated soft-white woven upholstery on chair backs, seat cushions and arm pads. Brass structure and walnut desks retain their materials. Party/rating colors remain on figures and independent markers, including translucent contested figures. Rebuilds preserve the upholstery material without sharing it with figures. The SVG fallback uses white chair fills with the existing colored outlines and rating/party bands.

### Display accounting and source details
The current/outlook bars list every segment and count in order, including narrow segments. Voting thresholds have their own neutral ruler; denominators, calculations and procedural exceptions remain in expandable details. Main headings have at most one necessary subtitle. Keep attribution and source qualification in expandable source sections instead of repeated warnings beside each claim.

The 100 current Senate portraits are hosted as lazy-loaded, content-addressed JPEG display copies under `dist/portraits/senate/`. Their manifest records original and display hashes, exact identities, source and reuse evidence; 22 explicitly matched candidate records share those images. Other candidates do not inherit an incumbent image by seat or surname. Murphy uses the distinct 112th Congress historical official portrait. Election research timestamps are unchanged by this image import.

### Chamber and Capitol exterior
The entrance side now has a complete wall and doors. Sightline intersections determine which room walls fade; walls behind the seats remain visible. Exterior/Chamber shortcuts and zoom transition between the room and an original, stylized Capitol model with a dome, drum, portico, wings, windows and stairs. This is an architectural illustration, not a surveyed reconstruction. Separate zoom thresholds prevent boundary flicker, reduced motion skips fades, and the far view hides interior geometry. Repeated exterior details use 22 instanced batches rather than independent decorative meshes. Existing seat positions, holograms, selection and election data are unchanged.

### Critical seats, floor dial and geographic explorer
The key-seat filter includes only individually sourced Lean-D, Lean-R and Toss-up ratings (13 Senate and 57 House seats in this snapshot). Unknown ratings are excluded, including the 348 unjoined House seats. It hides other chair instances without changing fixed positions. The inlaid chamber dial always uses the full 100/435-seat denominator. Its needle is fixed at the 50% midpoint; the colored outer arc has angle pi × abs(D−R)/capacity and reports a categorical seat-count difference, not win probability. The current Senate 46/46 tie has no lead arc. Toss-ups and unknowns are never allocated. A 2D equivalent lists all categories and counts.

The state explorer uses hash-pinned Census 2025 20m boundaries for exactly 50 states, with explicit AK/HI insets and preserved polygon holes and dateline fragments. The dark base defaults to historical post-2024 party composition; a control switches to current caucus composition. Bright upper bands show sourced 2026 seat categories, not district locations or a statewide winner. Exact counts and every Senate seat are listed on selection. Filled stars mark states with source-rated competitive seats; outlined stars mark additional editorial monitoring states. Neither is a tipping-point model.

Seven real Census 2026 CD120 district geometries are enabled: AZ06, CA22, CO08, MI07, NJ07, NY17 and PA07. Other districts remain in the state seat list. CA22 uses its new 2026 boundary; historical district results are never painted onto new boundaries. Source/version metadata is available under dist/geography. State and district meshes are read-only interaction targets and never alter election data. The map renders only while visible, and WebGL-disabled devices keep the state selector and seat list.

Historical baselines are versioned in evidence.json and therefore stored in the same D1 snapshot as ratings and translations. House winners total R220/D215. The Senate post-2024 last-election-outcome baseline totals R53/D45/I2: 31 seats last elected in 2020, 35 in 2022 and 34 in 2024. It is not a claim that all 100 seats were contested in 2024 or a swearing-in-day roster. Historical independents keep caucus=null; current affiliation, vacancies and 2026 district identities are separate. Source publication dates, original winner identities and page references are preserved. Existing research asOf and prior history observations are unchanged.
