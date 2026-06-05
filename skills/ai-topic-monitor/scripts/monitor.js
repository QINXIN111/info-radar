#!/usr/bin/env node
/**
 * ai-topic-monitor
 * 自动监控 AI/财经/加密 选题，按关键词分类，输出话题度评分
 *
 * 用法：
 *   node monitor.js              # 输出今日选题报告（控制台）
 *   node monitor.js --json      # 输出 JSON 格式
 *   node monitor.js --push      # 输出报告 + 推送标记（供自动化调用）
 */

const https = require('https');
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ══════════════════════════════════════════════════════════════════
// 关键词体系 v2.0 — 中英双语 + 事件行为词 + 信息源关键词
// 结构：分类 → { entities: [...实体词], events: [...事件词] }
// entities 匹配实体，events 匹配行为/事件（用于反转/流量评分加权）
// ══════════════════════════════════════════════════════════════════

const KEYWORDS = {
  // ── ex1: AI核心动态 ──
  'AI核心动态': {
    entities: [
      // 海外 AI 公司/产品
      'OpenAI','ChatGPT','GPT-4','GPT-5','o1','o3','Anthropic','Claude',
      'Google','Gemini','Meta','Llama','DeepMind','Mistral','xAI','Grok',
      'Perplexity','Cohere','Stability AI','Midjourney','Runway','Sora',
      'Pika','Ideogram','Flux','Black Forest Labs','Reka','01.AI','Yi',
      'Inflection','Character.AI','Adept','Adept AI','Cerebras','SambaNova',
      // 国内 AI 公司/产品
      'DeepSeek','深度求索','文心一言','通义千问','腾讯混元','字节豆包',
      '快手可灵','智谱AI','智谱清言','Kimi','月之暗面','百川智能','百川',
      '阶跃星辰','StepFun','稀宇科技','MiniMax','零一万物','商汤','SenseTime',
      '科大讯飞','星火','出门问问','序列猴子','海螺AI','即梦',
      // 通用AI术语
      '大语言模型','LLM','多模态','AGI','提示词','Prompt','AI Agent',
      'AI智能体','Reasoning','推理模型','Diffusion','扩散模型',
      'Transformer','RAG','Fine-tuning','微调','RLHF','Scaling Law',
      'Benchmark','AI benchmark','AI benchmark'
    ],
    events: [
      '发布','release','launch','发布新模型','发布新功能','模型更新',
      '开源','open-source','open source','闭源','API降价','pricing',
      '免费','free','限时免费','内测','公测','beta','preview',
      '重磅更新','重大突破','性能提升','超越','beat','surpass',
      '排行榜','leaderboard','排名','榜单','评测','测试','review'
    ]
  },

  // ── ex2: 科技巨头核心动态 ──
  '科技巨头核心动态': {
    entities: [
      // 英伟达
      '英伟达','NVIDIA','黄仁勋','Jensen Huang','RTX','CUDA','TensorRT',
      'Blackwell','Hopper','GB200','B200',
      // 特斯拉/马斯克
      '特斯拉','Tesla','马斯克','Elon Musk','xAI','Grok','Neuralink',
      'The Boring Company','FSD','Full Self-Driving','Optimus','擎天柱',
      // 苹果
      '苹果','Apple','库克','Tim Cook','iPhone','iPad','MacBook',
      'Apple Intelligence','Siri','Vision Pro','M系列芯片',
      // 微软
      '微软','Microsoft','纳德拉','Nadella','Azure','Copilot','Bing',
      'Windows','GitHub','Office','Surface',
      // 亚马逊
      '亚马逊','Amazon','贝索斯','Jeff Bezos','AWS','Bedrock','Echo',
      // Meta
      'Meta','扎克伯格','Mark Zuckerberg','Facebook','Instagram','WhatsApp',
      'Quest','Horizon','Ray-Ban',
      // 谷歌
      '谷歌','Google','皮查伊','Sundar Pichai','Alphabet','Pixel',
      'YouTube','Android','Chrome','Waymo','DeepMind',
      // 字节
      '字节跳动','字节','ByteDance','张一鸣','梁汝波'
    ],
    events: [
      '财报','earnings','营收','利润','股价','stock','股价大涨','股价暴跌',
      '裁员','layoff','招聘','hiring','收购','acquire','合并','merger',
      '发布会','发布会直播','WWDC','Google I/O','Build','re:Invent',
      '新品','新品发布','新品泄露','爆料','泄露','leak','rumor',
      'CEO','换帅','离职','高管变动','上市','IPO','分拆'
    ]
  },

  // ── ex3: 宏观经济与政策 ──
  '宏观经济与政策': {
    entities: [
      // 美国政策/经济
      '特朗普','Trump','拜登','Biden','美联储','Fed','鲍威尔','Powell',
      '白宫','White House','美国国会','SEC','美国证券交易委员会',
      // 中国政策/经济
      '国务院','工信部','科技部','发改委','央行','中国人民银行',
      '证监会','财政部','商务部','网信办',
      // 国际机构
      '欧盟','EU','G7','G20','WTO','IMF','世界银行',
      // 宏观指标
      'CPI','PPI','GDP','PMI','非农','就业数据','通胀','deflation',
      '降息','rate cut','加息','rate hike','利率决议','量化宽松','QE',
      // 关税/贸易
      '关税','tariff','贸易战','trade war','贸易壁垒','制裁','sanction',
      '出口管制','export control','实体清单','Entity List',
      // 行业政策
      '芯片法案','CHIPS Act','AI监管','AI regulation','AI法案','AI Act',
      '数据安全','数据隐私','GDPR','版权','copyright','专利','patent',
      '反垄断','antitrust'
    ],
    events: [
      '政策出台','新规','征求意见稿','立法','法案通过','法案否决',
      '制裁加码','制裁放松','关税上调','关税下调','贸易谈判',
      '降息25个基点','暂停加息','开始降息','加息周期',
      '经济数据超预期','不及预期','超预期','不及预期'
    ]
  },

  // ── ex4: 行业上下游动态 ──
  '行业上下游动态': {
    entities: [
      // 芯片/半导体
      '芯片','半导体','semiconductor','台积电','TSMC','三星','Samsung',
      'AMD','Intel','高通','Qualcomm','联发科','MediaTek','Arm',
      'ASML','中芯国际','SMIC','海思','寒武纪','地平线','黑芝麻',
      // 云/基础设施
      'AWS','Azure','Google Cloud','阿里云','腾讯云','华为云','百度云',
      'Oracle','Cloudflare','Snowflake','Databricks',
      // 互联网平台
      'SpaceX','星链','Starlink','TikTok','抖音','微信','WhatsApp',
      'Discord','Reddit','Twitter','X','Pinterest','Snap','Uber','Airbnb',
      // 国内大厂
      '腾讯','阿里','阿里巴巴','Alibaba','百度','Baidu','京东','JD',
      '美团','拼多多','PDD','小红书','网易','NetEase','携程','快手','B站',
      // 新能源/汽车
      '比亚迪','BYD','蔚来','NIO','小鹏','XPeng','理想','Li Auto',
      '宁德时代','CATL','新能源','电动车','EV','充电桩','储能'
    ],
    events: [
      '融资','funding','估值','valuation','IPO','上市','招股书',
      '收购','并购','战略合作','投资入股','撤资',
      '断供','禁用','封杀','下架','违规','被罚','罚款','处罚',
      '新品发布','产品上线','功能更新','重大升级','降价','涨价',
      '财报','营收增长','营收下滑','亏损收窄','首次盈利'
    ]
  },

  // ── ex5: 国内科技与政策（新增细分）──
  '国内科技与政策': {
    entities: [
      // 国产替代/自主可控
      '国产替代','自主可控','信创','鸿蒙','HarmonyOS','昇腾','鲲鹏',
      '华为','Huawei','任正非','中芯国际','寒武纪','龙芯','飞腾',
      // 政策热词
      '新质生产力','人工智能+','数字中国','数字经济','东数西算',
      '算力枢纽','算力网络','算力补贴','大模型备案','算法备案',
      '深度合成','生成式AI管理办法','数据二十条',
      // 央企/国资AI
      '国资委','央企AI','国企改革','国资云','政务大模型',
      // 地方政策
      '北京AI','上海AI','深圳AI','杭州AI','成都AI',
      '人工智能先导区','AI试验区','自贸区'
    ],
    events: [
      '政策发布','指导意见','实施方案','试点','示范','推广',
      '国产突破','首次超越','替代完成','全面替换',
      '通过验收','获得认证','列入目录','补贴发放',
      '监管趋严','监管放松','新规落地','合规检查',
      '两会提案','人大建议','政协提案'
    ]
  },

  // ── ex6: 加密/区块链（国内+国外）──
  '加密/区块链': {
    entities: [
      // 主流币种
      '比特币','BTC','Bitcoin','以太坊','ETH','Ethereum','Solana','SOL',
      'BNB','XRP','ADA','DOGE','狗狗币','SHIB','PEPE','WIF',
      // 交易所/机构
      'Binance','币安','OKX','Coinbase','Kraken','Gemini',
      'Grayscale','贝莱德','BlackRock','ETF','比特币ETF','以太坊ETF',
      // DeFi/协议
      'DeFi','Uniswap','Aave','MakerDAO','Lido','EigenLayer',
      '稳定币','USDT','USDC','DAI','Circle','Tether',
      // 链/基础设施
      '以太坊','Ethereum','Layer 2','L2','Arbitrum','Optimism','Base',
      'Polygon','Avalanche','Near','Sui','Aptos','Cosmos','Polkadot',
      // 国内
      '数字人民币','DCEP','央行数字货币','CBDC','香港Web3','香港虚拟资产',
      'Web3','NFT','数字藏品','元宇宙','metaverse',
      // 矿业
      '矿机','矿场','挖矿','算力','减半','halving','矿池'
    ],
    events: [
      '暴涨','大涨','bull run','牛市','bear market','暴跌','崩盘',
      '突破新高','历史新高','ATH','all-time high','跌破','支撑位',
      'ETF获批','ETF通过','ETF申购','ETF赎回','资金流入','资金流出',
      '黑客攻击','被盗','rug pull','跑路','暴雷','违约',
      '监管打击','非法集资','洗钱','封禁','交易所被查',
      '减半','halving','升级','EIP','分叉','fork','合并','merge',
      'ICO','IEO','IDO','打新','空投','airdrop','质押','staking'
    ]
  },

  // ── ex7: AI工具与创作者生态 ──
  'AI工具与创作者生态': {
    entities: [
      // AI视频
      'Sora','Runway','Gen-3','Pika','可灵','Kling','即梦','Jimeng',
      '海螺AI','MiniMax','PixVerse','Viggle','Luma','DomoAI',
      'AI短视频','AI视频','AI动画','AI电影',
      // AI图像
      'Midjourney','DALL·E','DALL-E','Stable Diffusion','SD','Flux',
      'Ideogram','Leonardo','Adobe Firefly','AI绘画','AI插画','AI设计',
      // AI音频/语音
      'AI配音','Suno','Udio','ElevenLabs','TTS','AI音乐','AI歌声',
      'AI克隆声音','AI播客','AI有声书',
      // AI效率
      'AI写作','AI编程','Cursor','Copilot','AI编程工具','v0','Bolt',
      'AI PPT','AI表格','AI会议','AI翻译','AI笔记','Notion AI',
      // AI数字人/直播
      '数字人','AI数字人','AI主播','AI直播','AI带货','AI客服',
      'AI分身','AI替身','虚拟偶像','虚拟人',
      // 创作者工具
      '剪映','CapCut','Canva','AI剪辑','AI特效','AI转场'
    ],
    events: [
      '教程','如何用','how to','保姆级','零基础','小白也能',
      '赚钱','副业','变现','月入','日赚','收入','搞钱',
      '免费工具','免费AI','白嫖','限时免费','开源','open-source',
      '推荐','推荐几个','神器','效率神器','必备','天花板',
      '翻车','翻车现场','翻车合集','翻车了',
      '取代工作','被AI取代','失业','岗位消失','AI抢饭碗',
      '测评','体验','实测','对比','哪个好','怎么选'
    ]
  },

  // ── ex8: AI争议与负面（高反转/高流量）──
  'AI争议与负面': {
    entities: [
      'AI裁员','layoff','AI取代','AI失业','AI版权','copyright',
      'AI翻车','AI幻觉','hallucination','AI偏见','bias',
      'AI造假','deepfake','AI换脸','AI诈骗','AI钓鱼',
      'AI监管','AI法案','AI限制','AI禁令','AI安全','AI风险',
      'AI伦理','AI隐私','AI数据泄露','AI训练数据',
      '大模型降价','price war','价格战','AI内卷',
      'AI军备竞赛','AI竞赛','AI泡沫','AI过度炒作'
    ],
    events: [
      '道歉','下架','撤回','被罚','罚款','被起诉','lawsuit','诉讼',
      '禁用','封禁','限制','监管','调查','审查','审计',
      '翻车','出错','漏洞','vulnerability','数据泄露','隐私泄露',
      '争议','质疑','批评','反对','抵制','抗议',
      '事故','伤亡','危险','风险','威胁','警告','alert',
      '反转','打脸','回应','辟谣','真相','内幕','揭秘'
    ]
  }
};

