import { describe, expect, it } from 'vitest'
import { FLOAT_TICKS_BEFORE_FALL, stepGravity } from './gravity'
import { GRID_WIDTH, Grid } from './grid'
import { createTerrain } from './terrain'
import { countBlocks, dumpGrid, makeGrid, seededRandom } from './testing'

/**
 * 窓の下端は「未生成の土に支えられている」扱いなので、
 * 落としたい塊より下に必ず余白の行を置いてから toY を指定する。
 */
function fall(rows: string[], times = FLOAT_TICKS_BEFORE_FALL + 1): string[] {
  const grid = makeGrid(rows)
  for (let i = 0; i < times; i++) stepGravity(grid, 0, rows.length - 2)
  return dumpGrid(grid, rows.length)
}

describe('stepGravity', () => {
  it('支えを失ったブロックは 1 マス落ちる', () => {
    expect(
      fall([
        '...1....', //
        '........',
        '........',
      ]),
    ).toEqual([
      '........', //
      '...1....',
      '........',
    ])
  })

  it('地面についているブロックは落ちない', () => {
    expect(
      fall([
        '...1....', //
        '...2....',
        '........',
      ]),
    ).toEqual([
      '...1....', //
      '...2....',
      '........',
    ])
  })

  it('支えを失ってもすぐには落ちず、猶予のあいだ浮いている', () => {
    expect(
      fall(
        [
          '...1....', //
          '........',
          '........',
        ],
        FLOAT_TICKS_BEFORE_FALL,
      ),
    ).toEqual([
      '...1....', //
      '........',
      '........',
    ])
  })

  it('同色でつながった塊は形を保ったまま落ちる', () => {
    expect(
      fall([
        '..11....', //
        '...1....',
        '........',
        '........',
      ]),
    ).toEqual([
      '........', //
      '..11....',
      '...1....',
      '........',
    ])
  })

  it('隣り合っていても色が違えば別々に落ちる', () => {
    // 1 は 3 に乗って残り、支えの無い 2 だけが落ちる
    expect(
      fall([
        '..12....', //
        '..3.....',
        '........',
      ]),
    ).toEqual([
      '..1.....', //
      '..32....',
      '........',
    ])
  })

  it('支えられている塊に乗っているブロックは落ちない', () => {
    expect(
      fall([
        '...1....', //
        '...2....',
        '...3....',
        '........',
      ]),
    ).toEqual([
      '...1....', //
      '...2....',
      '...3....',
      '........',
    ])
  })

  it('塊の一部でも地面についていれば全体が残る', () => {
    // 左の 1 は下が空だが、右の 1 が地面についているので塊ごと留まる
    expect(
      fall([
        '..11....', //
        '...3....',
        '........',
      ]),
    ).toEqual([
      '..11....', //
      '...3....',
      '........',
    ])
  })

  it('落ちきったブロックは次のティックで動かない', () => {
    expect(
      fall(
        [
          '...1....', //
          '........',
          '........',
        ],
        FLOAT_TICKS_BEFORE_FALL + 5,
      ),
    ).toEqual([
      '........', //
      '...1....',
      '........',
    ])
  })

  it('落ちたセルには落下中の印がつき、止まると消える', () => {
    const grid = makeGrid([
      '...1....', //
      '........',
      '........',
    ])
    for (let i = 0; i <= FLOAT_TICKS_BEFORE_FALL; i++) stepGravity(grid, 0, 1)
    expect(grid.at(3, 1)?.fell).toBe(true)
    stepGravity(grid, 0, 1)
    expect(grid.at(3, 1)?.fell).toBe(false)
  })

  it('窓の上へ続いている塊は、全体が見えないので落とさない', () => {
    const grid = makeGrid([
      '...1....', //
      '...1....',
      '........',
      '........',
    ])
    for (let i = 0; i <= FLOAT_TICKS_BEFORE_FALL; i++) stepGravity(grid, 1, 2)
    expect(dumpGrid(grid, 4)).toEqual([
      '...1....', //
      '...1....',
      '........',
      '........',
    ])
  })

  it('猶予中の塊の上に落下中の塊が乗っていてもブロックは消えない', () => {
    const grid = makeGrid([
      '...0....', //
      '...3....',
      '........',
      '........',
    ])
    // 上はもう落ち始めていて、下はまだ浮いているだけ、という食い違いを作る
    grid.at(3, 0)!.floatTicks = FLOAT_TICKS_BEFORE_FALL + 2
    grid.at(3, 1)!.floatTicks = 1

    stepGravity(grid, 0, 2)

    expect(dumpGrid(grid, 4)).toEqual([
      '...0....', //
      '...3....',
      '........',
      '........',
    ])
  })

  it('掘った跡を落とし続けてもブロックの総数は変わらない', () => {
    const random = seededRandom(7)
    const grid = new Grid(createTerrain(random))
    grid.ensureDepth(20)
    for (let i = 0; i < 40; i++) {
      grid.set(Math.floor(random() * GRID_WIDTH), 2 + Math.floor(random() * 18), null)
    }
    const before = countBlocks(grid, 0, 20)

    for (let tick = 0; tick < 200; tick++) stepGravity(grid, 0, 20)

    expect(countBlocks(grid, 0, 20)).toBe(before)
  })

  it('落ちた先の位置を返す', () => {
    const grid = makeGrid([
      '...1....', //
      '........',
      '........',
    ])
    // 猶予のあいだは何も動かず、使い切った次のティックで落ちる
    for (let i = 0; i < FLOAT_TICKS_BEFORE_FALL; i++) {
      expect(stepGravity(grid, 0, 1).landed).toEqual([])
    }
    expect(stepGravity(grid, 0, 1).landed).toEqual([{ x: 3, y: 1 }])
  })
})
