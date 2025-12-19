// app/actions.ts
"use server";
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { Tags, Languages, Station, PageResult } from '@/types'

async function getDb() {
  const { env } = await getCloudflareContext({ async: true })
  const DB = env.DB

  return DB
}

export async function getLanguages() {
  const DB = await getDb()

  const { results } = await DB.prepare("SELECT * FROM languages").run()

  return results
}

export async function getTopLanguages() {
  const DB = await getDb()

  const { results } = await DB.prepare("SELECT * FROM languages ORDER BY stationcount DESC LIMIT 30").run()

  return results as Languages[]
}

export async function getTopTags() {
  const DB = await getDb()

  const { results } = await DB.prepare("SELECT * FROM tags ORDER BY stationcount DESC LIMIT 30").run()

  return results as Tags[]
}

interface SearchType {
  page: number
  pageSize: number
  languagesId?: number
  tagsId?: number
  keyword?: string
}

export async function getStations({
                                    page,
                                    pageSize,
                                    languagesId,
                                    tagsId,
                                    keyword
                                  }: SearchType) {
  const DB = await getDb()

  const whereClauses: string[] = []
  const params: (string | number)[] = []

  if (languagesId) {
    const language = await DB.prepare("SELECT name FROM languages WHERE id = ?").bind(languagesId).first() as {
      name: string
    } | null
    if (language) {
      whereClauses.push("language LIKE ?")
      params.push(`%${language.name}%`)
    }
  }

  if (tagsId) {
    const tag = await DB.prepare("SELECT name FROM tags WHERE id = ?").bind(tagsId).first() as { name: string } | null
    if (tag) {
      whereClauses.push("tags LIKE ?")
      params.push(`%${tag.name}%`)
    }
  }

  if (keyword) {
    whereClauses.push("(name LIKE ? OR tags LIKE ? OR language LIKE ?)")
    params.push(`%${keyword}%`)
    params.push(`%${keyword}%`)
    params.push(`%${keyword}%`)
  }

  const whereSQL = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : ""

  // Get total count
  // const countResult = await DB.prepare(`SELECT count(*) as total
  //                                       FROM station ${whereSQL}`).bind(...params).first() as { total: number }
  // const total = countResult.total

  // Get paginated results
  const offset = (page - 1) * pageSize
  params.push(pageSize)
  params.push(offset)

  const { results } = await DB.prepare(`SELECT *
                                        FROM station ${whereSQL}  ORDER BY votes DESC LIMIT ?
                                        OFFSET ?`).bind(...params).run()

  const data = {
    list: results as unknown as Station[],
    // total,
    page,
    pageSize
  }
  return data
}

export async function getStationById(id: number) {
  const DB = await getDb()

  console.log(id)
  const { results } = await DB.prepare("SELECT * FROM station WHERE id = ?").bind(id).run()

  return results[0] || null
}
