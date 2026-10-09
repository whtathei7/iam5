import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const 根目录 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 目标 = path.join(根目录, '_worker.js');
const 核心 = fs.readFileSync(path.join(根目录, 'src/route-optimizer-core.mjs'), 'utf8');
const 胶水 = fs.readFileSync(path.join(根目录, 'src/route-optimizer-glue.js'), 'utf8');
const 后台样式 = fs.readFileSync(path.join(根目录, 'src/admin-calm.css'), 'utf8');
let 源 = fs.readFileSync(目标, 'utf8').replace(/\r\n/g, '\n');

function 包裹(名称, 内容) {
  return `/* ROUTE_OPT_START ${名称} */\n${内容.replace(/^\n/, '').replace(/\n$/, '')}\n/* ROUTE_OPT_END ${名称} */`;
}

function 写入(名称, 锚点, 内容) {
  const 块 = 包裹(名称, 内容);
  const 开始 = `/* ROUTE_OPT_START ${名称} */`;
  const 结束 = `/* ROUTE_OPT_END ${名称} */`;
  const 起 = 源.indexOf(开始);
  if (起 >= 0) {
    const 止 = 源.indexOf(结束, 起);
    if (止 < 0) throw new Error('标记不完整: ' + 名称);
    源 = 源.slice(0, 起) + 块 + 源.slice(止 + 结束.length);
    return;
  }
  const 位 = 源.indexOf(锚点);
  if (位 < 0) throw new Error('找不到插入点: ' + 名称);
  if (源.indexOf(锚点, 位 + 锚点.length) >= 0) throw new Error('插入点不唯一: ' + 名称);
  源 = 源.slice(0, 位) + 块 + 源.slice(位 + 锚点.length);
}

function 缩进(文本, 空格) {
  const 行 = String(文本 || '').replace(/^\n/, '').replace(/\n$/, '').split('\n');
  const 非空 = 行.filter(行文本 => 行文本.trim());
  const 最小 = 非空.reduce((值, 行文本) => Math.min(值, 行文本.match(/^ */)[0].length), 80);
  return 行.map(行文本 => (行文本.trim() ? ' '.repeat(空格) + 行文本.slice(最小) : '')).join('\n');
}

function 处理订阅钩子() {
  const 名称 = 'subscribe';
  const 开始 = `/* ROUTE_OPT_START ${名称} */`;
  const 结束 = `/* ROUTE_OPT_END ${名称} */`;
  const 遗留起 = '/* ROUTE_OPT_LEGACY_START */';
  const 遗留止 = '/* ROUTE_OPT_LEGACY_END */';
  let 旧代码 = '';
  if (源.includes(遗留起)) {
    const 起 = 源.indexOf(遗留起) + 遗留起.length;
    const 止 = 源.indexOf(遗留止, 起);
    if (止 < 0) throw new Error('旧订阅逻辑标记不完整');
    旧代码 = 源.slice(起, 止);
  } else {
    const 起点 = '  const 是否有自定义优选 = 自定义优选地址列表.length > 0 || 自定义优选域名列表.length > 0;\n';
    const 终点 = '  if (最终链接列表.length === 0) {\n';
    const 起 = 源.indexOf(起点);
    const 止 = 源.indexOf(终点);
    if (起 < 0 || 止 < 0 || 止 <= 起) throw new Error('找不到订阅生成插入点');
    旧代码 = 源.slice(起, 止);
  }
  const 块 = `${开始}
  let 已写入优化节点 = false;
  if (!禁用优选 && 启用线路优化) {
    try {
      线路入口域名 = 工作器域名504;
      const 优化节点 = await 组装线路优化节点();
      if (优化节点.length > 0) {
        await 添加节点列表来源列表(优化节点);
        const 独立入口 = 读取独立入口(工作器域名504);
        const 独立候选 = 优化节点.filter(节点 => 节点 && 节点.kind !== 'domain').slice(0, 6);
        for (const 入口 of 独立入口) {
          const 入口节点 = 独立候选.map(节点 => ({
            ...节点,
            frontDomain: 入口.domain,
            isp: 入口.name + '·' + (节点.isp || '优选')
          }));
          await 添加独立入口节点列表(入口节点, 入口.uuid, 入口.domain);
        }
        if (线路优化摘要.startsWith('on;')) 线路优化摘要 += ';backends=' + (独立入口.length + 1);
        已写入优化节点 = true;
      } else {
        线路优化摘要 = 'fallback';
      }
    } catch (优化错误) {
      线路优化摘要 = 'fallback';
    }
  } else {
    线路优化摘要 = 'off';
  }
  if (!已写入优化节点) {
${遗留起}
${缩进(旧代码, 4)}
${遗留止}
  }
${结束}
`;
  if (源.includes(开始)) {
    const 起 = 源.indexOf(开始);
    const 止 = 源.indexOf(结束, 起);
    if (止 < 0) throw new Error('订阅标记不完整');
    let 尾 = 止 + 结束.length;
    if (源[尾] === '\n') 尾++;
    源 = 源.slice(0, 起) + 块 + 源.slice(尾);
    return;
  }
  const 起点 = '  const 是否有自定义优选 = 自定义优选地址列表.length > 0 || 自定义优选域名列表.length > 0;\n';
  const 终点 = '  if (最终链接列表.length === 0) {\n';
  const 起 = 源.indexOf(起点);
  const 止 = 源.indexOf(终点);
  源 = 源.slice(0, 起) + 块 + 源.slice(止);
}

