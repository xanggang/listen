const epochMs = Date.UTC(2024, 0, 1);
const maxTimestamp = (1n << 41n) - 1n;
const maxWorkerId = 1023;
const maxSequence = 4095;

/**
 * 创建按时间排序的 19 位十进制字符串 ID 生成器。
 * 同一数据库的并发写入进程必须使用不同 workerId；时钟回退时抛错以避免重复 ID。
 * @param {{workerId?: number, now?: () => number}} [options] 节点编号和可注入的毫秒时钟。
 * @returns {() => string} 每次调用返回一个固定长度的字符串主键。
 */
export function createSnowflakeIdGenerator(options = {}) {
  const workerId = options.workerId ?? 0;
  const now = options.now ?? Date.now;
  if (!Number.isInteger(workerId) || workerId < 0 || workerId > maxWorkerId) {
    throw new Error('workerId 必须是 0 到 1023 的整数。');
  }
  let lastTimestamp = -1;
  let sequence = 0;

  // 保证单个生成器内的时间顺序与唯一性，超过每毫秒 4096 个时等待下一毫秒。
  return () => {
    let timestamp = now();
    if (!Number.isSafeInteger(timestamp) || timestamp < epochMs) {
      throw new Error('系统时钟不在雪花 ID 支持的范围内。');
    }
    if (timestamp < lastTimestamp) throw new Error('系统时钟回退，已停止生成雪花 ID。');
    if (timestamp === lastTimestamp) {
      sequence++;
      if (sequence > maxSequence) {
        do {
          timestamp = now();
          if (!Number.isSafeInteger(timestamp) || timestamp < lastTimestamp) {
            throw new Error('等待下一毫秒时系统时钟无效或发生回退。');
          }
        } while (timestamp <= lastTimestamp);
        sequence = 0;
      }
    } else {
      sequence = 0;
    }
    const elapsed = BigInt(timestamp - epochMs);
    if (elapsed > maxTimestamp) throw new Error('雪花 ID 时间位已超出范围。');
    lastTimestamp = timestamp;
    const id = (elapsed << 22n) | (BigInt(workerId) << 12n) | BigInt(sequence);
    return id.toString().padStart(19, '0');
  };
}
