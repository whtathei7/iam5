import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { register } from 'node:module';
import test from 'node:test';
import {
  编排优选节点,
  整理线路选项,
  解析优选文本,
  挑选测活样本,
  应用握手结果,
  随机补足节点,
  地址位于网段,
  低延迟网段,
  是安全优选网址,
  生成保底节点,
  生成入口节点,
  节点键,
  压缩节点,
  展开节点,
  可持久化节点,
  判断缓存写入,
  缓存时间戳,
  位于云墙网段,
  可拨号节点,
  构造握手请求,
  判断握手应答,
  保留可用速度,
  标注保底,
  扩展备用端口,
  是ECH配置,
  提取ECH配置,
  生成抗阻断路径,
  分配前置域名,
  是公网地址,
  社区节点,
  电信优选源,
  整理电信优选节点,
  解析独立入口配置,
  挑选自动测速节点,
  挑选电信大带宽节点,
  更新测活历史,
  历史成功率,
  允许访问,
  重置访问账本
} from '../src/route-optimizer-core.mjs';

const 选项 = 整理线路选项({ optLimit: 12, ipv6: 'yes', v6policy: 'off' });

test('解析地区行、延迟行和 IPv6，并丢掉网段与网页', () => {
  const 文本 = [
    '2.27.109.35:443#地区随机 | 香港 HK | HKG | 2.27.109.35:443',
    '104.18.40.205:443#麒麟优选 | 电信 | 104.18.40.205 | 44.40ms | 68.59mb/s',
    '[2606:4700::1]:443#CFYes优选 | 移动',
    '104.24.0.0/16',
    '<!DOCTYPE html>'
  ].join('\n');
  const 节点 = 解析优选文本(文本, { tier: 2, prefer: 'region', fallbackName: '优选IP' });
  assert.equal(节点.length, 3);
  assert.equal(节点[0].isp, '香港');
  assert.equal(节点[0].region, 'HK');
  assert.equal(节点[1].isp, '电信');
  assert.equal(节点[1].latency, 44.4);
  assert.equal(节点[1].speed, 68.59);
  assert.equal(节点[2].kind, 'v6');
});

test('BestCF 电信源只收电信标签，并允许专线中转公网地址', () => {
  assert.deepEqual(电信优选源.map(来源 => 来源.url), [
    'https://bestcf.pages.dev/wetest/ipv4.txt',
    'https://cf.junzhen.qzz.io/best_ips_bj.txt',
    'https://raw.githubusercontent.com/love-ztm/cfip/refs/heads/main/best_ips.txt'
  ]);
  const 三网 = 解析优选文本([
    '162.159.198.1:443#WeTest优选 | 10-09 18:31 | BestCF.pages.dev',
    '104.19.63.96:443#微测优选 | 电信 | LAX | 104.19.63.96',
    '104.17.120.1:443#微测优选 | 移动 | HKG | 104.17.120.1',
    '104.18.20.1:443#微测优选 | 联通 | NRT | 104.18.20.1'
  ].join('\n'), { tier: 1, prefer: 'isp' });
  const 电信 = 整理电信优选节点(三网, { taggedOnly: true, limit: 12 });
  assert.deepEqual(电信.map(节点 => 节点.ip), ['104.19.63.96']);
  assert.equal(电信[0].isp, '电信');
  assert.equal(电信[0].sourced, true);
  assert.equal(电信[0].relay, false);

  const 专线 = 解析优选文本([
    '43.168.16.112:443#HK [优选高速 47.45ms]',
    '202.144.194.170:8443#JP [优选高速 96.75ms]'
  ].join('\n'), { tier: 2, prefer: 'region' });
  const 中转 = 整理电信优选节点(专线, { relay: true, limit: 8 });
  assert.equal(中转.length, 2);
  assert.equal(中转[0].isp, '电信中转·香港');
  assert.equal(中转[0].relay, true);
  assert.equal(可拨号节点(中转[0]), true);
  assert.equal(中转[1].port, 8443);
  const 兆数 = 解析优选文本('43.129.217.38:443#CN [高速 by Jz 20M]', { tier: 2, prefer: 'region' });
  assert.equal(兆数[0].speed, 20);
});

