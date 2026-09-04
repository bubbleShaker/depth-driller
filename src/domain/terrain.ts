import { CLEAR_MIN_SIZE } from './clear'
import { GRID_WIDTH, SURFACE_ROWS, type RowGenerator } from './grid'
import { COLOR_COUNT, type Cell } from './types'

/**
 * 隣と同じ色を選ぶ確率。
 *
 * 一様な乱数で塗ると同色が 1〜2 個ずつに散らばり、掘っても落としてもまず揃わない
 * （実測では 118m 潜って 1 回も消えなかった）。
 * 固めて 3 個の塊を作っておくと「あと 1 個」が至る所に生まれ、
 * どこを崩すかを考える遊びになる。
 * 20 シードの試走では 0.7 が最も点の入りが良かった（13/20 で得点、中央値 90 点）。
 */
const CLUSTER_CHANCE = 0.7

/**
 * 土の作り方。
 *
 * ただの乱数だと、生成した端から 4 つ揃って勝手に消えていく。
 * プレイヤーが何もしていないのに盤面が崩れるのは手応えが無いので、
 * 置いた時点で 4 つつながってしまう色は避ける。
 * 掘って落として揃える、という手順を踏んだ時だけ消えるようにするための細工。
 */
export function createTerrain(random: () => number = Math.random): RowGenerator {
  return (y, look) => {
    if (y < SURFACE_ROWS) return Array.from<Cell>({ length: GRID_WIDTH }).fill(null)

    const row: Cell[] = []
    // まだ書き込んでいない行を読めるようにする。左隣は今まさに決めたばかりの色
    const peek = (px: number, py: number): Cell => (py === y ? (row[px] ?? null) : look(px, py))

    for (let x = 0; x < GRID_WIDTH; x++) {
      const color = pickColor(x, y, peek, random)
      row[x] = { color, fell: false, floatTicks: 0, clearTicks: 0 }
    }
    return row
  }
}

/**
 * そこに置いても 4 つつながらない色を選ぶ。
 * まず隣の色に寄せてみて、揃ってしまうなら他の色から選び直す。
 * 制約になるのは上と左の高々 2 色なので、4 色あれば必ず選べる。
 * 最後の `return first` は色数を減らした時のための保険で、通常は届かない。
 */
function pickColor(
  x: number,
  y: number,
  peek: (x: number, y: number) => Cell,
  random: () => number,
): number {
  const neighbors = [peek(x, y - 1), peek(x - 1, y)].flatMap((cell) =>
    cell === null ? [] : [cell.color],
  )
  if (neighbors.length > 0 && random() < CLUSTER_CHANCE) {
    const color = neighbors[Math.floor(random() * neighbors.length)]!
    if (groupSizeWith(x, y, color, peek) < CLEAR_MIN_SIZE) return color
  }

  const first = Math.floor(random() * COLOR_COUNT)
  for (let i = 0; i < COLOR_COUNT; i++) {
    const color = (first + i) % COLOR_COUNT
    if (groupSizeWith(x, y, color, peek) < CLEAR_MIN_SIZE) return color
  }
  return first
}

/** そのマスにその色を置いたとき、つながる同色の数。CLEAR_MIN_SIZE まで数えたら打ち切る */
function groupSizeWith(
  x: number,
  y: number,
  color: number,
  peek: (x: number, y: number) => Cell,
): number {
  const key = (px: number, py: number) => py * GRID_WIDTH + px
  const seen = new Set<number>([key(x, y)])
  const stack = [{ x, y }]
  let size = 0

  while (stack.length > 0) {
    const pos = stack.pop()!
    size += 1
    if (size >= CLEAR_MIN_SIZE) return size

    for (const [nx, ny] of [
      [pos.x + 1, pos.y],
      [pos.x - 1, pos.y],
      [pos.x, pos.y + 1],
      [pos.x, pos.y - 1],
    ] as const) {
      if (nx < 0 || nx >= GRID_WIDTH || ny < 0) continue
      const id = key(nx, ny)
      if (seen.has(id)) continue
      const neighbor = peek(nx, ny)
      if (neighbor === null || neighbor.color !== color) continue
      seen.add(id)
      stack.push({ x: nx, y: ny })
    }
  }
  return size
}
