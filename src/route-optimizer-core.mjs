// 线路优化的纯逻辑。订阅生成时由 _worker.js 调用，单测直接引用本文件。
// 思路借鉴 CFNext：按测速和延迟挑高质量地址、443 优先、分运营商留名额、订阅里提供自动选择最快节点。
// 主力来自 BestCF 首页列出的电信、移动实测结果；联通和地区中转只作补位。
// Worker 上的握手只能证明 Cloudflare 边缘自己能连，不能据此丢掉用户侧已经测过速度的地址。
// 实现独立，不复制其源码。

export const 内置地区代码 = ['HK', 'TW', 'JP', 'SG', 'US', 'KR'];
export const 地区云墙源 = {
  HK: 'https://bestcf.pages.dev/random-region/HK/20.txt',
  TW: 'https://bestcf.pages.dev/random-region/TW/20.txt',
  JP: 'https://bestcf.pages.dev/random-region/JP/20.txt',
  SG: 'https://bestcf.pages.dev/random-region/SG/20.txt',
  US: 'https://bestcf.pages.dev/random-region/US/20.txt',
  KR: 'https://bestcf.pages.dev/random-region/KR/20.txt',
  DE: 'https://bestcf.pages.dev/random-region/DE/20.txt'
};
// BestCF 首页上带运营商标签或实测速度的源。电信、移动是主力；联通只留少量。
// 微测、麒麟、CFYes、vvHan 都在 bestcf.pages.dev，必须按标签拆开。
// 后三个是首页列出的电信/移动专线，地址不在 Cloudflare 官方网段，按社区中转处理。
export const 主力优选源 = [
  { url: 'https://bestcf.pages.dev/uouin/all.txt', isps: ['电信', '移动', '联通'], taggedOnly: true, relay: false, maxLines: 80, limits: { 电信: 8, 移动: 6, 联通: 3 } },
  { url: 'https://bestcf.pages.dev/wetest/ipv4.txt', isps: ['电信', '移动', '联通'], taggedOnly: true, relay: false, maxLines: 40, limits: { 电信: 5, 移动: 5, 联通: 2 } },
  { url: 'https://bestcf.pages.dev/cfyes/ipv4.txt', isps: ['电信', '移动', '联通'], taggedOnly: true, relay: false, maxLines: 40, limits: { 电信: 5, 移动: 5, 联通: 2 } },
  { url: 'https://bestcf.pages.dev/vvhan/ipv4.txt', isps: ['电信', '移动'], taggedOnly: true, relay: false, maxLines: 80, limits: { 电信: 4, 移动: 4 } },
  { url: 'https://cf.junzhen.qzz.io/best_ips_bj.txt', isps: ['电信'], taggedOnly: false, relay: true, maxLines: 80, limits: { 电信: 4 } },
  { url: 'https://raw.githubusercontent.com/love-ztm/cfip/refs/heads/main/best_ips.txt', isps: ['电信'], taggedOnly: false, relay: true, maxLines: 40, limits: { 电信: 4 } },
  { url: 'https://raw.githubusercontent.com/svip-s/cloudflare_ip/refs/heads/main/best_ips.txt', isps: ['移动'], taggedOnly: false, relay: true, maxLines: 40, limits: { 移动: 4 } }
];
export const 优选域名源 = 'https://bestcf.pages.dev/domain/all.txt';
export const 六版优选源 = 'https://bestcf.pages.dev/cfyes/ipv6.txt';
export const 运营商顺序 = ['电信', '移动', '联通', '多线', '中转', '其他'];
export const 主力节拍 = ['电信', '移动', '电信', '移动', '联通', '中转', '多线', '其他'];
export const 自动测速网址 = 'https://www.gstatic.com/generate_204';
export const 云墙安全端口 = [443, 2053, 2083, 2087, 2096, 8443];
export const 云墙明文端口 = [80, 8080, 8880, 2052, 2082, 2086, 2095];
export const 云墙四版网段 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22'
];
export const 云墙六版网段 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32'
];
// 2026-10-09 对 entryip 列表做过 TLS 握手，只留下能完成握手的地址。旧的内置直连地址握手超时，不能再当保底。
export const 实测入口地址 = [
  '104.16.0.1',
  '104.17.0.1',
  '104.18.0.1',
  '104.19.0.1',
  '104.20.0.1',
  '104.21.0.1',
  '104.24.0.1',
  '104.25.0.1',
  '104.26.0.1',
  '104.27.0.1',
  '103.31.4.1',
  '108.162.192.1',
  '108.162.193.1',
  '108.162.194.1',
  '141.101.115.1',
  '141.101.120.1',
  '162.159.192.1',
  '162.159.193.1',
  '162.159.195.1',
  '172.65.0.1',
  '172.66.0.1',
  '188.114.96.1',
  '188.114.97.1',
  '188.114.98.1',
  '188.114.99.1',
  '190.93.244.1'
];
export const 低延迟网段 = [
  '104.16.0.0/16',
  '104.17.0.0/16',
  '104.18.0.0/16',
  '104.19.0.0/16',
  '104.24.0.0/16',
  '104.25.0.0/16',
  '104.26.0.0/16'
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

export function 解析独立入口配置(值, 当前域名 = '') {
  const 当前 = String(当前域名 || '').trim().toLowerCase();
  const 唯一标识 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const 结果 = [];
  const 已见 = new Set();
  for (const 原项 of String(值 || '').split(/[\n,;]+/)) {
    const 文本 = 原项.trim();
    if (!文本) continue;
    try {
      const 网址 = new URL(文本);
      const 域名 = 网址.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      const 用户 = decodeURIComponent(网址.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
      if (网址.protocol !== 'https:' || 地址种类(域名) !== 'domain' || 域名 === 当前 || !唯一标识.test(用户)) continue;
      const 键 = `${域名}|${用户}`;
      if (已见.has(键)) continue;
      已见.add(键);
      const 标签 = decodeURIComponent(网址.hash.slice(1)).replace(/[\r\n|]/g, '').trim().slice(0, 24);
      结果.push({ domain: 域名, uuid: 用户, name: 标签 || `独立入口${结果.length + 1}` });
      if (结果.length >= 2) break;
    } catch (错误) {}
  }
  return 结果;
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
  return 地区云墙源[地区] || '';
}

export function 规范云墙端口(端口, 保留原样 = false) {
  const 值 = Number(端口) || 443;
  if (保留原样) return 值 > 0 && 值 <= 65535 ? 值 : 443;
  if (云墙安全端口.includes(值) || 云墙明文端口.includes(值)) return 值;
  return 443;
}

export function 展开六版(地址) {
  const 文本 = String(地址 || '').trim().toLowerCase();
  if (!文本 || 文本.includes('.')) return null;
  const 左右 = 文本.split('::');
  if (左右.length > 2) return null;
  const 解析 = 段 => 段 ? 段.split(':').filter(Boolean) : [];
  const 左 = 解析(左右[0]);
  const 右 = 左右.length === 2 ? 解析(左右[1]) : [];
  if (左右.length === 1 && 左.length !== 8) return null;
  const 缺 = 8 - 左.length - 右.length;
  if (缺 < 0) return null;
  const 段 = 左.concat(Array(缺).fill('0'), 右);
  const 数 = 段.map(项 => (/^[0-9a-f]{1,4}$/.test(项) ? parseInt(项, 16) : NaN));
  if (数.length !== 8 || 数.some(项 => Number.isNaN(项))) return null;
  return 数;
}

export function 位于六版网段(地址, 网段) {
  const [基址, 掩码文本] = String(网段 || '').split('/');
  const 掩码 = Number(掩码文本);
  const 甲 = 展开六版(地址);
  const 乙 = 展开六版(基址);
  if (!甲 || !乙 || !Number.isFinite(掩码)) return false;
  let 剩余 = 掩码;
  for (let 索引 = 0; 索引 < 8 && 剩余 > 0; 索引++) {
    const 位 = Math.min(16, 剩余);
    const 遮 = 位 === 16 ? 0xffff : ((0xffff << (16 - 位)) & 0xffff);
    if ((甲[索引] & 遮) !== (乙[索引] & 遮)) return false;
    剩余 -= 位;
  }
  return true;
}

export function 位于云墙网段(地址) {
  const 种类 = 地址种类(地址);
  if (种类 === 'v4') return 云墙四版网段.some(网段 => 地址位于网段(地址, 网段));
  if (种类 === 'v6') return 云墙六版网段.some(网段 => 位于六版网段(地址, 网段));
  return false;
}

export function 是公网地址(地址) {
  const 种类 = 地址种类(地址);
  if (种类 === 'v6') {
    const 段 = 展开六版(地址);
    if (!段) return false;
    if (段.every(节 => 节 === 0)) return false;
    if (段[0] === 0 && 段.slice(1, 7).every(节 => 节 === 0) && 段[7] === 1) return false;
    if (段[0] >= 0xfe80 && 段[0] <= 0xfebf) return false;
    if ((段[0] & 0xfe00) === 0xfc00) return false;
    if ((段[0] & 0xff00) === 0xff00) return false;
    return true;
  }
  if (种类 !== 'v4') return false;
  const 段 = 地址.split('.').map(Number);
  const [甲, 乙] = 段;
  if (段.some(节 => 节 > 255) || 甲 === 0 || 甲 === 10 || 甲 === 127 || 甲 >= 224) return false;
  if (甲 === 100 && 乙 >= 64 && 乙 <= 127) return false;
  if (甲 === 169 && 乙 === 254) return false;
  if (甲 === 172 && 乙 >= 16 && 乙 <= 31) return false;
  if (甲 === 192 && (乙 === 168 || 乙 === 0)) return false;
  if (甲 === 198 && (乙 === 18 || 乙 === 19 || 乙 === 51)) return false;
  if (甲 === 203 && 乙 === 0) return false;
  return true;
}

export function 可拨号节点(节点, 允许外部 = false) {
  if (!节点 || !节点.ip || !节点.kind) return false;
  if (节点.kind === 'domain') return true;
  if (!是公网地址(节点.ip)) return false;
  if (允许外部 || 节点.pinned || 节点.relay) return true;
  return 位于云墙网段(节点.ip);
}

export function 运营商名(节点) {
  const 名 = String((节点 && 节点.isp) || '');
  if (名.includes('移动')) return '移动';
  if (名.includes('联通')) return '联通';
  if (名.includes('电信')) return '电信';
  if (名.includes('多线')) return '多线';
  if (节点 && (节点.relay || 节点.region)) return '中转';
  return '其他';
}

export function 分组键(节点) {
  if (!节点 || 节点.kind === 'domain') return '域名';
  if (节点.pinned) return '自定义';
  if (节点.relay) return `中转:${节点.region || 节点.isp || 'XX'}`;
  return 运营商名(节点);
}

export function 社区节点(节点) {
  return !!(节点 && 节点.tier !== 5 && (节点.sourced || 节点.relay || 节点.pinned || 节点.latency != null || 节点.speed > 0));
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
  const 速度值 = 解析速度(备注);
  const 偏向地区 = 配置.prefer === 'region';
  const 名称 = (偏向地区 ? (地区 && 地区.名) || 线路 : 线路 || (地区 && 地区.名)) || 配置.fallbackName || '优选IP';
  return {
    ip: 地址段.address,
    port: 端口,
    isp: 名称,
    tier: 配置.tier == null ? 1 : 配置.tier,
    kind: 种类,
    latency: 延迟匹配 ? Number(延迟匹配[1]) : null,
    speed: 速度值,
    region: 地区 ? 地区.码 : ''
  };
}

export function 解析速度(备注) {
  const 文本 = String(备注 || '');
  const 比特 = 文本.match(/(\d+(?:\.\d+)?)\s*mbps\b/i);
  if (比特) return Math.round((Number(比特[1]) / 8) * 100) / 100;
  const 字节 = 文本.match(/(\d+(?:\.\d+)?)\s*mb\/s\b/i);
  if (字节) return Number(字节[1]);
  const 简写 = 文本.match(/(\d+(?:\.\d+)?)\s*m(?=\s|\]|\)|$)/i);
  return 简写 ? Number(简写[1]) : 0;
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
  const 甲失败串 = Math.max(0, Number(甲.failureStreak) || 0);
  const 乙失败串 = Math.max(0, Number(乙.failureStreak) || 0);
  const 甲等级 = (甲.tier || 0) + (甲失败串 >= 3 ? 2 : 甲失败串 ? 1 : 0);
  const 乙等级 = (乙.tier || 0) + (乙失败串 >= 3 ? 2 : 乙失败串 ? 1 : 0);
  if (甲等级 !== 乙等级) return 甲等级 - 乙等级;
  const 甲样本 = (Number(甲.successes) || 0) + (Number(甲.failures) || 0);
  const 乙样本 = (Number(乙.successes) || 0) + (Number(乙.failures) || 0);
  if (甲样本 >= 2 || 乙样本 >= 2) {
    const 甲率 = 历史成功率(甲);
    const 乙率 = 历史成功率(乙);
    if (甲率 !== 乙率) return 乙率 - 甲率;
  }
  const 甲速 = Number(甲.speed) || 0;
  const 乙速 = Number(乙.speed) || 0;
  if (甲速 > 0 && 乙速 > 0 && 甲速 !== 乙速) return 乙速 - 甲速;
  const 甲延迟 = 甲.latency == null ? 1e9 : 甲.latency;
  const 乙延迟 = 乙.latency == null ? 1e9 : 乙.latency;
  if (甲延迟 !== 乙延迟) return 甲延迟 - 乙延迟;
  if (甲速 !== 乙速) return 乙速 - 甲速;
  const 甲口 = Number(甲.port) === 443 ? 0 : 1;
  const 乙口 = Number(乙.port) === 443 ? 0 : 1;
  return 甲口 - 乙口;
}

