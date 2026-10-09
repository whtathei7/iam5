// 线路优化的纯逻辑。订阅生成时由 _worker.js 调用，单测直接引用本文件。
// 思路借鉴 CFNext 公开方案：优选池优先、随机补足封顶、测活剔除、保底前置、IPv6 后置、头部轮换。
// 实现独立，不复制其源码。

export const 内置地区代码 = ['HK', 'TW', 'JP', 'SG', 'US', 'KR'];
export const 实测优选源 = [
  'https://bestcf.pages.dev/uouin/all.txt',
  'https://bestcf.pages.dev/cfyes/ipv4.txt'
];
export const 六版优选源 = 'https://bestcf.pages.dev/cfyes/ipv6.txt';
export const 低延迟网段 = [
  '104.16.0.0/16',
  '104.17.0.0/16',
  '104.18.0.0/16',
  '104.19.0.0/16',
  '104.24.0.0/16',
  '172.64.0.0/16',
  '162.158.0.0/16'
];

const 地区中文 = {
  HK: '香港',
  TW: '台湾',
  JP: '日本',
  SG: '新加坡',
  US: '美国',
  KR: '韩国',
  DE: '德国'
};

export function 开关值(值, 默认启用 = false) {
  if (值 === undefined || 值 === null || 值 === '') return 默认启用;
  if (值 === true || 值 === false) return 值;
  const 文本 = String(值).trim().toLowerCase();
  if (文本 === 'yes' || 文本 === 'true' || 文本 === '1' || 文本 === 'on') return true;
  if (文本 === 'no' || 文本 === 'false' || 文本 === '0' || 文本 === 'off') return false;
  return 默认启用;
}

export function 整理数量(值, 默认值 = 36) {
  const 数字 = parseInt(值, 10);
  if (!Number.isFinite(数字)) return 默认值;
  return Math.min(120, Math.max(8, 数字));
}

export function 整理六版策略(值) {
  const 文本 = String(值 || 'off').trim().toLowerCase();
  return ['off', 'backup', 'mix'].includes(文本) ? 文本 : 'off';
}

export function 整理地区(值) {
  const 文本 = String(值 || 'all').trim().toUpperCase();
  if (!文本 || 文本 === 'ALL') return 'all';
  return ['HK', 'TW', 'JP', 'SG', 'US', 'KR', 'DE'].includes(文本) ? 文本 : 'all';
}

export function 是安全优选网址(值) {
  try {
    const 网址 = new URL(String(值).trim());
    if (网址.protocol !== 'https:') return false;
    const 主机 = 网址.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!主机 || 主机 === 'localhost' || 主机.endsWith('.local') || 主机 === 'metadata.google.internal') return false;
    if (主机 === '::1' || 主机 === '0.0.0.0') return false;
    const 四版 = 主机.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (四版) {
      const 段 = 四版.slice(1).map(Number);
      if (段.some(节 => 节 > 255)) return false;
      if (段[0] === 10 || 段[0] === 127 || 段[0] === 0) return false;
      if (段[0] === 169 && 段[1] === 254) return false;
      if (段[0] === 192 && 段[1] === 168) return false;
      if (段[0] === 172 && 段[1] >= 16 && 段[1] <= 31) return false;
    }
    return true;
  } catch (错误) {
    return false;
  }
}

export function 整理兜底池(值) {
  return String(值 || '')
    .split(/[\n,;]+/)
    .map(项 => 项.trim())
    .filter(是安全优选网址)
    .slice(0, 6);
}

export function 整理线路选项(输入 = {}) {
  const ipv4 = 开关值(输入.ipv4, true);
  const ipv6 = 开关值(输入.ipv6, false);
  return {
    enabled: 开关值(输入.opt, true),
    limit: 整理数量(输入.optLimit, 36),
    probe: 开关值(输入.optProbe, true),
    balance: 开关值(输入.optBalance, true),
    anchor: 开关值(输入.optAnchor, true),
    merge: 开关值(输入.optMerge, false),
    v6policy: 整理六版策略(输入.v6policy),
    region: 整理地区(输入.optRegion),
    ipv4: ipv4 || !ipv6,
    ipv6,
    mobile: 开关值(输入.ispMobile, true),
    unicom: 开关值(输入.ispUnicom, true),
    telecom: 开关值(输入.ispTelecom, true),
    pool: 整理兜底池(输入.optPool)
  };
}

