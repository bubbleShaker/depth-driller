/**
 * ブロックの色。COLOR_COUNT と同じ数だけ並べる。
 * 同色 4 つで消えるルールがあるので、隣り合った時に見間違えないことが最優先。
 * 色を増やすほど揃わなくなり、消す遊びが成立しなくなる（実測で 5 色は揃わなすぎた）。
 */
export const BLOCK_COLORS = [
  { face: '#e2574c', light: '#f08a80', shade: '#a83a32' },
  { face: '#4a89dc', light: '#7fb0ea', shade: '#31609e' },
  { face: '#8cc152', light: '#b4dd85', shade: '#5f8f34' },
  { face: '#f6bb42', light: '#ffd884', shade: '#bd8a1c' },
] as const

export const PLAYER_COLORS = {
  suit: '#f4f6fb',
  suitShade: '#c3cbdb',
  visor: '#2f3b52',
  helmet: '#ffd23f',
  drill: '#cfd6e4',
  drillShade: '#8d97ab',
}

/** 掘った後の空洞。深いほど暗くして、潜っている実感を出す */
export function caveColor(depth: number): string {
  const t = Math.min(1, depth / 400)
  return `hsl(${28 - 14 * t} ${34 - 16 * t}% ${16 - 9 * t}%)`
}

/** 地表より上に見える空 */
export const SKY_COLOR = '#7ec8f0'
