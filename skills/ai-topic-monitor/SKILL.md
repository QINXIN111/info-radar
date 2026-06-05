---
name: ai-topic-monitor
description: Info Radar ??????AI ??????????? info-radar ????????????????????????
---
# AI 选题自动监控 Skill

## 触发词
`选题监控` `AI日报` `今日选题` `财经选题` `加密选题` `跑一下监控`

## 功能概述
自动抓取以下来源，按 **8大关键词分类**（中英双语 + 实体词 + 事件行为词）过滤、评分、输出选题日报：
- **AI HOT 日报** `https://aihot.virxact.com/api/public/daily`
- **抖音热榜** 通过 `douyin-hot` skill（node scripts/douyin.js hot 50）

## 关键词体系 v2.0（8类 × 双语 × 实体+事件+信息源）

> 参照专业选题团队的信息源锁定 → 关键词筛选 → 事件/动作词捕捉 三层架构。
> 每类包含：信息源（监控渠道）+ 实体词（匹配对象）+ 事件词（话题度加权）。

---

### ex1：AI核心动态
**信息源**：中文AI媒体（量子位、机器之心、新智元、36氪AI、InfoQ中文）、英文AI媒体（TechCrunch AI、The Verge AI、VentureBeat AI、Ars Technica AI）、AI公司官方博客（OpenAI Blog、Google AI Blog、Anthropic Blog、Meta AI Blog）、Newsletter精选（The Batch、TLDR AI、Import AI、AI News Rundown）、Folo关键词订阅：AGI、DeepSeek、新模型发布、开源大模型、模型评测
- **实体词**：OpenAI、ChatGPT、GPT-4/5、o1/o3、Anthropic、Claude、Google、Gemini、Meta、Llama、DeepMind、Mistral、xAI、Grok、Perplexity、Cohere、Midjourney、Runway、Sora、Pika、Flux、Black Forest Labs、DeepSeek、文心一言、通义千问、腾讯混元、字节豆包、快手可灵、智谱AI、Kimi、月之暗面、百川智能、阶跃星辰、MiniMax、零一万物、商汤、科大讯飞、海螺AI、即梦、LLM、AGI、多模态、Prompt、AI Agent、Reasoning、Benchmark
- **事件词**：发布、release、launch、开源、open-source、API降价、pricing、免费、限时免费、内测、公测、beta、重磅更新、突破、超越、beat、排行榜、leaderboard、评测、review

---

### ex2：科技巨头核心动态
**信息源**：英文科技媒体（The Verge、TechCrunch、Engadget、Wired、Bloomberg Tech、CNBC Tech）、中文科技媒体（36氪、虎嗅、极客公园）、公司投资者关系页（ir.nvidia.com、ir.tesla.com、ir.apple.com）、财报季跟踪（Seeking Alpha、Yahoo Finance）、Folo关键词订阅：AI裁员、AI监管、AI版权、AI翻车、AI争议、大模型降价、AI取代工作
- **实体词**：英伟达、NVIDIA、黄仁勋、Jensen Huang、Blackwell、RTX、CUDA、特斯拉、Tesla、马斯克、Elon Musk、xAI、Grok、Neuralink、FSD、Optimus、苹果、Apple、库克、Tim Cook、iPhone、Apple Intelligence、Vision Pro、微软、Microsoft、纳德拉、Nadella、Azure、Copilot、GitHub、亚马逊、Amazon、贝索斯、AWS、Bedrock、Meta、扎克伯格、Mark Zuckerberg、Facebook、Instagram、WhatsApp、Quest、谷歌、Google、皮查伊、Alphabet、YouTube、Android、Chrome、Waymo、字节跳动、ByteDance、张一鸣
- **事件词**：财报、earnings、营收、利润、股价、裁员、layoff、收购、acquire、合并、merger、发布会、WWDC、Google I/O、新品泄露、leak、rumor、CEO换帅、离职、上市、IPO

---