function 套上简洁样式(样式) {
  const 开始 = '/* ROUTE_OPT_START calm */';
  const 结束 = '/* ROUTE_OPT_END calm */';
  const 块 = `${开始}\n${样式.trim()}\n${结束}\n`;
  if (源.includes(开始)) {
    const 转义 = 文本 => 文本.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    源 = 源.replace(new RegExp(转义(开始) + '[\\s\\S]*?' + 转义(结束) + '\\n?', 'g'), 块);
    return;
  }
  const 锚 = '        </style>';
  const 次数 = 源.split(锚).length - 1;
  if (次数 !== 2) throw new Error('后台样式结束标记数量不对: ' + 次数);
  源 = 源.split(锚).join(块 + 锚);
}

const 面板 = `                        <div style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; color: #00f0ff; font-weight: bold; text-shadow: 0 0 3px #00f0ff;">线路优化</label>
                            <div style="padding: 15px; background: rgba(15, 3, 40, 0.6); border: 1px solid #00f0ff; border-radius: 5px;">
                                <label style="display: inline-flex; align-items: center; cursor: pointer; color: #00f0ff; margin-bottom: 8px;">
                                    <input type="checkbox" id="optEnabled" checked style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                                    <span style="font-size: 1.05rem;">启用线路优化</span>
                                </label>
                                <div style="display: flex; flex-wrap: wrap; gap: 14px; margin: 8px 0 12px;">
                                    <label style="display: inline-flex; align-items: center; cursor: pointer; color: #00f0ff;">
                                        <input type="checkbox" id="optAnchor" checked style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                                        <span>保底节点前置</span>
                                    </label>
                                    <label style="display: inline-flex; align-items: center; cursor: pointer; color: #00f0ff;">
                                        <input type="checkbox" id="optProbe" checked style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                                        <span>下发前测活</span>
                                    </label>
                                    <label style="display: inline-flex; align-items: center; cursor: pointer; color: #00f0ff;">
                                        <input type="checkbox" id="optBalance" checked style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                                        <span>头部轮换</span>
                                    </label>
                                    <label style="display: inline-flex; align-items: center; cursor: pointer; color: #00f0ff;">
                                        <input type="checkbox" id="optMerge" style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                                        <span>自定义节点合并默认池</span>
                                    </label>
                                </div>
                                <div class="opt-note" style="font-size: 13px; line-height: 1.6; margin-bottom: 10px;">电信、移动优质节点优先，订阅里可以选择自动最快。联通、地区中转和 8443 仍会保留。</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                                    <div style="min-width: 120px; flex: 1;">
                                        <label style="display: block; margin-bottom: 6px; color: #00f0ff;">下发数量</label>
                                        <input type="number" id="optLimit" value="36" min="8" max="120" style="width: 100%; padding: 10px; background: rgba(0, 0, 0, 0.8); border: 1px solid #00f0ff; color: #00f0ff; font-family: 'Courier New', monospace; font-size: 13px;">
                                    </div>
                                    <div style="min-width: 160px; flex: 1;">
                                        <label style="display: block; margin-bottom: 6px; color: #00f0ff;">IPv6 策略</label>
                                        <select id="v6policy" style="width: 100%; padding: 10px; background: rgba(0, 0, 0, 0.8); border: 1px solid #00f0ff; color: #00f0ff; font-family: 'Courier New', monospace; font-size: 13px;">
                                            <option value="off">不下发</option>
                                            <option value="backup">仅备胎</option>
                                            <option value="mix">等权混合</option>
                                        </select>
                                    </div>
                                    <div style="min-width: 140px; flex: 1;">
                                        <label style="display: block; margin-bottom: 6px; color: #00f0ff;">地区优选</label>
                                        <select id="optRegion" style="width: 100%; padding: 10px; background: rgba(0, 0, 0, 0.8); border: 1px solid #00f0ff; color: #00f0ff; font-family: 'Courier New', monospace; font-size: 13px;">
                                            <option value="all">全部</option>
                                            <option value="HK">香港</option>
                                            <option value="TW">台湾</option>
                                            <option value="JP">日本</option>
                                            <option value="SG">新加坡</option>
                                            <option value="US">美国</option>
                                            <option value="KR">韩国</option>
                                            <option value="DE">德国</option>
                                        </select>
                                    </div>
                                </div>
                                <div style="margin-top: 12px;">
                                    <label style="display: block; margin-bottom: 6px; color: #00f0ff;">兜底优选池 URL</label>
                                    <textarea id="optPool" rows="3" placeholder="留空使用实测优选。只采纳 Cloudflare 网段，每行一个 https 地址，最多 6 个" style="width: 100%; padding: 10px; background: rgba(0, 0, 0, 0.8); border: 1px solid #00f0ff; color: #00f0ff; font-family: 'Courier New', monospace; font-size: 13px;"></textarea>
                                </div>
                                <small style="color: #7aa9c4; font-size: 0.85rem; display: block; margin-top: 10px;">只下发 Cloudflare 网段里的地址。下发前做 TLS 握手，握手失败的地址不再下发；延迟低、速度快的排在最前。本机域名作为入口，避免优选地址全灭时订阅里没有能用的节点。</small>
                            </div>
                        </div>
`;