test('独立入口限制为两个，并让自动测速在不同入口间交错', () => {
  const 入口 = 解析独立入口配置([
    'https://backup-a.example.com/11111111-1111-4111-8111-111111111111#备用A',
    'https://main.example.com/22222222-2222-4222-8222-222222222222#同域跳过',
    'http://backup-b.example.com/33333333-3333-4333-8333-333333333333#明文跳过',
    'https://backup-b.example.com/44444444-4444-4444-8444-444444444444#备用B',
    'https://backup-c.example.com/55555555-5555-4555-8555-555555555555#超过上限'
  ].join('\n'), 'main.example.com');
  assert.deepEqual(入口.map(项 => 项.name), ['备用A', '备用B']);
  const 节点 = [
    ...Array.from({ length: 8 }, (_, i) => ({ name: `主-${i}`, sni: 'main.example.com' })),
    ...Array.from({ length: 6 }, (_, i) => ({ name: `备A-${i}`, sni: 'backup-a.example.com' })),
    ...Array.from({ length: 6 }, (_, i) => ({ name: `备B-${i}`, sni: 'backup-b.example.com' }))
  ];
  const 自动 = 挑选自动测速节点(节点, 12);
  assert.equal(自动.length, 12);
  assert.deepEqual(自动.slice(0, 6).map(项 => 项.sni), [
    'main.example.com', 'backup-a.example.com', 'backup-b.example.com',
    'main.example.com', 'backup-a.example.com', 'backup-b.example.com'
  ]);
  const 多协议 = 挑选自动测速节点([
    { name: '高速01·电信-01', server: '104.18.1.1', port: 443, sni: 'main.example.com', type: 'vless' },
    { name: '高速01·电信-02', server: '104.18.1.1', port: 443, sni: 'main.example.com', type: 'trojan' },
    { name: '高速02·电信-01', server: '104.18.1.2', port: 443, sni: 'main.example.com', type: 'vless' },
    { name: '备用·高速01·电信-01', server: '104.18.1.1', port: 443, sni: 'backup.example.com', type: 'vless' }
  ], 6);
  assert.deepEqual(多协议.map(项 => 项.name), [
    '高速01·电信-01',
    '备用·高速01·电信-01',
    '高速02·电信-01'
  ]);
});

test('历史成功率会惩罚连续失败，并优先稳定的电信高速节点', () => {
  const 旧节点 = [
    { ip: '104.18.1.1', port: 443, successes: 8, failures: 1, failureStreak: 0 },
    { ip: '104.18.1.2', port: 443, successes: 2, failures: 2, failureStreak: 2 }
  ];
  const 现在 = Date.parse('2026-10-09T08:00:00Z');
  const 更新 = 更新测活历史([
    { ...旧节点[0], isp: '电信', tier: 1, kind: 'v4', speed: 20, latency: 50, edgeStatus: 'ok' },
    { ...旧节点[1], isp: '电信', tier: 1, kind: 'v4', speed: 80, latency: 20, edgeStatus: 'timeout' },
    { ip: '104.18.1.3', port: 443, isp: '移动', tier: 1, kind: 'v4', speed: 100, latency: 10, edgeStatus: 'ok' }
  ], 旧节点, 现在);
  assert.equal(更新[0].successes, 9);
  assert.equal(更新[0].failureStreak, 0);
  assert.equal(更新[1].failures, 3);
  assert.equal(更新[1].failureStreak, 3);
  assert.ok(历史成功率(更新[0]) > 历史成功率(更新[1]));
  const 高速 = 挑选电信大带宽节点(更新, 6);
  assert.deepEqual(高速.map(节点 => 节点.ip), ['104.18.1.1']);
});

test('保底在前，低延迟优先，IPv6 默认不占名额，数量封顶', () => {
  const 列表 = [
    ...生成保底节点(['1.1.1.1', '1.0.0.1']),
    { ip: '8.8.8.8', port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 80, speed: 10, region: '' },
    { ip: '9.9.9.9', port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 20, speed: 30, region: '' },
    { ip: '2606:4700::2', port: 443, isp: 'IPv6优选', tier: 3, kind: 'v6', latency: 10, speed: 0, region: '' },
    { ip: 'example.com', port: 443, isp: '优选域名', tier: 4, kind: 'domain', latency: null, speed: 0, region: '' }
  ];
  const 结果 = 编排优选节点(列表, { ...选项, limit: 4, balance: false });
  assert.deepEqual(结果.map(项 => 项.ip), ['1.1.1.1', '1.0.0.1', '9.9.9.9', '8.8.8.8']);
});

