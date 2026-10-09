import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const 根目录 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 目标 = path.join(根目录, '_worker.js');
const 核心 = fs.readFileSync(path.join(根目录, 'src/route-optimizer-core.mjs'), 'utf8');
const 胶水 = fs.readFileSync(path.join(根目录, 'src/route-optimizer-glue.js'), 'utf8');
let 源 = fs.readFileSync(目标, 'utf8');

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
      const 优化节点 = await 组装线路优化节点();
      if (优化节点.length > 0) {
        await 添加节点列表来源列表(优化节点);
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
                                    <textarea id="optPool" rows="3" placeholder="留空使用内置地区池。每行一个 https 地址，最多 6 个" style="width: 100%; padding: 10px; background: rgba(0, 0, 0, 0.8); border: 1px solid #00f0ff; color: #00f0ff; font-family: 'Courier New', monospace; font-size: 13px;"></textarea>
                                </div>
                                <small style="color: #7aa9c4; font-size: 0.85rem; display: block; margin-top: 10px;">优选池按延迟和速度排序，测活去掉不通的地址，保底节点固定在最前并每 5 分钟轮换一次头部。IPv6 默认不进订阅。外部源缓存 30 分钟，拉取失败继续用上一份。填写了优选 IP 时默认只下发自定义节点和保底节点。</small>
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
  'module',
  'async function 处理订阅请求(请求507, 用户506, 网址505 = null) {\n',
  `${核心}\n${胶水}\nasync function 处理订阅请求(请求507, 用户506, 网址505 = null) {\n`
);

写入(
  'fetch-context',
  'async fetch(请求735, 本地值734, 本地值733) {\n    try {\n',
  'async fetch(请求735, 本地值734, 本地值733) {\n    try {\n      当前环境 = 本地值734 || {};\n      执行上下文 = 本地值733 || null;\n'
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

if (!源.includes('组装线路优化节点') || !源.includes('function 整理线路选项')) {
  throw new Error('线路优化代码没有写进 _worker.js');
}
fs.writeFileSync(目标, 源);
console.log('已套用线路优化:', 目标);