写入(
  'banner',
  '// CFnew - 终端 v3.1\n// 版本: v3.1 \n',
  '// CFnew - 终端 v3.1\n// 版本: v3.1 \n// 线路优化方案已启用\n'
);

写入(
  'defaults',
  "  ipv6: 'yes',\n  ispMobile: 'yes',\n  ispUnicom: 'yes',\n  ispTelecom: 'yes',\n  jk: 'no'\n};",
  `  ipv6: 'no',
  ispMobile: 'yes',
  ispUnicom: 'yes',
  ispTelecom: 'yes',
  jk: 'no',
  opt: 'yes',
  optLimit: '36',
  optProbe: 'yes',
  optBalance: 'yes',
  optAnchor: 'yes',
  optMerge: 'no',
  v6policy: 'off',
  optRegion: 'all',
  optPool: ''
};`
);

写入(
  'switches',
  "['ev', 'et', 'ex', 'ech', 'ena', 'epd', 'epi', 'egi', 'ipv4', 'ipv6', 'ispMobile', 'ispUnicom', 'ispTelecom', 'jk']",
  "['ev', 'et', 'ex', 'ech', 'ena', 'epd', 'epi', 'egi', 'ipv4', 'ipv6', 'ispMobile', 'ispUnicom', 'ispTelecom', 'jk', 'opt', 'optProbe', 'optBalance', 'optAnchor', 'optMerge']"
);

写入(
  'ech-runtime-default',
  'let 启用加密客户端问候 = false;',
  'let 启用加密客户端问候 = true;'
);

写入(
  'ech-config-default',
  "  ech: 'no',",
  "  ech: 'yes',"
);

写入(
  'ech-fetch-default',
  "      启用加密客户端问候 = 获取配置开关值('ech', false, 本地值734.ech || 本地值734.ECH);",
  `      const 强制ECH = !/^(no|false|0|off)$/i.test(String(本地值734.ECH_REQUIRED ?? 本地值734.echRequired ?? 'yes'));
      启用加密客户端问候 = 强制ECH || 获取配置开关值('ech', true, 本地值734.ech || 本地值734.ECH);`
);

写入(
  'ech-subscription-static',
  `  // 如果启用了ECH，使用自定义值
  let 加密客户端问候配置501 = null;
  if (启用加密客户端问候) {
    const 域名系统值500 = 自定义域名系统 || 'https://223.5.5.5/dns-query';
    const 加密客户端问候域名499 = 自定义加密客户端问候域名 || 'cloudflare-ech.com';
    加密客户端问候配置501 = \`\${加密客户端问候域名499}+\${域名系统值500}\`;
  }`,
  `  // 优先由 Worker 获取最新 ECHConfig 并直接下发，避免客户端本地 HTTPS DNS 查询失败。
  let 加密客户端问候配置501 = null;
  线路ECH配置 = '';
  if (启用加密客户端问候) {
    const 域名系统值500 = 自定义域名系统 || 'https://223.5.5.5/dns-query';
    const 加密客户端问候域名499 = 自定义加密客户端问候域名 || 'cloudflare-ech.com';
    线路ECH配置 = await 获取线路ECH配置(工作器域名504);
    加密客户端问候配置501 = 线路ECH配置 || \`\${加密客户端问候域名499}+\${域名系统值500}\`;
  }`
);

写入(
  'ech-yaml-static',
  `    行列表595.push(\`    ech-opts:\`);
    行列表595.push(\`      enable: true\`);
    行列表595.push(\`      query-server-name: \${处理本地值622(加密客户端问候域名590)}\`);`,
  `    行列表595.push(\`    ech-opts:\`);
    行列表595.push(\`      enable: true\`);
    if (线路ECH配置) 行列表595.push(\`      config: \${处理本地值622(线路ECH配置)}\`);
    else 行列表595.push(\`      query-server-name: \${处理本地值622(加密客户端问候域名590)}\`);`
);

