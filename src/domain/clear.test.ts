import { describe, expect, it } from 'vitest'
import { CLEAR_DELAY_TICKS, stepClear } from './clear'
import { stepGravity } from './gravity'
import { Grid } from './grid'
import { countBlocks, dumpGrid, makeGrid, seededRandom } from './testing'
import { createTerrain } from './terrain'

/** 点滅が終わって実際に消えるまで回す */
function clearAll(rows: string[]): string[] {
  const grid = makeGrid(rows)
  for (let i = 0; i <= CLEAR_DELAY_TICKS; i++) stepClear(grid, 0, rows.length - 1)
  return dumpGrid(grid, rows.length)
}

describe('stepClear', () => {
  it('同じ色が 4 つつながると消える', () => {
    expect(
      clearAll([
        '1111....', //
        '........',
      ]),
    ).toEqual([
      '........', //
      '........',
    ])
  })

  it('縦でも折れ曲がっていても、つながっていれば消える', () => {
    expect(
      clearAll([
        '11......', //
        '.1......',
        '.1......',
      ]),
    ).toEqual([
      '........', //
      '........',
      '........',
    ])
  })

  it('3 つでは消えない', () => {
    expect(
      clearAll([
        '111.....', //
        '........',
      ]),
    ).toEqual([
      '111.....', //
      '........',
    ])
  })

  it('色が違えばつながらない', () => {
    expect(
      clearAll([
        '1121....', //
        '........',
      ]),
    ).toEqual([
      '1121....', //
      '........',
    ])
  })

  it('印がついてから点滅する分だけ盤面に残る', () => {
    const grid = makeGrid(['1111....'])

    stepClear(grid, 0, 0)
    expect(grid.at(0, 0)?.clearTicks).toBe(CLEAR_DELAY_TICKS)

    for (let i = 0; i < CLEAR_DELAY_TICKS - 1; i++) stepClear(grid, 0, 0)
    expect(grid.at(0, 0)).not.toBeNull()

    stepClear(grid, 0, 0)
    expect(grid.at(0, 0)).toBeNull()
  })

  it('落ちている最中の塊は消さない', () => {
    const grid = makeGrid([
      '1111....', //
      '........',
    ])
    for (const x of [0, 1, 2, 3]) grid.at(x, 0)!.fell = true

    stepClear(grid, 0, 1)

    expect(grid.at(0, 0)?.clearTicks).toBe(0)
  })

  it('窓の上へ続いている塊は、全体の大きさが分からないので消さない', () => {
    const grid = makeGrid([
      '11......', //
      '11......',
    ])

    for (let i = 0; i <= CLEAR_DELAY_TICKS; i++) stepClear(grid, 1, 1)

    expect(dumpGrid(grid, 2)).toEqual([
      '11......', //
      '11......',
    ])
  })

  it('消えた跡に落ちてきたブロックがまた揃うと連鎖する', () => {
    // 2222 が消える → 上の 1 が落ちる → 下の 1 とつながって 4 つになる
    const grid = makeGrid([
      '1.......', //
      '1.......',
      '1.......',
      '2222....',
      '1.......',
      '01230123',
    ])

    let clears = 0
    for (let tick = 0; tick < 60; tick++) {
      stepGravity(grid, 0, 5)
      if (stepClear(grid, 0, 5).removed > 0) clears += 1
    }

    expect(clears).toBe(2)
    expect(dumpGrid(grid, 6)).toEqual([
      '........', //
      '........',
      '........',
      '........',
      '........',
      '01230123',
    ])
  })

  it('作りたての地形は勝手に消えない', () => {
    // 掘って落として揃えた時だけ消えてほしい。生成しただけで崩れると手応えが無い
    const grid = new Grid(createTerrain(seededRandom(5)))
    grid.ensureDepth(40)
    const before = countBlocks(grid, 0, 40)

    for (let tick = 0; tick <= CLEAR_DELAY_TICKS * 2; tick++) stepClear(grid, 0, 39)

    expect(countBlocks(grid, 0, 40)).toBe(before)
  })
})
