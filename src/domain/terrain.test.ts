import { describe, expect, it } from 'vitest'
import { splitIntoChunks } from './chunks'
import { CLEAR_MIN_SIZE } from './clear'
import { Grid, SURFACE_ROWS } from './grid'
import { seededRandom } from './testing'
import { createTerrain } from './terrain'

function survey(seed: number, depth = 60) {
  const grid = new Grid(createTerrain(seededRandom(seed)))
  // 窓の下端で切られた塊は本当の大きさが分からないので、余白を作って除く
  grid.ensureDepth(depth + 2)
  const sizes = splitIntoChunks(grid, SURFACE_ROWS, depth)
    .chunks.filter((c) => !c.openTop && !c.openBottom)
    .map((c) => c.cells.length)
  return { sizes, biggest: Math.max(...sizes), count: sizes.length }
}

describe('createTerrain', () => {
  // pickColor には「どの色も駄目なら諦めて置く」保険があるので、性質ではなく統計で見る
  it('生成しただけでは 4 つ揃わない', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { biggest, count } = survey(seed)
      expect(count).toBeGreaterThan(0)
      expect(biggest).toBeLessThan(CLEAR_MIN_SIZE)
    }
  })

  it('同色が固まって配られる', () => {
    // 散らばりすぎると掘っても落としても揃わず、消えるルールに気づけない。
    // 3 個の塊が至るところにあってはじめて「あと 1 個」を狙える
    const { sizes, count } = survey(7)
    const triples = sizes.filter((s) => s === 3).length
    expect(triples / count).toBeGreaterThan(0.1)
  })
})