### ex3：宏观经济与政策
**信息源**：财经媒体（Bloomberg、Reuters、Financial Times、CNBC、华尔街见闻、财新、第一财经）、央行/监管公告（federalreserve.gov、pbc.gov.cn、sec.gov）、经济数据日历（tradingeconomics.com、investing.com）、Folo关键词订阅：美联储决议、关税变化、AI法案、芯片制裁
- **实体词**：特朗普、Trump、拜登、Biden、美联储、Fed、鲍威尔、Powell、白宫、SEC、国务院、工信部、科技部、发改委、央行、证监会、欧盟、EU、G7、G20、WTO、IMF、CPI、PPI、GDP、PMI、非农、通胀、降息、rate cut、加息、关税、tariff、贸易战、制裁、sanction、出口管制、实体清单、芯片法案、CHIPS Act、AI监管、AI regulation、AI法案、版权、copyright、专利、反垄断、antitrust
- **事件词**：政策出台、新规、立法、法案通过、制裁加码、关税上调/下调、贸易谈判、降息/加息决议、经济数据超预期、不及预期

---

### ex4：行业上下游动态
**信息源**：半导体/硬件媒体（AnandTech、Tom's Hardware、EE Times、半导体行业观察）、云计算媒体（The Information、Protocol、云头条）、互联网平台动态（Social Media Today、新榜、卡思数据）、新能源媒体（Electrek、InsideEVs、汽车之家）、Folo关键词订阅：芯片断供、云厂商降价、平台下架、新势力销量
- **实体词**：芯片、半导体、台积电、TSMC、三星、AMD、Intel、高通、Arm、ASML、中芯国际、SMIC、海思、AWS、Azure、Google Cloud、阿里云、腾讯云、华为云、SpaceX、星链、Starlink、TikTok、抖音、微信、Discord、Reddit、Twitter、X、腾讯、阿里、百度、京东、拼多多、小红书、网易、快手、B站、比亚迪、BYD、蔚来、NIO、小鹏、理想、宁德时代、CATL
- **事件词**：融资、funding、估值、IPO、收购、并购、战略合作、断供、禁用、封杀、下架、违规、被罚、罚款、新品发布、降价、涨价、营收增长/下滑、首次盈利

---

### ex5：国内科技与政策 🆕
**信息源**：政府官网（gov.cn、miit.gov.cn、most.gov.cn）、央媒（人民日报、新华社、央视新闻）、地方政策平台（各省市政府网）、科技产业媒体（智东西、甲子光年、钛媒体、雷锋网）、Folo关键词订阅：新质生产力、国产替代、鸿蒙生态、昇腾适配、大模型备案
- **实体词**：国产替代、自主可控、信创、鸿蒙、HarmonyOS、昇腾、鲲鹏、华为、中芯国际、寒武纪、龙芯、新质生产力、人工智能+、数字中国、东数西算、算力枢纽、大模型备案、深度合成、生成式AI管理办法、国资委、央企AI、政务大模型、北京/上海/深圳AI、人工智能先导区
- **事件词**：政策发布、指导意见、试点、示范、国产突破、首次超越、全面替换、通过验收、补贴发放、监管趋严/放松、新规落地、两会提案

---

### ex6：加密/区块链 🆕
**信息源**：加密媒体（CoinDesk、The Block、Decrypt、金色财经、律动BlockBeats、Foresight News）、链上数据（Dune Analytics、DeFiLlama、Glassnode）、交易所公告（Binance Blog、OKX Blog、Coinbase Blog）、Folo关键词订阅：ETF动态、减半周期、黑客攻击、监管打击、牛市信号
- **实体词**：比特币、BTC、Bitcoin、以太坊、ETH、Ethereum、Solana、SOL、BNB、XRP、DOGE、SHIB、PEPE、Binance、币安、OKX、Coinbase、Grayscale、贝莱德、BlackRock、ETF、比特币ETF、DeFi、Uniswap、Aave、稳定币、USDT、USDC、Layer 2、Arbitrum、Optimism、Polygon、数字人民币、DCEP、CBDC、香港Web3、Web3、NFT、数字藏品、元宇宙
- **事件词**：暴涨、bull run、暴跌、崩盘、突破新高、ATH、跌破、ETF获批、资金流入/流出、黑客攻击、被盗、rug pull、跑路、暴雷、监管打击、洗钱、封禁、减半、halving、升级、分叉、fork、空投、airdrop、质押、staking

