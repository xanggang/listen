// import { getCloudflareContext } from '@opennextjs/cloudflare'
import { fetch } from '../../../prisma/test'

export default async function DBTest() {
  console.log('DBTest')
  const res = await fetch()
  const list = await res.json()
  console.log(list)
  //
  // console.log(a)
  return <div>
    <div>zhelishiDc</div>
    {
      list.map(item => <p> { item.name }</p>)
    }
  </div>
}
