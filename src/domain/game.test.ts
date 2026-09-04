import { describe, expect, it } from 'vitest'
import { DIG_DURATION_MS, FALL_INTERVAL_MS, Game } from './game'
import { FLOAT_TICKS_BEFORE_FALL } from './gravity'
import { GRID_WIDTH, emptyWorld, type Grid } from './grid'
import { block, seededRandom } from './testing'
import { createTerrain } from './terrain'

/**
 * 支えにするための土。隣どうしが必ず違う色になるので、それ自体は消えない。
 * 色 2 と 3 しか使わないので、テストで消したい塊には 0 と 1 を使うこと
 */
function pillar(grid: Grid, x: number, fromY: number, toY: number): void {
  for (let y = fromY; y <= toY; y++) grid.set(x, y, block((x + y) % 2 === 0 ? 2 : 3))
}

function paint(grid: Grid, cells: [number, number][], color: number): void {
  for (const [x, y] of cells) grid.set(x, y, block(color))
}

/** 色を 1 種類に固定した盤面。落下や消去の条件を意図した形だけに絞れる */
const solidGround = () => new Game(createTerrain(() => 0))

describe('Game', () => {
  it('地表に立って始まる', () => {
    const game = solidGround()
    expect(game.depth).toBe(0)
    expect(game.isAirborne).toBe(false)
    expect(game.state).toBe('playing')
  })

  it('押した方向のブロックを掘る', () => {
    const game = solidGround()
    const { x, y } = game
    game.update(0, 'down')
    expect(game.grid.at(x, y + 1)).toBeNull()
  })

  it('掘った穴に落ちて深くなる', () => {
    const game = solidGround()
    game.update(0, 'down')
    game.update(FALL_INTERVAL_MS, null)
    expect(game.depth).toBe(1)
    expect(game.maxDepth).toBe(1)
  })

  it('壁の外へは掘れない', () => {
    const game = solidGround()
    game.x = 0
    game.update(0, 'left')
    expect(game.x).toBe(0)
  })

  it('横は掘るのと入るのが 1 手', () => {
    const game = solidGround()
    // 地表の行は空なので、土に囲まれるところまで潜ってから試す
    game.update(0, 'down')
    game.update(FALL_INTERVAL_MS, null)
    const { x, y } = game

    game.update(DIG_DURATION_MS, 'right')
    expect(game.grid.at(x + 1, y)).toBeNull()
    expect(game.x).toBe(x + 1)
    expect(game.y).toBe(y)
  })

  it('落ちてきたブロックに潰されるとゲームオーバー', () => {
    const game = solidGround()
    // 頭上に、もう浮いていられないブロックを置く
    game.grid.set(game.x, game.y - 1, { color: 1, fell: false, floatTicks: FLOAT_TICKS_BEFORE_FALL, clearTicks: 0 })
    game.update(FALL_INTERVAL_MS, null)
    expect(game.state).toBe('gameover')
  })

  it('ゲームオーバー後は何をしても動かない', () => {
    const game = solidGround()
    game.grid.set(game.x, game.y - 1, { color: 1, fell: false, floatTicks: FLOAT_TICKS_BEFORE_FALL, clearTicks: 0 })
    game.update(FALL_INTERVAL_MS, null)
    const { x, y } = game
    game.update(FALL_INTERVAL_MS * 10, 'down')
    expect(game.x).toBe(x)
    expect(game.y).toBe(y)
  })

  it('落ちている間は掘れない', () => {
    const game = solidGround()
    const startX = game.x
    for (const dy of [1, 2, 3]) game.grid.set(startX, game.y + dy, null)

    game.update(FALL_INTERVAL_MS, null)
    expect(game.isAirborne).toBe(true)

    game.update(1, 'right')
    expect(game.grid.at(startX + 1, game.y)).not.toBeNull()
  })

  it('1 回の update でティックが何度も回っても地形が抜け落ちない', () => {
    const game = solidGround()
    const column = game.x
    for (let dy = 1; dy <= 8; dy++) game.grid.set(column, game.y + dy, null)

    // 生成が追いつかないと、窓の外が「空」に見えて盤面ごと落ちてしまう
    game.update(FALL_INTERVAL_MS * 8, null)

    expect(game.depth).toBe(8)
    expect(game.grid.at(column + 1, game.y)).not.toBeNull()
    expect(game.grid.at(column, game.y + 1)).not.toBeNull()
  })

  it('落ちている間は真上のブロックに追いつかれない', () => {
    const game = solidGround()
    const column = game.x
    for (const dy of [1, 2, 3]) game.grid.set(column, game.y + dy, null)
    game.grid.set(column, game.y - 1, { color: 1, fell: false, floatTicks: FLOAT_TICKS_BEFORE_FALL, clearTicks: 0 })

    // ブロックと同じ速さで落ちるので、頭の上にあっても潰されない
    game.update(FALL_INTERVAL_MS, null)

    expect(game.state).toBe('playing')
    expect(game.depth).toBe(1)
  })

  it('下を押し続けている限りは潜り続けられる', () => {
    // 掘って落ちるだけで潰されるようなら、そもそもゲームにならない
    const game = new Game(createTerrain(seededRandom(1)))
    for (let t = 0; t < 20000 && game.state === 'playing'; t += 16) {
      game.update(16, 'down')
    }
    expect(game.state).toBe('playing')
    expect(game.maxDepth).toBeGreaterThan(60)
  })

  it('頭上の震えを見て逃げれば、横に掘り進んでも生き延びられる', () => {
    // 震えはブロックが落ちてくる唯一の予告。これに反応して助からないなら理不尽なゲームになる
    const game = new Game(createTerrain(seededRandom(3)))
    for (let t = 0; t < 20000 && game.state === 'playing'; t += 16) {
      const above = game.grid.at(game.x, game.y - 1)
      const escaping = above !== null && above.floatTicks > 0
      game.update(16, escaping ? 'down' : 'right')
    }
    expect(game.state).toBe('playing')
  })

  it('離れた場所で続けて消えても連鎖にはならない', () => {
    const game = new Game(emptyWorld)
    const grid = game.grid
    pillar(grid, Math.floor(GRID_WIDTH / 2), 2, 30) // プレイヤーの足場
    for (const x of [0, 1, 6]) pillar(grid, x, 22, 30) // 消える塊の土台

    // 左: 最初から 4 つ揃っている
    paint(grid, [[0, 20], [1, 20], [0, 21], [1, 21]], 0)
    // 右: 3 つ + 上から落ちてきて 4 つ目になる。左とは無関係に、少し遅れて消える
    paint(grid, [[6, 19], [6, 20], [6, 21]], 1)
    paint(grid, [[6, 17]], 1)

    for (let t = 0; t < 4000; t += 16) game.update(16, null)

    // 4 個 × 2 回。連鎖と数えていれば 40 + 80 になる
    expect(game.score).toBe(80)
  })

  it('離れた場所の消去が近い時間で続いても連鎖にはならない', () => {
    // 上のテストとの違いは、右の塊がもう落下中で、着地が 8 ティック早いこと。
    // 「続けて消えた」だけで連鎖を伸ばすと、この近さで巻き込まれる
    const game = new Game(emptyWorld)
    const grid = game.grid
    pillar(grid, Math.floor(GRID_WIDTH / 2), 2, 30)
    for (const x of [0, 1, 6]) pillar(grid, x, 22, 30)

    paint(grid, [[0, 20], [1, 20], [0, 21], [1, 21]], 0)
    paint(grid, [[6, 19], [6, 20], [6, 21]], 1)
    paint(grid, [[6, 17]], 1)
    grid.at(6, 17)!.floatTicks = FLOAT_TICKS_BEFORE_FALL

    for (let t = 0; t < 4000; t += 16) game.update(16, null)

    expect(game.score).toBe(80)
  })

  it('消した跡に落ちてきたブロックが揃えば連鎖になる', () => {
    const game = new Game(emptyWorld)
    const grid = game.grid
    pillar(grid, Math.floor(GRID_WIDTH / 2), 2, 30)
    pillar(grid, 0, 22, 30)
    for (const x of [1, 2, 3]) pillar(grid, x, 21, 30)

    // 横 4 つが消える → 上の縦 3 つが落ちる → 下の 1 つとつながって 4 つになる
    paint(grid, [[0, 17], [0, 18], [0, 19]], 1)
    paint(grid, [[0, 20], [1, 20], [2, 20], [3, 20]], 0)
    paint(grid, [[0, 21]], 1)

    for (let t = 0; t < 4000; t += 16) game.update(16, null)

    // 1 回目は 40 点、跡に落ちて揃った 2 回目は 2 連鎖で 80 点
    expect(game.score).toBe(120)
  })

  it('同じ列でも、離れた深さで続けて消えたなら連鎖にはならない', () => {
    // 列は重なるが 9 行離れていて、片方の消去がもう片方を引き起こしていない
    const game = new Game(emptyWorld)
    const grid = game.grid
    pillar(grid, Math.floor(GRID_WIDTH / 2), 2, 30)

    // 浅い方: 最初から揃っている
    for (const x of [0, 1]) pillar(grid, x, 13, 16)
    paint(grid, [[0, 11], [1, 11], [0, 12], [1, 12]], 0)

    // 深い方: 上から 1 個落ちてきて 4 つ目になる
    for (const x of [0, 1]) pillar(grid, x, 22, 30)
    paint(grid, [[0, 20], [1, 20], [0, 21]], 1)
    paint(grid, [[1, 18]], 1)

    for (let t = 0; t < 4000; t += 16) game.update(16, null)

    expect(game.score).toBe(80)
  })

  it('潜った後に浅い場所へ戻っても最大深度は減らない', () => {
    const game = solidGround()
    game.update(0, 'down')
    game.update(FALL_INTERVAL_MS, null)
    expect(game.maxDepth).toBe(1)
    game.y = 0
    expect(game.maxDepth).toBe(1)
  })
})