// ── 热度加权实体词（出现在标题中直接加分）──
const HOT_ENTITIES = [
  '马斯克','特朗普','英伟达','OpenAI','苹果','华为','字节','腾讯',
  'Elon Musk','NVIDIA','Trump','BTC','Bitcoin','美联储','Fed',
  'SpaceX','特斯拉','DeepSeek','Sora'
];

// ── 事件行为词（高反转/高流量信号）──
const EVENT_SIGNALS = {
  reverse: [
    '反转','打脸','暴跌','暴涨','崩盘','意外','没想到','颠覆','超越',
    '首次','无补贴','被罚','被起诉','禁用','下架','撤回','翻车','造假',
    '泄露','事故','漏洞','内幕','揭秘','辟谣','真相','打破','击败',
    '超越人类','超过人类','世界第一','全球第一'
  ],
  traffic: [
    '如何用','教程','攻略','赚钱','副业','变现','月入','日赚',
    '推荐','排行榜','神器','必备','天花板','免费','开源',
    '预测','揭秘','真相','避坑','对比','测评','实测','哪个好',
    'AI取代','失业','岗位消失','AI抢饭碗'
  ]
};

// ── 工具函数 ──
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    }).on('error', reject);
  });
}

function matchKeywords(text) {
  const matched = [];
  const lower = text.toLowerCase();
  for (const [category, group] of Object.entries(KEYWORDS)) {
    const kws = group.entities || (Array.isArray(group) ? group : []);
    const evts = group.events || [];
    let hitEntity = false;
    let hitEvents = [];
    for (const kw of kws) {
      if (lower.includes(kw.toLowerCase())) {
        hitEntity = true;
        break;
      }
    }
    if (hitEntity) {
      for (const ev of evts) {
        if (lower.includes(ev.toLowerCase())) {
          hitEvents.push(ev);
        }
      }
      matched.push({ category, hitEvents });
    }
  }
  return matched;
}

