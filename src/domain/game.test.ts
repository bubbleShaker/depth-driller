import { describe, expect, it } from 'vitest'
import { DIG_DURATION_MS, FALL_INTERVAL_MS, Game } from './game'
import { FLOAT_TICKS_BEFORE_FALL } from './gravity'
import { seededRandom } from './testing'

/** 色を 1 種類に固定した盤面。落下や消去の条件を意図した形だけに絞れる */
const solidGround = () => new Game(() => 0)

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
    game.grid.set(game.x, game.y - 1, { color: 1, fell: false, floatTicks: FLOAT_TICKS_BEFORE_FALL })
    game.update(FALL_INTERVAL_MS, null)
    expect(game.state).toBe('gameover')
  })

  it('ゲームオーバー後は何をしても動かない', () => {
    const game = solidGround()
    game.grid.set(game.x, game.y - 1, { color: 1, fell: false, floatTicks: FLOAT_TICKS_BEFORE_FALL })
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
    game.grid.set(column, game.y - 1, { color: 1, fell: false, floatTicks: FLOAT_TICKS_BEFORE_FALL })

    // ブロックと同じ速さで落ちるので、頭の上にあっても潰されない
    game.update(FALL_INTERVAL_MS, null)

    expect(game.state).toBe('playing')
    expect(game.depth).toBe(1)
  })

  it('下を押し続けている限りは潜り続けられる', () => {
    // 掘って落ちるだけで潰されるようなら、そもそもゲームにならない
    const game = new Game(seededRandom(1))
    for (let t = 0; t < 20000 && game.state === 'playing'; t += 16) {
      game.update(16, 'down')
    }
    expect(game.state).toBe('playing')
    expect(game.maxDepth).toBeGreaterThan(60)
  })

  it('頭上の震えを見て逃げれば、横に掘り進んでも生き延びられる', () => {
    // 震えはブロックが落ちてくる唯一の予告。これに反応して助からないなら理不尽なゲームになる
    const game = new Game(seededRandom(3))
    for (let t = 0; t < 20000 && game.state === 'playing'; t += 16) {
      const above = game.grid.at(game.x, game.y - 1)
      const escaping = above !== null && above.floatTicks > 0
      game.update(16, escaping ? 'down' : 'right')
    }
    expect(game.state).toBe('playing')
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