test('同地址保留更高优先级，运营商和地区筛选生效', () => {
  const 列表 = [
    { ip: '9.9.9.9', port: 443, isp: '电信', tier: 2, kind: 'v4', latency: 10, speed: 1, region: 'US' },
    { ip: '9.9.9.9', port: 443, isp: '保底', tier: 0, kind: 'v4', latency: null, speed: 0, region: '' },
    { ip: '2.2.2.2', port: 443, isp: '移动', tier: 1, kind: 'v4', latency: 5, speed: 1, region: '' },
    { ip: '3.3.3.3', port: 443, isp: '日本', tier: 2, kind: 'v4', latency: 5, speed: 1, region: 'JP' }
  ];
  const 结果 = 编排优选节点(列表, {
    ...选项,
    limit: 10,
    balance: false,
    mobile: false,
    region: 'JP'
  });
  assert.deepEqual(结果.map(项 => 项.ip), ['9.9.9.9', '3.3.3.3']);
  assert.equal(结果[0].isp, '保底');
});

test('IPv6 仅备胎时排在尾部且不超过 15%', () => {
  const 列表 = [
    { ip: '1.1.1.1', port: 443, isp: '优选IP', tier: 1, kind: 'v4', latency: 10, speed: 1, region: '' },
    { ip: '2606:4700::1', port: 443, isp: 'IPv6优选', tier: 3, kind: 'v6', latency: 1, speed: 0, region: '' },
    { ip: '2606:4700::2', port: 443, isp: 'IPv6优选', tier: 3, kind: 'v6', latency: 2, speed: 0, region: '' }
  ];
  const 结果 = 编排优选节点(列表, { ...选项, limit: 10, v6policy: 'backup', balance: false });
  assert.equal(结果.at(-1).kind, 'v6');
  assert.equal(结果.filter(项 => 项.kind === 'v6').length, 1);
});

test('头部轮换只换前排，不把保底换出列表', () => {
  const 保底 = 生成保底节点(['10.0.0.1', '10.0.0.2', '10.0.0.3']);
  const 甲 = 编排优选节点(保底, { ...选项, limit: 3, balance: true }, 0);
  const 乙 = 编排优选节点(保底, { ...选项, limit: 3, balance: true }, 300000);
  assert.deepEqual(甲.map(项 => 项.ip), ['10.0.0.1', '10.0.0.2', '10.0.0.3']);
  assert.deepEqual(乙.map(项 => 项.ip), ['10.0.0.2', '10.0.0.3', '10.0.0.1']);
});

