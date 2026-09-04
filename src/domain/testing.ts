import { GRID_WIDTH, Grid } from './grid'
import type { Cell } from './types'

/**
 * 文字で盤面を書き下す。'.' が空、数字がその色のブロック。
 * 落下や消去は目で追えないと検証しづらいので、テストは絵で書けるようにしておく。
 */
export function makeGrid(rows: string[]): Grid {
  const grid = new Grid(() => 0)
  grid.ensureDepth(rows.length - 1)
  rows.forEach((row, y) => {
    if (row.length !== GRID_WIDTH) {
      throw new Error(`行 ${y} の幅が ${row.length}。${GRID_WIDTH} で書くこと`)
    }
    ;[...row].forEach((ch, x) => {
      const cell: Cell = ch === '.' ? null : { color: Number(ch), fell: false, floatTicks: 0 }
      grid.set(x, y, cell)
    })
  })
  return grid
}

export function dumpGrid(grid: Grid, rowCount: number): string[] {
  return Array.from({ length: rowCount }, (_, y) =>
    Array.from({ length: GRID_WIDTH }, (_, x) => {
      const cell = grid.at(x, y)
      return cell === null ? '.' : String(cell.color)
    }).join(''),
  )
}
