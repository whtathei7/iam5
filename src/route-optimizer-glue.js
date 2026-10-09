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
const 线路优化新鲜毫秒 = 10 * 60 * 1000;
const 线路优化保留毫秒 = 6 * 60 * 60 * 1000;
let 线路优化内存 = null;
let 线路优化刷新任务 = null;
let 线路优化刷新键 = '';
let 线路写入账本 = { day: '', writes: 0, lastAt: 0, hash: '' };
let 线路入口域名 = '';
let 线路ECH配置 = '';
let 线路ECH状态 = 'dns';
let 线路ECH缓存 = { domain: '', value: '', at: 0 };

async function 查询ECH配置(域名) {
  const 控制器 = new AbortController();
  const 定时器 = setTimeout(() => 控制器.abort(), 3500);
  try {
    const 地址 = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(域名)}&type=65`;
    const 响应 = await fetch(地址, {
      headers: { Accept: 'application/dns-json' },
      signal: 控制器.signal
    });
    if (!响应.ok) return '';
    return 提取ECH配置(await 响应.json());
  } catch (错误) {
    return '';
  } finally {
    clearTimeout(定时器);
  }
}

async function 获取线路ECH配置(入口域名) {
  const 环境配置 = String(当前环境.ECH_CONFIG || 当前环境.echConfig || '').trim();
  if (是ECH配置(环境配置)) {
    线路ECH状态 = 'env';
    return 环境配置;
  }
  const 域名 = 选择ECH查询域名(入口域名, 自定义加密客户端问候域名);
  if (!域名) {
    线路ECH状态 = 'off';
    return '';
  }
  const 现在 = Date.now();
  if (线路ECH缓存.domain === 域名 && 线路ECH缓存.value && 现在 - 线路ECH缓存.at < 60 * 1000) {
    线路ECH状态 = 'cache';
    return 线路ECH缓存.value;
  }
  const 最新 = await 查询ECH配置(域名);
  if (最新) {
    线路ECH缓存 = { domain: 域名, value: 最新, at: 现在 };
    线路ECH状态 = 'static';
    return 最新;
  }
  if (线路ECH缓存.domain === 域名 && 线路ECH缓存.value && 现在 - 线路ECH缓存.at < 6 * 60 * 60 * 1000) {
    线路ECH状态 = 'stale';
    return 线路ECH缓存.value;
  }
  线路ECH状态 = 'off';
  return '';
}

function 当前订阅ECH值() {
  return 订阅用ECH值(启用加密客户端问候, 线路ECH配置);
}

function 读取备用前置域名() {
  const 原文 = 当前环境.FRONT_DOMAINS || 当前环境.frontDomains || 当前环境.OPT_FRONT_DOMAINS || '';
  return String(原文).split(/[\s,;]+/).map(项 => 项.trim().toLowerCase()).filter(项 => {
    if (!项 || 项 === 线路入口域名) return false;
    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(项);
  }).filter((项, 索引, 全部) => 全部.indexOf(项) === 索引).slice(0, 8);
}

function 读取独立入口(当前域名) {
  const 原文 = 当前环境.INDEPENDENT_ENDPOINTS || 当前环境.BACKUP_ENDPOINTS || 当前环境.independentEndpoints || '';
  return 解析独立入口配置(原文, 当前域名);
}

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
    'stable7',
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
  if (数据.ledger && 数据.ledger.day === 日) {
    线路写入账本.writes = Math.max(线路写入账本.writes || 0, Number(数据.ledger.writes) || 0);
    线路写入账本.lastAt = Math.max(线路写入账本.lastAt || 0, Number(数据.ledger.lastAt) || 0);
  }
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
      ledger: 线路写入账本,
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

async function 有限并发结算(任务, 并发数 = 5) {
  const 结果 = Array(任务.length);
  let 游标 = 0;
  async function 执行() {
    while (游标 < 任务.length) {
      const 索引 = 游标++;
      try {
        结果[索引] = { status: 'fulfilled', value: await 任务[索引]() };
      } catch (reason) {
        结果[索引] = { status: 'rejected', reason };
      }
    }
  }
  const 数量 = Math.min(Math.max(1, 并发数), 任务.length);
  await Promise.all(Array.from({ length: 数量 }, 执行));
  return 结果;
}

async function 读到判定(读取器, 超时毫秒) {
  const 块 = [];
  let 长度 = 0;
  const 截止 = Date.now() + 超时毫秒;
  while (Date.now() < 截止) {
    const 剩余 = Math.max(1, 截止 - Date.now());
    let 定时器 = null;
    const 片段 = await Promise.race([
      读取器.read().then(结果 => 结果).catch(() => null),
      new Promise(完成 => {
        定时器 = setTimeout(() => 完成(null), 剩余);
      })
    ]);
    if (定时器) clearTimeout(定时器);
    if (!片段 || 片段.done || !片段.value) return 长度 ? 'dead' : 'timeout';
    const 值 = 片段.value instanceof Uint8Array ? 片段.value : new Uint8Array(片段.value);
    块.push(值);
    长度 += 值.length;
    const 合并 = new Uint8Array(长度);
    let 偏移 = 0;
    for (const 段 of 块) {
      合并.set(段, 偏移);
      偏移 += 段.length;
    }
    const 判定 = 判断握手应答(合并);
    if (判定 !== 'wait') return 判定;
    if (长度 > 80) return 'dead';
  }
  return 'timeout';
}

async function 探测握手(主机, 端口, 超时毫秒) {
  let 套接字 = null;
  let 定时器 = null;
  try {
    套接字 = 连接({ hostname: 主机, port: Number(端口) || 443 });
    const 打开 = await Promise.race([
      套接字.opened.then(() => true).catch(() => false),
      new Promise(完成 => {
        定时器 = setTimeout(() => 完成(false), 超时毫秒);
      })
    ]);
    if (!打开 || !套接字.writable || !套接字.readable) return 'timeout';
    const 写入器 = 套接字.writable.getWriter();
    await 写入器.write(构造握手请求('www.cloudflare.com'));
    try {
      写入器.releaseLock();
    } catch (忽略) {}
    return await 读到判定(套接字.readable.getReader(), 超时毫秒);
  } catch (错误) {
    return 'dead';
  } finally {
    if (定时器) clearTimeout(定时器);
    try {
      if (套接字) 套接字.close();
    } catch (忽略) {}
  }
}

async function 测活候选(候选, 选项) {
  if (!选项.probe) return { nodes: (候选 || []).filter(稳定可下发), effective: true };
  // 只抽查前几名，确认是不是 TLS。超时仍保留原 443，避免一次探测把订阅改成全员 8443 或删空。
  const 样本 = (候选 || []).filter(节点 => 节点 && 节点.kind !== 'domain' && (节点.pinned || 位于云墙网段(节点.ip))).slice(0, 8);
  if (!样本.length) return 应用握手结果(候选, [], 选项, true);
  const 首轮 = await 并发映射(样本, 3, async 节点 => {
    const 端口 = 规范云墙端口(节点.port, !!节点.pinned);
    const 状态 = await 探测握手(节点.ip, 端口, 800);
    return { key: 节点键(节点), status: 状态 };
  });
  return 应用握手结果(候选, 首轮, 选项, true);
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
    region: '',
    pinned: true
  }));
  const 域名 = 自定义优选域名列表.map(项 => ({
    ip: 项.domain,
    port: 项.port || 443,
    isp: 项.name || '优选域名',
    tier: 1,
    kind: 'domain',
    latency: null,
    speed: 0,
    region: '',
    pinned: true
  }));
  return 地址.concat(域名).filter(项 => 项.kind);
}

function 收成云墙(列表) {
  return (列表 || []).filter(节点 => 可拨号节点(节点)).map(节点 => {
    if (!节点 || 节点.kind === 'domain') return 节点;
    return { ...节点, port: 规范云墙端口(节点.port, !!节点.pinned) };
  });
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

function 标成社区节点(列表, 是中转 = false) {
  return (列表 || []).map(节点 => {
    if (!节点 || 节点.kind === 'domain') return 节点;
    const 中转 = !!(是中转 && !位于云墙网段(节点.ip));
    return { ...节点, sourced: true, relay: 中转 || !!节点.relay };
  });
}

function 运营商仍启用(名称, 选项) {
  if (名称 === '移动') return !!选项.mobile;
  if (名称 === '联通') return !!选项.unicom;
  if (名称 === '电信') return !!选项.telecom;
  return true;
}

async function 拉取远程优选(选项) {
  const 任务 = [];
  if (启用优选地址) {
    for (const 来源 of 主力优选源) {
      const 运营商列 = (来源.isps || []).filter(名称 => 运营商仍启用(名称, 选项));
      if (!运营商列.length) continue;
      任务.push(() => 拉取并解析(来源.url, {
        tier: 来源.relay ? 2 : 1,
        fallbackName: 来源.relay ? '优选中转' : '优选IP',
        prefer: 来源.relay ? 'region' : 'isp',
        maxLines: 来源.maxLines
      }).then(列表 => {
        const 输出 = [];
        for (const 运营商 of 运营商列) {
          输出.push(...整理运营商优选节点(列表, {
            isp: 运营商,
            taggedOnly: 来源.taggedOnly,
            relay: 来源.relay,
            limit: (来源.limits && 来源.limits[运营商]) || 6
          }));
        }
        return 输出;
      }));
    }
    for (const 网址 of 选项.pool) {
      任务.push(() => 拉取并解析(网址, { tier: 1, fallbackName: '优选IP', prefer: 'isp', maxLines: 40 }).then(列表 => 标成社区节点(列表)));
    }
    if (选项.v6policy !== 'off' && 选项.ipv6) {
      任务.push(() => 拉取并解析(六版优选源, { tier: 3, fallbackName: 'IPv6优选', prefer: 'isp', maxLines: 30 }).then(列表 => 标成社区节点(列表.filter(项 => 项.kind === 'v6').slice(0, 8))));
    }
  }
  if (启用仓库优选 && 优选地址源) 任务.push(() => 读取仓库优选节点().then(列表 => 标成社区节点(列表)));
  // Workers Free 每次请求最多同时等待 6 个外连；保留一个余量给运行时其它请求。
  const 结算 = await 有限并发结算(任务, 5);
  let 节点 = [];
  for (const 项 of 结算) {
    if (项.status === 'fulfilled' && Array.isArray(项.value)) 节点 = 节点.concat(项.value);
  }
  节点 = 收成云墙(节点);
  节点 = 保留可用速度(节点, 4);
  const 质量 = 节点.filter(项 => 项.kind === 'v4' && 项.tier <= 2).length;
  if (启用优选地址 && 质量 < 5) {
    try {
      const 旧列表 = await 获取值地址列表();
      节点 = 节点.concat(标成社区节点(收成云墙((旧列表 || []).map(项 => ({
        ip: 项.ip,
        port: 443,
        isp: 项.isp || '优选IP',
        tier: 1,
        kind: 地址种类(项.ip),
        latency: null,
        speed: 0,
        region: ''
      })))));
    } catch (错误) {}
  }
  return 合并去重(节点);
}

async function 刷新线路候选(键, 选项, 本地候选, 独占, 历史节点 = []) {
  if (线路优化刷新任务 && 线路优化刷新键 === 键) return 线路优化刷新任务;
  线路优化刷新键 = 键;
  线路优化刷新任务 = (async () => {
    let 远程 = [];
    if (!独占 && (启用优选地址 || (启用仓库优选 && 优选地址源))) 远程 = await 拉取远程优选(选项);
    let 候选 = 收成云墙(本地候选.concat(远程));
    候选 = 保留可用速度(筛选优选(合并去重(候选), 选项), 4);
    const 测活 = await 测活候选(候选, 选项);
    候选 = 更新测活历史(测活.nodes, 历史节点).filter(稳定可下发);
    const 四版数 = 候选.filter(项 => 项.kind === 'v4').length;
    if (候选.length) await 写入线路缓存(键, 候选, 测活.effective && 四版数 > 0, 独占);
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
    const 刷新 = 刷新线路候选(键, 选项, 本地, 独占, 缓存.nodes).catch(() => []);
    if (执行上下文 && typeof 执行上下文.waitUntil === 'function') 执行上下文.waitUntil(刷新);
  } else {
    候选 = await 刷新线路候选(键, 选项, 本地, 独占, []);
    缓存状态 = 候选.length ? 'miss' : 'empty';
    if (!候选.length) 候选 = 筛选优选(合并去重(收成云墙(本地)), 选项);
  }
  候选 = (候选 || []).filter(稳定可下发);
  if (选项.anchor && !独占) 候选 = 标注保底(候选);
  const 入口 = 生成入口节点(线路入口域名);
  if (入口) 候选 = 合并去重(候选.concat([入口]));
  let 最终 = 编排优选节点(候选, 选项).filter(节点 => 节点 && (节点.kind === 'domain' || 可拨号节点(节点)));
  const 备用前置域名 = 读取备用前置域名();
  最终 = 分配前置域名(最终, 线路入口域名, 备用前置域名);
  const 池内 = 候选.filter(项 => 项.kind !== 'domain').length;
  const 已选地址 = 最终.filter(项 => 项.kind !== 'domain').length;
  const 边缘已测 = 最终.filter(项 => 项.kind !== 'domain' && 项.edgeStatus).length;
  const 边缘可达 = 最终.filter(项 => 项.kind !== 'domain' && 项.edgeStatus === 'ok').length;
  const 历史样本 = 最终.filter(项 => (Number(项.successes) || 0) + (Number(项.failures) || 0) > 0).length;
  const 稳定节点 = 最终.filter(项 => Number(项.successes) >= 2 && 历史成功率(项) >= 0.75 && !(Number(项.failureStreak) > 0)).length;
  线路优化摘要 = `on;count=${最终.length};selected=${已选地址};edge_ok=${边缘可达};edge_tested=${边缘已测};history=${历史样本};stable=${稳定节点};user_ok=unknown;fronts=${备用前置域名.length + 1};pool=${池内};cache=${缓存状态}`;
  return 最终;
}

function 安静页面(状态 = 404) {
  const 页 = '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f1ea;color:#1c2430;font-family:sans-serif"><p>这里没有内容。</p></body></html>';
  const 头 = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
  if (状态 === 429) 头['Retry-After'] = '60';
  return new Response(页, { status: 状态, headers: 头 });
}

function 处理访客边界(请求, 环境 = {}) {
  let 网址;
  try {
    网址 = new URL(请求.url);
  } catch (错误) {
    return 安静页面(404);
  }
  if (请求.method === 'GET' && 网址.pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }
    });
  }
  if ((请求.headers.get('Upgrade') || '').toLowerCase() === 'websocket') return null;
  if (请求.method === 'POST') return null;
  const 环境令牌 = String((环境 && (环境.u || 环境.U)) || '').trim();
  const 令牌 = (环境令牌 || (typeof 认证令牌 === 'string' ? 认证令牌 : '')).toLowerCase();
  const 自定义 = String((环境 && (环境.d || 环境.D)) || '').trim().toLowerCase().replace(/^\//, '');
  const 段 = 网址.pathname.split('/').filter(Boolean);
  const 首段 = (段[0] || '').toLowerCase();
  const 命中 = Boolean(首段) && (首段 === 令牌 || (自定义 && 首段 === 自定义));
  if (网址.pathname !== '/' && !命中) return 安静页面(404);
  const 是管理 = 段.some(段名 => {
    const 名称 = 段名.toLowerCase();
    return 名称 === 'api' || 名称 === 'region' || 名称 === 'test-api';
  });
  const 是页面 = 网址.pathname === '/' || (段.length === 1 && 命中);
  const 是订阅 = 命中 && !是页面 && !是管理;
  if (!是订阅 && !是页面) return null;
  const 上限 = 是订阅 ? 10 : 30;
  if (!允许访问(是订阅 ? 'sub' : 'page', Date.now(), 上限)) return 安静页面(429);
  return null;
}
