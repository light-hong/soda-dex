import { erc20Abi, type PublicClient } from 'viem'
import { CurrencyAmount, Percent, Token } from '@uniswap/sdk-core'
import { TickMath, tickToPrice, Pool as V3Pool } from '@uniswap/v3-sdk'
import { Pool } from '@/hooks/useFormatPools'
import { contractConfig } from './contracts'

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

export async function getAvailablePools(
  client: PublicClient,
  tokens: TokenMeta[],
): Promise<TokenMeta[]> {
  const liquidTokens: TokenMeta[] = []
  const results = await client.readContract({
    ...contractConfig.poolManager,
    functionName: 'getAllPools',
  })
  console.log('🚀 ~ getAvailablePools ~ results:', results)
  for (const token of tokens) {
    const tokenPools = results.filter(
      (p: any) => p.token0 === token.address || p.token1 === token.address,
    )

    // 检查池子流动性
    // let hasLiquidity = false
    for (const pool of tokenPools) {
      // const liquidity = await client.readContract({
      //   address: pool.pool,
      //   abi: [
      //     {
      //       inputs: [],
      //       name: 'liquidity',
      //       outputs: [{ type: 'uint128' }],
      //       type: 'function',
      //     },
      //   ],
      //   functionName: 'liquidity',
      // })
      // if (liquidity as number > 0) {
      //   hasLiquidity = true
      //   break
      // }
    }

    // if (hasLiquidity) {
    //   liquidTokens.push(token)
    // }
  }
  return liquidTokens
}
