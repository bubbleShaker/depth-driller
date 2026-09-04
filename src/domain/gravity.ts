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

/**
 * 支えを失った塊を 1 マスだけ落とす。
 *
 * 落ちる単位は「同じ色で上下左右につながったひとかたまり」。
 * 色が違うブロックは互いを支えるが、一緒には落ちない。原作でブロックを 1 つ掘ると
 * 同色の塊がまとめて降ってくるのはこのため。
 *
 * fromY..toY は計算する窓。窓の外のことは分からないので、上下どちらであれ
 * 窓からはみ出した塊は「支えられている」ものとして動かさない。
 * 空だと決めつけると盤面が丸ごと落ちてしまうし、塊を窓で切って落とすと
 * 半分だけが落ちて穴が空く。窓はプレイヤーの周りに十分な余白を取って渡すこと。
 *
 * @returns 落ちたセルの移動後の位置
 */
export function stepGravity(grid: Grid, fromY: number, toY: number): CellPos[] {
  const top = Math.max(0, fromY)
  const key = (x: number, y: number) => y * GRID_WIDTH + x

  // 窓の中のブロックを同色の塊に分ける
  const componentOf = new Map<number, number>()
  const components: CellPos[][] = []
  /** 窓の上へ続いている塊。全体が見えていないので落とせない */
  const openTop: boolean[] = []
  for (let y = top; y <= toY; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid.at(x, y)
      if (cell === null || componentOf.has(key(x, y))) continue

      const id = components.length
      const cells: CellPos[] = []
      const stack: CellPos[] = [{ x, y }]
      let touchesTop = false
      componentOf.set(key(x, y), id)
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
            if (above !== null && above.color === cell.color) touchesTop = true
            continue
          }
          if (componentOf.has(key(nx, ny))) continue
          const neighbor = grid.at(nx, ny)
          if (neighbor === null || neighbor.color !== cell.color) continue
          componentOf.set(key(nx, ny), id)
          stack.push({ x: nx, y: ny })
        }
      }
      components.push(cells)
      openTop.push(touchesTop)
    }
  }

  // 地面に足がついている塊から、その上に乗っている塊へ「支えられている」を伝える
  const supported = Array.from<boolean>({ length: components.length }).fill(false)
  const riders: number[][] = components.map(() => [])
  const settled: number[] = []
  components.forEach((cells, id) => {
    if (openTop[id] === true) {
      supported[id] = true
      settled.push(id)
      return
    }
    for (const { x, y } of cells) {
      const below = y + 1
      if (below > toY) {
        // 窓の外は未知。落とさない方に倒す
        if (!supported[id]) {
          supported[id] = true
          settled.push(id)
        }
        continue
      }
      const cellBelow = grid.at(x, below)
      if (cellBelow === null) continue
      const belowId = componentOf.get(key(x, below))
      if (belowId === undefined || belowId === id) continue
      riders[belowId]!.push(id)
    }
  })
  while (settled.length > 0) {
    const id = settled.pop()!
    for (const rider of riders[id]!) {
      if (supported[rider]) continue
      supported[rider] = true
      settled.push(rider)
    }
  }

  // 落ちるセルを一度すべて消してから書き戻す。
  // 1 つずつ動かすと、同じ塊の上のセルが下のセルを踏み潰してしまう
  const falling: { pos: CellPos; color: number; floatTicks: number }[] = []
  components.forEach((cells, id) => {
    for (const pos of cells) {
      const cell = grid.at(pos.x, pos.y)
      if (cell === null) continue
      if (supported[id] === true) {
        cell.floatTicks = 0
        continue
      }
      // 浮いている時間を数え、猶予を超えたものだけが落ち始める
      cell.floatTicks += 1
      if (cell.floatTicks > FLOAT_TICKS_BEFORE_FALL) {
        falling.push({ pos, color: cell.color, floatTicks: cell.floatTicks })
      }
    }
  })
  for (const { pos } of falling) grid.set(pos.x, pos.y, null)

  const landed: CellPos[] = []
  for (const { pos, color, floatTicks } of falling) {
    const to = { x: pos.x, y: pos.y + 1 }
    grid.set(to.x, to.y, { color, fell: true, floatTicks })
    landed.push(to)
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