/**
 * 话题度评分算法
 * 热度(40%) + 反转强度(35%) + 流量潜力(25%)
 */
function scoreTopic(item, category, hitEvents) {
  let hotScore = 50;
  let reverseScore = 30;
  let trafficScore = 40;

  const title = (item.title || '').toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  const fullText = title + ' ' + summary;

  // ── 热度评分 ──
  if (item.hot_value) {
    const hv = parseInt(item.hot_value);
    hotScore = Math.min(100, Math.round(hv / 200000));
  } else {
    // 根据热门实体词推断
    const hotHit = HOT_ENTITIES.filter(e => fullText.includes(e.toLowerCase()));
    hotScore += hotHit.length * 15;
    // 事件行为词额外加分
    const releaseKw = ['发布','突破','暴跌','暴涨','悬赏','登顶','免费','开源','首次','超越','新高'];
    const releaseHit = releaseKw.filter(k => fullText.includes(k.toLowerCase()));
    hotScore += releaseHit.length * 10;
    hotScore = Math.min(100, hotScore);
  }

  // ── 反转强度评分（使用全局 EVENT_SIGNALS + 分类 events）──
  const globalReverseHit = EVENT_SIGNALS.reverse.filter(k => fullText.includes(k.toLowerCase()));
  reverseScore += globalReverseHit.length * 12;
  reverseScore += hitEvents.length * 8;
  reverseScore = Math.min(100, reverseScore);

  // ── 流量潜力评分（使用全局 EVENT_SIGNALS + 分类 events）──
  const globalTrafficHit = EVENT_SIGNALS.traffic.filter(k => fullText.includes(k.toLowerCase()));
  trafficScore += globalTrafficHit.length * 12;
  trafficScore += hitEvents.length * 8;
  // 分类加权
  const trafficWeight = {
    'AI工具与创作者生态': 25,
    'AI争议与负面': 28,
    '宏观经济与政策': 20,
    'AI核心动态': 20,
    '科技巨头核心动态': 18,
    '加密/区块链': 22,
    '行业上下游动态': 15,
    '国内科技与政策': 12
  };
  trafficScore += (trafficWeight[category] || 10);
  trafficScore = Math.min(100, trafficScore);

  const total = Math.round(hotScore * 0.4 + reverseScore * 0.35 + trafficScore * 0.25);

  return { hotScore, reverseScore, trafficScore, total };
}