---

### ex7：AI工具与创作者生态 🆕
**信息源**：产品发现平台（Product Hunt、FutureTools、There's An AI For That）、创作者社区（小红书AI标签、抖音AI教程、YouTube AI频道）、Folo关键词订阅：AI工具推荐、AI副业、AI变现、AI翻车、AI取代工作
- **实体词**：Sora、Runway、Pika、可灵、Kling、即梦、海螺AI、MiniMax、PixVerse、Viggle、Luma、AI短视频/视频/动画/电影、Midjourney、DALL·E、Stable Diffusion、Flux、Ideogram、AI绘画/插画/设计、Suno、Udio、ElevenLabs、AI配音、AI音乐、Cursor、Copilot、AI PPT、Notion AI、数字人、AI主播/直播/带货、剪映、CapCut、Canva、AI剪辑
- **事件词**：教程、如何用、保姆级、零基础、赚钱、副业、变现、月入、免费工具、白嫖、开源、推荐、神器、效率神器、必备、天花板、翻车、取代工作、失业、被AI取代、AI抢饭碗、测评、实测、对比、哪个好

---

### ex8：AI争议与负面（高反转/高流量）🆕
**信息源**：社交媒体（微博热搜、Reddit r/singularity、Twitter/X #AI debate）、调查报道（Wired、MIT Tech Review、NYT Technology）、Folo关键词订阅：AI伦理争议、AI事故、deepfake、AI裁员、AI版权诉讼、AI监管处罚
- **实体词**：AI裁员、AI取代、AI失业、AI版权、AI翻车、AI幻觉、hallucination、AI偏见、AI造假、deepfake、AI换脸、AI诈骗、AI钓鱼、AI监管、AI禁令、AI安全、AI风险、AI伦理、AI隐私、AI数据泄露、大模型降价、price war、价格战、AI内卷、AI军备竞赛、AI泡沫
- **事件词**：道歉、下架、撤回、被罚、被起诉、lawsuit、禁用、封禁、调查、审查、翻车、出错、漏洞、数据泄露、隐私泄露、争议、质疑、批评、抵制、事故、警告、反转、打脸、辟谣、真相、内幕、揭秘

## 话题度评分算法 v2.0
```
总分 = 热度(40%) + 反转强度(35%) + 流量潜力(25%)
```
- **热度**：抖音热值 / 200000，无热值则按热门实体词（马斯克/特朗普/英伟达等18个）+ 发布类事件词推断
- **反转强度**：全局反转信号词（反转/打脸/暴跌/超越/首次/被罚等20+个）×12分 + 分类事件词 ×8分
- **流量潜力**：全局流量信号词（如何用/赚钱/推荐/测评等15+个）×12分 + 分类事件词 ×8分 + 分类权重加成（AI争议28分最高）

## 使用方法

### 基础用法（控制台输出日报）
```
node ".\skills\ai-topic-monitor\scripts\monitor.js"
```

### JSON 格式输出（供自动化/UI 调用）
```
node ".\skills\ai-topic-monitor\scripts\monitor.js" --json
```

### 保存报告文件（供推送自动化读取）
```
node ".\skills\ai-topic-monitor\scripts\monitor.js" --push
```

以上命令假设当前工作目录是 `info-radar` 插件根目录。

## 定时自动化（可选）
- 先确认关键词、频率、推送渠道和报告长度。
- 再用 Codex 的自动化能力创建提醒或监控。
- 不要在没有用户确认时自动向外部渠道推送。

## 依赖
- Node.js >= 18
- `douyin-hot` skill 已安装（用于抖音热榜）
- 网络可访问 `aihot.virxact.com`（无需 API Key）

## 文件结构
```
<plugin-root>/skills/ai-topic-monitor/
├── SKILL.md              # 本文件
└── scripts/
    └── monitor.js        # 主监控脚本
```
