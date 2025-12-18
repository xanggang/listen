const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- 配置区 ---
const MYSQL_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'your_mysql_db'
};

const D1_DATABASE_NAME = 'your-d1-binding-name'; // wrangler.toml 中的数据库名称或 ID
const TABLE_NAME = 'users'; // 目标表名
const BATCH_SIZE = 1000;    // 每批次处理的行数，建议 500-1000

async function runMigration() {
  const connection = await mysql.createConnection(MYSQL_CONFIG);
  console.log('✅ 已连接到 MySQL');

  try {
    // 1. 获取总行数
    const [countResult] = await connection.execute(`SELECT COUNT(*) as total FROM ${TABLE_NAME}`);
    const totalRows = countResult[0].total;
    console.log(`📊 总计 ${totalRows} 条数据待迁移`);

    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      // 2. 分批读取数据
      const [rows] = await connection.execute(
        `SELECT * FROM ${TABLE_NAME} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      );

      if (rows.length === 0) continue;

      // 3. 将数据转换为 SQL INSERT 语句
      // 注意：这里使用 SQLite 语法。mysql2 的 escape 会处理好大部分转义
      const columns = Object.keys(rows[0]).map(col => `"${col}"`).join(', ');

      const values = rows.map(row => {
        const valArray = Object.values(row).map(val => {
          if (val === null) return 'NULL';
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`; // 处理 JSON
          return connection.escape(val);
        });
        return `(${valArray.join(', ')})`;
      }).join(', ');

      const sql = `INSERT INTO ${TABLE_NAME} (${columns}) VALUES ${values};`;

      // 4. 写入临时 SQL 文件
      const tempSqlFile = path.join(__dirname, 'temp_batch.sql');
      fs.writeFileSync(tempSqlFile, sql);

      // 5. 调用 Wrangler 执行本地更新
      console.log(`🚀 正在写入第 ${offset + 1} 到 ${offset + rows.length} 条...`);
      try {
        // 使用 --local 参数强制更新本地 SQLite 文件
        execSync(`npx wrangler d1 execute ${D1_DATABASE_NAME} --local --file=${tempSqlFile}`, { stdio: 'inherit' });
      } catch (err) {
        console.error('❌ D1 写入失败:', err.message);
        break;
      }

      // 清理临时文件
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
