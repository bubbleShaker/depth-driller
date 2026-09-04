import type { Cell } from './types'

/** 掘れる範囲の横幅。原作と同じく狭く、左右は壁で閉じている */
export const GRID_WIDTH = 8

/** 地表側の空洞。ここがプレイヤーの立ち位置になるので土で埋めない */
export const SURFACE_ROWS = 2

/**
 * 1 行ぶんの土を作る。
 * `look` で既に出来ている盤面を読めるので、上の行を見て色を選べる。
 */
export type RowGenerator = (y: number, look: (x: number, y: number) => Cell) => Cell[]

const emptyRow: RowGenerator = () => Array.from<Cell>({ length: GRID_WIDTH }).fill(null)

/**
 * 縦に無限へ続く土の**入れ物**。
 * 「下がまだ無い」のではなく「まだ作っていないだけ」なので、
 * 潜った深さに応じて ensureDepth で掘り足していく。
 *
 * どんな土を作るかは知らない。色の配り方は深さやルール（4 つ揃うと消える等）に
 * 左右されるので、行の作り方は外から渡す。
 */
export class Grid {
  readonly #rows: Cell[][] = []
  readonly #generate: RowGenerator

  constructor(generate: RowGenerator = emptyRow) {
    this.#generate = generate
  }

  /** 生成済みの最下行。これより下は未生成で、まだ「無い」わけではない */
  get generatedDepth(): number {
    return this.#rows.length - 1
  }

  ensureDepth(depth: number): void {
    while (this.#rows.length <= depth) {
      this.#rows.push(this.#generate(this.#rows.length, (x, y) => this.at(x, y)))
    }
  }

  at(x: number, y: number): Cell {
    if (x < 0 || x >= GRID_WIDTH) return null
    return this.#rows[y]?.[x] ?? null
  }

  set(x: number, y: number, cell: Cell): void {
    if (x < 0 || x >= GRID_WIDTH || y < 0) return
    this.ensureDepth(y)
    const row = this.#rows[y]
    if (row) row[x] = cell
  }

  /** 左右の外側。掘れないし通り抜けられない */
  isWall(x: number): boolean {
    return x < 0 || x >= GRID_WIDTH
  }

  /** そこへ進めないか。壁でもブロックでもない場所だけ歩ける */
  isBlocked(x: number, y: number): boolean {
    return this.isWall(x) || this.at(x, y) !== null
  }
}