export function 内置地区源(地区) {
  return `https://bestcf.pages.dev/random-region/${地区}/10.txt`;
}

export function 地址种类(地址) {
  const 文本 = String(地址 || '').trim();
  if (!文本 || 文本.includes('/') || /\s/.test(文本)) return '';
  if (文本.includes(':')) {
    if (!/^[0-9a-fA-F:]+$/.test(文本) || !文本.includes(':')) return '';
    return 'v6';
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(文本) && 文本.split('.').every(节 => Number(节) <= 255)) return 'v4';
  if (/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(文本)) return 'domain';
  return '';
}

export function 节点键(节点) {
  return `${节点.ip}|${节点.port || 443}`;
}

function 识别地区(文本) {
  const 原文 = String(文本 || '');
  for (const [码, 名称] of Object.entries(地区中文)) {
    if (原文.includes(名称)) return { 名: 名称, 码 };
  }
  const 码表 = { HKG: 'HK', TPE: 'TW', NRT: 'JP', HND: 'JP', KIX: 'JP', SIN: 'SG', ICN: 'KR', FRA: 'DE', HK: 'HK', TW: 'TW', JP: 'JP', SG: 'SG', US: 'US', KR: 'KR', DE: 'DE' };
  const 匹配 = 原文.toUpperCase().match(/\b(HKG|TPE|NRT|HND|KIX|SIN|ICN|FRA|HK|TW|JP|SG|US|KR|DE)\b/);
  if (!匹配) return null;
  const 码 = 码表[匹配[1]];
  return { 名: 地区中文[码], 码 };
}

function 识别线路(文本) {
  const 原文 = String(文本 || '');
  if (原文.includes('移动')) return '移动';
  if (原文.includes('联通')) return '联通';
  if (原文.includes('电信')) return '电信';
  if (原文.includes('多线') || /\bBGP\b/i.test(原文)) return '多线';
  return '';
}

function 切出地址(文本) {
  let 剩余 = String(文本 || '').trim();
  if (!剩余) return null;
  if (剩余.startsWith('[')) {
    const 右 = 剩余.indexOf(']');
    if (右 < 0) return null;
    const 地址 = 剩余.slice(1, 右);
    const 尾部 = 剩余.slice(右 + 1);
    if (尾部 && !/^:\d+$/.test(尾部)) return null;
    return { address: 地址, port: 尾部 ? parseInt(尾部.slice(1), 10) : null };
  }
  const 冒号 = 剩余.lastIndexOf(':');
  if (冒号 > 0 && /^\d+$/.test(剩余.slice(冒号 + 1)) && !剩余.slice(0, 冒号).includes(':')) {
    return { address: 剩余.slice(0, 冒号), port: parseInt(剩余.slice(冒号 + 1), 10) };
  }
  return { address: 剩余, port: null };
}

