import { splitIntoChunks } from './chunks'
import { GRID_WIDTH, type Grid } from './grid'

/** 何個つながったら消えるか */
export const CLEAR_MIN_SIZE = 4

/**
 * 消える印がついてから実際に消えるまでのティック数。
 * 即座に消すと、何がどう繋がって消えたのか目で追えない。
 */
export const CLEAR_DELAY_TICKS = 6

export interface ClearResult {
  /** このティックで盤面から取り除いたセルの数 */
  removed: number
  /** 消える印がついたばかりのセルの数 */
  marked: number
  /** 消えるのを待っているセルの数。0 なら盤面に消し掛けのものは無い */
  pending: number
}

/**
 * 同じ色が 4 つ以上つながった塊を消す。
 *
 * 落下と足並みを揃えるため、消去も 1 ティックに 1 回進む。
 * 印がついた塊は落ちも消えもせずその場に残り、点滅し終えてから盤面を離れる。
 * 消えた跡は支えを失うので、次のティックで [[stepGravity]] が塊を落とし、
 * そこでまた 4 つ揃えば連鎖する。
 *
 * 落ちている最中の塊は数に入れない。空中で揃ったものが消えると、
 * 着地を見て置き場所を考える遊びが成り立たなくなる。
 */
export function stepClear(grid: Grid, fromY: number, toY: number): ClearResult {
  const top = Math.max(0, fromY)
  let removed = 0
  let marked = 0
  let pending = 0

  // 先に点滅を進める。同じティックで印を付けて即消すと点滅が 1 回も見えない
  for (let y = top; y <= toY; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid.at(x, y)
      if (cell === null || cell.clearTicks <= 0) continue
      cell.clearTicks -= 1
      if (cell.clearTicks <= 0) {
        grid.set(x, y, null)
        removed += 1
      } else {
        pending += 1
      }
    }
  }

  const { chunks } = splitIntoChunks(grid, top, toY)
  for (const chunk of chunks) {
    if (chunk.cells.length < CLEAR_MIN_SIZE) continue
    // 窓の外へ続く塊は全体の大きさが分からない。落下と同じく手を出さない
    if (chunk.openTop) continue
    if (chunk.cells.some((pos) => grid.at(pos.x, pos.y)?.fell === true)) continue
    if (chunk.cells.some((pos) => (grid.at(pos.x, pos.y)?.clearTicks ?? 0) > 0)) continue

    for (const pos of chunk.cells) {
      const cell = grid.at(pos.x, pos.y)
      if (cell === null) continue
      cell.clearTicks = CLEAR_DELAY_TICKS
      marked += 1
      pending += 1
    }
  }

  return { removed, marked, pending }
}