test('移动和中转不会被电信挤掉，Worker 握手失败也不丢掉实测地址', () => {
  const 列表 = [
    { ip: '104.16.1.1', port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 40, speed: 20, region: '', sourced: true },
    { ip: '104.16.1.2', port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 50, speed: 10, region: '', sourced: true },
    { ip: '104.16.1.3', port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 30, speed: 30, region: '', sourced: true },
    { ip: '104.17.1.9', port: 443, isp: '移动', tier: 1, kind: 'v4', latency: 55, speed: 0.2, region: '', sourced: true },
    { ip: '68.64.183.37', port: 8443, isp: '香港', tier: 2, kind: 'v4', latency: null, speed: 0, region: 'HK', relay: true, sourced: true },
    { ip: '104.19.9.9', port: 443, isp: '随机补足', tier: 5, kind: 'v4', latency: null, speed: 0, region: '' },
    { ip: 'example.com', port: 443, isp: '优选域名', tier: 4, kind: 'domain', latency: null, speed: 0, region: '' }
  ];
  const 样本 = 挑选测活样本(列表, 2);
  assert.deepEqual(样本.map(项 => 项.ip), ['104.16.1.3', '104.17.1.9']);
  const 全灭 = 应用握手结果(列表, 列表.filter(节点 => 节点.kind !== 'domain').map(节点 => ({ key: 节点键(节点), status: 'timeout', port: 节点.port })), 选项);
  assert.equal(全灭.effective, true);
  assert.deepEqual(全灭.nodes.map(项 => 项.ip), ['104.16.1.1', '104.16.1.2', '104.16.1.3', '104.17.1.9', '68.64.183.37', 'example.com']);
  assert.equal(社区节点(列表[4]), true);
  assert.equal(社区节点(列表[5]), false);
  const 电信 = Array.from({ length: 8 }, (_, 序) => ({ ip: `104.18.2.${序 + 1}`, port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 40, speed: 20, region: '' }));
  const 保留 = 保留可用速度(电信.concat([列表[3], 列表[4]]), 4);
  assert.equal(保留.some(项 => 项.isp === '移动'), true);
  assert.equal(保留.some(项 => 项.relay), true);
  const 联通实测 = { ip: '104.26.0.79', port: 443, isp: '联通', tier: 1, kind: 'v4', latency: 68, speed: 0.1, region: '' };
  const 同地址 = { ip: '198.41.208.168', port: 443, isp: '联通', tier: 1, kind: 'v4', latency: null, speed: 0, region: '' };
  const 留下 = 保留可用速度([联通实测, 同地址], 4);
  assert.equal(留下.some(项 => 项.ip === '104.26.0.79'), true);
  const 备用 = 扩展备用端口([{ ip: '104.18.32.73', port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 44, speed: 68, region: '' }]);
  assert.equal(备用.some(项 => 项.port === 8443), true);
  const 路径甲 = 生成抗阻断路径({ ip: '104.18.32.73', port: 443 }, 'test-user');
  const 路径乙 = 生成抗阻断路径({ ip: '104.18.32.74', port: 443 }, 'test-user');
  assert.match(路径甲, /^\/assets\/[0-9a-f]+\?ed=2048$/);
  assert.notEqual(路径甲, 路径乙);
  const 前置 = 分配前置域名([{ ip: '1.1.1.1' }, { ip: '1.0.0.1' }, { ip: '8.8.8.8' }], 'main.example.com', ['alt.example.com']);
  assert.deepEqual(前置.map(项 => 项.frontDomain), ['main.example.com', 'alt.example.com', 'main.example.com']);
});

test('可以从 HTTPS DNS 回答中提取静态 ECHConfig', () => {
  const 配置 = 'AEX+DQBBjgAgACD+zopphOEd4wE3MjhUHOMvon4iwlravt7ZRBqu34NpQwAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA=';
  assert.equal(是ECH配置(配置), true);
  assert.equal(是ECH配置('='.repeat(40)), false);
  assert.equal(提取ECH配置({ Answer: [{ type: 65, data: `1 . alpn=h3,h2 ech=${配置} ipv4hint=1.1.1.1` }] }), 配置);
  assert.equal(提取ECH配置({ Answer: [{ type: 1, data: '1.1.1.1' }] }), '');
});

test('私网地址不能下发，社区中转可以，电信再快也留移动节点', () => {
  assert.equal(位于云墙网段('104.18.32.73'), true);
  assert.equal(位于云墙网段('104.16.0.1'), true);
  assert.equal(位于云墙网段('68.64.183.37'), false);
  assert.equal(位于云墙网段('2606:4700::1'), true);
  assert.equal(是公网地址('10.1.1.1'), false);
  assert.equal(是公网地址('68.64.183.37'), true);
  assert.equal(可拨号节点({ ip: '68.64.183.37', kind: 'v4' }), false);
  assert.equal(可拨号节点({ ip: '68.64.183.37', kind: 'v4', relay: true }), true);
  assert.equal(可拨号节点({ ip: '10.1.1.1', kind: 'v4', relay: true }), false);
  assert.equal(可拨号节点({ ip: '45.145.229.223', kind: 'v4', pinned: true }), true);
  const 请求 = 构造握手请求('www.cloudflare.com');
  assert.equal(请求[0], 0x16);
  assert.equal(判断握手应答(Uint8Array.of(0x16, 0x03, 0x03)), 'ok');
  assert.equal(判断握手应答(Uint8Array.of(0x15, 0x03, 0x03)), 'dead');
  assert.equal(判断握手应答(Uint8Array.of(0x16)), 'wait');
});

