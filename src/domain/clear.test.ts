import { describe, expect, it } from 'vitest'
import { CLEAR_DELAY_TICKS, stepClear, type ClearOrder } from './clear'
import { stepGravity } from './gravity'
import { Grid } from './grid'
import { countBlocks, dumpGrid, makeGrid, seededRandom } from './testing'
import { createTerrain } from './terrain'

/**
 * 点滅が終わって実際に消えるまで回す。
 * 窓の下端に足が出ている塊は「まだ下が見えていない」扱いで消えないので、
 * 窓は盤面より 1 行深く取る（そこは未生成 = 空として読まれる）。
 */
function clearAll(rows: string[]): string[] {
  const grid = makeGrid(rows)
  const orders: ClearOrder[] = []
  for (let i = 0; i <= CLEAR_DELAY_TICKS; i++) stepClear(grid, orders, 0, rows.length)
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
    const orders: ClearOrder[] = []

    stepClear(grid, orders, 0, 1)
    expect(grid.at(0, 0)?.clearTicks).toBe(CLEAR_DELAY_TICKS)

    for (let i = 0; i < CLEAR_DELAY_TICKS - 1; i++) stepClear(grid, orders, 0, 1)
    expect(grid.at(0, 0)).not.toBeNull()

    stepClear(grid, orders, 0, 1)
    expect(grid.at(0, 0)).toBeNull()
  })

  it('浮いている塊は、着地するまで消さない', () => {
    const grid = makeGrid([
      '1111....', //
      '........',
    ])
    for (const x of [0, 1, 2, 3]) grid.at(x, 0)!.floatTicks = 1
    const orders: ClearOrder[] = []

    stepClear(grid, orders, 0, 2)

    expect(grid.at(0, 0)?.clearTicks).toBe(0)
  })

  it('窓の上へ続いている塊は、全体の大きさが分からないので消さない', () => {
    const grid = makeGrid([
      '11......', //
      '11......',
    ])
    const orders: ClearOrder[] = []

    for (let i = 0; i <= CLEAR_DELAY_TICKS; i++) stepClear(grid, orders, 1, 2)

    expect(dumpGrid(grid, 2)).toEqual([
      '11......', //
      '11......',
    ])
  })

  it('窓の下へ足が出ている塊は、全体の大きさが分からないので消さない', () => {
    const grid = makeGrid([
      '.1......', //
      '.1......',
      '.1......',
      '.1......',
    ])
    const orders: ClearOrder[] = []

    // 窓を盤面の途中で切る。塊は 4 つあるが、下がどこまで続くか分からない
    for (let i = 0; i <= CLEAR_DELAY_TICKS; i++) stepClear(grid, orders, 0, 3)

    expect(dumpGrid(grid, 4)).toEqual([
      '.1......', //
      '.1......',
      '.1......',
      '.1......',
    ])
  })

  it('印がついた後で窓がずれても、塊は丸ごと消える', () => {
    // 点滅の途中でプレイヤーが落ちると窓が動く。
    // 窓の中しか見ないでいると、塊の半分だけ消えて残りが宙に固まる
    const grid = makeGrid([
      '.1......', //
      '.1......',
      '.1......',
      '.1......',
      '.2......',
      '.3......',
    ])
    const orders: ClearOrder[] = []

    stepClear(grid, orders, 0, 5)
    expect(grid.at(1, 0)?.clearTicks).toBe(CLEAR_DELAY_TICKS)

    // 窓を下へずらす。塊の上半分はもう窓の外
    for (let i = 0; i <= CLEAR_DELAY_TICKS; i++) stepClear(grid, orders, 3, 5)

    expect(dumpGrid(grid, 6)).toEqual([
      '........', //
      '........',
      '........',
      '........',
      '.2......',
      '.3......',
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

    const orders: ClearOrder[] = []
    let clears = 0
    for (let tick = 0; tick < 60; tick++) {
      stepGravity(grid, 0, 5)
      if (stepClear(grid, orders, 0, 5).removed > 0) clears += 1
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
    const orders: ClearOrder[] = []

    for (let tick = 0; tick <= CLEAR_DELAY_TICKS * 2; tick++) stepClear(grid, orders, 0, 39)

    expect(countBlocks(grid, 0, 40)).toBe(before)
  })
})