export function 解析优选行(行, 配置 = {}) {
  let 文本 = String(行 || '').replace(/^\uFEFF/, '').trim();
  if (!文本 || 文本.startsWith('#') || 文本.startsWith('<') || /^https?:\/\//i.test(文本)) return null;
  let 备注 = '';
  const 井号 = 文本.indexOf('#');
  if (井号 >= 0) {
    备注 = 文本.slice(井号 + 1).trim();
    文本 = 文本.slice(0, 井号).trim();
  }
  const 地址段 = 切出地址(文本);
  if (!地址段) return null;
  const 种类 = 地址种类(地址段.address);
  if (!种类) return null;
  const 端口 = 地址段.port && 地址段.port > 0 && 地址段.port <= 65535 ? 地址段.port : 443;
  const 地区 = 识别地区(备注);
  const 线路 = 识别线路(备注);
  const 延迟匹配 = 备注.match(/(\d+(?:\.\d+)?)\s*ms/i);
  const 速度匹配 = 备注.match(/(\d+(?:\.\d+)?)\s*mb\/s/i);
  const 偏向地区 = 配置.prefer === 'region';
  const 名称 = (偏向地区 ? (地区 && 地区.名) || 线路 : 线路 || (地区 && 地区.名)) || 配置.fallbackName || '优选IP';
  return {
    ip: 地址段.address,
    port: 端口,
    isp: 名称,
    tier: 配置.tier == null ? 1 : 配置.tier,
    kind: 种类,
    latency: 延迟匹配 ? Number(延迟匹配[1]) : null,
    speed: 速度匹配 ? Number(速度匹配[1]) : 0,
    region: 地区 ? 地区.码 : ''
  };
}

export function 解析优选文本(文本, 配置 = {}) {
  const 上限 = 配置.maxLines || 80;
  const 结果 = [];
  const 行列表 = String(文本 || '').split(/\r?\n/);
  for (const 行 of 行列表) {
    if (结果.length >= 上限) break;
    const 节点 = 解析优选行(行, 配置);
    if (节点) 结果.push(节点);
  }
  return 结果;
}

export function 比较优选(甲, 乙) {
  if ((甲.tier || 0) !== (乙.tier || 0)) return (甲.tier || 0) - (乙.tier || 0);
  const 甲延迟 = 甲.latency == null ? 1e9 : 甲.latency;
  const 乙延迟 = 乙.latency == null ? 1e9 : 乙.latency;
  if (甲延迟 !== 乙延迟) return 甲延迟 - 乙延迟;
  return (乙.speed || 0) - (甲.speed || 0);
}

export function 合并去重(列表) {
  const 表 = new Map();
  for (const 节点 of 列表 || []) {
    if (!节点 || !节点.ip) continue;
    const 键 = 节点键(节点);
    const 已有 = 表.get(键);
    if (!已有 || 比较优选(节点, 已有) < 0) 表.set(键, 节点);
  }
  return [...表.values()];
}

function 允许运营商(节点, 选项) {
  const 名称 = `${节点.isp || ''} ${节点.region || ''}`;
  if (名称.includes('移动') && !选项.mobile) return false;
  if (名称.includes('联通') && !选项.unicom) return false;
  if (名称.includes('电信') && !选项.telecom) return false;
  return true;
}

function 命中地区(节点, 地区) {
  if (!地区 || 地区 === 'all') return true;
  if (节点.tier === 0 || 节点.kind === 'domain') return true;
  if (节点.tier === 1 && !节点.region) return true;
  return 节点.region === 地区 || (节点.isp || '').includes(地区中文[地区] || 地区);
}

export function 筛选优选(列表, 选项) {
  const 四版开启 = 选项.ipv4 || !选项.ipv6;
  return (列表 || []).filter(节点 => {
    if (!节点 || !节点.kind) return false;
    if (节点.kind === 'v6' && (!选项.ipv6 || 选项.v6policy === 'off') && 四版开启) return false;
    if (节点.kind === 'v4' && !四版开启 && 选项.ipv6) return false;
    if (!允许运营商(节点, 选项)) return false;
    if (!命中地区(节点, 选项.region)) return false;
    return true;
  });
}

export function 挑选测活样本(列表, 上限 = 24) {
  const 保底 = (列表 || []).filter(节点 => 节点.tier === 0 && 节点.kind !== 'domain');
  const 其余 = (列表 || []).filter(节点 => 节点.tier !== 0 && 节点.kind !== 'domain').sort(比较优选);
  const 选出 = [];
  const 已见 = new Set();
  const 放入 = 节点 => {
    if (选出.length >= 上限) return;
    const 键 = 节点键(节点);
    if (已见.has(键)) return;
    已见.add(键);
    选出.push(节点);
  };
  保底.forEach(放入);
  const 按组 = new Map();
  for (const 节点 of 其余) {
    const 组 = 节点.region || 节点.isp || '其他';
    if (!按组.has(组)) 按组.set(组, []);
    按组.get(组).push(节点);
  }
  const 组列表 = [...按组.values()];
  let 轮次 = 0;
  while (选出.length < 上限 && 组列表.some(组 => 组.length > 轮次)) {
    for (const 组 of 组列表) {
      if (选出.length >= 上限) break;
      if (组[轮次]) 放入(组[轮次]);
    }
    轮次++;
  }
  return 选出;
}

export function 应用测活结果(列表, 存活键, 已探测键, 选项) {
  if (!选项.probe) return 列表;
  const 存活 = new Set(存活键 || []);
  const 已探测 = new Set(已探测键 || []);
  if (!已探测.size) return 列表;
  const 活着 = (列表 || []).filter(节点 => 存活.has(节点键(节点)));
  if (!活着.length) return 列表;
  if (活着.length >= Math.min(8, 选项.limit || 8)) return 活着;
  const 未测 = (列表 || []).filter(节点 => !已探测.has(节点键(节点)));
  return 活着.concat(未测);
}

export function 轮换序列(列表, 现在 = Date.now(), 窗口 = 8, 间隔毫秒 = 300000) {
  if (!列表 || 列表.length <= 1) return (列表 || []).slice();
  const 跨度 = Math.min(窗口, 列表.length);
  const 偏移 = Math.floor(现在 / 间隔毫秒) % 跨度;
  if (!偏移) return 列表.slice();
  return 列表.slice(偏移).concat(列表.slice(0, 偏移));
}

export function 编排优选节点(列表, 选项, 现在 = Date.now()) {
  const 四版开启 = 选项.ipv4 || !选项.ipv6;
  const 筛选 = 筛选优选(合并去重(列表), 选项);
  const 保底 = 筛选.filter(节点 => 节点.tier === 0 && 节点.kind !== 'domain');
  const 域名 = 筛选.filter(节点 => 节点.kind === 'domain');
  const 四版 = 筛选.filter(节点 => 节点.kind === 'v4' && 节点.tier !== 0).sort(比较优选);
  const 六版 = 筛选.filter(节点 => 节点.kind === 'v6').sort(比较优选);
  const 保底序 = 选项.balance ? 轮换序列(保底, 现在, 保底.length, 300000) : 保底;
  const 四版序 = 选项.balance ? 轮换序列(四版, 现在, Math.min(8, 四版.length), 300000) : 四版;
  let 主体;
  if (!四版开启 && 选项.ipv6) {
    主体 = 六版.concat(域名);
  } else if (!选项.ipv6 || 选项.v6policy === 'off') {
    主体 = 保底序.concat(四版序, 域名);
  } else if (选项.v6policy === 'mix') {
    const 混合 = [];
    const 次数 = Math.max(四版序.length, 六版.length);
    for (let 索引 = 0; 索引 < 次数; 索引++) {
      if (四版序[索引]) 混合.push(四版序[索引]);
      if (六版[索引]) 混合.push(六版[索引]);
    }
    主体 = 保底序.concat(混合, 域名);
  } else {
    const 限额 = Math.max(1, Math.floor((选项.limit || 36) * 0.15));
    主体 = 保底序.concat(四版序, 域名, 六版.slice(0, 限额));
  }
  return 主体.slice(0, 选项.limit || 36);
}

export function 生成保底节点(地址列表) {
  return (地址列表 || []).filter(Boolean).map(地址 => ({
    ip: String(地址).trim(),
    port: 443,
    isp: '保底',
    tier: 0,
    kind: 'v4',
    latency: null,
    speed: 0,
    region: ''
  }));
}

function 网段数值(地址) {
  return String(地址).split('.').reduce((值, 节) => ((值 << 8) + Number(节)) >>> 0, 0);
}

export function 地址位于网段(地址, 网段) {
  const [基址, 掩码文本] = 网段.split('/');
  const 掩码 = Number(掩码文本);
  const 位 = 掩码 === 0 ? 0 : (0xffffffff << (32 - 掩码)) >>> 0;
  return (网段数值(地址) & 位) === (网段数值(基址) & 位);
}

export function 随机地址来自网段(网段, 随机 = Math.random) {
  const [基址, 掩码文本] = 网段.split('/');
  const 掩码 = Number(掩码文本);
  const 容量 = 2 ** (32 - 掩码);
  const 偏移 = Math.floor(随机() * Math.max(1, 容量 - 2)) + 1;
  const 地址值 = (网段数值(基址) + 偏移) >>> 0;
  return [24, 16, 8, 0].map(位移 => (地址值 >>> 位移) & 255).join('.');
}

export function 随机补足节点(数量, 随机 = Math.random) {
  const 结果 = [];
  const 已见 = new Set();
  let 保护 = 0;
  while (结果.length < 数量 && 保护 < 数量 * 8) {
    保护++;
    const 网段 = 低延迟网段[Math.floor(随机() * 低延迟网段.length)];
    const ip = 随机地址来自网段(网段, 随机);
    if (已见.has(ip) || !地址位于网段(ip, 网段)) continue;
    已见.add(ip);
    结果.push({ ip, port: 443, isp: '随机补足', tier: 5, kind: 'v4', latency: null, speed: 0, region: '' });
  }
  return 结果;
}

export function 短哈希(文本) {
  let 值 = 2166136261;
  const 串 = String(文本 || '');
  for (let 索引 = 0; 索引 < 串.length; 索引++) {
    值 ^= 串.charCodeAt(索引);
    值 = Math.imul(值, 16777619);
  }
  return (值 >>> 0).toString(16);
}

export function 压缩节点(节点) {
  return [节点.ip, 节点.port || 443, 节点.isp || '', 节点.tier || 0, 节点.kind || 'v4', 节点.latency == null ? null : 节点.latency, 节点.speed || 0, 节点.region || ''];
}

export function 展开节点(项) {
  if (!项) return null;
  if (!Array.isArray(项)) {
    if (!项.ip) return null;
    return {
      ip: 项.ip,
      port: 项.port || 443,
      isp: 项.isp || '',
      tier: 项.tier || 0,
      kind: 项.kind || 地址种类(项.ip),
      latency: 项.latency == null ? null : 项.latency,
      speed: 项.speed || 0,
      region: 项.region || ''
    };
  }
  if (!项[0]) return null;
  return {
    ip: 项[0],
    port: 项[1] || 443,
    isp: 项[2] || '',
    tier: 项[3] || 0,
    kind: 项[4] || 'v4',
    latency: 项[5] == null ? null : 项[5],
    speed: 项[6] || 0,
    region: 项[7] || ''
  };
}

export function 可持久化节点(列表) {
  return (列表 || []).filter(节点 => 节点 && 节点.ip && 节点.tier !== 5 && 节点.kind !== 'domain').slice(0, 80);
}

export function 持久化摘要(列表) {
  return 短哈希(可持久化节点(列表).map(节点 => `${节点.tier}|${节点键(节点)}`).join(','));
}

export function 缓存时间戳(现在, 探测有效, 新鲜毫秒) {
  if (探测有效) return 现在;
  return 现在 - 新鲜毫秒 + 2 * 60 * 1000;
}

export function 判断缓存写入(账本, 现在, 哈希) {
  const 日 = new Date(现在).toISOString().slice(0, 10);
  const 当前 = 账本 && 账本.day === 日 ? { ...账本 } : { day: 日, writes: 0, lastAt: 0, hash: '' };
  if (!哈希 || 当前.hash === 哈希) return { ok: false, reason: 'same', 账本: 当前 };
  if (当前.lastAt && 现在 - 当前.lastAt < 10 * 60 * 1000) return { ok: false, reason: 'gate', 账本: 当前 };
  if (当前.writes >= 24) return { ok: false, reason: 'budget', 账本: 当前 };
  return {
    ok: true,
    reason: 'write',
    账本: { day: 日, writes: 当前.writes + 1, lastAt: 现在, hash: 哈希 }
  };
}

export function 并发映射(列表, 并发, 任务) {
  const 结果 = new Array(列表.length);
  let 游标 = 0;
  const 工人 = async () => {
    for (;;) {
      const 索引 = 游标++;
      if (索引 >= 列表.length) return;
      结果[索引] = await 任务(列表[索引], 索引);
    }
  };
  const 人数 = Math.max(1, Math.min(并发 || 1, 列表.length || 1));
  return Promise.all(Array.from({ length: 列表.length ? 人数 : 0 }, () => 工人())).then(() => 结果);
}