test('每个运营商各留一个保底，入口域名紧跟这组地址', () => {
  const 列表 = 标注保底([
    ...生成保底节点(['104.16.0.1', '172.71.218.190']),
    { ip: '104.18.32.73', port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 44, speed: 68, region: '', alive: true },
    { ip: '104.17.1.8', port: 443, isp: '移动', tier: 1, kind: 'v4', latency: 51, speed: 0.2, region: '', alive: true },
    { ip: '1.2.3.4', port: 443, isp: '自定甲', tier: 1, kind: 'v4', latency: null, speed: 0, region: '', pinned: true }
  ]);
  assert.equal(列表.find(项 => 项.ip === '104.18.32.73').isp, '保底·电信');
  assert.equal(列表.find(项 => 项.ip === '104.17.1.8').isp, '保底·移动');
  assert.equal(列表.find(项 => 项.ip === '1.2.3.4').isp, '自定甲');
  assert.equal(列表.find(项 => 项.ip === '172.71.218.190').tier, 2);
  const 入口 = 生成入口节点('example.com');
  const 结果 = 编排优选节点(列表.concat([入口]), { ...选项, limit: 10, balance: false });
  assert.equal(结果[0].isp, '保底·移动');
  const 入口位 = 结果.findIndex(项 => 项.isp === '入口');
  assert.ok(入口位 > 0);
  assert.ok(结果.slice(0, 入口位).every(项 => 项.tier === 0 && 项.kind !== 'domain'));
  const 交错 = 编排优选节点([
    { ip: '104.18.1.1', port: 443, isp: '电信', tier: 1, kind: 'v4', latency: 10, speed: 50, region: '' },
    { ip: '104.17.1.1', port: 443, isp: '移动', tier: 1, kind: 'v4', latency: 80, speed: 0.2, region: '' }
  ], { ...选项, limit: 2, balance: false });
  assert.deepEqual(交错.map(项 => 项.isp), ['移动', '电信']);
});

test('握手请求能让 Cloudflare 入口返回 ServerHello', async () => {
  const 请求 = 构造握手请求('www.cloudflare.com');
  const 结果 = await new Promise((完成, 失败) => {
    const 套接字 = net.connect(443, '104.16.0.1');
    const 定时 = setTimeout(() => {
      套接字.destroy();
      失败(new Error('timeout'));
    }, 4000);
    套接字.on('data', 数据 => {
      clearTimeout(定时);
      套接字.end();
      完成(判断握手应答(数据));
    });
    套接字.on('error', 错误 => {
      clearTimeout(定时);
      失败(错误);
    });
    套接字.on('connect', () => 套接字.write(请求));
  });
  assert.equal(结果, 'ok');
});

test('随机补足落在低延迟网段内，私网和明文地址不能当优选源', () => {
  let 游标 = 0;
  const 补足 = 随机补足节点(6, () => {
    游标 += 0.17;
    return 游标 % 1;
  });
  assert.equal(补足.length, 6);
  for (const 节点 of 补足) {
    assert.equal(节点.tier, 5);
    assert.ok(低延迟网段.some(网段 => 地址位于网段(节点.ip, 网段)));
  }
  const 池 = 整理线路选项({
    optPool: 'https://bestcf.pages.dev/random-region/HK/10.txt\nhttp://example.com/a.txt\nhttps://127.0.0.1/a.txt\nhttps://169.254.169.254/a'
  });
  assert.deepEqual(池.pool, ['https://bestcf.pages.dev/random-region/HK/10.txt']);
  assert.equal(是安全优选网址('https://192.168.1.1/a'), false);
});

test('优选缓存相同内容不写，随机地址不落盘，探测失败不会冻住三十分钟', () => {
  const 保底 = 生成保底节点(['1.1.1.1']);
  const 随机 = { ip: '104.16.1.1', port: 443, isp: '随机补足', tier: 5, kind: 'v4', latency: null, speed: 0, region: '' };
  const 可存 = 可持久化节点(保底.concat([随机]));
  assert.deepEqual(可存.map(项 => 项.ip), ['1.1.1.1']);
  const 还原 = 展开节点(压缩节点({ ...可存[0], successes: 7, failures: 2, failureStreak: 1 }));
  assert.equal(还原.isp, '保底');
  assert.equal(还原.tier, 0);
  assert.equal(还原.successes, 7);
  assert.equal(还原.failures, 2);
  assert.equal(还原.failureStreak, 1);
  const 现在 = Date.parse('2026-10-09T00:00:00Z');
  const 首次 = 判断缓存写入(null, 现在, 'abc');
  assert.equal(首次.ok, true);
  const 重复 = 判断缓存写入(首次.账本, 现在 + 1000, 'abc');
  assert.equal(重复.reason, 'same');
  const 过密 = 判断缓存写入(首次.账本, 现在 + 60 * 1000, 'def');
  assert.equal(过密.reason, 'gate');
  const 预算耗尽 = 判断缓存写入({ day: '2026-10-09', writes: 24, lastAt: 0, hash: 'old' }, 现在, 'new');
  assert.equal(预算耗尽.reason, 'budget');
  const 失败时间 = 缓存时间戳(现在, false, 30 * 60 * 1000);
  assert.ok(现在 - 失败时间 < 30 * 60 * 1000);
  assert.ok(现在 + 3 * 60 * 1000 - 失败时间 > 30 * 60 * 1000);
});

