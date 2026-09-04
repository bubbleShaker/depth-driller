import { GRID_WIDTH, Grid, type RowGenerator } from './grid'
import type { Cell } from './types'

/** 土がまったく無い世界。テストで必要な形だけを置きたいときに渡す */
export const emptyWorld: RowGenerator = () => Array.from<Cell>({ length: GRID_WIDTH }).fill(null)

export function block(color: number): Cell {
  return { color, fell: false, floatTicks: 0, clearTicks: 0 }
}

/**
 * 文字で盤面を書き下す。'.' が空、数字がその色のブロック。
 * 落下や消去は目で追えないと検証しづらいので、テストは絵で書けるようにしておく。
 */
export function makeGrid(rows: string[]): Grid {
  const grid = new Grid()
  grid.ensureDepth(rows.length - 1)
  rows.forEach((row, y) => {
    if (row.length !== GRID_WIDTH) {
      throw new Error(`行 ${y} の幅が ${row.length}。${GRID_WIDTH} で書くこと`)
    }
    ;[...row].forEach((ch, x) => {
      const cell: Cell = ch === '.' ? null : block(Number(ch))
      grid.set(x, y, cell)
    })
  })
  return grid
}

/** 窓の中に残っているブロックの数。落下でブロックが消えていないかを見るのに使う */
export function countBlocks(grid: Grid, fromY: number, toY: number): number {
  let total = 0
  for (let y = fromY; y <= toY; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (grid.at(x, y) !== null) total += 1
    }
  }
  return total
}

/** 盤面を固定するためのシード付き乱数 */
export function seededRandom(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dumpGrid(grid: Grid, rowCount: number): string[] {
  return Array.from({ length: rowCount }, (_, y) =>
    Array.from({ length: GRID_WIDTH }, (_, x) => {
      const cell = grid.at(x, y)
      return cell === null ? '.' : String(cell.color)
    }).join(''),
  )
}
