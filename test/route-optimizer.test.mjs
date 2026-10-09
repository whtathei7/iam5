import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { register } from 'node:module';
import test from 'node:test';
import {
  编排优选节点,
  整理线路选项,
  解析优选文本,
  挑选测活样本,
  应用测活结果,
  随机补足节点,
  地址位于网段,
  低延迟网段,
  是安全优选网址,
  生成保底节点,
  节点键,
  压缩节点,
  展开节点,
  可持久化节点,
  判断缓存写入,
  缓存时间戳
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

test('测活样本按地区轮流取，全灭时保留原列表', () => {
  const 列表 = [
    { ip: '1.1.1.1', port: 443, isp: '香港', tier: 2, kind: 'v4', latency: 1, speed: 1, region: 'HK' },
    { ip: '1.1.1.2', port: 443, isp: '香港', tier: 2, kind: 'v4', latency: 2, speed: 1, region: 'HK' },
    { ip: '2.2.2.2', port: 443, isp: '日本', tier: 2, kind: 'v4', latency: 3, speed: 1, region: 'JP' }
  ];
  const 样本 = 挑选测活样本(列表, 2);
  assert.deepEqual(样本.map(项 => 项.region), ['HK', 'JP']);
  const 全灭 = 应用测活结果(列表, [], 样本.map(节点键), 选项);
  assert.equal(全灭.length, 3);
  const 足够 = 应用测活结果(列表, [节点键(列表[0]), 节点键(列表[2])], 列表.map(节点键), { ...选项, limit: 8 });
  assert.deepEqual(足够.map(项 => 项.ip), ['1.1.1.1', '2.2.2.2']);
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
  const 还原 = 展开节点(压缩节点(可存[0]));
  assert.equal(还原.isp, '保底');
  assert.equal(还原.tier, 0);
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

test('套用脚本可重复执行，工人脚本语法保持有效', () => {
  execFileSync(process.execPath, ['scripts/apply-route-optimizer.mjs'], { cwd: new URL('..', import.meta.url) });
  const 一次 = fs.readFileSync(new URL('../_worker.js', import.meta.url));
  execFileSync(process.execPath, ['scripts/apply-route-optimizer.mjs'], { cwd: new URL('..', import.meta.url) });
  const 二次 = fs.readFileSync(new URL('../_worker.js', import.meta.url));
  assert.equal(一次.equals(二次), true);
  assert.match(二次.toString(), /组装线路优化节点/);
  execFileSync(process.execPath, ['--check', '_worker.js'], { cwd: new URL('..', import.meta.url) });
});

test('订阅请求会走优选、保底前置和缓存', async () => {
  register(new URL('./cf-hook.mjs', import.meta.url));
  const 工人 = await import('../_worker.js');
  const 令牌 = '351c9981-04b6-4103-aa4b-864aa9c91469';
  const 请求订阅 = () => 工人.default.fetch(new Request(`https://example.com/${令牌}/sub`), { u: 令牌 }, { waitUntil() {} });
  const 第一次 = await 请求订阅();
  assert.equal(第一次.status, 200);
  const 摘要1 = 第一次.headers.get('X-Opt') || '';
  assert.match(摘要1, /^on;count=\d+/);
  const 正文1 = Buffer.from(await 第一次.text(), 'base64').toString('utf8');
  const 行1 = 正文1.split('\n').filter(Boolean);
  assert.ok(行1.length >= 8 && 行1.length <= 36, `节点数量异常: ${行1.length} ${摘要1}`);
  assert.match(decodeURIComponent(行1[0]), /保底/);
  assert.equal(行1.some(行 => 行.includes('[')), false);
  const 第二次 = await 请求订阅();
  assert.match(第二次.headers.get('X-Opt') || '', /cache=fresh/);
  const 自定义 = await 工人.default.fetch(new Request(`https://example.com/${令牌}/sub`), {
    u: 令牌,
    yx: '1.2.3.4:443#自定甲,5.6.7.8:443#自定乙'
  }, { waitUntil() {} });
  const 自定义正文 = decodeURIComponent(Buffer.from(await 自定义.text(), 'base64').toString('utf8'));
  const 自定义行 = 自定义正文.split('\n').filter(Boolean);
  assert.match(自定义行[0], /保底/);
  assert.match(自定义正文, /自定甲/);
  assert.match(自定义正文, /自定乙/);
  assert.equal(自定义行.length, 12);
});