export function 历史成功率(节点) {
  const 成功 = Math.max(0, Number(节点 && 节点.successes) || 0);
  const 失败 = Math.max(0, Number(节点 && 节点.failures) || 0);
  // Beta(1,1) 平滑，避免只有一次成功的新节点立刻压过长期稳定节点。
  return (成功 + 1) / (成功 + 失败 + 2);
}

export function 更新测活历史(列表, 旧列表 = [], 现在 = Date.now()) {
  const 历史 = new Map((旧列表 || []).filter(Boolean).map(节点 => [节点键(节点), 节点]));
  return (列表 || []).map(节点 => {
    if (!节点) return 节点;
    const 旧 = 历史.get(节点键(节点)) || {};
    let successes = Math.max(0, Number(旧.successes) || 0);
    let failures = Math.max(0, Number(旧.failures) || 0);
    let failureStreak = Math.max(0, Number(旧.failureStreak) || 0);
    let lastSuccessAt = Math.max(0, Number(旧.lastSuccessAt) || 0);
    let lastFailureAt = Math.max(0, Number(旧.lastFailureAt) || 0);
    if (节点.edgeStatus === 'ok') {
      successes = Math.min(255, successes + 1);
      failureStreak = 0;
      lastSuccessAt = 现在;
    } else if (节点.edgeStatus === 'dead' || 节点.edgeStatus === 'timeout') {
      failures = Math.min(255, failures + 1);
      failureStreak = Math.min(15, failureStreak + 1);
      lastFailureAt = 现在;
    }
    return { ...节点, successes, failures, failureStreak, lastSuccessAt, lastFailureAt };
  });
}

