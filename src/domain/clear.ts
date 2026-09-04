import { splitIntoChunks, type CellPos } from './chunks'
import type { Grid } from './grid'
import type { Block } from './types'

/** 何個つながったら消えるか */
export const CLEAR_MIN_SIZE = 4

/**
 * 消える印がついてから実際に消えるまでのティック数。
 * 即座に消すと、何がどう繋がって消えたのか目で追えない。
 */
export const CLEAR_DELAY_TICKS = 6

export interface ClearResult {
  /** このティックで盤面から取り除いたセルの位置。連鎖が続いているかの判断に使う */
  removed: CellPos[]
  /** 消えるのを待っているセルの数。0 なら盤面に消し掛けのものは無い */
  pending: number
}

/** 消えると決まった塊。座標だけでなく、その時そこにあったセルも覚えておく */
interface ClearOrder {
  cells: { pos: CellPos; cell: Block }[]
  ticksLeft: number
}

/**
 * 同じ色が 4 つ以上つながった塊を消す係。
 *
 * 消える途中の塊を**盤面の外**で覚えているのが肝。
 * 落下も消去もプレイヤーの上下 24 マスという窓の中でしか計算しないので、
 * セル側のカウンタだけで管理すると、点滅している間にプレイヤーが落ちて窓がずれたとき、
 * 塊の半分だけが消えて残りが宙に固まる。予約として外に持てば、
 * 一度印がついた塊は窓がどこにあろうと最後まで一緒に消える。
 *
 * 覚えるのは座標だけでは足りない。点滅中のブロックはプレイヤーが掘れるので、
 * 空いた穴に別のブロックが落ちてくると、座標だけを見て巻き添えで消してしまう。
 * そこで「その時そこにあったセル」まで覚えて、消す直前に本人か確かめる。
 */
export class ClearScheduler {
  readonly #grid: Grid
  readonly #orders: ClearOrder[] = []

  /** 予約は特定の盤面のセルを指すので、盤面ごとに 1 つ持つ */
  constructor(grid: Grid) {
    this.#grid = grid
  }

  /** 消えるのを待っているセルの数 */
  get pending(): number {
    return this.#orders.reduce((total, order) => total + order.cells.length, 0)
  }

  /**
   * 1 ティック進める。
   *
   * 浮いている塊は数に入れない。空中で揃ったものが消えると、
   * 着地を見て置き場所を考える遊びが成り立たなくなる。
   * 浮いているかは [[stepGravity]] が書いた `floatTicks` で分かるので、
   * 先に重力を進めてから呼ぶこと。
   */
  step(fromY: number, toY: number): ClearResult {
    const removed = this.#advance()
    this.#reserve(fromY, toY)
    return { removed, pending: this.pending }
  }

  /** 点滅を進め、待ち時間が尽きた塊を盤面から取り除く */
  #advance(): CellPos[] {
    const grid = this.#grid
    const removed: CellPos[] = []

    for (let i = this.#orders.length - 1; i >= 0; i--) {
      const order = this.#orders[i]!
      order.ticksLeft -= 1
      // 掘られた跡に別のブロックが入っていることがある。本人でなければもう預かっていない
      order.cells = order.cells.filter(({ pos, cell }) => grid.at(pos.x, pos.y) === cell)

      if (order.ticksLeft > 0) {
        for (const { cell } of order.cells) cell.clearTicks = order.ticksLeft
        continue
      }

      for (const { pos } of order.cells) {
        grid.set(pos.x, pos.y, null)
        removed.push(pos)
      }
      this.#orders.splice(i, 1)
    }
    return removed
  }

  /** 新しく揃った塊に印をつける */
  #reserve(fromY: number, toY: number): void {
    const grid = this.#grid
    for (const chunk of splitIntoChunks(grid, fromY, toY).chunks) {
      if (chunk.cells.length < CLEAR_MIN_SIZE) continue
      // 窓からはみ出した塊は全体の大きさが分からない。落下と同じく手を出さない
      if (chunk.openTop || chunk.openBottom) continue

      const cells = chunk.cells.flatMap((pos) => {
        const cell = grid.at(pos.x, pos.y)
        return cell === null ? [] : [{ pos, cell }]
      })
      if (cells.some(({ cell }) => cell.floatTicks > 0 || cell.clearTicks > 0)) continue

      this.#orders.push({ cells, ticksLeft: CLEAR_DELAY_TICKS })
      for (const { cell } of cells) cell.clearTicks = CLEAR_DELAY_TICKS
    }
  }
}