写入(
  'ech-response-header',
  `  // 添加ECH状态到响应头
  if (启用加密客户端问候) {
    响应头部列表['X-ECH-Status'] = 'ENABLED';
    if (加密客户端问候配置501) {
      响应头部列表['X-ECH-Config-Length'] = String(加密客户端问候配置501.length);
    }
  }`,
  `  // 添加ECH状态到响应头
  if (启用加密客户端问候) {
    响应头部列表['X-ECH-Status'] = 'ENABLED';
    响应头部列表['X-ECH-Mode'] = 线路ECH配置 ? 线路ECH状态 : 'dns';
    if (线路ECH配置) 响应头部列表['X-ECH-Config-Length'] = String(线路ECH配置.length);
  }`
);

写入(
  'normalize',
  `  if (快照.ev === 'no' && 快照.et === 'no' && 快照.ex === 'no') {
    快照.ev = 'yes';
  }
  if (快照.ech === 'yes') {
    快照.dkby = 'yes';
  }
  return 快照;
}`,
  `  if (快照.ev === 'no' && 快照.et === 'no' && 快照.ex === 'no') {
    快照.ev = 'yes';
  }
  if (快照.ech === 'yes') {
    快照.dkby = 'yes';
  }
  const 线路选项 = 整理线路选项(快照);
  快照.opt = 线路选项.enabled ? 'yes' : 'no';
  快照.optProbe = 线路选项.probe ? 'yes' : 'no';
  快照.optBalance = 线路选项.balance ? 'yes' : 'no';
  快照.optAnchor = 线路选项.anchor ? 'yes' : 'no';
  快照.optMerge = 线路选项.merge ? 'yes' : 'no';
  快照.optLimit = String(线路选项.limit);
  快照.v6policy = 线路选项.v6policy;
  快照.optRegion = 线路选项.region;
  快照.optPool = 线路选项.pool.join('\\n');
  return 快照;
}`
);

写入(
  'env',
  `    jk: ['jk', 'JK']
  };`,
  `    jk: ['jk', 'JK'],
    opt: ['opt', 'OPT'],
    optLimit: ['optLimit', 'OPTLIMIT', 'OPT_LIMIT'],
    optProbe: ['optProbe', 'OPTPROBE', 'OPT_PROBE'],
    optBalance: ['optBalance', 'OPTBALANCE', 'OPT_BALANCE'],
    optAnchor: ['optAnchor', 'OPTANCHOR', 'OPT_ANCHOR'],
    optMerge: ['optMerge', 'OPTMERGE', 'OPT_MERGE'],
    v6policy: ['v6policy', 'V6POLICY', 'V6_POLICY'],
    optRegion: ['optRegion', 'OPTREGION', 'OPT_REGION'],
    optPool: ['optPool', 'OPTPOOL', 'OPT_POOL']
  };`
);

写入(
  'clash-auto-fastest',
  `  const 值值577 = [解码64('cHJveHktZ3JvdXBzOg=='), '  - name: "🚀 节点选择"', '    type: select', '    proxies:', '      - "🎯 全球直连"', 节点仅,`,
  `  const 低延迟组名 = '⚡ 电信低延迟';
  const 大带宽组名 = '🚄 电信大带宽';
  const Codex智能组名 = '🧠 Codex智能';
  const 自动选择组名 = '⚡ 自动选择';
  const Codex测试网址 = 'https://chatgpt.com/cdn-cgi/trace';
  const 自动测速网址 = 'https://www.gstatic.com/generate_204';
  const 电信节点 = 节点列表586.filter(节点 => /电信/.test(节点.name || ''));
  const 低延迟节点 = 挑选自动测速节点(电信节点.length ? 电信节点 : 节点列表586, 8);
  const Codex候选节点 = 挑选自动测速节点(节点列表586, 12);
  const 自动选择节点 = 挑选自动最快节点(节点列表586, 8);
  const 高速节点 = 节点列表586.filter(节点 => /高速\\d+·.*电信/.test(节点.name || '')).sort((甲, 乙) => {
    const 甲序 = Number((甲.name.match(/高速(\\d+)·/) || [])[1]) || 999;
    const 乙序 = Number((乙.name.match(/高速(\\d+)·/) || [])[1]) || 999;
    return 甲序 - 乙序;
  });
  const 大带宽节点 = 挑选自动测速节点(高速节点.length ? 高速节点 : 低延迟节点, 6);
  const 列出测速节点 = 列表 => 列表.length ? 列表.map(节点 => \`      - \${处理本地值622(节点.name)}\`).join('\\n') : '      - DIRECT';
  const 自动选择组 = [
    '  - name: "' + 自动选择组名 + '"',
    '    type: url-test',
    '    url: ' + 自动测速网址,
    '    expected-status: 204',
    '    interval: 600',
    '    tolerance: 50',
    '    lazy: true',
    '    proxies:',
    列出测速节点(自动选择节点)
  ].join('\\n');
  const 低延迟组 = [
    '  - name: "' + 低延迟组名 + '"',
    '    type: url-test',
    '    url: ' + Codex测试网址,
    '    expected-status: 200',
    '    interval: 900',
    '    tolerance: 80',
    '    lazy: true',
    '    proxies:',
    列出测速节点(低延迟节点)
  ].join('\\n');
  const 大带宽组 = [
    '  - name: "' + 大带宽组名 + '"',
    '    type: fallback',
    '    url: ' + Codex测试网址,
    '    expected-status: 200',
    '    interval: 1800',
    '    lazy: true',
    '    proxies:',
    列出测速节点(大带宽节点)
  ].join('\\n');
  const Codex智能组 = [
    '  - name: "' + Codex智能组名 + '"',
    '    type: url-test',
    '    url: ' + Codex测试网址,
    '    expected-status: 200',
    '    interval: 900',
    '    tolerance: 100',
    '    lazy: true',
    '    proxies:',
    列出测速节点(Codex候选节点)
  ].join('\\n');
  const Codex优先仅 = [
    '      - "' + Codex智能组名 + '"',
    '      - "' + 大带宽组名 + '"',
    '      - "' + 低延迟组名 + '"',
    '      - "' + 自动选择组名 + '"',
    '      - "🚀 节点选择"',
    '      - "🎯 全球直连"',
    节点仅
  ].join('\\n');
  const 值值577 = [解码64('cHJveHktZ3JvdXBzOg=='), 自动选择组, Codex智能组, 大带宽组, 低延迟组, '  - name: "🚀 节点选择"', '    type: select', '    proxies:', '      - "' + 自动选择组名 + '"', '      - "' + Codex智能组名 + '"', '      - "' + 大带宽组名 + '"', '      - "' + 低延迟组名 + '"', '      - "🎯 全球直连"', 节点仅,`
);