export function 挑选电信大带宽节点(列表, 数量 = 6) {
  const 上限 = Math.max(1, Math.min(12, Number(数量) || 6));
  const 电信 = (列表 || []).filter(节点 => 节点 && 运营商名(节点) === '电信' && 节点.kind !== 'domain');
  const 可用 = 电信.filter(节点 => (Number(节点.failureStreak) || 0) < 3);
  const 有速度 = 可用.filter(节点 => Number(节点.speed) > 0);
  const 候选 = (有速度.length ? 有速度 : 可用.length ? 可用 : 电信).slice();
  候选.sort((甲, 乙) => {
    const 率差 = 历史成功率(乙) - 历史成功率(甲);
    const 甲样本 = (Number(甲.successes) || 0) + (Number(甲.failures) || 0);
    const 乙样本 = (Number(乙.successes) || 0) + (Number(乙.failures) || 0);
    if ((甲样本 >= 2 || 乙样本 >= 2) && 率差) return 率差;
    if ((乙.speed || 0) !== (甲.speed || 0)) return (乙.speed || 0) - (甲.speed || 0);
    return 比较优选(甲, 乙);
  });
  return 候选.slice(0, 上限);
}

function 四版前缀(地址) {
  const 段 = String(地址 || '').split('.');
  if (段.length !== 4 || 段.some(节 => !/^\d{1,3}$/.test(节))) return String(地址 || '');
  return 段.slice(0, 3).join('.');
}

