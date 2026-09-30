import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnowflakeIdGenerator } from '../src/snowflake-id.mjs';

// 同一毫秒内生成的 ID 必须唯一、有序，且始终作为固定长度字符串返回。
test('雪花 ID 在同一毫秒内唯一且有序', () => {
  const timestamp = Date.UTC(2026, 8, 30);
  // 固定时钟以验证序列号，而不是依赖测试运行速度。
  const nextId = createSnowflakeIdGenerator({ workerId: 7, now: () => timestamp });
  const ids = [nextId(), nextId(), nextId()];
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids[0] < ids[1] && ids[1] < ids[2]);
  for (const id of ids) assert.match(id, /^\d{19}$/);
});

// 不同 worker 的 ID 应分离，系统时钟回退则停止生成。
test('worker 编号隔离及时钟回退检查', () => {
  let timestamp = Date.UTC(2026, 8, 30);
  // 提供可变时钟以模拟回退。
  const left = createSnowflakeIdGenerator({ workerId: 1, now: () => timestamp });
  const right = createSnowflakeIdGenerator({ workerId: 2, now: () => timestamp });
  assert.notEqual(left(), right());
  timestamp -= 1;
  assert.throws(() => left(), /时钟回退/);
  assert.throws(() => createSnowflakeIdGenerator({ workerId: 1024 }), /workerId/);
});
