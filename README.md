# 信息雷达 / info-radar

一个面向中文创作者和研究者的 Codex 信息收集与聚合插件。它把国内外主流媒体、热榜、AI 资讯、GitHub 开源信号、短视频平台热点和关键词搜索整理成可判断、可选题、可行动的中文简报。

## 它解决什么问题

- 不再只看单个平台热榜，而是把多源信号放在一起比较。
- 不再让用户单独下载一堆采集 skill，本插件已经内置常用采集器。
- 默认走快速模式，先给可用结果；只有明确要求“深度、全量、尽可能全”时才展开更多来源。
- 输出不只是标题列表，还包含评分、风险、可确认事实、待核实点和内容选题角度。

## 已内置的采集能力

安装 `info-radar` 后，不需要再单独安装这些 skill：

- `daily-hot-news`：多平台热榜。
- `hotspot-radar`：全网热榜聚合与趋势分析。
- `hot`：通用热点查询。
- `aihot`：AI HOT 中文 AI 资讯。
- `ai-topic-monitor`：AI 选题关键词监控。
- `multi-search-engine`：国内外多搜索引擎关键词搜索。
- `content-hunter`：热门内容捕捉。
- `douyin-hot`：抖音热榜。
- `douyin-search-keyword`：抖音关键词搜索。
- `bilibili-hot-monitor`：B 站热点监控。

`china-hotdata` 当前没有可随插件复制的本地 skill 目录，所以只作为可选外部来源，不算内置能力。

## 安装

### 克隆仓库

```powershell
git clone https://github.com/QINXIN111/info-radar.git
cd info-radar
```

如果要作为 Codex 本地插件使用，把仓库放到你自己的插件目录即可。插件 manifest 位于：

```text
.codex-plugin/plugin.json
```

插件本身不需要额外的 npm 或 pip 安装；内置采集器如果调用第三方平台，可能需要网络访问。

## 最快开始

### 1. 生成今日 AI 热点快报

```powershell
py -3 .\scripts\info_radar.py quick --query "AI Agent" --output-dir ".\_outputs\info-radar"
```

### 2. 同时加入 GitHub 开源信号

```powershell
py -3 .\scripts\info_radar.py quick --query "AI Agent" --github --github-sort updated --output-dir ".\_outputs\info-radar"
```

### 3. 控制速度

```powershell
py -3 .\scripts\info_radar.py quick --query "OpenAI" --timeout 8 --top 10 --output-dir ".\_outputs\info-radar"
```

默认每个公共来源最多等待 12 秒。`--timeout 8` 会更快，但可能漏掉慢接口返回的内容。

## 常用命令

### AI HOT 采集

```powershell
py -3 .\scripts\info_radar.py fetch-aihot --hours 24 --take 50 --output aihot.json
```

关键词搜索：

```powershell
py -3 .\scripts\info_radar.py fetch-aihot --query OpenAI --days 7 --take 50 --output openai.json
```

### GitHub 公共仓库搜索

```powershell
py -3 .\scripts\info_radar.py fetch-github --query "AI agent" --sort updated --take 20 --output github-ai-agent.json
```

GitHub 结果只是开发者生态信号，不能只凭 stars 判断项目质量或商业价值。

### 把 JSON 条目生成日报

```powershell
py -3 .\scripts\info_radar.py digest --input aihot.json github-ai-agent.json --keywords "AI Agent,OpenAI" --output-dir ".\_outputs\info-radar"
```

## 模式说明

- 快速模式：默认模式。优先 1 到 3 个最相关来源，目标是尽快拿到可判断结果。
- 标准模式：适合日报、国内外对照、选题会材料，覆盖热榜、媒体、官方源和技术社区。
- 深度模式：只有用户明确要求“深度、全量、尽可能全”时使用，会展开更多采集器，速度更慢。

## 输出位置

默认报告会保存到：

```text
_outputs/info-radar/YYYY-MM-DD/
```

也可以显式指定自己的工作区路径，例如：

```text
<workspace>\_outputs\info-radar\
```

典型输出文件包括：

- `info-radar-quick.md`
- `info-radar-digest.md`
- 中间 JSON 采集文件

## 报告会包含什么

- 今日最值得关注的信息。
- 每条信息的评分和信号类型。
- 为什么重要。
- 可确认事实与待核实风险。
- 适合短视频、公众号或选题会的角度。
- 国内外信号对照。
- 原始来源列表。

## 配置

示例配置文件：

```text
assets/config.example.json
```

其中 `performance` 控制默认速度策略：

```json
{
  "default_mode": "quick",
  "per_source_timeout_seconds": 12,
  "quick_mode_sources": ["aihot"],
  "github_enabled_by_default": false,
  "deep_mode_requires_explicit_request": true
}
```

## 常见问题

### 为什么不是每次都全网全量搜索？

全量展开会明显变慢，而且会带来大量低价值重复信息。插件默认先用快速模式找高信号内容，再按需要扩展来源。

### 为什么 GitHub 默认不开？

GitHub 更适合判断技术生态和早期趋势。普通热点日报不一定需要它，所以默认关闭；需要时加 `--github`。

### AI HOT 出现 TLS 证书问题怎么办？

如果只是读取公开、非登录、非敏感信息，可以临时加：

```powershell
--insecure
```

这只适合排障，不建议作为长期默认配置。

### 会自动推送到外部渠道吗？

第一版不会擅自外部推送，只生成本地报告和推送文案草稿。要做定时推送，需要先确认关键词、频率、渠道和报告长度。

## 安全边界

- 不抓取私有仓库。
- 不采集登录后内容。
- 不绕过网站规则或权限限制。
- 不把热榜排名当作事实真实性。
- 不把 GitHub stars 当作项目质量证明。
- 不在公开仓库提交 API key、token、cookie 或 `.env` 文件。

## 开发与校验

校验插件：

```powershell
py -3 "<path-to-plugin-creator>\scripts\validate_plugin.py" .
```

校验内置 skill：

```powershell
Get-ChildItem ".\skills" -Directory | ForEach-Object {
  py -3 "<path-to-skill-creator>\scripts\quick_validate.py" $_.FullName
}
```

刷新本地插件版本：

```powershell
py -3 "<path-to-plugin-creator>\scripts\update_plugin_cachebuster.py" .
```