test('同一分钟内的访问次数有上限，下一分钟重新计数', () => {
  重置访问账本();
  const 现在 = Date.parse('2026-10-09T00:00:00Z');
  for (let 序 = 0; 序 < 10; 序++) assert.equal(允许访问('sub', 现在, 10), true);
  assert.equal(允许访问('sub', 现在 + 1000, 10), false);
  assert.equal(允许访问('page', 现在, 30), true);
  assert.equal(允许访问('sub', 现在 + 60000, 10), true);
});

test('套用脚本可重复执行，工人脚本语法保持有效', () => {
  execFileSync(process.execPath, ['scripts/apply-route-optimizer.mjs'], { cwd: new URL('..', import.meta.url) });
  const 一次 = fs.readFileSync(new URL('../_worker.js', import.meta.url));
  execFileSync(process.execPath, ['scripts/apply-route-optimizer.mjs'], { cwd: new URL('..', import.meta.url) });
  const 二次 = fs.readFileSync(new URL('../_worker.js', import.meta.url));
  assert.equal(一次.equals(二次), true);
  assert.match(二次.toString(), /组装线路优化节点/);
  assert.equal(二次.toString().split('/* ROUTE_OPT_START calm */').length, 3);
  execFileSync(process.execPath, ['--check', '_worker.js'], { cwd: new URL('..', import.meta.url) });
});