写入(
  'surge-auto-fastest',
  '  行列表555.push(`🚀 节点选择 = select, 🎯 全球直连, ${列表553}`);',
  `  const 自动选择名 = '⚡ 自动选择';
  const 自动候选 = 挑选自动最快节点(节点列表560.map(项 => ({ name: 项.name, server: 项.server, port: 项.port, sni: 项.sni })), 8);
  const 自动名单 = 自动候选.length ? 自动候选.map(项 => 项.name).join(', ') : (名称列表557[0] || 'DIRECT');
  行列表555.push(\`\${自动选择名} = url-test, \${自动名单}, url=http://www.gstatic.com/generate_204, interval=600, tolerance=50, timeout=5\`);
  行列表555.push(\`🚀 节点选择 = select, \${自动选择名}, 🎯 全球直连, \${列表553}\`);`
);

写入(
  'loon-auto-fastest',
  '  行列表546.push(`🚀 节点选择 = select,🎯 全球直连,${列表542}`);',
  `  const 自动选择名 = '⚡ 自动选择';
  const 自动候选 = 挑选自动最快节点(节点列表550.map(项 => ({ name: 项.name, server: 项.server, port: 项.port, sni: 项.sni })), 8);
  const 自动名单 = 自动候选.length ? 自动候选.map(项 => 项.name).join(',') : (名称列表548[0] || 'DIRECT');
  行列表546.push(\`\${自动选择名} = url-test,\${自动名单},url=http://www.gstatic.com/generate_204,interval=600,tolerance=50\`);
  行列表546.push(\`🚀 节点选择 = select,\${自动选择名},🎯 全球直连,\${列表542}\`);`
);

写入(
  'qx-auto-fastest',
  '  行列表538.push(`static=🚀 节点选择, ${列表534}, direct, img-url=${解码64(\'aHR0cHM6Ly9mYXN0bHkuanNkZWxpdnIubmV0L2doL0tvb2xzb24vUXVyZUBtYXN0ZXIvSWNvblNldC9Db2xvci9Qcm94eS5wbmc=\')}`);',
  `  const 自动选择名 = '⚡ 自动选择';
  const 自动候选 = 挑选自动最快节点(节点列表.map(项 => ({ name: 项.name, server: 项.server, port: 项.port, sni: 项.sni })), 8);
  const 自动名单 = 自动候选.length ? 自动候选.map(项 => 项.name).join(', ') : 'direct';
  行列表538.push(\`url-latency-benchmark=\${自动选择名}, \${自动名单}, check-interval=600, tolerance=50, img-url=https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png\`);
  行列表538.push(\`static=🚀 节点选择, \${自动选择名}, \${列表534}, direct, img-url=\${解码64('aHR0cHM6Ly9mYXN0bHkuanNkZWxpdnIubmV0L2doL0tvb2xzb24vUXVyZUBtYXN0ZXIvSWNvblNldC9Db2xvci9Qcm94eS5wbmc=')}\`);`
);

写入(
  'singbox-auto-candidates',
  '  const 出站值 = 节点列表572.map(数量值569 => 数量值569.name);',
  `  const 出站值 = 节点列表572.map(数量值569 => 数量值569.name);
  const 自动选择候选 = 挑选自动最快节点(节点列表572.map(项 => ({ name: 项.name, server: 项.server, port: 项.port, sni: 项.sni })), 8).map(项 => 项.name);
  const 自动选择出站 = 自动选择候选.length ? 自动选择候选 : 出站值.slice(0, 8);`
);

