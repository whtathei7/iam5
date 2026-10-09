let 当前环境 = {};
let 执行上下文 = null;
let 线路优化摘要 = 'off';
let 启用线路优化 = true;
let 线路优化数量 = 36;
let 启用线路测活 = true;
let 启用线路均衡 = true;
let 启用保底前置 = true;
let 启用优选合并 = false;
let 六版下发策略 = 'off';
let 线路优选地区 = 'all';
let 线路兜底池 = '';
const 线路优化新鲜毫秒 = 30 * 60 * 1000;
const 线路优化保留毫秒 = 6 * 60 * 60 * 1000;
let 线路优化内存 = null;
let 线路优化刷新任务 = null;
let 线路优化刷新键 = '';
let 线路写入账本 = { day: '', writes: 0, lastAt: 0, hash: '' };

function 应用线路优化开关() {
  const 线路 = 整理线路选项(获取有效配置快照(当前环境));
  启用线路优化 = 线路.enabled;
  线路优化数量 = 线路.limit;
  启用线路测活 = 线路.probe;
  启用线路均衡 = 线路.balance;
  启用保底前置 = 线路.anchor;
  启用优选合并 = 线路.merge;
  六版下发策略 = 线路.v6policy;
  线路优选地区 = 线路.region;
  线路兜底池 = 线路.pool.join('\n');
}

function 读取当前线路选项() {
  return 整理线路选项({
    opt: 启用线路优化 ? 'yes' : 'no',
    optLimit: 线路优化数量,
    optProbe: 启用线路测活 ? 'yes' : 'no',
    optBalance: 启用线路均衡 ? 'yes' : 'no',
    optAnchor: 启用保底前置 ? 'yes' : 'no',
    optMerge: 启用优选合并 ? 'yes' : 'no',
    v6policy: 六版下发策略,
    optRegion: 线路优选地区,
    optPool: 线路兜底池,
    ipv4: 获取配置值('ipv4', 'yes'),
    ipv6: 获取配置值('ipv6', 'no'),
    ispMobile: 获取配置值('ispMobile', 'yes'),
    ispUnicom: 获取配置值('ispUnicom', 'yes'),
    ispTelecom: 获取配置值('ispTelecom', 'yes')
  });
}

function 线路缓存键(选项, 自定义摘要) {
  return [
    选项.region,
    选项.mobile ? 1 : 0,
    选项.unicom ? 1 : 0,
    选项.telecom ? 1 : 0,
    选项.v6policy,
    选项.ipv6 ? 1 : 0,
    选项.anchor ? 1 : 0,
    选项.probe ? 1 : 0,
    选项.pool.join(','),
    自定义摘要
  ].join('|');
}

function 记住写入账本(数据, 沿用摘要) {
  if (!数据) return;
  const 现在 = Date.now();
  const 日 = new Date(现在).toISOString().slice(0, 10);
  if (线路写入账本.day !== 日) 线路写入账本 = { day: 日, writes: 0, lastAt: 0, hash: '' };
  if (沿用摘要 && 数据.hash) 线路写入账本.hash = 数据.hash;
  if (数据.at) 线路写入账本.lastAt = Math.max(线路写入账本.lastAt || 0, 数据.at || 0);
}

async function 读取线路缓存(键) {
  const 现在 = Date.now();
  if (线路优化内存 && 线路优化内存.key === 键) {
    const 年龄 = 现在 - 线路优化内存.at;
    if (年龄 < 线路优化保留毫秒) return { nodes: 线路优化内存.nodes, fresh: 年龄 < 线路优化新鲜毫秒 };
  }
  if (!键值存储) return null;
  try {
    const 原文 = await 键值存储.get('opt_pool');
    if (!原文) return null;
    const 数据 = JSON.parse(原文);
    const 节点 = (数据 && Array.isArray(数据.nodes) ? 数据.nodes : []).map(展开节点).filter(Boolean);
    const 键匹配 = !!(数据 && 数据.key === 键 && 节点.length);
    记住写入账本(数据, 键匹配);
    if (!键匹配) return null;
    线路优化内存 = { key: 键, at: 数据.at || 0, nodes: 节点, hash: 数据.hash || 持久化摘要(节点) };
    const 年龄 = 现在 - 线路优化内存.at;
    if (年龄 >= 线路优化保留毫秒) return null;
    return { nodes: 节点, fresh: 年龄 < 线路优化新鲜毫秒 };
  } catch (错误) {
    return null;
  }
}

async function 写入线路缓存(键, 节点, 探测有效, 独占) {
  const 现在 = Date.now();
  const 可存 = 可持久化节点(节点);
  const 哈希 = 持久化摘要(节点);
  线路优化内存 = {
    key: 键,
    at: 缓存时间戳(现在, 探测有效, 线路优化新鲜毫秒),
    nodes: 节点,
    hash: 哈希
  };
  if (!探测有效 || 独占 || !键值存储 || !可存.length) return 'skip';
  const 决定 = 判断缓存写入(线路写入账本, 现在, 哈希);
  线路写入账本 = 决定.账本;
  if (!决定.ok) return 决定.reason;
  try {
    await 键值存储.put('opt_pool', JSON.stringify({
      v: 2,
      key: 键,
      at: 现在,
      hash: 哈希,
      nodes: 可存.map(压缩节点)
    }), { expirationTtl: 21600 });
    return 'write';
  } catch (错误) {
    return 'skip';
  }
}