export function 分散优选(列表, 数量 = 8) {
  const 上限 = Math.max(1, Math.min(40, Number(数量) || 8));
  const 排序 = (列表 || []).filter(Boolean).slice().sort(比较优选);
  const 已见 = new Set();
  const 先 = [];
  const 后 = [];
  for (const 节点 of 排序) {
    const 前缀 = 四版前缀(节点.ip);
    if (!已见.has(前缀)) {
      已见.add(前缀);
      先.push(节点);
    } else {
      后.push(节点);
    }
  }
  return 先.concat(后).slice(0, 上限);
}

export function 整理运营商优选节点(列表, 配置 = {}) {
  const 目标 = 配置.isp || '电信';
  const 只收标签 = !!配置.taggedOnly;
  const 是中转源 = !!配置.relay;
  const 上限 = Math.max(1, Math.min(40, Number(配置.limit) || 12));
  const 过滤 = (列表 || [])
    .filter(节点 => 节点 && 节点.kind === 'v4' && (!只收标签 || 运营商名(节点) === 目标))
    .map(节点 => {
      const 外部中转 = 是中转源 && !位于云墙网段(节点.ip);
      const 地区名 = 节点.region ? 地区中文[节点.region] || 节点.region : '';
      return {
        ...节点,
        isp: 是中转源 ? `${目标}中转${地区名 ? `·${地区名}` : ''}` : 目标,
        sourced: true,
        relay: 外部中转 || !!节点.relay
      };
    })
    .sort(比较优选);
  return 分散优选(过滤, 上限);
}

export function 整理电信优选节点(列表, 配置 = {}) {
  return 整理运营商优选节点(列表, { ...配置, isp: '电信' });
}

export function 挑选自动测速节点(列表, 数量 = 12) {
  const 上限 = Math.max(1, Math.min(24, Number(数量) || 12));
  const 分组 = new Map();
  for (const 节点 of 列表 || []) {
    if (!节点 || !节点.name) continue;
    const 键 = String(节点.sni || 节点.host || 节点.server || 'default').toLowerCase();
    if (!分组.has(键)) 分组.set(键, []);
    分组.get(键).push(节点);
  }
  const 组 = [...分组.values()];
  const 结果 = [];
  const 已见 = new Set();
  const 已见线路 = new Set();
  let 轮次 = 0;
  while (结果.length < 上限 && 组.some(节点列 => 节点列.length > 轮次)) {
    for (const 节点列 of 组) {
      const 节点 = 节点列[轮次];
      if (!节点 || 已见.has(节点.name)) continue;
      const 线路键 = 节点.server
        ? `${String(节点.server).toLowerCase()}|${节点.port || 443}|${String(节点.sni || 节点.host || '').toLowerCase()}`
        : `name|${节点.name}`;
      if (已见线路.has(线路键)) continue;
      已见.add(节点.name);
      已见线路.add(线路键);
      结果.push(节点);
      if (结果.length >= 上限) break;
    }
    轮次++;
  }
  return 结果;
}

