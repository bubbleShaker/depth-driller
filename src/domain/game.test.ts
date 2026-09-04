import { describe, expect, it } from 'vitest'
import { DIG_DURATION_MS, FALL_INTERVAL_MS, Game } from './game'

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

  it('横を掘るのと、掘った穴に入るのは別の 1 手', () => {
    const game = solidGround()
    // 地表の行は空なので、土に囲まれるところまで潜ってから試す
    game.update(0, 'down')
    game.update(FALL_INTERVAL_MS, null)
    const { x, y } = game

    game.update(DIG_DURATION_MS, 'right')
    expect(game.x).toBe(x)
    expect(game.grid.at(x + 1, y)).toBeNull()

    // 押しっぱなしなら続けて穴に入る
    game.update(DIG_DURATION_MS, 'right')
    expect(game.x).toBe(x + 1)
    expect(game.y).toBe(y)
  })

  it('落ちてきたブロックに潰されるとゲームオーバー', () => {
    const game = solidGround()
    // 頭上に支えの無いブロックを置く
    game.grid.set(game.x, game.y - 1, { color: 1, fell: false })
    game.update(FALL_INTERVAL_MS, null)
    expect(game.state).toBe('gameover')
  })

  it('ゲームオーバー後は何をしても動かない', () => {
    const game = solidGround()
    game.grid.set(game.x, game.y - 1, { color: 1, fell: false })
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

  it('潜った後に浅い場所へ戻っても最大深度は減らない', () => {
    const game = solidGround()
    game.update(0, 'down')
    game.update(FALL_INTERVAL_MS, null)
    expect(game.maxDepth).toBe(1)
    game.y = 0
    expect(game.maxDepth).toBe(1)
  })
})