写入(
  'singbox-auto-fastest',
  `    outbounds: [{
      type: 'selector',
      tag: 'select',
      outbounds: ['direct', ...出站值],
      default: 出站值[0] || 'direct'
    }, {`,
  `    outbounds: [{
      type: 'urltest',
      tag: '⚡ 自动选择',
      outbounds: 自动选择出站.length ? 自动选择出站 : ['direct'],
      url: 'https://www.gstatic.com/generate_204',
      interval: '10m',
      tolerance: 50,
      idle_timeout: '30m'
    }, {
      type: 'selector',
      tag: 'select',
      outbounds: ['⚡ 自动选择', 'direct', ...出站值],
      default: '⚡ 自动选择'
    }, {`
);

写入(
  'codex-openai-priority',
  `'  - name: "🤖 OpenAI"', '    type: select', '    proxies:', 处理值选择值(名称列表584),`,
  `'  - name: "🤖 OpenAI"', '    type: select', '    proxies:', Codex优先仅,`
);

写入(
  'codex-development-rules',
  `'  - DOMAIN-KEYWORD,openai,🤖 OpenAI', '  - DOMAIN-KEYWORD,chatgpt,🤖 OpenAI', '  - DOMAIN-SUFFIX,openai.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,chatgpt.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,oaistatic.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,oaiusercontent.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,anthropic.com,🤖 OpenAI',`,
  `'  - DOMAIN-KEYWORD,openai,🤖 OpenAI', '  - DOMAIN-KEYWORD,chatgpt,🤖 OpenAI', '  - DOMAIN-SUFFIX,openai.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,chatgpt.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,oaistatic.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,oaiusercontent.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,github.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,githubusercontent.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,github-cloud.githubusercontent.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,codeload.github.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,github-cloud.s3.amazonaws.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,release-assets.githubusercontent.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,npmjs.org,🤖 OpenAI', '  - DOMAIN-SUFFIX,yarnpkg.com,🤖 OpenAI', '  - DOMAIN-SUFFIX,pypi.org,🤖 OpenAI', '  - DOMAIN-SUFFIX,pythonhosted.org,🤖 OpenAI', '  - DOMAIN-SUFFIX,crates.io,🤖 OpenAI', '  - DOMAIN-SUFFIX,golang.org,🤖 OpenAI', '  - DOMAIN-SUFFIX,maven.apache.org,🤖 OpenAI', '  - DOMAIN-SUFFIX,gradle.org,🤖 OpenAI', '  - DOMAIN-SUFFIX,nuget.org,🤖 OpenAI', '  - DOMAIN-SUFFIX,anthropic.com,🤖 OpenAI',`
);

写入(
  'independent-node-builder',
  `  if (启用原生地址) {
    if (当前工作器地区 === 'CUSTOM') {`,
  `  async function 添加独立入口节点列表(列表, 独立用户, 独立域名) {
    if (!列表.length) return;
    if (启用明文) {
      最终链接列表.push(...生成链接列表来源源(列表, 独立用户, 独立域名, 加密客户端问候配置501, false, 别名命名器502));
    }
    if (启用木马) {
      最终链接列表.push(...(await 生成木马链接列表来源源(列表, 独立用户, 独立域名, 加密客户端问候配置501, false, 别名命名器502)));
    }
    if (启用扩展传输) {
      最终链接列表.push(...生成扩展超文本链接列表来源源(列表, 独立用户, 独立域名, 加密客户端问候配置501, false, 别名命名器502));
    }
  }
  if (启用原生地址) {
    if (当前工作器地区 === 'CUSTOM') {`
);

写入(
  'module',
  'async function 处理订阅请求(请求507, 用户506, 网址505 = null) {\n',
  `${核心}\n${胶水}\nasync function 处理订阅请求(请求507, 用户506, 网址505 = null) {\n`
);

写入(
  'fetch-context',
  'async fetch(请求735, 本地值734, 本地值733) {\n    try {\n',
  'async fetch(请求735, 本地值734, 本地值733) {\n    try {\n      当前环境 = 本地值734 || {};\n      执行上下文 = 本地值733 || null;\n      const 访客响应 = 处理访客边界(请求735, 本地值734);\n      if (访客响应) return 访客响应;\n'
);

写入(
  'fetch-apply',
  "      启用家宽链式 = 获取配置开关值('jk', false, 本地值734.jk || 本地值734.JK);\n",
  "      启用家宽链式 = 获取配置开关值('jk', false, 本地值734.jk || 本地值734.JK);\n      应用线路优化开关();\n"
);

写入(
  'config-apply',
  "  禁用优选 = !!(有效配置.yxby && 有效配置.yxby.toLowerCase() === 'yes');\n}",
  "  禁用优选 = !!(有效配置.yxby && 有效配置.yxby.toLowerCase() === 'yes');\n  应用线路优化开关();\n}"
);

写入(
  'header',
  '  return new Response(订阅内容, {\n',
  `  if (线路优化摘要) 响应头部列表['X-Opt'] = 线路优化摘要;
  return new Response(订阅内容, {
`
);

