// app/actions.ts
"use server";
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function getLanguages() {
  const { env } = await getCloudflareContext({ async: true })
  const DB = env.DB

  const { results } = await DB.prepare("SELECT * FROM languages").run()

  return results
}