test('订阅请求会走优选、保底前置和缓存', async () => {
  register(new URL('./cf-hook.mjs', import.meta.url));
  const 工人 = await import('../_worker.js');
  const 令牌 = '351c9981-04b6-4103-aa4b-864aa9c91469';
  const 测试ECH配置 = 'AEX+DQBBjgAgACD+zopphOEd4wE3MjhUHOMvon4iwlravt7ZRBqu34NpQwAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA=';
  const 测试环境 = { u: 令牌, ECH_CONFIG: 测试ECH配置 };
  const 请求订阅 = () => 工人.default.fetch(new Request(`https://example.com/${令牌}/sub`), 测试环境, { waitUntil() {} });
  const 第一次 = await 请求订阅();
  assert.equal(第一次.status, 200);
  const 摘要1 = 第一次.headers.get('X-Opt') || '';
  assert.match(摘要1, /^on;count=\d+/);
  const 正文1 = Buffer.from(await 第一次.text(), 'base64').toString('utf8');
  const 行1 = 正文1.split('\n').filter(Boolean);
  assert.ok(行1.length >= 8 && 行1.length <= 36, `节点数量异常: ${行1.length} ${摘要1}`);
  assert.equal(行1.every(行 => 行.includes('ech=')), true);
  assert.ok(new Set(行1.map(行 => new URL(行).searchParams.get('path'))).size > 1);
  assert.match(摘要1, /selected=\d+/);
  assert.match(摘要1, /edge_ok=\d+;edge_tested=\d+;history=\d+;stable=\d+;user_ok=unknown/);
  assert.match(decodeURIComponent(行1[0]), /保底|移动|联通|电信|香港|台湾|日本/);
  assert.equal(行1.some(行 => /@(?:10\.|127\.|192\.168\.|0\.0\.0\.0)/.test(行)), false);
  assert.equal(行1.some(行 => 行.includes('[')), false);
  assert.doesNotMatch(摘要1, /(?:^|;)alive=/);
  const 第二次 = await 请求订阅();
  assert.match(第二次.headers.get('X-Opt') || '', /cache=fresh/);
  const Clash配置 = await 工人.default.fetch(new Request(`https://example.com/${令牌}/sub?target=clash`), 测试环境, { waitUntil() {} });
  const Clash正文 = await Clash配置.text();
  assert.match(Clash配置.headers.get('content-type') || '', /text\/yaml/);
  assert.equal(Clash配置.headers.get('X-ECH-Mode'), 'env');
  assert.match(Clash正文, /ech-opts:\s*\n\s+enable: true/);
  assert.match(Clash正文, new RegExp(`config: "${测试ECH配置.replace(/[+]/g, '\\+')}"`));
  assert.doesNotMatch(Clash正文, /query-server-name:/);
  assert.match(Clash正文, /path: "?\/assets\/[0-9a-f]+\?ed=2048"?/);
  assert.match(Clash正文, /- name: "⚡ 电信低延迟"\s*\n\s+type: url-test/);
  assert.match(Clash正文, /url: http:\/\/www\.gstatic\.com\/generate_204\s*\n\s+interval: 600\s*\n\s+tolerance: 50\s*\n\s+lazy: true/);
  assert.match(Clash正文, /- name: "🚄 电信大带宽"\s*\n\s+type: fallback\s*\n\s+url: http:\/\/www\.gstatic\.com\/generate_204\s*\n\s+interval: 1800\s*\n\s+lazy: true/);
  assert.match(Clash正文, /- name: "🚀 节点选择"\s*\n\s+type: select\s*\n\s+proxies:\s*\n\s+- "🚄 电信大带宽"\s*\n\s+- "⚡ 电信低延迟"/);
  assert.match(Clash正文, /RULE-SET,gfw,🚀 节点选择/);
  assert.match(Clash正文, /MATCH,🐟 漏网之鱼/);
  const 独立用户 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const 独立配置 = await 工人.default.fetch(new Request(`https://example.com/${令牌}/sub?target=clash`), {
    ...测试环境,
    INDEPENDENT_ENDPOINTS: `https://backup.example.net/${独立用户}#异地备用`
  }, { waitUntil() {} });
  const 独立正文 = await 独立配置.text();
  assert.match(独立配置.headers.get('X-Opt') || '', /backends=2/);
  assert.match(独立正文, new RegExp(`uuid: ${独立用户}`));
  assert.match(独立正文, /servername: "backup\.example\.net"/);
  assert.match(独立正文, /Host: "backup\.example\.net"/);
  const 自定义 = await 工人.default.fetch(new Request(`https://example.com/${令牌}/sub`), {
    ...测试环境,
    yx: '1.2.3.4:443#自定甲,5.6.7.8:443#自定乙'
  }, { waitUntil() {} });
  const 自定义正文 = decodeURIComponent(Buffer.from(await 自定义.text(), 'base64').toString('utf8'));
  const 自定义行 = 自定义正文.split('\n').filter(Boolean);
  assert.match(自定义正文, /自定甲/);
  assert.match(自定义正文, /自定乙/);
  assert.equal(自定义行.some(行 => /104\.16\.0\.1/.test(行)), false);
  assert.ok(自定义行.length >= 2 && 自定义行.length <= 8);
  const 机器人 = await 工人.default.fetch(new Request('https://example.com/robots.txt'), 测试环境, { waitUntil() {} });
  assert.equal(机器人.status, 200);
  assert.match(await 机器人.text(), /Disallow: \//);
  const 未知 = await 工人.default.fetch(new Request('https://example.com/scan'), 测试环境, { waitUntil() {} });
  assert.equal(未知.status, 404);
  const 未知正文 = await 未知.text();
  assert.match(未知正文, /这里没有内容/);
  assert.doesNotMatch(未知正文, /UUID|Not Found|vless/i);
  const 错误令牌 = await 工人.default.fetch(new Request('https://example.com/351c9981-04b6-4103-aa4b-864aa9c91470/sub'), 测试环境, { waitUntil() {} });
  assert.equal(错误令牌.status, 404);
  assert.match(await 错误令牌.text(), /这里没有内容/);
  let 末次 = 错误令牌;
  for (let 序 = 0; 序 < 12; 序++) 末次 = await 请求订阅();
  assert.equal(末次.status, 429);
  assert.equal(末次.headers.get('Retry-After'), '60');
  assert.match(await 末次.text(), /这里没有内容/);
});