export function 挑选自动最快节点(列表, 数量 = 8) {
  const 上限 = Math.max(1, Math.min(16, Number(数量) || 8));
  const 分组 = new Map([['电信', []], ['移动', []], ['联通', []], ['其他', []]]);
  const 已见线路 = new Set();
  for (const 节点 of 列表 || []) {
    if (!节点 || !节点.name) continue;
    const 线路键 = 节点.server
      ? `${String(节点.server).toLowerCase()}|${节点.port || 443}|${String(节点.sni || 节点.host || '').toLowerCase()}`
      : `name|${节点.name}`;
    if (已见线路.has(线路键)) continue;
    已见线路.add(线路键);
    const 名 = String(节点.name);
    const 类别 = 名.includes('电信') ? '电信' : 名.includes('移动') ? '移动' : 名.includes('联通') ? '联通' : '其他';
    分组.get(类别).push(节点);
  }
  const 节拍 = ['电信', '移动', '电信', '移动', '联通', '其他'];
  const 结果 = [];
  const 已见名 = new Set();
  for (;;) {
    if (结果.length >= 上限) break;
    let 有 = false;
    for (const 类别 of 节拍) {
      if (结果.length >= 上限) break;
      const 列 = 分组.get(类别);
      while (列.length && 已见名.has(列[0].name)) 列.shift();
      if (!列.length) continue;
      const 节点 = 列.shift();
      已见名.add(节点.name);
      结果.push(节点);
      有 = true;
    }
    if (!有) break;
  }
  return 结果;
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

export function 挑选测活样本(列表, 上限 = 16) {
  const 地址 = (列表 || []).filter(节点 => 节点 && 节点.kind !== 'domain' && 节点.tier !== 5);
  const 随机 = (列表 || []).filter(节点 => 节点 && 节点.tier === 5);
  const 组 = new Map();
  for (const 节点 of 地址) {
    const 键 = 分组键(节点);
    if (!组.has(键)) 组.set(键, []);
    组.get(键).push(节点);
  }
  for (const 节点列 of 组.values()) 节点列.sort(比较优选);
  const 选出 = [];
  const 已见 = new Set();
  const 放入 = 节点 => {
    if (!节点 || 选出.length >= 上限) return;
    const 键 = 节点键(节点);
    if (已见.has(键)) return;
    已见.add(键);
    选出.push(节点);
  };
  const 列 = [...组.values()];
  let 轮 = 0;
  while (选出.length < 上限 && 列.some(项 => 项.length > 轮)) {
    for (const 项 of 列) 放入(项[轮]);
    轮++;
  }
  随机.forEach(放入);
  return 选出;
}

export function 保留可用速度(列表, 每家 = 4) {
  const 组 = new Map();
  for (const 节点 of 列表 || []) {
    if (!节点) continue;
    const 键 = 分组键(节点);
    if (!组.has(键)) 组.set(键, []);
    组.get(键).push(节点);
  }
  const 结果 = [];
  const 上限 = Math.max(每家, 6);
  for (const [键, 节点列] of 组) {
    if (键 === '域名' || 键 === '自定义') {
      结果.push(...节点列);
      continue;
    }
    const 排序 = 节点列.slice().sort(比较优选);
    if (键 === '电信' || 键 === '移动') {
      const 选出 = [];
      const 已见 = new Set();
      const 测速 = 排序.filter(节点 => !节点.relay && 节点.speed >= 1);
      const 精选 = 排序.filter(节点 => !节点.relay && !(节点.speed >= 1));
      const 中转 = 排序.filter(节点 => 节点.relay);
      收入不重复(选出, 已见, 测速, 8);
      收入不重复(选出, 已见, 精选, 4);
      收入不重复(选出, 已见, 中转, 4);
      结果.push(...选出);
      continue;
    }
    const 快 = 排序.filter(节点 => 节点.relay || 节点.speed >= 1);
    const 慢 = 排序.filter(节点 => !节点.relay && 节点.speed > 0 && 节点.speed < 1);
    const 未知 = 排序.filter(节点 => !节点.relay && !(节点.speed > 0));
    const 主体 = 快.length >= 每家 ? 快 : 快.concat(慢);
    结果.push(...主体.concat(未知).slice(0, 上限));
  }
  return 结果;
}

function 收入不重复(目标, 已见, 候选, 数量) {
  let 已加 = 0;
  for (const 节点 of 候选 || []) {
    if (已加 >= 数量) return;
    const 键 = 节点键(节点);
    if (已见.has(键)) continue;
    已见.add(键);
    目标.push(节点);
    已加++;
  }
}

export function 应用握手结果(列表, 探测, 选项, 严格 = false) {
  const 原文 = 列表 || [];
  if (!选项 || !选项.probe) return { nodes: 原文, effective: true };
  const 表 = new Map((探测 || []).filter(项 => 项 && 项.key).map(项 => [项.key, 项]));
  if (!表.size) {
    const 节点 = 严格 ? 原文.filter(项 => 项 && (项.kind === 'domain' || 社区节点(项))) : 原文;
    return { nodes: 节点, effective: 节点.some(项 => 项 && 项.kind !== 'domain' && 社区节点(项)) };
  }
  const 留下 = [];
  for (const 节点 of 原文) {
    if (!节点) continue;
    if (节点.kind === 'domain') {
      留下.push(节点);
      continue;
    }
    const 结果 = 表.get(节点键(节点));
    if (!结果) {
      if (严格 && !社区节点(节点)) continue;
      留下.push(节点);
      continue;
    }
    if (结果.status === 'ok') {
      留下.push({ ...节点, port: 结果.port || 节点.port || 443, alive: true, edgeStatus: 'ok' });
      continue;
    }
    if (节点.tier === 5) continue;
    if (社区节点(节点)) 留下.push({ ...节点, alive: false, edgeStatus: 结果.status || 'failed' });
  }
  const 节点 = 合并去重(留下);
  return { nodes: 节点, effective: 节点.some(项 => 项.kind !== 'domain' && (项.alive || 社区节点(项))) };
}

function 拼接字节(...块) {
  const 列表 = 块.map(项 => (项 instanceof Uint8Array ? 项 : Uint8Array.from(项)));
  const 总长 = 列表.reduce((和, 项) => 和 + 项.length, 0);
  const 结果 = new Uint8Array(总长);
  let 偏移 = 0;
  for (const 项 of 列表) {
    结果.set(项, 偏移);
    偏移 += 项.length;
  }
  return 结果;
}

function 双字节(值) {
  return Uint8Array.of((值 >> 8) & 255, 值 & 255);
}

function 三字节(值) {
  return Uint8Array.of((值 >> 16) & 255, (值 >> 8) & 255, 值 & 255);
}

const 默认共享公钥 = Uint8Array.from([
  0x42, 0x79, 0x18, 0x01, 0x82, 0x6d, 0x55, 0x4e, 0x96, 0x94, 0xe1, 0x9a, 0x52, 0x05, 0xef, 0xf3,
  0xd7, 0x06, 0x8b, 0x75, 0x7e, 0xca, 0xd0, 0x58, 0x16, 0x04, 0x22, 0x63, 0x43, 0x65, 0x89, 0x0f
]);

export function 构造握手请求(主机名 = 'www.cloudflare.com', 公钥 = null) {
  const 主机 = new TextEncoder().encode(String(主机名 || 'www.cloudflare.com'));
  const 名称扩展 = 拼接字节(双字节(0), 双字节(主机.length + 5), 双字节(主机.length + 3), Uint8Array.of(0), 双字节(主机.length), 主机);
  const 共享公钥 = 公钥 instanceof Uint8Array && 公钥.length === 32 ? 公钥 : 默认共享公钥;
  const 组体 = 拼接字节(双字节(4), 双字节(0x001d), 双字节(0x0017));
  const 组 = 拼接字节(双字节(10), 双字节(组体.length), 组体);
  const 点 = 拼接字节(双字节(11), 双字节(4), Uint8Array.of(3, 0, 1, 2));
  const 签名列表 = [0x0403, 0x0503, 0x0603, 0x0807, 0x0808, 0x0804, 0x0805, 0x0401, 0x0501, 0x0601];
  const 签名体 = 拼接字节(双字节(签名列表.length * 2), ...签名列表.map(双字节));
  const 签名 = 拼接字节(双字节(13), 双字节(签名体.length), 签名体);
  const 版本 = 拼接字节(双字节(43), 双字节(5), Uint8Array.of(4, 0x03, 0x04, 0x03, 0x03));
  const 预共享 = 拼接字节(双字节(45), 双字节(2), Uint8Array.of(1, 1));
  const 扩展主密钥 = 拼接字节(双字节(23), 双字节(0));
  const 共享项 = 拼接字节(双字节(0x001d), 双字节(32), 共享公钥);
  const 共享体 = 拼接字节(双字节(共享项.length), 共享项);
  const 共享 = 拼接字节(双字节(51), 双字节(共享体.length), 共享体);
  const 扩展 = 拼接字节(名称扩展, 组, 点, 签名, 版本, 预共享, 扩展主密钥, 共享);
  const 套件 = [0x1301, 0x1302, 0x1303, 0xc02f, 0xc02b, 0xc030, 0xcca9, 0xcca8];
  const 套件体 = 拼接字节(双字节(套件.length * 2), ...套件.map(双字节));
  const 随机 = Uint8Array.from({ length: 32 }, (_, 索引) => (索引 * 17 + 9) & 255);
  const 会话 = Uint8Array.from({ length: 32 }, (_, 索引) => (索引 * 13 + 3) & 255);
  const 主体 = 拼接字节(Uint8Array.of(0x03, 0x03), 随机, Uint8Array.of(32), 会话, 套件体, Uint8Array.of(1, 0), 双字节(扩展.length), 扩展);
  const 握手 = 拼接字节(Uint8Array.of(1), 三字节(主体.length), 主体);
  return 拼接字节(Uint8Array.of(0x16, 0x03, 0x01), 双字节(握手.length), 握手);
}

export function 判断握手应答(数据) {
  const 字节 = 数据 instanceof Uint8Array ? 数据 : new Uint8Array(数据 || []);
  if (字节.length < 3) return 'wait';
  if (字节[0] === 0x16 && 字节[1] === 0x03) return 'ok';
  return 'dead';
}

export function 标注保底(列表) {
  const 四版 = (列表 || []).filter(节点 => 节点 && 节点.kind === 'v4' && 节点.tier !== 5);
  const 保底键 = new Set();
  for (const 运营商 of 运营商顺序) {
    const 候选 = 四版.filter(节点 => !节点.pinned && 运营商名(节点) === 运营商).sort(比较优选);
    if (候选[0]) 保底键.add(节点键(候选[0]));
  }
  return (列表 || []).map(节点 => {
    if (!节点) return 节点;
    if (节点.isp === '入口') return { ...节点, tier: 0 };
    if (节点.pinned) return { ...节点, tier: 0 };
    if (保底键.has(节点键(节点))) {
      const 名 = 运营商名(节点);
      const 前缀 = 名 === '其他' || 名 === '中转' ? '保底' : `保底·${名}`;
      return { ...节点, tier: 0, isp: 前缀 };
    }
    if (节点.tier === 0 && 节点.kind !== 'domain') {
      return { ...节点, tier: 2, isp: 节点.isp === '保底' ? '入口IP' : 节点.isp };
    }
    return 节点;
  });
}

export function 扩展备用端口(列表) {
  const 额外 = [];
  const 已见 = new Set((列表 || []).map(节点键));
  const 按家 = new Map();
  for (const 节点 of 列表 || []) {
    if (!节点 || 节点.kind !== 'v4' || 节点.tier === 5 || 节点.relay || 节点.pinned) continue;
    if (节点.port !== 443 || !位于云墙网段(节点.ip)) continue;
    const 家 = 运营商名(节点);
    if (!按家.has(家)) 按家.set(家, []);
    按家.get(家).push(节点);
  }
  for (const 节点列 of 按家.values()) {
    const 头 = 节点列.slice().sort(比较优选)[0];
    if (!头) continue;
    const 副本 = {
      ...头,
      port: 8443,
      isp: `${头.isp || '优选'}·8443`,
      tier: Math.min(4, (头.tier || 1) + 1)
    };
    const 键 = 节点键(副本);
    if (已见.has(键)) continue;
    已见.add(键);
    额外.push(副本);
  }
  return (列表 || []).concat(额外);
}

export function 入口补位(列表, 至少 = 8) {
  const 现有 = 列表 || [];
  const 已有 = new Set(现有.filter(节点 => 节点 && 节点.kind === 'v4').map(节点 => 节点.ip));
  if (已有.size >= 至少) return 现有;
  const 补 = [];
  for (const 地址 of 实测入口地址) {
    if (已有.has(地址)) continue;
    补.push(...生成保底节点([地址]));
    if (已有.size + 补.length >= 至少) break;
  }
  return 现有.concat(补);
}

export function 生成入口节点(域名) {
  const 文本 = String(域名 || '').trim().replace(/\.$/, '');
  if (!文本 || 地址种类(文本) !== 'domain') return null;
  return { ip: 文本, port: 443, isp: '入口', tier: 0, kind: 'domain', latency: null, speed: 0, region: '' };
}

export function 轮换序列(列表, 现在 = Date.now(), 窗口 = 8, 间隔毫秒 = 300000) {
  if (!列表 || 列表.length <= 1) return (列表 || []).slice();
  const 跨度 = Math.min(窗口, 列表.length);
  const 偏移 = Math.floor(现在 / 间隔毫秒) % 跨度;
  if (!偏移) return 列表.slice();
  return 列表.slice(偏移).concat(列表.slice(0, 偏移));
}

function 按地区交错(列表) {
  const 组 = new Map();
  for (const 节点 of 列表 || []) {
    const 键 = 节点.region || 节点.isp || 'XX';
    if (!组.has(键)) 组.set(键, []);
    组.get(键).push(节点);
  }
  for (const 节点列 of 组.values()) 节点列.sort(比较优选);
  const 列 = [...组.values()];
  const 结果 = [];
  const 最大 = Math.max(0, ...列.map(项 => 项.length));
  for (let 索引 = 0; 索引 < 最大; 索引++) {
    for (const 节点列 of 列) if (节点列[索引]) 结果.push(节点列[索引]);
  }
  return 结果;
}

function 按运营商分组(列表) {
  const 分组 = new Map(运营商顺序.map(名 => [名, []]));
  for (const 节点 of 列表 || []) {
    const 名 = 运营商名(节点);
    if (!分组.has(名)) 分组.set(名, []);
    分组.get(名).push(节点);
  }
  for (const [名, 节点列] of 分组) {
    if (名 === '中转') 分组.set(名, 按地区交错(节点列));
    else 节点列.sort(比较优选);
  }
  return 分组;
}

function 按运营商交错(列表) {
  const 列 = [...按运营商分组(列表).values()];
  const 结果 = [];
  const 最大 = Math.max(0, ...列.map(项 => 项.length));
  for (let 索引 = 0; 索引 < 最大; 索引++) {
    for (const 节点列 of 列) if (节点列[索引]) 结果.push(节点列[索引]);
  }
  return 结果;
}

export function 按主力填充(列表) {
  const 队列 = new Map([...按运营商分组(列表)].map(([名, 节点列]) => [名, 节点列.slice()]));
  const 结果 = [];
  for (;;) {
    let 有 = false;
    for (const 名 of 主力节拍) {
      const 列 = 队列.get(名);
      if (!列 || !列.length) continue;
      结果.push(列.shift());
      有 = true;
    }
    if (!有) break;
  }
  return 结果;
}

export function 编排优选节点(列表, 选项, 现在 = Date.now()) {
  const 四版开启 = 选项.ipv4 || !选项.ipv6;
  const 筛选 = 筛选优选(合并去重(列表), 选项);
  const 保底 = 按运营商交错(筛选.filter(节点 => 节点.tier === 0 && 节点.kind !== 'domain'));
  const 入口 = 筛选.filter(节点 => 节点.isp === '入口');
  const 域名 = 筛选.filter(节点 => 节点.kind === 'domain' && 节点.isp !== '入口');
  const 四版 = 按主力填充(筛选.filter(节点 => 节点.kind === 'v4' && 节点.tier !== 0));
  const 六版 = 筛选.filter(节点 => 节点.kind === 'v6').sort(比较优选);
  const 保底序 = 选项.balance ? 轮换序列(保底, 现在, Math.min(8, 保底.length), 300000) : 保底;
  const 四版序 = 选项.balance ? 轮换序列(四版, 现在, Math.min(8, 四版.length), 300000) : 四版;
  let 主体;
  if (!四版开启 && 选项.ipv6) {
    主体 = 入口.concat(六版, 域名);
  } else if (!选项.ipv6 || 选项.v6policy === 'off') {
    主体 = 保底序.concat(入口, 四版序, 域名);
  } else if (选项.v6policy === 'mix') {
    const 混合 = [];
    const 次数 = Math.max(四版序.length, 六版.length);
    for (let 索引 = 0; 索引 < 次数; 索引++) {
      if (四版序[索引]) 混合.push(四版序[索引]);
      if (六版[索引]) 混合.push(六版[索引]);
    }
    主体 = 保底序.concat(入口, 混合, 域名);
  } else {
    const 限额 = Math.max(1, Math.floor((选项.limit || 36) * 0.15));
    主体 = 保底序.concat(入口, 四版序, 域名, 六版.slice(0, 限额));
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

export function 是ECH配置(值) {
  const 文本 = String(值 || '').trim();
  if (文本.length < 32 || 文本.length > 4096 || !/^[A-Za-z0-9+/_=-]+$/.test(文本)) return false;
  try {
    const 标准 = 文本.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    const 补齐 = 标准 + '='.repeat((4 - 标准.length % 4) % 4);
    return atob(补齐).length >= 8;
  } catch (错误) {
    return false;
  }
}

export function 提取ECH配置(数据) {
  const 答案 = 数据 && Array.isArray(数据.Answer) ? 数据.Answer : [];
  for (const 项 of 答案) {
    const 文本 = typeof 项?.data === 'string' ? 项.data : '';
    const 匹配 = 文本.match(/(?:^|\s)ech=(?:"([A-Za-z0-9+/_=-]+)"|([A-Za-z0-9+/_=-]+))/i);
    const 配置 = 匹配 && (匹配[1] || 匹配[2]);
    if (是ECH配置(配置)) return 配置;
  }
  return '';
}

export function 生成抗阻断路径(节点, 用户 = '') {
  const 标识 = 节点 && (节点.ip || 节点.domain || 节点.server) || '';
  const 端口 = 节点 && 节点.port || 443;
  const 前置域名 = 节点 && 节点.frontDomain || '';
  return `/assets/${短哈希(`${用户}|${标识}|${端口}|${前置域名}`)}?ed=2048`;
}

export function 分配前置域名(列表, 入口域名, 备用域名 = []) {
  const 域名 = [入口域名, ...(备用域名 || [])]
    .map(项 => String(项 || '').trim().toLowerCase())
    .filter((项, 索引, 全部) => 项 && 全部.indexOf(项) === 索引);
  if (域名.length <= 1) return (列表 || []).map(节点 => ({ ...节点, frontDomain: 域名[0] || '' }));
  return (列表 || []).map((节点, 索引) => ({
    ...节点,
    frontDomain: 域名[索引 % 域名.length]
  }));
}

export function 压缩节点(节点) {
  return [
    节点.ip, 节点.port || 443, 节点.isp || '', 节点.tier || 0, 节点.kind || 'v4',
    节点.latency == null ? null : 节点.latency, 节点.speed || 0, 节点.region || '',
    节点.relay ? 1 : 0, 节点.sourced ? 1 : 0, 节点.edgeStatus || (节点.alive ? 'ok' : ''),
    Number(节点.successes) || 0, Number(节点.failures) || 0, Number(节点.failureStreak) || 0,
    Number(节点.lastSuccessAt) || 0, Number(节点.lastFailureAt) || 0
  ];
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
      region: 项.region || '',
      relay: !!项.relay,
      sourced: !!项.sourced,
      alive: 项.edgeStatus === 'ok' || !!项.alive,
      edgeStatus: 项.edgeStatus || (项.alive ? 'ok' : ''),
      successes: Number(项.successes) || 0,
      failures: Number(项.failures) || 0,
      failureStreak: Number(项.failureStreak) || 0,
      lastSuccessAt: Number(项.lastSuccessAt) || 0,
      lastFailureAt: Number(项.lastFailureAt) || 0
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
    region: 项[7] || '',
    relay: !!项[8],
    sourced: !!项[9],
    alive: 项[10] === 'ok',
    edgeStatus: 项[10] || '',
    successes: Number(项[11]) || 0,
    failures: Number(项[12]) || 0,
    failureStreak: Number(项[13]) || 0,
    lastSuccessAt: Number(项[14]) || 0,
    lastFailureAt: Number(项[15]) || 0
  };
}

export function 可持久化节点(列表) {
  return (列表 || []).filter(节点 => 节点 && 节点.ip && 节点.tier !== 5 && 节点.kind !== 'domain').slice(0, 80);
}

export function 持久化摘要(列表) {
  return 短哈希(可持久化节点(列表).map(节点 => [
    节点.tier,
    节点键(节点),
    Number(节点.successes) || 0,
    Number(节点.failures) || 0,
    Number(节点.failureStreak) || 0
  ].join('|')).join(','));
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

const 访问账本 = new Map();

export function 重置访问账本() {
  访问账本.clear();
}

export function 允许访问(种类, 现在, 上限 = 10, 窗口毫秒 = 60000) {
  const 窗口 = Math.floor(现在 / 窗口毫秒);
  const 键 = `${种类}|${窗口}`;
  const 次数 = (访问账本.get(键) || 0) + 1;
  访问账本.set(键, 次数);
  if (访问账本.size > 6) {
    for (const 旧键 of 访问账本.keys()) {
      if (!String(旧键).endsWith('|' + 窗口)) 访问账本.delete(旧键);
    }
  }
  return 次数 <= 上限;
}