// ── 主逻辑 ──
async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes('--json');
  const doPush = args.includes('--push');

  // 1. 获取 AI HOT 日报
  let aihotItems = [];
  try {
    const data = await fetchUrl('https://aihot.virxact.com/api/public/daily');
    const sections = data.sections || [];
    sections.forEach(s => {
      (s.items || []).forEach(item => {
        aihotItems.push({ ...item, _source: 'AI HOT', _section: s.label });
      });
    });
  } catch (e) {
    console.error('[WARN] AI HOT 获取失败:', e.message);
  }

  // 2. 获取抖音热榜
  let douyinItems = [];
  try {
    const douyinScript = path.resolve(__dirname, '..', '..', 'douyin-hot', 'scripts', 'douyin.js');
    const raw = execFileSync('node', [douyinScript, 'hot', '50'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' }
    });
    // 解析 douyin.js 输出
    const lines = raw.split('\n');
    let current = null;
    lines.forEach(line => {
      const m = line.match(/^\s*(\d+)\.\s+(.+)/);
      if (m) {
        current = { title: m[2].trim(), _source: '抖音热榜', hot_value: 0 };
        const hm = line.match(/热度:\s*([\d,]+)/);
        if (hm) current.hot_value = parseInt(hm[1].replace(/,/g, ''));
        douyinItems.push(current);
      }
    });
  } catch (e) {
    console.error('[WARN] 抖音热榜获取失败:', e.message);
  }

  // 3. 合并 + 分类 + 评分
  const allItems = [...aihotItems, ...douyinItems];
  const categorized = {};

  Object.keys(KEYWORDS).forEach(cat => { categorized[cat] = []; });

  allItems.forEach(item => {
    const text = (item.title || '') + ' ' + (item.summary || '');
    const matches = matchKeywords(text);
    matches.forEach(m => {
      const score = scoreTopic(item, m.category, m.hitEvents);
      categorized[m.category].push({
        ...item,
        _score: score,
        _hitEvents: m.hitEvents,
        _categories: matches.map(x => x.category)
      });
    });
  });

  // 4. 输出报告
  const date = new Date().toISOString().slice(0, 10);
  const report = { date, categories: {} };

  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length === 0) continue;
    const sorted = items.sort((a, b) => b._score.total - a._score.total);
    report.categories[cat] = sorted.slice(0, 5).map(i => ({
      title: i.title,
      score: i._score,
      source: i._source,
      hot_value: i.hot_value || null,
      url: i.sourceUrl || i.url || null
    }));
  }

  if (outputJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (doPush) {
    // 标记需要推送（由外部自动化读取 stdout 或文件）
    const outputDir = process.env.INFO_RADAR_OUTPUT_DIR || path.join(process.cwd(), '_outputs', 'ai-topic-monitor');
    fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, `ai-topic-report-${date}.json`);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\n[PUSH] 报告已保存至: ${outPath}`);
  }
}

function printReport(report) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AI 选题监控日报 · ${report.date}`);
  console.log(`${'='.repeat(60)}`);

  const rankIcon = ['🥇','🥈','🥉','④','⑤'];

  for (const [cat, items] of Object.entries(report.categories)) {
    console.log(`\n── ${cat} ──`);
    items.forEach((item, idx) => {
      const s = item.score;
      const icon = rankIcon[idx] || `  ${idx+1}`;
      console.log(`  ${icon} [${s.total}分] ${item.title}`);
      console.log(`      热度:${s.hotScore} 反转:${s.reverseScore} 流量:${s.trafficScore}  |  来源:${item.source}`);
      if (item.url) console.log(`      ${item.url}`);
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('  生成时间:', new Date().toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'}));
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(e => { console.error('[FATAL]', e); process.exit(1); });
