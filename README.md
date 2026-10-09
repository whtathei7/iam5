这是自动升级。订阅生成已套上线路优化：持续拉取 BestCF 上的优质电信、移动节点，只下发 Cloudflare 网段里握手成功的地址。Clash、Surge、Loon、Quantumult X 和 sing-box 订阅都带「⚡ 自动选择」，默认按延迟挑当前最快的节点。从 cfnew 同步新版本后，工作流会重新套用这套补丁。

> **⚠️ 重要：部署后请将兼容日期设置为 `2026-01-20`**
>
> **Pages 部署：**
> 1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
> 2. 进入 **Workers 和 Pages** → 选择你的 Pages 项目
> 3. 点击 **设置** → **运行时**
> 4. 找到 **兼容性日期**，选择 `2026-01-20`，点击 **保存**
> 5. 返回 **部署** → 对最新一次部署点 **重试部署**，让新日期生效
>
> **Worker 部署：**
> 1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
> 2. 进入 **Workers 和 Pages** → 选择你的 Worker
> 3. 点击 **设置** → **运行时**
> 4. 找到 **兼容性日期**，选择 `2026-01-20`，点击 **保存**
>
> 这个设置只用改一次，之后每 6 小时的自动同步不会动它。

## 线路优化

方案参考 [CFNext](https://github.com/PAICNI/CFNext) 的公开做法：用带测速的优选结果挑节点、同一网段不扎堆、443 优先，并在订阅策略组里提供自动选择最快节点。代码是按当前 cfnew 订阅流程单独写的。

订阅里出现地址但客户端连不上，通常是地址本身到不了这个 Worker：客户端拿订阅里的 IP 当服务器，SNI 和 Host 仍是本 Worker 的域名。地址不在 Cloudflare 网段、握手没有完成，或者好几套自动分组各挑各的，都会出现“列表里有节点，选上去没反应”。

现在每次生成订阅按这个顺序组节点：

1. **持续获取**：默认源是 [BestCF](https://bestcf.pages.dev/) 上的麒麟三网测速、微测、CFYes、vvHan。电信、移动按标签拆开，测速达到 1 MB/s 的地址尽量都留下，每家再补少量只有延迟的地址，并且尽量来自不同 /24；联通只留少量。各源独立超时，任一来源失效不会中断订阅生成。BestCF 标为随机、非实时的运营商接口，以及首页上的专线、地区随机列表，默认不拉取。有下载速度的地址优先于只有延迟的地址；`Mbps` 会先换算成 MB/s，避免和 `mb/s` 混在一起比。
2. **只留能拨通的地址**：服务器地址必须落在 Cloudflare 网段。用户在面板里钉住的自定义地址按原样保留。私网地址丢弃。
3. **测活**：下发前对这份短名单做 TLS 握手。443 失败时再试一次 8443，只有 8443 成功才改用这个端口。握手失败、没有测到，或连续失败达到 2 次的地址都不再下发。
4. **排序**：同一运营商里，连续失败少、历史成功率高、下载速度快、延迟低的排在前面。电信和移动交替填充。打开「最快节点前置」时，电信、移动、联通各把当前最快的一个放在最前，名字仍是运营商本身。
5. **入口**：订阅域名本身占一个节点，放在这几个最快地址后面，优选全灭时订阅里仍有本机域名。
6. **裁剪**：默认最多 36 个，实际通常更少。IPv6 默认不下发；选「仅备胎」时少量 IPv6 排到末尾；选「等权混合」时和 IPv4 交替。
7. **刷新**：内存和 KV 里的结果超过 10 分钟就在后台重新拉取，请求本身仍先返回 6 小时内的上一份。没有缓存时才等待本次拉取。KV 内容不变不写，10 分钟内不重复写，每个实例每天最多写 24 次。
8. **轮换**：默认关闭。需要时再打开「头部轮换」，前排地址每 5 分钟错开一位。
9. **自动最快**：Clash、Surge、Loon、Quantumult X 和 sing-box 都有一个 `⚡ 自动选择`。它按电信、移动交错取出最多 16 个已下发节点，用 `https://www.gstatic.com/generate_204` 做 URL-Test，每 600 秒检查一次，切换容差 50 ms，并启用 `lazy`。`🚀 节点选择` 的第一项就是这一组，后面是直连和单个节点。持续使用时，按 16 个节点估算每客户端每天约 2,304 次健康检查。
10. **稳定性历史**：线路缓存刷新时，把本次握手的成功次数写入 KV。连续失败会降级；成功率做平滑，避免只有一次成功的新节点压过长期稳定的节点。这个历史只代表 Worker 边缘测活。
11. **OpenAI**：Clash 的 `🤖 OpenAI` 组按顺序使用 `⚡ 自动选择`、`🚀 节点选择` 和直连。GitHub、npm、PyPI 等开发依赖域名仍进这个组。

### Codex 本地可信节点池

Worker 无法观察用户所在地的电信链路，因此项目增加了可选的两级筛选。第一层 Worker 只负责生成候选；第二层在运行 Codex 的同一局域网使用 [beck-8/subs-check](https://github.com/beck-8/subs-check) 做实际测活、OpenAI 解锁检查、小流量 GitHub 下载测试和 7 天历史复测。OpenClash 最终只读取第二层输出。

Windows PowerShell 中运行（订阅地址不会写进 Git 仓库）：

```powershell
.\scripts\install-codex-node-pool.ps1 -SourceUrl @(
  'https://第一个可信订阅',
  'https://第二个独立可信订阅'
)
```

安装器会下载 GitHub 最新正式版 Windows x86_64 资产并核对发布者提供的 SHA256，配置为每 6 小时检测一次：

- 存活目标使用 `https://chatgpt.com/cdn-cgi/trace`，不再用与 Codex 无关的 gstatic 204。
- 只保留通过 OpenAI 检测并带 `GPT`/`GPT+` 标记的节点。
- 带宽测试并发为 1，每节点最多下载 1 MiB，避免消耗 Cloudflare 免费额度。
- 最终目标约 16～24 个节点，最近 7 天成功节点只会重新进入待测队列，不会绕过本轮检查。
- 示例配置明确清空 `sub-urls-remote`，不会混入 subs-check 上游示例中的公共免费节点。

检测完成后，输出地址类似：

```text
http://192.168.3.15:8199/sub/all.yaml
```

把整个仓库复制到 OpenWrt，使用安装器实际输出的地址配置 OpenClash：

```sh
sh scripts/configure-openclash-codex.sh 'http://192.168.3.15:8199/sub/all.yaml'
sh scripts/verify-openclash-codex.sh
```

路由器脚本会先用实际 Mihomo 内核校验新配置，再切换并重启；若进程未启动会恢复原配置路径。原配置路径同时记录在 `/etc/openclash/codex-smart.previous-config`。配置通过 `proxy-provider` 每 6 小时读取本地结果。`⚡ 自动选择` 每 600 秒用 gstatic 测速，`🧠 Codex智能` 每 900 秒用 ChatGPT 目标测试、100 ms 容差。OpenAI 组先走自动选择。LightGBM 和训练数据收集关闭，以减少路由器内存和闪存写入。

GitHub、codeload、release-assets、npm、PyPI、crates、Go、Maven/Gradle 和 NuGet 等 Codex 开发依赖域名也进入 `🤖 OpenAI` 组。Worker 直接生成的 Clash 配置把这个组指到 `⚡ 自动选择`。

这套链路不会把一个 Worker 复制成真正的多后端。至少两个 `SourceUrl` 应来自不同服务商、不同域名/SNI 和不同 ASN；最佳实践是再加入一个自有 WireGuard/VPS 出口。只有一个来源时安装器会明确警告共同故障仍然存在。

### 独立入口容灾

仅绑定多个域名到同一个 Worker 不能抵御 Worker 故障。项目现在支持最多两个独立兼容入口：先分别部署相同程序，并给每个入口设置不同域名和 UUID，然后在主入口增加环境变量 `INDEPENDENT_ENDPOINTS`，每行格式为：

```text
https://backup-a.example.com/11111111-1111-4111-8111-111111111111#备用A
https://backup-b.example.net/22222222-2222-4222-8222-222222222222#备用B
```

每个备用入口只生成 6 个优选节点；自动测速组按 SNI/入口轮流取样，因此不会被主入口节点全部占满。这里直接生成节点，不从备用 Worker 拉取订阅，所以不会增加订阅生成时的外部子请求。两个 Worker 如果仍在同一个 Cloudflare 账号下，会共享账号级免费额度，也不能抵御整个账号被暂停；这项功能用于正常的域名、路由和单项目故障容灾，不应用于规避平台处置。

Cloudflare 当前公开的免费额度主要包括：[Workers](https://developers.cloudflare.com/workers/platform/limits/) 每账号每天 100,000 次请求、每次请求 10 ms CPU、50 个外部子请求和 6 个同时等待的外连；[KV](https://developers.cloudflare.com/kv/platform/limits/) 每天 100,000 次读取、1,000 次写入、1 GB 存储；[Pages](https://developers.cloudflare.com/pages/platform/limits/) 每月 500 次构建且同时只能构建 1 个。本项目超过 10 分钟就在后台刷新优选、旧结果保留 6 小时、KV 写入限制为每天 24 次，并把优选源抓取并发限制为 5；即使如此，实际代理连接和客户端健康检查仍计入 Workers 请求量，应在 Cloudflare 面板监控每日用量。

## SNI 阻断与多入口

默认强制开启 ECH（包括旧 KV 配置仍保存 `ech=no` 的部署）。Clash 请使用支持 `ech-opts` 的新版 Mihomo 内核；Worker 会在生成订阅时获取最新 ECHConfig，并直接写入 Clash YAML 的 `ech-opts.config`，客户端不再依赖本地 HTTPS DNS 查询。获取失败时才回退到 `query-server-name`。每个入口还会使用根据地址生成的不同 WebSocket 路径，避免所有节点共用 `/?ed=2048` 这一条固定特征。如需兼容不支持 ECH 的旧内核，可显式设置环境变量 `ECH_REQUIRED=no`，此时面板中的 ECH 开关重新生效；也可以用 `ECH_CONFIG` 临时指定 Base64 ECHConfig。

如果已经在 Cloudflare 中把其他自定义域名绑定到同一个 Worker，可设置环境变量 `FRONT_DOMAINS`（逗号分隔）。订阅会在主域名和这些域名之间轮换 SNI 与 Host。未绑定到同一 Worker 的域名不能填写；Cloudflare 会拒绝跨站域前置。

ECH 和多路径可以降低单一 SNI、固定路径被阻断时的全灭风险，但同一个 Worker 和 UUID 仍是共享故障点。需要真正独立的容灾时，应另建 Worker、域名和凭据。

填写了自定义优选 IP 时，默认只下发这些地址和本机域名，不再把内置任播地址塞在前面。打开「自定义节点合并默认池」后，才会再并入优选池。

外部列表在内存里保留 10 分钟。超过这个时间先用上一份，再在后台刷新；连续拉取失败时，6 小时内继续用最后一份成功结果。

KV 只保存去掉随机补足和域名后的紧凑名单。名单没变不写，10 分钟内不重复写，每个实例每天最多写 24 次。没有可下发的地址，或只用自定义节点时，不写 KV。订阅响应头 `X-Opt` 中，`selected` 是下发的非域名入口数，`edge_ok/edge_tested` 仅代表 Worker 侧入口握手结果，`user_ok=unknown` 明确表示服务端无法知道用户网络是否可达；不再用 `alive` 冒充端到端存活数。

面板里的开关在「线路优化」。也可以用环境变量 `OPT`、`OPT_LIMIT`、`OPT_PROBE`、`OPT_BALANCE`、`OPT_ANCHOR`、`OPT_MERGE`、`V6_POLICY`、`OPT_REGION`、`OPT_POOL`。

自动同步只覆盖 `_worker.js`。同步脚本解压后会执行 `node scripts/apply-route-optimizer.mjs`，把这套逻辑重新打进去。补丁对不上新版本时，同步会停住，仓库里仍是上一份已经优化过的代码。

## 避免被停用

Cloudflare 停用这类 Worker，公开可见的原因主要是三条：免费额度被打满（请求、CPU、KV 写入）、出口流量大到收到滥用投诉，以及随机地址一律返回带项目特征的 JSON。后一条会让扫描器确认这是一个只做代理的站点。

现在的处理是：

- 订阅每分钟最多生成 10 次，首页和面板每分钟最多 30 次。超出后返回普通页面，并带 `Retry-After: 60`。代理连接本身不计入这个限制。
- 路径对不上时直接返回这句页面，不读 KV，也不占用上面的次数。
- `/robots.txt` 告诉爬虫不要抓取。
- 未知地址、错误令牌和内部错误都返回同一句「这里没有内容。」，不再带 UUID、变量名或堆栈。
- KV 仍按前面的规则少写。节点数量默认 36。
