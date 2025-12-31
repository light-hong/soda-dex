'use client'

import { getBatchErc20Meta, formatUniswapV3Pool, FormattedPool } from '@/lib/getErc20Meta'
import { useEffect, useState } from 'react'
import { erc20Abi, PublicClient } from 'viem'
import { useChainId, usePublicClient } from 'wagmi'

export interface Pool {
  pool: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  index: number
  fee: number
  feeProtocol: number
  tickLower: number
  tickUpper: number
  tick: number
  sqrtPriceX96: bigint
  liquidity: bigint
}

type TokenMeta = {
  address: `0x${string}`
  symbol: string
  decimals: number
}

export function useFormatPools(pools: Pool[]) {
  const client = usePublicClient()
  const chainId = useChainId()
  const [tokenMap, setTokenMap] = useState<Map<string, TokenMeta>>(new Map())
  const [poolList, setPoolList] = useState<FormattedPool[]>([])

  const getTokenMeta = (token: string) => {
    if (!tokenMap.has(token)) {
      return {
        isErc20: false,
        symbol: `${token.slice(0, 4)}...${token.slice(-4)}`,
        decimals: 0,
      }
    }
    return tokenMap.get(token)
  }

  useEffect(() => {
    const getMeta = async (tokens: `0x${string}`[]) => {
      const resultMap: Map<string, TokenMeta> = new Map()
      const metas = await getBatchErc20Meta(
        client as PublicClient,
        tokens as `0x${string}`[],
      )
      metas.forEach((meta) => {
        resultMap.set(meta.address, meta)
      })
      setTokenMap(resultMap)
      // console.log('🚀 ~ useReadTokens ~ resultMap:', resultMap)
      const filteredPools: FormattedPool[] = []
      pools.forEach((pool) => {
        if (resultMap.has(pool.token0) && resultMap.has(pool.token1) && [500, 3000, 10000].includes(pool.fee)) {
          // console.log('🚀 ~ getMeta ~ pool:', pool)
          const token0Meta = {
            decimals: resultMap.get(pool.token0)?.decimals ?? 0,
            symbol: resultMap.get(pool.token0)?.symbol ?? '',
          }
          const token1Meta = {
            decimals: resultMap.get(pool.token1)?.decimals ?? 0,
            symbol: resultMap.get(pool.token1)?.symbol ?? '',
          }
          const res = formatUniswapV3Pool(pool, token0Meta, token1Meta, chainId)
          filteredPools.push(res)
        }
      })
      setPoolList(filteredPools)
      // console.log('🚀 ~ getMeta ~ filteredPools:', filteredPools)
    }
    if (pools?.length && client && chainId) {
      // console.log('🚀 ~ useFormatPools ~ pools:', pools)
      const tokenSet = new Set()
      pools.forEach((pool) => {
        tokenSet.add(pool.token0)
        tokenSet.add(pool.token1)
      })
      const tokens = [...tokenSet]
      // console.log("🚀 ~ useFormatPools ~ tokens:", tokens)
      getMeta(tokens as `0x${string}`[])
    }
  }, [pools])

  return {
    getTokenMeta,
    poolList,
  }
}
