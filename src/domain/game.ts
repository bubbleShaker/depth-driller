import { stepGravity, type CellPos } from './gravity'
import { GRID_WIDTH, Grid, SURFACE_ROWS } from './grid'
import { decideAction } from './player'
import type { Direction } from './types'

/** ブロックが 1 マス落ちるのにかかる時間。短いほど落石が怖くなる */
export const FALL_INTERVAL_MS = 90
export const MOVE_DURATION_MS = 110
export const DIG_DURATION_MS = 150

/**
 * 重力を計算する上下の窓。
 * 画面に映る範囲より広く取らないと、画面外の塊が固まったまま見えてしまう。
 */
const GRAVITY_MARGIN = 24

export type GameState = 'playing' | 'gameover'

/**
 * ルールの本体。Canvas も DOM も知らないので、盤面の挙動だけを単体テストできる。
 * 呼び出し側は毎フレーム update に経過時間と押されている方向を渡す。
 */
export class Game {
  readonly grid: Grid
  x: number
  y: number
  facing: Direction = 'down'
  state: GameState = 'playing'
  /** 到達した最大の深さ。潜って戻っても減らない */
  maxDepth = 0

  /** 描画がマス目の間を埋めるための、動く前の位置 */
  #prevX: number
  #prevY: number
  #actionElapsed = 0
  #actionDuration = 0
  #fallElapsed = 0
  #digTarget: CellPos | null = null

  constructor(random?: () => number) {
    this.grid = new Grid(random)
    this.x = Math.floor(GRID_WIDTH / 2)
    this.y = SURFACE_ROWS - 1
    this.#prevX = this.x
    this.#prevY = this.y
    this.grid.ensureDepth(this.y + GRAVITY_MARGIN + 1)
  }

  /** 地表を 0 とした現在の深さ（マス） */
  get depth(): number {
    return Math.max(0, this.y - (SURFACE_ROWS - 1))
  }

  /** 直前の動作の進み具合 0..1 */
  get moveProgress(): number {
    if (this.#actionDuration <= 0) return 1
    return Math.min(1, this.#actionElapsed / this.#actionDuration)
  }

  /** 落下ティックの進み具合 0..1。落ちてくるブロックの補間に使う */
  get fallProgress(): number {
    return Math.min(1, this.#fallElapsed / FALL_INTERVAL_MS)
  }

  get renderX(): number {
    return this.#prevX + (this.x - this.#prevX) * this.moveProgress
  }

  get renderY(): number {
    return this.#prevY + (this.y - this.#prevY) * this.moveProgress
  }

  /** 掘っている最中の対象。演出用で、盤面上ではもう壊れている */
  get digTarget(): CellPos | null {
    return this.#isBusy() ? this.#digTarget : null
  }

  /** 足元が空いている。落ちている間は掘れない */
  get isAirborne(): boolean {
    return !this.grid.isBlocked(this.x, this.y + 1)
  }

  update(dtMs: number, dir: Direction | null): void {
    if (this.state === 'gameover') return

    this.grid.ensureDepth(this.y + GRAVITY_MARGIN + 1)
    this.#actionElapsed += dtMs

    this.#fallElapsed += dtMs
    while (this.#fallElapsed >= FALL_INTERVAL_MS) {
      this.#fallElapsed -= FALL_INTERVAL_MS
      // 潰されたらその場で終わり。以降の入力を受け付けない
      if (this.#tickFall()) return
    }

    if (dir !== null) this.facing = dir
    if (dir !== null && !this.#isBusy() && !this.isAirborne) this.#startAction(dir)
  }

  #isBusy(): boolean {
    return this.#actionElapsed < this.#actionDuration
  }

  /** @returns 潰されたら true */
  #tickFall(): boolean {
    const landed = stepGravity(this.grid, this.y - GRAVITY_MARGIN, this.y + GRAVITY_MARGIN)

    // 落ちてきたブロックが自分のいるマスに入った = 潰された
    if (landed.some((p) => p.x === this.x && p.y === this.y)) {
      this.state = 'gameover'
      return true
    }

    if (this.isAirborne) this.#moveTo(this.x, this.y + 1, FALL_INTERVAL_MS)
    return false
  }

  #startAction(dir: Direction): void {
    const action = decideAction(this.grid, this.x, this.y, dir)
    if (action.kind === 'none') return

    if (action.kind === 'dig') {
      this.grid.set(action.x, action.y, null)
      this.#digTarget = { x: action.x, y: action.y }
      this.#beginAction(DIG_DURATION_MS)
      return
    }
    this.#digTarget = null
    this.#moveTo(action.x, action.y, MOVE_DURATION_MS)
  }

  #moveTo(x: number, y: number, durationMs: number): void {
    this.#prevX = this.x
    this.#prevY = this.y
    this.x = x
    this.y = y
    this.maxDepth = Math.max(this.maxDepth, this.depth)
    this.#beginAction(durationMs)
  }

  #beginAction(durationMs: number): void {
    this.#actionElapsed = 0
    this.#actionDuration = durationMs
  }
}
