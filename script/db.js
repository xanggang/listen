const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- 配置区 ---
const MYSQL_CONFIG = {
  host: 'nginx.naxi.fun',
  port: 13306,
  user: 'root',
  password: 'xang1057516363',
  database: 'listen-world'
};

const D1_DATABASE_NAME = 'DB';
const TABLE_NAME = 'countries';
const BATCH_SIZE = 15000;      // 每次从 MySQL 取出的总量
const MAX_SQL_SIZE = 85000;   // 单个 INSERT 语句的最大字节数 (D1 限制 100KB，预留空间)

async function runMigration() {
  const connection = await mysql.createConnection(MYSQL_CONFIG);
  console.log('✅ 已连接到 MySQL');

  try {
    const [countResult] = await connection.execute(`SELECT COUNT(*) as total FROM ${TABLE_NAME}`);
    const totalRows = countResult[0].total;
    console.log(`📊 总计 ${totalRows} 条数据待迁移`);

    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      const [rows] = await connection.execute(
        `SELECT * FROM ${TABLE_NAME} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      );

      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]).map(col => `"${col}"`).join(', ');
      const insertHeader = `INSERT INTO ${TABLE_NAME} (${columns}) VALUES `;

      let finalSqlFileContent = "";
      let currentInsertValues = [];
      let currentSqlSize = 0;

      for (const row of rows) {
        // 将单行转换为 SQL 片段
        const valArray = Object.values(row).map(val => {
          if (val === null) return 'NULL';
          if (typeof val === 'number') return val;
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        const rowSql = `(${valArray.join(', ')})`;

        // 计算增加这一行后的长度 (rowSql + 逗号 + 换行)
        const rowSize = Buffer.byteLength(rowSql, 'utf8') + 2;

        // 检查：如果加上这一行会超过限制，或者这一行本身就超大
        if (currentSqlSize + rowSize > MAX_SQL_SIZE && currentInsertValues.length > 0) {
          // 封存当前的 INSERT 语句
          finalSqlFileContent += insertHeader + currentInsertValues.join(',\n') + ';\n';
          // 重置计数器
          currentInsertValues = [];
          currentSqlSize = 0;
        }

        currentInsertValues.push(rowSql);
        currentSqlSize += rowSize;

        // 极端情况：单行就超过了 MAX_SQL_SIZE
        if (rowSize > MAX_SQL_SIZE) {
          console.warn(`⚠️ 警告：检测到一条超大数据行 (约 ${Math.round(rowSize/1024)}KB)，已尝试独立处理。`);
        }
      }

      // 处理剩余的数据
      if (currentInsertValues.length > 0) {
        finalSqlFileContent += insertHeader + currentInsertValues.join(',\n') + ';\n';
      }

      const tempSqlFile = path.join(__dirname, 'temp_batch.sql');
      fs.writeFileSync(tempSqlFile, finalSqlFileContent);

      console.log(`🚀 正在推送范围: ${offset + 1} ~ ${offset + rows.length}...`);
      try {
        execSync(`npx wrangler d1 execute ${D1_DATABASE_NAME} --local --file=${tempSqlFile}`, { stdio: 'inherit' });
        // execSync(`npx wrangler d1 execute ${D1_DATABASE_NAME} --remote --file=${tempSqlFile}`, { stdio: 'inherit' });
      } catch (err) {
        console.error('❌ D1 写入失败。错误可能由于单行数据过大或网络问题。');
        return;
      }

      fs.unlinkSync(tempSqlFile);
    }

    console.log('✨ 迁移完成！');
  } catch (error) {
    console.error('❌ 发生错误:', error);
  } finally {
    await connection.end();
  }
}

runMigration();