写入(
  'vless-source-server',
  "    const 安全地址467 = 项目468.ip.includes(':') ? `[${项目468.ip}]` : 项目468.ip;",
  `    const 服务器468 = 项目468.kind === 'domain' && 项目468.frontDomain ? 项目468.frontDomain : 项目468.ip;
    const 安全地址467 = 服务器468.includes(':') ? \`[\${服务器468}]\` : 服务器468;`
);

写入(
  'vless-source-front',
  `          sni: 工作器域名480,
          // randomized fingerprint may cause TLS compatibility issues with some Xray/uTLS clients.
          // Use chrome as default for better compatibility (chrome is also required when ECH is enabled).
          fp: 'chrome',
          type: 'ws',
          host: 工作器域名480,
          path: 网页套接字路径471`,
  `          sni: 项目468.frontDomain || 工作器域名480,
          // randomized fingerprint may cause TLS compatibility issues with some Xray/uTLS clients.
          // Use chrome as default for better compatibility (chrome is also required when ECH is enabled).
          fp: 'chrome',
          type: 'ws',
          host: 项目468.frontDomain || 工作器域名480,
          path: 生成抗阻断路径(项目468, 用户481)`
);

写入(
  'trojan-source-server',
  "    const 安全地址442 = 项目443.ip.includes(':') ? `[${项目443.ip}]` : 项目443.ip;",
  `    const 服务器443 = 项目443.kind === 'domain' && 项目443.frontDomain ? 项目443.frontDomain : 项目443.ip;
    const 安全地址442 = 服务器443.includes(':') ? \`[\${服务器443}]\` : 服务器443;`
);

写入(
  'trojan-source-front',
  `          sni: 工作器域名453,
          fp: 'chrome',
          type: 'ws',
          host: 工作器域名453,
          path: 网页套接字路径446`,
  `          sni: 项目443.frontDomain || 工作器域名453,
          fp: 'chrome',
          type: 'ws',
          host: 项目443.frontDomain || 工作器域名453,
          path: 生成抗阻断路径(项目443, 用户454)`
);

写入(
  'vless-new-server',
  "    const 安全地址87 = 项目89.ip.includes(':') ? `[${项目89.ip}]` : 项目89.ip;",
  `    const 服务器89 = 项目89.kind === 'domain' && 项目89.frontDomain ? 项目89.frontDomain : 项目89.ip;
    const 安全地址87 = 服务器89.includes(':') ? \`[\${服务器89}]\` : 服务器89;
    const 节点前置域名89 = 项目89.frontDomain || 工作器域名98;
    const 节点网页套接字路径89 = 生成抗阻断路径(项目89, 用户99);`
);

写入(
  'vless-new-front-safe-port',
  "      let 链接85 = `${协议}://${用户99}@${安全地址87}:${端口88}?encryption=none&security=tls&sni=${工作器域名98}&fp=chrome&type=ws&host=${工作器域名98}&path=${网页套接字路径91}`;",
  "      let 链接85 = `${协议}://${用户99}@${安全地址87}:${端口88}?encryption=none&security=tls&sni=${节点前置域名89}&fp=chrome&type=ws&host=${节点前置域名89}&path=${节点网页套接字路径89}`;"
);

写入(
  'vless-new-front-other-port',
  "      let 链接79 = `${协议}://${用户99}@${安全地址87}:${端口88}?encryption=none&security=tls&sni=${工作器域名98}&fp=chrome&type=ws&host=${工作器域名98}&path=${网页套接字路径91}`;",
  "      let 链接79 = `${协议}://${用户99}@${安全地址87}:${端口88}?encryption=none&security=tls&sni=${节点前置域名89}&fp=chrome&type=ws&host=${节点前置域名89}&path=${节点网页套接字路径89}`;"
);

写入(
  'trojan-new-server',
  "    const 安全地址 = 项目62.ip.includes(':') ? `[${项目62.ip}]` : 项目62.ip;",
  `    const 服务器62 = 项目62.kind === 'domain' && 项目62.frontDomain ? 项目62.frontDomain : 项目62.ip;
    const 安全地址 = 服务器62.includes(':') ? \`[\${服务器62}]\` : 服务器62;
    const 节点前置域名62 = 项目62.frontDomain || 工作器域名;
    const 节点网页套接字路径62 = 生成抗阻断路径(项目62, 用户);`
);

写入(
  'trojan-new-front-safe-port',
  "      let 链接59 = `${atob('dHJvamFuOi8v')}${密码}@${安全地址}:${端口61}?security=tls&sni=${工作器域名}&fp=chrome&type=ws&host=${工作器域名}&path=${网页套接字路径}`;",
  "      let 链接59 = `${atob('dHJvamFuOi8v')}${密码}@${安全地址}:${端口61}?security=tls&sni=${节点前置域名62}&fp=chrome&type=ws&host=${节点前置域名62}&path=${节点网页套接字路径62}`;"
);

