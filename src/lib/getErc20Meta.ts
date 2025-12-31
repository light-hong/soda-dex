import { erc20Abi, type PublicClient } from 'viem'
import { CurrencyAmount, Percent, Token } from '@uniswap/sdk-core'
import { TickMath, tickToPrice, Pool as V3Pool } from '@uniswap/v3-sdk'
import { Pool } from '@/hooks/useFormatPools'
import { formatBigNumber } from './utils'

type TokenMeta = {
  address: `0x${string}`
  symbol: string
  decimals: number
}

export type FormattedPool = {
  poolAddress: `0x${string}`
  token0: TokenMeta
  token1: TokenMeta
  fee: string
  currentPrice: string
  priceRange: string
  liquidity: string
  tick: number
}

export async function getBatchErc20Meta(
  client: PublicClient,
  tokens: `0x${string}`[],
): Promise<TokenMeta[]> {
  const contracts = tokens.flatMap((token) => {
    const _token =
      token === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        ? '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
        : token
    return [
      {
        address: _token,
        abi: erc20Abi,
        functionName: 'symbol',
      },
      {
        address: _token,
        abi: erc20Abi,
        functionName: 'decimals',
      },
    ]
  })

  const results = await client.multicall({
    allowFailure: true,
    contracts,
  })

  const metas: TokenMeta[] = []

  // console.log('🚀 ~ getBatchErc20Meta ~ results:', results)
  for (let i = 0; i < tokens.length; i++) {
    const symbolResult = results[i * 2]
    const decimalsResult = results[i * 2 + 1]
    if (decimalsResult.status === 'success' && !decimalsResult.error) {
      metas.push({
        address: tokens[i],
        symbol: symbolResult.result as string,
        decimals: decimalsResult.result as number,
      })
    }
  }
  return metas
}

function clampTick(tick: number) {
  if (tick < TickMath.MIN_TICK) return TickMath.MIN_TICK
  if (tick > TickMath.MAX_TICK) return TickMath.MAX_TICK
  return tick
}
export function formatUniswapV3Pool(
  raw: Pool,
  token0Meta: { decimals: number; symbol: string },
  token1Meta: { decimals: number; symbol: string },
  chainId: number,
) {
  // 1. 创建Token对象
  const token0 = new Token(
    chainId,
    raw.token0,
    token0Meta.decimals,
    token0Meta.symbol,
  )

  const token1 = new Token(
    chainId,
    raw.token1,
    token1Meta.decimals,
    token1Meta.symbol,
  )

  // 2. 格式化手续费
  const feePercent = new Percent(raw.fee, 1000000) // 3000 = 0.3%

  // 3. 格式化当前价格（sqrtPriceX96 → tick → price）
  const currentTick = raw.tick
  const price = tickToPrice(token0, token1, currentTick)
  const formattedPrice = parseFloat(price.toFixed(token0.decimals)).toFixed(6)

  // 4. 格式化价格区间（tickLower/Upper → price）
  const tickLower = raw.tickLower
  const tickUpper = raw.tickUpper
  const priceLower = tickToPrice(token0, token1, clampTick(tickLower)).toFixed(
    6,
  )
  const pLower = formatBigNumber(priceLower)
  const priceUpper = tickToPrice(token0, token1, clampTick(tickUpper)).toFixed(
    6,
  )
  const pUpper = formatBigNumber(priceUpper)

  // 5. 格式化流动性（liquidity → TokenAmount）
  const liquidity = CurrencyAmount.fromRawAmount(
    token0,
    raw.liquidity.toString(),
  ).toFixed(6)
  const liquidityFormatted = formatBigNumber(liquidity)

  return {
    poolAddress: raw.pool,
    token0: {
      address: raw.token0,
      symbol: token0Meta.symbol,
      decimals: token0Meta.decimals,
    },
    token1: {
      address: raw.token1,
      symbol: token1Meta.symbol,
      decimals: token1Meta.decimals,
    },
    fee: feePercent.toFixed(2) + '%', // 例如 "0.30%"
    currentPrice: `${formattedPrice}`,
    priceRange: `${pLower} - ${pUpper}`,
    liquidity: liquidityFormatted,
    tick: currentTick,
  } as FormattedPool
}
