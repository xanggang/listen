import { appendFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dataDirectory = new URL('../data/', import.meta.url);
const logDirectory = new URL('../log/', import.meta.url);

/**
 * 打开 Radio Garden 专用 SQLite 并创建采集台账；不读取其他项目的数据库或迁移。
 * @returns {import('node:sqlite').DatabaseSync} 本数据源自己的数据库连接。
 */
export function openStore() {
  const path = fileURLToPath(new URL('radio-garden.sqlite', dataDirectory));
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS api_responses (
      endpoint TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
      http_status INTEGER,
      content_type TEXT,
      response_json TEXT,
      redirect_url TEXT,
      response_file TEXT,
      error TEXT,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (endpoint, entity_id)
    );
    CREATE TABLE IF NOT EXISTS place_channels (
      place_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_title TEXT,
      discovered_at TEXT NOT NULL,
      PRIMARY KEY (place_id, channel_id)
    );
    CREATE INDEX IF NOT EXISTS idx_place_channels_channel ON place_channels(channel_id);
  `);
  migrateFailureRows(db);
  return db;
}

/**
 * 将旧版本写入 SQLite 的失败记录迁移到 JSONL 日志，再从成功数据台账中清除。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用连接。
 */
function migrateFailureRows(db) {
  const failures = db
    .prepare("SELECT endpoint, entity_id, http_status, error, fetched_at FROM api_responses WHERE status='failed'")
    .all();
  if (!failures.length) return;
  const path = fileURLToPath(new URL('api-errors.jsonl', logDirectory));
  mkdirSync(fileURLToPath(logDirectory), { recursive: true });
  for (const failure of failures) {
    appendFileSync(
      path,
      `${JSON.stringify({
        occurred_at: failure.fetched_at,
        endpoint: failure.endpoint,
        entity_id: failure.entity_id,
        http_status: failure.http_status,
        error: failure.error,
        migrated_from_sqlite: true,
      })}\n`,
      'utf8',
    );
  }
  db.prepare("DELETE FROM api_responses WHERE status='failed'").run();
}

/**
 * 将成功 API JSON 原文仅写入 SQLite，并可选更新地点频道关联。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用连接。
 * @param {object} record 已通过响应校验的接口记录。
 * @param {object[]} relations 地点频道关联，仅 places_channels 阶段提供。
 */
export async function saveSuccess(db, record, relations = []) {
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO api_responses
      (endpoint, entity_id, status, http_status, content_type, response_json, redirect_url, response_file, error, fetched_at)
      VALUES (?, ?, 'success', ?, ?, ?, ?, NULL, NULL, ?)
      ON CONFLICT(endpoint, entity_id) DO UPDATE SET status='success', http_status=excluded.http_status,
      content_type=excluded.content_type, response_json=excluded.response_json,
      redirect_url=excluded.redirect_url, response_file=excluded.response_file, error=NULL, fetched_at=excluded.fetched_at`,
    ).run(
      record.endpoint,
      record.entityId,
      record.httpStatus,
      record.contentType,
      record.responseJson,
      record.redirectUrl ?? null,
      now,
    );
    const insertRelation =
      db.prepare(`INSERT INTO place_channels (place_id, channel_id, channel_title, discovered_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(place_id, channel_id) DO UPDATE SET
      channel_title=excluded.channel_title, discovered_at=excluded.discovered_at`);
    for (const relation of relations) {
      insertRelation.run(relation.placeId, relation.channelId, relation.title ?? null, now);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * 将某个 API 实体的请求失败追加到项目日志，不写入成功数据 SQLite。
 * @param {{endpoint: string, entityId: string, httpStatus?: number, error: string}} failure 失败信息。
 */
export async function saveFailure(failure) {
  await mkdir(logDirectory, { recursive: true });
  const path = fileURLToPath(new URL('api-errors.jsonl', logDirectory));
  const entry = {
    occurred_at: new Date().toISOString(),
    endpoint: failure.endpoint,
    entity_id: failure.entityId,
    http_status: failure.httpStatus ?? null,
    error_name: failure.errorName ?? 'Error',
    request_url: failure.requestUrl ?? failure.diagnostics?.request_url ?? null,
    cloudflare_detected: failure.diagnostics?.cloudflare_detected ?? false,
    diagnostics: failure.diagnostics ?? null,
    error: failure.error.slice(0, 1000),
  };
  await appendFile(path, `${JSON.stringify(entry)}\n`, 'utf8');
}

/**
 * 判断某个接口实体是否已成功采集，支持断点续跑。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用连接。
 * @param {string} endpoint 固定接口阶段名。
 * @param {string} entityId 地点或频道 ID。
 * @returns {boolean} 成功响应是否已存在。
 */
export function isComplete(db, endpoint, entityId) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM api_responses WHERE endpoint=? AND entity_id=? AND status='success'")
      .get(endpoint, entityId),
  );
}

/**
 * 读取已发现且去重的频道 ID，用于详情和流地址阶段。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用连接。
 * @returns {string[]} 按频道 ID 排序的完整列表。
 */
export function listChannelIds(db) {
  return db
    .prepare('SELECT DISTINCT channel_id FROM place_channels ORDER BY channel_id')
    .all()
    .map((row) => row.channel_id);
}

/**
 * 将播放重定向结果仅保存到 SQLite，不写文件或下载音频内容。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用连接。
 * @param {{channelId: string, httpStatus: number, redirectUrl: string}} result 302 结果。
 */
export async function saveRedirect(db, result) {
  const responseJson = `${JSON.stringify(
    {
      channelId: result.channelId,
      endpoint: `/ara/content/listen/${result.channelId}/channel.mp3`,
      httpStatus: result.httpStatus,
      redirectUrl: result.redirectUrl,
      fetchedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO api_responses
    (endpoint, entity_id, status, http_status, content_type, response_json, redirect_url, response_file, error, fetched_at)
    VALUES ('stream_redirect', ?, 'success', ?, NULL, ?, ?, NULL, NULL, ?)
    ON CONFLICT(endpoint, entity_id) DO UPDATE SET status='success', http_status=excluded.http_status,
    response_json=excluded.response_json, redirect_url=excluded.redirect_url,
    response_file=NULL, error=NULL, fetched_at=excluded.fetched_at`,
  ).run(result.channelId, result.httpStatus, responseJson, result.redirectUrl, now);
}

/**
 * 写出各阶段成功和总量统计，便于长任务在命令行和文件中检查进度。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用连接。
 * @returns {object[]} 每个接口阶段的计数。
 */
export async function writeProgress(db) {
  const counts = db
    .prepare(
      `SELECT endpoint, status, COUNT(*) AS count FROM api_responses
    GROUP BY endpoint, status ORDER BY endpoint, status`,
    )
    .all();
  const totalRelations = db.prepare('SELECT COUNT(*) AS count FROM place_channels').get().count;
  const summary = {
    updated_at: new Date().toISOString(),
    counts,
    place_channel_relations: totalRelations,
  };
  const destination = new URL('sync-progress.json', dataDirectory);
  const temporary = new URL(`sync-progress.${process.pid}.json.tmp`, dataDirectory);
  await writeFile(temporary, `${JSON.stringify(summary, null, 2)}\n`);
  await rename(temporary, destination);
  return summary;
}
