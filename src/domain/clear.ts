import { splitIntoChunks, type CellPos } from './chunks'
import type { Grid } from './grid'

/** 何個つながったら消えるか */
export const CLEAR_MIN_SIZE = 4

/**
 * 消える印がついてから実際に消えるまでのティック数。
 * 即座に消すと、何がどう繋がって消えたのか目で追えない。
 */
export const CLEAR_DELAY_TICKS = 6

/**
 * 消えると決まった塊。
 *
 * セル側のカウンタだけで管理すると、点滅している間にプレイヤーが動いて
 * 窓（計算する範囲）がずれたとき、塊の半分だけが消えて残りが宙に固まる。
 * 「一度印がついた塊は、窓がどこにあろうと最後まで一緒に消える」ことを
 * 保証するために、塊ごとの予約として外に持つ。
 */
export interface ClearOrder {
  cells: CellPos[]
  ticksLeft: number
}

export interface ClearResult {
  /** このティックで盤面から取り除いたセルの数 */
  removed: number
  /** 取り除いたセルがあった列。連鎖が続いているかの判断に使う */
  removedColumns: number[]
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
 * 浮いている塊は数に入れない。空中で揃ったものが消えると、
 * 着地を見て置き場所を考える遊びが成り立たなくなる。
 * 浮いているかは [[stepGravity]] が書いた `floatTicks` で分かるので、
 * 先に重力を進めてから呼ぶこと。
 *
 * @param orders 進行中の予約。呼び出し側が持ち続け、この関数が書き換える
 */
export function stepClear(
  grid: Grid,
  orders: ClearOrder[],
  fromY: number,
  toY: number,
): ClearResult {
  let removed = 0
  const removedColumns = new Set<number>()

  // 先に点滅を進める。同じティックで印を付けて即消すと点滅が 1 回も見えない。
  // 窓の外に出た予約もここで進むので、印がついた塊は必ず消えきる
  for (let i = orders.length - 1; i >= 0; i--) {
    const order = orders[i]!
    order.ticksLeft -= 1

    if (order.ticksLeft > 0) {
      for (const pos of order.cells) {
        const cell = grid.at(pos.x, pos.y)
        if (cell !== null) cell.clearTicks = order.ticksLeft
      }
      continue
    }

    for (const pos of order.cells) {
      if (grid.at(pos.x, pos.y) === null) continue
      grid.set(pos.x, pos.y, null)
      removed += 1
      removedColumns.add(pos.x)
    }
    orders.splice(i, 1)
  }

  let marked = 0
  for (const chunk of splitIntoChunks(grid, fromY, toY).chunks) {
    if (chunk.cells.length < CLEAR_MIN_SIZE) continue
    // 窓からはみ出した塊は全体の大きさが分からない。落下と同じく手を出さない
    if (chunk.openTop || chunk.openBottom) continue
    if (chunk.cells.some((pos) => (grid.at(pos.x, pos.y)?.floatTicks ?? 0) > 0)) continue
    if (chunk.cells.some((pos) => (grid.at(pos.x, pos.y)?.clearTicks ?? 0) > 0)) continue

    orders.push({ cells: chunk.cells, ticksLeft: CLEAR_DELAY_TICKS })
    for (const pos of chunk.cells) {
      const cell = grid.at(pos.x, pos.y)
      if (cell === null) continue
      cell.clearTicks = CLEAR_DELAY_TICKS
      marked += 1
    }
  }

  const pending = orders.reduce((total, order) => total + order.cells.length, 0)
  return { removed, removedColumns: [...removedColumns], marked, pending }
}