写入(
  'trojan-new-front-other-port',
  "      let 链接 = `${atob('dHJvamFuOi8v')}${密码}@${安全地址}:${端口61}?security=tls&sni=${工作器域名}&fp=chrome&type=ws&host=${工作器域名}&path=${网页套接字路径}`;",
  "      let 链接 = `${atob('dHJvamFuOi8v')}${密码}@${安全地址}:${端口61}?security=tls&sni=${节点前置域名62}&fp=chrome&type=ws&host=${节点前置域名62}&path=${节点网页套接字路径62}`;"
);

处理订阅钩子();

写入(
  'panel',
  '                                <label style="display: block; margin-bottom: 8px; color: #00f0ff; font-weight: bold; text-shadow: 0 0 3px #00f0ff;">优选IP筛选设置</label>\n',
  `${面板}                                <label style="display: block; margin-bottom: 8px; color: #00f0ff; font-weight: bold; text-shadow: 0 0 3px #00f0ff;">优选IP筛选设置</label>\n`
);

写入(
  'ipv6-box',
  'id="ipv6Enabled" checked',
  'id="ipv6Enabled"'
);

写入(
  'ipv6-hint',
  '选择要使用的IP版本和运营商，未选中的将被过滤',
  '选择要使用的IP版本和运营商，未选中的将被过滤。IPv6 是否进入订阅还看上面的「IPv6 策略」，默认不下发。'
);

写入(
  'ui-load',
  "  写入开关值('ipv6Enabled', 配置.ipv6, true);\n  写入开关值('ispMobile', 配置.ispMobile, true);\n",
  `  写入开关值('ipv6Enabled', 配置.ipv6, false);
  写入开关值('optEnabled', 配置.opt, true);
  写入开关值('optAnchor', 配置.optAnchor, true);
  写入开关值('optProbe', 配置.optProbe, true);
  写入开关值('optBalance', 配置.optBalance, true);
  写入开关值('optMerge', 配置.optMerge, false);
  写入字段值('optLimit', 配置.optLimit || '36');
  写入字段值('v6policy', 配置.v6policy || 'off');
  写入字段值('optRegion', 配置.optRegion || 'all');
  写入字段值('optPool', 配置.optPool || '');
  写入开关值('ispMobile', 配置.ispMobile, true);
`
);

写入(
  'ui-save',
  "    ispTelecom: 读取开关值('ispTelecom', true)\n  };",
  `    ispTelecom: 读取开关值('ispTelecom', true),
    opt: 读取开关值('optEnabled', true),
    optAnchor: 读取开关值('optAnchor', true),
    optProbe: 读取开关值('optProbe', true),
    optBalance: 读取开关值('optBalance', true),
    optMerge: 读取开关值('optMerge', false),
    optLimit: 读取字段值('optLimit') || '36',
    v6policy: 读取字段值('v6policy') || 'off',
    optRegion: 读取字段值('optRegion') || 'all',
    optPool: 读取字段值('optPool')
  };`
);

写入(
  'ipv6-read',
  "    ipv6: 读取开关值('ipv6Enabled', true),",
  "    ipv6: 读取开关值('ipv6Enabled', false),"
);

写入(
  'reset',
  "          alpn: ''\n        })",
  `          alpn: '',
          opt: '',
          optLimit: '',
          optProbe: '',
          optBalance: '',
          optAnchor: '',
          optMerge: '',
          v6policy: '',
          optRegion: '',
          optPool: ''
        })`
);

写入(
  'quiet-uuid',
  `              return new Response(JSON.stringify({
                error: '访问被拒绝',
                message: '当前 Worker 已启用自定义路径模式，UUID 访问已禁用'
              }), {
                status: 403,
                headers: {
                  'Content-Type': 'application/json'
                }
              });`,
  '                return 安静页面(404);'
);

写入(
  'quiet-uuid-hint',
  `                return new Response(JSON.stringify({
                  error: 'UUID错误 请注意变量名称是u不是uuid'
                }), {
                  status: 403,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });`,
  '                return 安静页面(404);'
);

写入(
  'quiet-uuid-sub',
  `                  return new Response(JSON.stringify({
                    error: 'UUID错误'
                  }), {
                    status: 403,
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });`,
  '                  return 安静页面(404);'
);

写入(
  'quiet-early',
  `          return new Response('Not Found', {
            status: 404
          });`,
  '          return 安静页面(404);'
);

写入(
  'quiet-404',
  `      return new Response(JSON.stringify({
        error: 'Not Found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });`,
  '      return 安静页面(404);'
);

写入(
  'quiet-500',
  `      return new Response(错误655.toString(), {
        status: 500
      });`,
  '      return 安静页面(500);'
);

套上简洁样式(后台样式);

if (!源.includes('组装线路优化节点') || !源.includes('function 整理线路选项') || 源.split('/* ROUTE_OPT_START calm */').length !== 3) {
  throw new Error('线路优化代码没有写进 _worker.js');
}
fs.writeFileSync(目标, 源);
console.log('已套用线路优化:', 目标);
