import { GRID_WIDTH, type Grid } from './grid'

export interface CellPos {
  x: number
  y: number
}

export interface Chunk {
  cells: CellPos[]
  color: number
  /** 窓の上へ続いている。全体が見えていないので、動かすことも消すこともできない */
  openTop: boolean
}

export interface ChunkMap {
  chunks: Chunk[]
  /** そのマスが属する塊。ブロックが無ければ undefined */
  idAt(x: number, y: number): number | undefined
}

/**
 * 窓の中のブロックを、同じ色で上下左右につながったひとかたまりに分ける。
 *
 * 落下も消去も「塊」を単位にするので、両方がこの結果を使う。
 * 落ちるのは支えを失った塊ごと、消えるのは 4 つ以上つながった塊ごと。
 *
 * 窓の外は見えないので、上へ続いている塊には印を付けて呼び出し側に判断を委ねる。
 * 半分だけ落としたり半分だけ消したりすると盤面に穴が空く。
 */
export function splitIntoChunks(grid: Grid, fromY: number, toY: number): ChunkMap {
  const key = (x: number, y: number) => y * GRID_WIDTH + x
  const chunkOf = new Map<number, number>()
  const chunks: Chunk[] = []

  for (let y = fromY; y <= toY; y++) {
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
          if (ny < fromY) {
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
      chunks.push({ cells, color: cell.color, openTop })
    }
  }

  return { chunks, idAt: (x, y) => chunkOf.get(key(x, y)) }
}
