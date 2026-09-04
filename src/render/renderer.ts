import type { GameState } from '../domain/game'
import { FLOAT_TICKS_BEFORE_FALL } from '../domain/gravity'
import { GRID_WIDTH, SURFACE_ROWS } from '../domain/grid'
import type { Cell, Direction } from '../domain/types'
import { BLOCK_COLORS, PLAYER_COLORS, SKY_COLOR, caveColor } from './palette'

/**
 * Renderer が盤面について知っていればよいことだけを並べた読み取り口。
 * Game そのものを受け取ると、描画のついでに盤面を作ったり動かしたりできてしまう。
 * ここを通しておけば、描画が状態を変えないことが型で保証される。
 */
export interface BoardView {
  readonly grid: { at(x: number, y: number): Readonly<Cell> }
  readonly renderX: number
  readonly renderY: number
  readonly facing: Direction
  readonly depth: number
  readonly fallProgress: number
  readonly digTarget: { readonly x: number; readonly y: number } | null
  readonly state: GameState
}

/** プレイヤーを画面のどのあたりに置くか。下を広く見せたいので上寄り */
const CAMERA_ANCHOR = 0.34

/**
 * 縦に何マス見せたいか。
 * マスの大きさを画面の横幅だけで決めると、縦長のスマホでは数行しか見えず、
 * 落ちてくるブロックに気づいた時にはもう避けられない。
 */
const TARGET_ROWS = 15

/** PC の大画面でマスが間延びしないための上限 */
const MAX_CELL_PX = 58

/**
 * 盤面を Canvas に描くだけの層。ルールは一切持たない。
 * 位置はすべてマス目を単位にして計算し、最後に 1 マスの大きさを掛けて px にする。
 */
