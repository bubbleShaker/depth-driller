import { splitIntoChunks, type CellPos } from './chunks'
import { GRID_WIDTH, type Grid } from './grid'
import type { Block } from './types'

export interface FallResult {
  /** このティックで落ちたセルの、移動後の位置 */
  landed: CellPos[]
  /**
   * 支えを失った塊がある列。落下の猶予中でまだ動いていないものも含む。
   * 盤面のどこかが動いているだけでは連鎖とは言えないので、列まで絞って持つ。
   */
  unsupportedColumns: ReadonlySet<number>
}

/**
 * 支えを失ってから実際に落ち始めるまでのティック数。
 * 0 にすると掘った瞬間に落ちてきて避けようがなく、ただの理不尽になる。
 * 8（約 0.7 秒）は、横へ掘り進みながらでも下へ逃げ直せる長さとして実測で選んだ。
 */
export const FLOAT_TICKS_BEFORE_FALL = 8

/**
 * 支えを失った塊を 1 マスだけ落とす。
 *
 * 落ちる単位は同じ色でつながったひとかたまり（[[splitIntoChunks]]）。
 * 色が違うブロックは互いを支えるが、一緒には落ちない。原作でブロックを 1 つ掘ると
 * 同色の塊がまとめて降ってくるのはこのため。
 *
 * 塊には混ぜてはいけない 2 つの状態がある。
 * - **接地**: 支えがある。浮いている時間がリセットされ、震えも止まる
 * - **停止**: このティックでは動かない。接地しているものに加えて、
 *   まだ落下の猶予中のものと、その上に乗っているものが含まれる
 *
 * 2 つを 1 つの真偽値で兼ねると、猶予中で動かない塊の上に落下中の塊が重なり、
 * 埋まっているマスへ書き込んでブロックが消える。
 *
 * fromY..toY は計算する窓。窓の外のことは分からないので、上下どちらであれ
 * 窓からはみ出した塊は動かさない。空だと決めつけると盤面が丸ごと落ちてしまうし、
 * 塊を窓で切って落とすと半分だけが落ちて穴が空く。
 *
 */
export function stepGravity(grid: Grid, fromY: number, toY: number): FallResult {
  // 窓の上端。負の行は存在しないので、以降の走査もここから始める
  const top = Math.max(0, fromY)
  const key = (x: number, y: number) => y * GRID_WIDTH + x
  const { chunks, idAt } = splitIntoChunks(grid, top, toY)

  // 真下で接している塊。「支えられている」も「動けない」も、この関係を伝って上へ広がる
  const riders: number[][] = chunks.map(() => [])
  chunks.forEach((chunk, id) => {
    for (const { x, y } of chunk.cells) {
      const below = y + 1
      if (below > toY || grid.at(x, below) === null) continue
      const belowId = idAt(x, below)
      if (belowId === undefined || belowId === id) continue
      riders[belowId]!.push(id)
    }
  })

  const grounded = spread(
    chunks.map((chunk) => chunk.openTop || chunk.openBottom),
    riders,
  )

  // 浮いている時間は塊ごとに揃える。合体した塊が別々のタイミングで落ちるとちぎれる
  const floatTicks = chunks.map((chunk, id) => {
    if (grounded[id] === true) return 0
    const shortest = chunk.cells.reduce(
      (min, pos) => Math.min(min, grid.at(pos.x, pos.y)?.floatTicks ?? 0),
      Number.POSITIVE_INFINITY,
    )
    return (Number.isFinite(shortest) ? shortest : 0) + 1
  })
  chunks.forEach((chunk, id) => {
    for (const pos of chunk.cells) {
      const cell = grid.at(pos.x, pos.y)
      if (cell !== null) cell.floatTicks = floatTicks[id]!
    }
  })

  // このティックで動けない塊。猶予の最中のものと、その上に乗っているものも動けない。
  // 消えるのを待っているブロックも、消えるまではその場に留まる
  const held = spread(
    chunks.map(
      (chunk, id) =>
        grounded[id] === true ||
        floatTicks[id]! <= FLOAT_TICKS_BEFORE_FALL ||
        isClearing(grid, chunk.cells),
    ),
    riders,
  )

  const unsupportedColumns = new Set<number>()
  chunks.forEach((chunk, id) => {
    if (grounded[id] === true) return
    for (const pos of chunk.cells) unsupportedColumns.add(pos.x)
  })

  return { landed: applyFall(grid, chunks, held, top, toY, key), unsupportedColumns }
}

/** 消えるのを待っているか。真実は ClearScheduler が持ち、ここで読むのはセル側の写し */
function isClearing(grid: Grid, cells: CellPos[]): boolean {
  return cells.some((pos) => (grid.at(pos.x, pos.y)?.clearTicks ?? 0) > 0)
}

/** 種になった塊から、その上に乗っている塊へ状態を配る */
function spread(seeds: boolean[], riders: number[][]): boolean[] {
  const marked = [...seeds]
  const queue = marked.flatMap((isMarked, id) => (isMarked ? [id] : []))
  while (queue.length > 0) {
    const id = queue.pop()!
    for (const rider of riders[id]!) {
      if (marked[rider] === true) continue
      marked[rider] = true
      queue.push(rider)
    }
  }
  return marked
}

/** 動ける塊を 1 マス下へ移す */
function applyFall(
  grid: Grid,
  chunks: { cells: CellPos[] }[],
  held: boolean[],
  top: number,
  toY: number,
  key: (x: number, y: number) => number,
): CellPos[] {
  // 一度すべて消してから書き戻す。1 つずつ動かすと、同じ塊の上のセルが下のセルを踏み潰す
  const falling: { pos: CellPos; cell: Block }[] = []
  chunks.forEach((chunk, id) => {
    if (held[id] === true) return
    for (const pos of chunk.cells) {
      const cell = grid.at(pos.x, pos.y)
      if (cell !== null) falling.push({ pos, cell })
    }
  })
  for (const { pos } of falling) grid.set(pos.x, pos.y, null)

  const landed: CellPos[] = []
  for (const { pos, cell } of falling) {
    // 落ちる先が空いていないなら判定のどこかが破綻している。
    // ブロックを消してしまうより、その場に戻す方がまだ被害が小さい
    const blocked = grid.at(pos.x, pos.y + 1) !== null
    const to = blocked ? pos : { x: pos.x, y: pos.y + 1 }
    // 同じオブジェクトのまま運ぶ。作り直すと状態を書き潰すうえ、
    // 消える予約が「そこにあったセル」を見失う
    cell.fell = !blocked
    grid.set(to.x, to.y, cell)
    if (!blocked) landed.push(to)
  }

  // 落ちなかったセルの「落下中」表示を消す
  const landedKeys = new Set(landed.map((p) => key(p.x, p.y)))
  for (let y = top; y <= toY + 1; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid.at(x, y)
      if (cell !== null && cell.fell && !landedKeys.has(key(x, y))) {
        cell.fell = false
      }
    }
  }

  return landed
}