async function 拉取优选文本(网址) {
  const 控制器 = new AbortController();
  const 定时器 = setTimeout(() => 控制器.abort(), 4000);
  try {
    const 响应 = await fetch(网址, {
      signal: 控制器.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!响应.ok) return '';
    const 文本 = await 响应.text();
    if (!文本 || /<!doctype html|<html/i.test(文本)) return '';
    return 文本;
  } catch (错误) {
    return '';
  } finally {
    clearTimeout(定时器);
  }
}

async function 拉取并解析(网址, 配置) {
  const 文本 = await 拉取优选文本(网址);
  if (!文本) return [];
  return 解析优选文本(文本, 配置);
}

async function 探测套接字可达(主机, 端口, 超时毫秒) {
  let 套接字 = null;
  let 定时器 = null;
  try {
    套接字 = 连接({ hostname: 主机, port: Number(端口) || 443 });
    const 超时 = new Promise(完成 => {
      定时器 = setTimeout(() => 完成(false), 超时毫秒);
    });
    const 成功 = await Promise.race([
      套接字.opened.then(() => true).catch(() => false),
      超时
    ]);
    return 成功 === true;
  } catch (错误) {
    return false;
  } finally {
    if (定时器) clearTimeout(定时器);
    try {
      if (套接字) 套接字.close();
    } catch (忽略) {}
  }
}

async function 测活候选(候选, 选项) {
  if (!选项.probe) return { nodes: 候选, effective: true };
  const 样本 = 挑选测活样本(候选, 24);
  if (!样本.length) return { nodes: 候选, effective: true };
  const 探测键 = 样本.map(节点键);
  const 结果 = await 并发映射(样本, 4, async 节点 => {
    if (节点.kind === 'domain') return '';
    const 通 = await 探测套接字可达(节点.ip, 节点.port || 443, 1000);
    return 通 ? 节点键(节点) : '';
  });
  const 存活 = 结果.filter(Boolean);
  return { nodes: 应用测活结果(候选, 存活, 探测键, 选项), effective: 存活.length > 0 };
}

async function 域名仍可解析(域名) {
  const 控制器 = new AbortController();
  const 定时器 = setTimeout(() => 控制器.abort(), 2500);
  try {
    const 响应 = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(域名)}&type=A`, {
      signal: 控制器.signal,
      headers: { accept: 'application/dns-json' }
    });
    if (!响应.ok) return true;
    const 数据 = await 响应.json();
    if (数据.Status !== 0) return false;
    return Array.isArray(数据.Answer) && 数据.Answer.length > 0;
  } catch (错误) {
    return true;
  } finally {
    clearTimeout(定时器);
  }
}

async function 选取优选域名(数量) {
  const 候选 = 直连域名列表.map(项 => 项.domain).filter(Boolean).slice(0, 数量 + 4);
  const 结果 = await Promise.all(候选.map(async 域名 => (await 域名仍可解析(域名)) ? 域名 : ''));
  return 结果.filter(Boolean).slice(0, 数量).map(域名 => ({
    ip: 域名,
    port: 443,
    isp: '优选域名',
    tier: 4,
    kind: 'domain',
    latency: null,
    speed: 0,
    region: ''
  }));
}

function 自定义转节点() {
  const 地址 = 自定义优选地址列表.map(项 => ({
    ip: 项.ip,
    port: 项.port || 443,
    isp: 项.isp || '自定义优选',
    tier: 1,
    kind: 地址种类(项.ip),
    latency: null,
    speed: 0,
    region: ''
  }));
  const 域名 = 自定义优选域名列表.map(项 => ({
    ip: 项.domain,
    port: 项.port || 443,
    isp: 项.name || '优选域名',
    tier: 1,
    kind: 'domain',
    latency: null,
    speed: 0,
    region: ''
  }));
  return 地址.concat(域名).filter(项 => 项.kind);
}

async function 读取仓库优选节点() {
  try {
    const 列表 = await 获取值解析新地址列表();
    return (列表 || []).slice(0, 30).map(项 => ({
      ip: 项.ip,
      port: 项.port || 443,
      isp: 项.name || '优选IP',
      tier: 1,
      kind: 地址种类(项.ip),
      latency: null,
      speed: 0,
      region: ''
    })).filter(项 => 项.kind);
  } catch (错误) {
    return [];
  }
}

async function 拉取远程优选(选项) {
  const 任务 = [];
  if (启用优选地址) {
    任务.push(拉取并解析(实测优选源[0], { tier: 1, fallbackName: '优选IP', prefer: 'isp', maxLines: 80 }).then(列表 => 列表.sort(比较优选).slice(0, 16)));
    任务.push(拉取并解析(实测优选源[1], { tier: 1, fallbackName: '优选IP', prefer: 'isp', maxLines: 60 }).then(列表 => 列表.sort(比较优选).slice(0, 12)));
    const 地区网址 = 选项.pool.length ? 选项.pool : (选项.region === 'all' ? 内置地区代码 : [选项.region]).map(内置地区源);
    for (const 网址 of 地区网址) {
      任务.push(拉取并解析(网址, { tier: 2, fallbackName: '优选IP', prefer: 'region', maxLines: 20 }).then(列表 => 列表.slice(0, 6)));
    }
    if (选项.v6policy !== 'off' && 选项.ipv6) {
      任务.push(拉取并解析(六版优选源, { tier: 3, fallbackName: 'IPv6优选', prefer: 'isp', maxLines: 30 }).then(列表 => 列表.filter(项 => 项.kind === 'v6').slice(0, 8)));
    }
  }
  if (启用仓库优选 && 优选地址源) 任务.push(读取仓库优选节点());
  const 结算 = await Promise.allSettled(任务);
  let 节点 = [];
  for (const 项 of 结算) {
    if (项.status === 'fulfilled' && Array.isArray(项.value)) 节点 = 节点.concat(项.value);
  }
  const 质量 = 节点.filter(项 => 项.kind === 'v4' && 项.tier <= 2).length;
  if (启用优选地址 && 质量 < 8) {
    节点 = 节点.concat(随机补足节点(Math.max(4, Math.round(选项.limit * 0.2))));
    if (质量 < 5) {
      try {
        const 旧列表 = await 获取值地址列表();
        节点 = 节点.concat((旧列表 || []).map(项 => ({
          ip: 项.ip,
          port: 443,
          isp: 项.isp || '优选IP',
          tier: 1,
          kind: 地址种类(项.ip),
          latency: null,
          speed: 0,
          region: ''
        })).filter(项 => 项.kind));
      } catch (错误) {}
    }
  }
  return 合并去重(节点);
}

async function 刷新线路候选(键, 选项, 本地候选, 独占) {
  if (线路优化刷新任务 && 线路优化刷新键 === 键) return 线路优化刷新任务;
  线路优化刷新键 = 键;
  线路优化刷新任务 = (async () => {
    let 远程 = [];
    if (!独占 && (启用优选地址 || (启用仓库优选 && 优选地址源))) 远程 = await 拉取远程优选(选项);
    let 候选 = 本地候选.concat(远程);
    if (启用优选域名 && !独占) 候选 = 候选.concat(await 选取优选域名(4));
    候选 = 筛选优选(合并去重(候选), 选项);
    const 测活 = await 测活候选(候选, 选项);
    候选 = 测活.nodes;
    if (候选.length) await 写入线路缓存(键, 候选, 测活.effective, 独占);
    return 候选;
  })().finally(() => {
    if (线路优化刷新键 === 键) 线路优化刷新任务 = null;
  });
  return 线路优化刷新任务;
}

async function 组装线路优化节点() {
  const 选项 = 读取当前线路选项();
  const 有自定义 = 自定义优选地址列表.length > 0 || 自定义优选域名列表.length > 0;
  const 独占 = 有自定义 && !选项.merge;
  const 本地 = [];
  if (选项.anchor) 本地.push(...生成保底节点(官方直连地址));
  if (有自定义) 本地.push(...自定义转节点());
  const 摘要 = 短哈希(JSON.stringify({
    本地: 本地.map(节点键),
    独占,
    域名: 启用优选域名 && !独占,
    地址: 启用优选地址 && !独占,
    仓库: 启用仓库优选 && !!优选地址源 && !独占,
    源: 优选地址源 || ''
  }));
  const 键 = 线路缓存键(选项, 摘要);
  const 缓存 = await 读取线路缓存(键);
  let 候选 = [];
  let 缓存状态 = 'miss';
  if (缓存 && 缓存.fresh) {
    候选 = 缓存.nodes;
    缓存状态 = 'fresh';
  } else if (缓存 && 缓存.nodes.length) {
    候选 = 缓存.nodes;
    缓存状态 = 'stale';
    const 刷新 = 刷新线路候选(键, 选项, 本地, 独占).catch(() => []);
    if (执行上下文 && typeof 执行上下文.waitUntil === 'function') 执行上下文.waitUntil(刷新);
  } else {
    候选 = await 刷新线路候选(键, 选项, 本地, 独占);
    缓存状态 = 候选.length ? 'miss' : 'empty';
    if (!候选.length) 候选 = 筛选优选(合并去重(本地), 选项);
  }
  const 最终 = 编排优选节点(候选, 选项);
  const 池内 = 候选.filter(项 => 项.kind !== 'domain').length;
  线路优化摘要 = `on;count=${最终.length};pool=${池内};cache=${缓存状态}`;
  return 最终;
}
