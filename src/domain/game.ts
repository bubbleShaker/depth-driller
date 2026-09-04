import type { CellPos } from './chunks'
import { ClearScheduler } from './clear'
import { stepGravity } from './gravity'
import { GRID_WIDTH, Grid, SURFACE_ROWS, type RowGenerator } from './grid'
import { decideAction } from './player'
import { createTerrain } from './terrain'
import type { Direction } from './types'

/** ブロックが 1 マス落ちるのにかかる時間。短いほど落石が怖くなる */
export const FALL_INTERVAL_MS = 90
/**
 * 掘る・歩くにかかる時間。
 * 落下の間隔より長くすると、絵がまだ元のマスにいる間に隣で潰されることが起きる。
 * 当たり判定と見た目がずれると死に納得できないので、落下と同じ刻みに揃える。
 */
export const MOVE_DURATION_MS = FALL_INTERVAL_MS
export const DIG_DURATION_MS = FALL_INTERVAL_MS

/**
 * 重力を計算する上下の窓。
 * 画面に映る範囲より広く取らないと、画面外の塊が固まったまま見えてしまう。
 */
const GRAVITY_MARGIN = 24

/**
 * どこまで先に土を作っておくか。
 * 未生成の行は「空」と見分けがつかないので、重力の窓と描画の範囲の
 * どちらよりも深くまで作っておかないと、盤面が下へ抜け落ちる。
 */
const LOOKAHEAD = GRAVITY_MARGIN * 2

export type GameState = 'playing' | 'gameover'

/** 連鎖するほど 1 個あたりの価値が上がる。まとめて消す組み立てに報いるため */
function scoreFor(removed: number, chain: number): number {
  return removed * 10 * chain
}

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
  /** 消したブロックで稼いだ点。深さとは別勘定 */
  score = 0
  /**
   * いま何連鎖目か。消えた跡が落ちてまた消えると伸びる。
   * 盤面が静まると 0 に戻る
   */
  chain = 0

  /** 描画がマス目の間を埋めるための、動く前の位置 */
  #prevX: number
  #prevY: number
  #actionElapsed = 0
  #actionDuration = 0
  #fallElapsed = 0
  #digTarget: CellPos | null = null
  /** 消えると決まった塊。窓がずれても最後まで一緒に消えるよう、盤面の外で持つ */
  readonly #clears = new ClearScheduler()
  /** 直前に消した跡の列。ここが動いている間だけ連鎖が続く */
  #chainColumns = new Set<number>()

  /** 土の作り方を差し替えられる。テストでは手で書いた盤面を渡せる */
  constructor(rows: RowGenerator = createTerrain()) {
    this.grid = new Grid(rows)
    this.x = Math.floor(GRID_WIDTH / 2)
    this.y = SURFACE_ROWS - 1
    this.#prevX = this.x
    this.#prevY = this.y
    this.grid.ensureDepth(this.y + LOOKAHEAD)
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

    this.#actionElapsed += dtMs

    this.#fallElapsed += dtMs
    while (this.#fallElapsed >= FALL_INTERVAL_MS) {
      this.#fallElapsed -= FALL_INTERVAL_MS
      // 潰されたらその場で終わり。以降の入力を受け付けない
      if (this.#tickFall()) return
    }

    if (dir !== null) this.facing = dir
    if (dir === null || this.#isBusy()) return
    // 落ちている最中にできるのは横へ逃げることだけ。
    // 真下を掘っても落下は速くならないし、何もできないまま着地して潰されるのは理不尽
    const sideways = dir === 'left' || dir === 'right'
    if (!this.isAirborne || sideways) this.#startAction(dir)
  }

  #isBusy(): boolean {
    return this.#actionElapsed < this.#actionDuration
  }

  /** @returns 潰されたら true */
  #tickFall(): boolean {
    // 1 回の update でティックが何度も回ることがある。
    // 生成はティックごとにやり直さないと、深くなった窓が未生成域にはみ出す
    this.grid.ensureDepth(this.y + LOOKAHEAD)

    const top = this.y - GRAVITY_MARGIN
    const bottom = this.y + GRAVITY_MARGIN

    // 落ちるかどうかは、ブロックが動く前の足元で決める。
    // ブロックと同じ速さで落ちている間は、真上から追いつかれない
    const falls = this.isAirborne
    const fall = stepGravity(this.grid, top, bottom)

    if (falls && !this.grid.isBlocked(this.x, this.y + 1)) {
      this.#moveTo(this.x, this.y + 1, FALL_INTERVAL_MS)
    }

    // 落ちてきたブロックが自分のいるマスに入った = 潰された
    if (fall.landed.some((p) => p.x === this.x && p.y === this.y)) {
      this.state = 'gameover'
      this.chain = 0
      return true
    }

    const cleared = this.#clears.step(this.grid, top, bottom)
    if (cleared.removed > 0) {
      // 前に消した跡と同じ列で起きた消去だけを連鎖と数える。
      // 「続けて消えた」だけで伸ばすと、離れた場所の偶然まで連鎖になる
      const followsUp = cleared.removedColumns.some((x) => this.#chainColumns.has(x))
      this.chain = followsUp ? this.chain + 1 : 1
      this.score += scoreFor(cleared.removed, this.chain)
      this.#chainColumns = new Set(cleared.removedColumns)
      return false
    }
    if (this.chain > 0) {
      // 消した跡へ向かう落下が止まったら、そこで連鎖は途切れる
      const stillMoving = [...this.#chainColumns].some((x) => fall.unsupportedColumns.has(x))
      if (!stillMoving && cleared.pending === 0) {
        this.chain = 0
        this.#chainColumns.clear()
      }
    }
    return false
  }

  #startAction(dir: Direction): void {
    const action = decideAction(this.grid, this.x, this.y, dir)
    if (action.kind === 'none') return

    if (action.kind === 'dig') {
      this.grid.set(action.x, action.y, null)
      this.#digTarget = { x: action.x, y: action.y }
      if (action.enter) this.#moveTo(action.x, action.y, DIG_DURATION_MS)
      else this.#beginAction(DIG_DURATION_MS)
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
