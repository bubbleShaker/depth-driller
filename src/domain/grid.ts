import { COLOR_COUNT, type Cell } from './types'

/** 掘れる範囲の横幅。原作と同じく狭く、左右は壁で閉じている */
export const GRID_WIDTH = 8

/** 地表側の空洞。ここがプレイヤーの立ち位置になるので土で埋めない */
export const SURFACE_ROWS = 2

/**
 * 縦に無限へ続く土。
 * 「下がまだ無い」のではなく「まだ作っていないだけ」なので、
 * 潜った深さに応じて ensureDepth で掘り足していく。
 */
export class Grid {
  readonly #rows: Cell[][] = []
  readonly #random: () => number

  /** 乱数を差し替えられるようにしておくと、盤面を固定してテストできる */
  constructor(random: () => number = Math.random) {
    this.#random = random
  }

  /** 生成済みの最下行。これより下は未生成で、まだ「無い」わけではない */
  get generatedDepth(): number {
    return this.#rows.length - 1
  }

  ensureDepth(depth: number): void {
    while (this.#rows.length <= depth) {
      this.#rows.push(this.#createRow(this.#rows.length))
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

  #createRow(y: number): Cell[] {
    if (y < SURFACE_ROWS) return Array.from<Cell>({ length: GRID_WIDTH }).fill(null)
    return Array.from({ length: GRID_WIDTH }, () => ({
      color: Math.floor(this.#random() * COLOR_COUNT),
      fell: false,
    }))
  }
}
