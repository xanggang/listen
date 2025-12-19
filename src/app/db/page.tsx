import { getCloudflareContext } from '@opennextjs/cloudflare'

export default async function DBPage() {

  const a = await getCloudflareContext({ async: true })
  const DB = a.env.DB

  console.log(DB)

  const { results } = await DB.prepare("SELECT * FROM User").run() as any

  console.log(results)

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-6">用户列表 (User List)</h1>

      <div className="mt-8 text-sm text-gray-400">
        <p>数据来源: Cloudflare D1 via Prisma</p>
      </div>
    </div>
  )
}
