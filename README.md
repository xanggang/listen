

相关文档:

部署
npm run build 之后"upload" 会手动推到cf

# 接入prisma到D1
https://www.prisma.io/docs/guides/cloudflare-d1

npx prisma migrate diff \
--from-empty \
--to-schema prisma/schema.prisma \
--script > prisma/migrations/0001_init.sql

此命令会生成一个 SQL 文件，其中包含创建数据库表所需的语句。您可以在 . 中查看生成的 SQL prisma/migrations/0001_init.sql

# Apply to local database 将本地命令推送到本地D1数据库
npx wrangler d1 execute listen --local --file=./prisma/migrations/0001_init.sql

# Apply to remote database  推送远程
npx wrangler d1 execute listen --remote --file=./prisma/migrations/0001_init.sql

对于未来的架构变更，您可以使用以下命令生成新的迁移文件：
npx prisma migrate diff \
--from-local-d1 \
--to-schema prisma/schema.prisma \
--script > migrations/0002_add_new_field.sql

wrangler d1 execute然后使用与上面所示相同的命令应用它们。

npx wrangler d1 execute listen --command "INSERT INTO \"User\" (\"email\", \"name\") VALUES ('naxi', 'naxi');" --local


添加model之后需要重新生辰 npx prisma generate


连接远程需要代理

export https_proxy=http://127.0.0.1:10808  && npm run dev

export HTTP_PROXY=http://127.0.0.1:10808
export HTTPS_PROXY=http://127.0.0.1:10808
export ALL_PROXY=socks5://127.0.0.1:10808