export class Renderer {
  readonly #canvas: HTMLCanvasElement
  readonly #ctx: CanvasRenderingContext2D
  #width = 0
  #height = 0
  #cell = 0
  /** 盤面の左端。余った横幅は左右に振り分けて壁にする */
  #originX = 0

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('Canvas 2D が使えない')
    this.#ctx = ctx
  }

  /**
   * 表示サイズと実ピクセルを合わせる。
   * devicePixelRatio を掛けないと、スマホでは輪郭が眠くなる
   */
  resize(cssWidth: number, cssHeight: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.#width = cssWidth
    this.#height = cssHeight
    this.#cell = Math.min(cssWidth / GRID_WIDTH, cssHeight / TARGET_ROWS, MAX_CELL_PX)
    this.#originX = (cssWidth - this.#cell * GRID_WIDTH) / 2
    this.#canvas.width = Math.round(cssWidth * dpr)
    this.#canvas.height = Math.round(cssHeight * dpr)
    this.#canvas.style.width = `${cssWidth}px`
    this.#canvas.style.height = `${cssHeight}px`
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  draw(game: BoardView): void {
    const cell = this.#cell
    const rowsVisible = this.#height / cell

    // カメラ。地表より上を出しすぎると、何もない空ばかりになる
    const cameraY = Math.max(-0.6, game.renderY - rowsVisible * CAMERA_ANCHOR)
    const toPx = (row: number) => (row - cameraY) * cell

    this.#drawBackground(game, cameraY, rowsVisible, toPx)

    const firstRow = Math.max(0, Math.floor(cameraY) - 1)
    const lastRow = Math.ceil(cameraY + rowsVisible) + 1

    for (let y = firstRow; y <= lastRow; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const block = game.grid.at(x, y)
        if (block === null) continue
        // 落ちている最中のブロックは、1 つ上のマスから降りてくる途中に見せる
        const drawRow = block.fell ? y - 1 + game.fallProgress : y
        // 支えを失って浮いているブロックは震わせる。落ちてくる前の唯一の予告なので、
        // 落下が近いほど揺れを大きくして「そろそろ来る」を伝える
        const urgency = block.fell ? 0 : Math.min(1, block.floatTicks / FLOAT_TICKS_BEFORE_FALL)
        const wobble = urgency * Math.sin(performance.now() / 26 + y) * cell * 0.07
        this.#drawBlock(this.#originX + x * cell + wobble, toPx(drawRow), block.color)
      }
    }

    this.#drawPlayer(game, toPx)
  }

  #drawBackground(
    game: BoardView,
    cameraY: number,
    rowsVisible: number,
    toPx: (row: number) => number,
  ): void {
    const ctx = this.#ctx
    ctx.fillStyle = caveColor(game.depth)
    ctx.fillRect(0, 0, this.#width, this.#height)

    // 地表より上は空。掘り始めがどこだったか分かると深さが実感できる
    const surfacePx = toPx(SURFACE_ROWS)
    if (surfacePx > 0) {
      ctx.fillStyle = SKY_COLOR
      ctx.fillRect(0, 0, this.#width, surfacePx)
      ctx.fillStyle = '#6b4a2f'
      ctx.fillRect(0, surfacePx - this.#cell * 0.12, this.#width, this.#cell * 0.12)
    }

    this.#drawWalls(Math.max(0, surfacePx))

    // 深さの目盛り。10 マスごとに薄い線を引くと、落ちた距離が見える
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
    ctx.lineWidth = 1
    const boardRight = this.#originX + this.#cell * GRID_WIDTH
    const from = Math.floor(cameraY / 10) * 10
    for (let row = from; row < cameraY + rowsVisible; row += 10) {
      const py = Math.round(toPx(row)) + 0.5
      ctx.beginPath()
      ctx.moveTo(this.#originX, py)
      ctx.lineTo(boardRight, py)
      ctx.stroke()
    }
  }

  /** 盤面の左右にはみ出した余白。掘れない岩壁として塗り、盤面の境界を示す */
  #drawWalls(fromY: number): void {
    if (this.#originX <= 0) return
    const ctx = this.#ctx
    const right = this.#originX + this.#cell * GRID_WIDTH
    const height = this.#height - fromY

    ctx.fillStyle = '#2a1d13'
    ctx.fillRect(0, fromY, this.#originX, height)
    ctx.fillRect(right, fromY, this.#width - right, height)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    const edge = this.#cell * 0.08
    ctx.fillRect(this.#originX - edge, fromY, edge, height)
    ctx.fillRect(right, fromY, edge, height)
  }

  #drawBlock(px: number, py: number, color: number): void {
    const ctx = this.#ctx
    const cell = this.#cell
    const palette = BLOCK_COLORS[color % BLOCK_COLORS.length]!
    const inset = cell * 0.04
    const size = cell - inset * 2

    ctx.fillStyle = palette.shade
    ctx.beginPath()
    ctx.roundRect(px + inset, py + inset, size, size, cell * 0.18)
    ctx.fill()

    ctx.fillStyle = palette.face
    ctx.beginPath()
    ctx.roundRect(px + inset, py + inset, size, size * 0.88, cell * 0.18)
    ctx.fill()

    ctx.fillStyle = palette.light
    ctx.beginPath()
    ctx.roundRect(px + cell * 0.16, py + cell * 0.14, size * 0.42, size * 0.2, cell * 0.08)
    ctx.fill()
  }

  #drawPlayer(game: BoardView, toPx: (row: number) => number): void {
    const ctx = this.#ctx
    const cell = this.#cell
    const px = this.#originX + game.renderX * cell
    const py = toPx(game.renderY)
    const cx = px + cell / 2
    const cy = py + cell / 2

    ctx.save()
    ctx.translate(cx, cy)

    // 掘っている間は小刻みに揺らす。手応えが目に見える
    if (game.digTarget !== null) {
      const shake = Math.sin(performance.now() / 18) * cell * 0.04
      ctx.translate(shake, 0)
    }

    this.#drawDrill(game)

    ctx.fillStyle = PLAYER_COLORS.suitShade
    ctx.beginPath()
    ctx.roundRect(-cell * 0.28, -cell * 0.18, cell * 0.56, cell * 0.46, cell * 0.14)
    ctx.fill()

    ctx.fillStyle = PLAYER_COLORS.suit
    ctx.beginPath()
    ctx.roundRect(-cell * 0.28, -cell * 0.32, cell * 0.56, cell * 0.5, cell * 0.16)
    ctx.fill()

    ctx.fillStyle = PLAYER_COLORS.helmet
    ctx.beginPath()
    ctx.arc(0, -cell * 0.16, cell * 0.22, Math.PI, 0)
    ctx.fill()

    ctx.fillStyle = PLAYER_COLORS.visor
    ctx.beginPath()
    ctx.roundRect(-cell * 0.15, -cell * 0.14, cell * 0.3, cell * 0.16, cell * 0.06)
    ctx.fill()

    ctx.restore()
  }

  #drawDrill(game: BoardView): void {
    const ctx = this.#ctx
    const cell = this.#cell
    const angle = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[game.facing]

    ctx.save()
    ctx.rotate(angle)
    ctx.fillStyle = PLAYER_COLORS.drillShade
    ctx.beginPath()
    ctx.roundRect(cell * 0.14, -cell * 0.13, cell * 0.14, cell * 0.26, cell * 0.05)
    ctx.fill()

    ctx.fillStyle = PLAYER_COLORS.drill
    ctx.beginPath()
    ctx.moveTo(cell * 0.26, -cell * 0.12)
    ctx.lineTo(cell * 0.52, 0)
    ctx.lineTo(cell * 0.26, cell * 0.12)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}
