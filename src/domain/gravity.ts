import { GRID_WIDTH, type Grid } from './grid'

export interface CellPos {
  x: number
  y: number
}

/**
 * 支えを失ってから実際に落ち始めるまでのティック数。
 * 0 にすると掘った瞬間に落ちてきて避けようがなく、ただの理不尽になる。
 * 8（約 0.7 秒）は、横へ掘り進みながらでも下へ逃げ直せる長さとして実測で選んだ。
 */
export const FLOAT_TICKS_BEFORE_FALL = 8

interface Chunk {
  cells: CellPos[]
  /** 窓の上へ続いている。全体が見えないので動かせない */
  openTop: boolean
  /** 窓の下へ足が出ている。その先は未生成かもしれないので、支えがあるものとして扱う */
  openBottom: boolean
}

/**
 * 支えを失った塊を 1 マスだけ落とす。
 *
 * 落ちる単位は「同じ色で上下左右につながったひとかたまり」。
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
 * @returns 落ちたセルの移動後の位置
 */
export function stepGravity(grid: Grid, fromY: number, toY: number): CellPos[] {
  const top = Math.max(0, fromY)
  const key = (x: number, y: number) => y * GRID_WIDTH + x

  const { chunks, chunkOf } = splitIntoChunks(grid, top, toY, key)

  // 真下で接している塊。「支えられている」も「動けない」も、この関係を伝って上へ広がる
  const riders: number[][] = chunks.map(() => [])
  chunks.forEach((chunk, id) => {
    for (const { x, y } of chunk.cells) {
      const below = y + 1
      if (below > toY) {
        chunk.openBottom = true
        continue
      }
      if (grid.at(x, below) === null) continue
      const belowId = chunkOf.get(key(x, below))
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

  // このティックで動けない塊。猶予の最中のものと、その上に乗っているものも動けない
  const held = spread(
    chunks.map((_, id) => grounded[id] === true || floatTicks[id]! <= FLOAT_TICKS_BEFORE_FALL),
    riders,
  )

  return applyFall(grid, chunks, held, top, toY, key)
}

/** 同じ色でつながったセルをひとかたまりにまとめる */
function splitIntoChunks(
  grid: Grid,
  top: number,
  toY: number,
  key: (x: number, y: number) => number,
): { chunks: Chunk[]; chunkOf: Map<number, number> } {
  const chunkOf = new Map<number, number>()
  const chunks: Chunk[] = []

  for (let y = top; y <= toY; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid.at(x, y)
      if (cell === null || chunkOf.has(key(x, y))) continue

      const id = chunks.length
      const cells: CellPos[] = []
      const stack: CellPos[] = [{ x, y }]
      let openTop = false
      chunkOf.set(key(x, y), id)
      while (stack.length > 0) {
        const pos = stack.pop()!
        cells.push(pos)
        for (const [nx, ny] of [
          [pos.x + 1, pos.y],
          [pos.x - 1, pos.y],
          [pos.x, pos.y + 1],
          [pos.x, pos.y - 1],
        ] as const) {
          if (nx < 0 || nx >= GRID_WIDTH || ny > toY) continue
          if (ny < top) {
            // 窓の外までつながっているかだけ見て、探索は広げない
            const above = grid.at(nx, ny)
            if (above !== null && above.color === cell.color) openTop = true
            continue
          }
          if (chunkOf.has(key(nx, ny))) continue
          const neighbor = grid.at(nx, ny)
          if (neighbor === null || neighbor.color !== cell.color) continue
          chunkOf.set(key(nx, ny), id)
          stack.push({ x: nx, y: ny })
        }
      }
      chunks.push({ cells, openTop, openBottom: false })
    }
  }
  return { chunks, chunkOf }
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
  chunks: Chunk[],
  held: boolean[],
  top: number,
  toY: number,
  key: (x: number, y: number) => number,
): CellPos[] {
  // 一度すべて消してから書き戻す。1 つずつ動かすと、同じ塊の上のセルが下のセルを踏み潰す
  const falling: { pos: CellPos; color: number; floatTicks: number }[] = []
  chunks.forEach((chunk, id) => {
    if (held[id] === true) return
    for (const pos of chunk.cells) {
      const cell = grid.at(pos.x, pos.y)
      if (cell !== null) falling.push({ pos, color: cell.color, floatTicks: cell.floatTicks })
    }
  })
  for (const { pos } of falling) grid.set(pos.x, pos.y, null)

  const landed: CellPos[] = []
  for (const { pos, color, floatTicks } of falling) {
    // 落ちる先が空いていないなら判定のどこかが破綻している。
    // ブロックを消してしまうより、その場に戻す方がまだ被害が小さい
    const blocked = grid.at(pos.x, pos.y + 1) !== null
    const to = blocked ? pos : { x: pos.x, y: pos.y + 1 }
    grid.set(to.x, to.y, { color, fell: !blocked, floatTicks })
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
