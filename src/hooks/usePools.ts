'use client'

import { contractConfig } from '@/lib/contracts'
import { formatBigNumber, formatPrice } from '@/lib/utils'
import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { TickMath, tickToPrice } from '@uniswap/v3-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { erc20Abi } from 'viem'
import {
  useAccount,
  useChainId,
  useReadContracts,
} from 'wagmi'

type TokenMeta = {
  address: `0x${string}`
  symbol: string
  decimals: number
}

interface RawPair {
  token0: `0x${string}`
  token1: `0x${string}`
}
interface TokenPair extends RawPair {
  token0Symbol: string
  token0Decimals: number
  token1Symbol: string
  token1Decimals: number
  pair: string
}
interface RawPool {
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
export interface Pool extends RawPool {
  token0Symbol: string
  token0Decimals: number
  token1Symbol: string
  token1Decimals: number
  tokenPair: string
  feeStr: string
  priceRange: string
  currentPrice: string
  liquidityStr: string
}
function clampTick(tick: number) {
  if (tick < TickMath.MIN_TICK) return TickMath.MIN_TICK
  if (tick > TickMath.MAX_TICK) return TickMath.MAX_TICK
  return tick
}
export function usePools(
  selectedToken0?: `0x${string}`,
  selectedToken1?: `0x${string}`,
) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { data, isSuccess, isPending: isBaseLoading } = useReadContracts({
    contracts: [
      {
        ...contractConfig.poolManager,
        functionName: 'getAllPools',
      },
      {
        ...contractConfig.poolManager,
        functionName: 'getPairs',
      },
    ],
    query: {
      enabled: isConnected,
      refetchInterval: 15000,
    },
  })
  const [tokens, setTokens] = useState<`0x${string}`[]>([])
  const {
    data: metaData,
    isSuccess: metaSuccess,
    isPending: isMetaLoading,
  } = useReadContracts({
    contracts: tokens.flatMap((address) => [
      {
        address,
        abi: erc20Abi,
        functionName: 'symbol',
      },
      {
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      },
    ]),
    query: {
      enabled: tokens.length > 0,
    },
    allowFailure: true,
  })
  const [tokenMap, setTokenMap] = useState<Map<`0x${string}`, TokenMeta>>(
    new Map(),
  )
  const [rawPair, setRawPair] = useState<RawPair[]>([])
  const [rawPool, setRawPool] = useState<RawPool[]>([])

  useEffect(() => {
    if (metaSuccess) {
      const resultMap: Map<`0x${string}`, TokenMeta> = new Map()
      for (let i = 0; i < tokens.length; i++) {
        let symbol: string = 'Unknown'
        let decimal: number = 18
        const symbolResult = metaData[i * 2]
        const decimalsResult = metaData[i * 2 + 1]
        if (symbolResult.status === 'success') {
          symbol = symbolResult.result as string
        }
        if (decimalsResult.status === 'success') {
          decimal = decimalsResult.result as number
        }
        if (
          symbolResult.status === 'success' &&
          decimalsResult.status === 'success'
        ) {
          resultMap.set(tokens[i], {
            address: tokens[i],
            symbol,
            decimals: decimal,
          })
        }
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokenMap(resultMap)
      // console.log('🚀 ~ useUnionPools ~ resultMap:', resultMap)
    }
  }, [metaData, metaSuccess])
  // fee [500, 3000, 10000] 有效的token

  useEffect(() => {
    if (
      isSuccess &&
      data.length &&
      data[0].status === 'success' &&
      data[1].status === 'success'
    ) {
      const tokenSet = new Set<`0x${string}`>()
      const allPools = data[0].result.map((pool) => {
        const { token0, token1 } = pool
        let t0 = token0
        let t1 = token1
        if (token0 === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
          t0 = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`
        }
        if (token1 === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
          t1 = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`
        }
        tokenSet.add(t0)
        tokenSet.add(t1)
        const item = { ...pool, token0: t0, token1: t1 }
        return { ...item }
      })
      const allPairs = data[1].result.map((pair) => {
        const { token0, token1 } = pair
        let t0 = token0
        let t1 = token1
        if (token0 === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
          t0 = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`
        }
        if (token1 === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
          t1 = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`
        }
        return {
          token0: t0,
          token1: t1,
        }
      })
      const uniqueTokens = Array.from(tokenSet)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokens(uniqueTokens)
      setRawPair(allPairs)
      setRawPool(allPools)
    }
  }, [isSuccess, data])
  const pairOptions: TokenPair[] = useMemo(() => {
    const formatPairs: TokenPair[] = []
    for (const pair of rawPair) {
      const pairMeta: TokenPair = {
        ...pair,
        token0Symbol: '',
        token0Decimals: 0,
        token1Symbol: '',
        token1Decimals: 0,
        pair: '',
      }
      if (tokenMap.has(pair.token0) && tokenMap.has(pair.token1)) {
        const token0Meta = tokenMap.get(pair.token0)
        const token1Meta = tokenMap.get(pair.token1)
        pairMeta.token0Symbol = token0Meta!.symbol
        pairMeta.token0Decimals = token0Meta!.decimals
        pairMeta.token1Symbol = token1Meta!.symbol
        pairMeta.token1Decimals = token1Meta!.decimals
        pairMeta.pair = `${token0Meta!.symbol}/${token1Meta!.symbol}`
        formatPairs.push(pairMeta)
      }
    }
    return formatPairs
  }, [rawPair, tokenMap])

  const handleFormatPool = useCallback(
    (rawPools: RawPool[], tokenMap: Map<`0x${string}`, TokenMeta>) => {
      const formatPool: Pool[] = []
      for (const pool of rawPools) {
        const poolItem: Pool = {
          ...pool,
          token0Symbol: '',
          token0Decimals: 0,
          token1Symbol: '',
          token1Decimals: 0,
          tokenPair: '',
          feeStr: '',
          priceRange: '',
          currentPrice: '',
          liquidityStr: '',
        }
        if (tokenMap.has(pool.token0) && tokenMap.has(pool.token1)) {
          const token0Meta = tokenMap.get(pool.token0)
          const token1Meta = tokenMap.get(pool.token1)
          poolItem.token0Symbol = token0Meta!.symbol
          poolItem.token0Decimals = token0Meta!.decimals
          poolItem.token1Symbol = token1Meta!.symbol
          poolItem.token1Decimals = token1Meta!.decimals
          poolItem.tokenPair = `${token0Meta!.symbol}/${token1Meta!.symbol}`
          const token0 = new Token(
            chainId,
            pool.token0,
            poolItem.token0Decimals,
            poolItem.token0Symbol,
          )

          const token1 = new Token(
            chainId,
            pool.token1,
            poolItem.token1Decimals,
            poolItem.token1Symbol,
          )
          const priceLower = tickToPrice(
            token0,
            token1,
            clampTick(poolItem.tickLower),
          )
          const pL = formatPrice(priceLower.toFixed(4))
          const priceUpper = tickToPrice(
            token0,
            token1,
            clampTick(poolItem.tickUpper),
          )
          const pU = formatPrice(priceUpper.toFixed(4))
          poolItem.feeStr = (poolItem.fee / 10000).toString() + '%'
          poolItem.priceRange = `${priceLower.toFixed(
            4,
          )} - ${priceUpper.toFixed(4)}`
          poolItem.priceRange = `${pL} - ${pU}`
          const currentPrice = tickToPrice(token0, token1, poolItem.tick)
          poolItem.currentPrice = `${currentPrice.toFixed(4)}`

          const liquidity = CurrencyAmount.fromRawAmount(
            token0,
            poolItem.liquidity.toString(),
          ).toFixed(6)
          poolItem.liquidityStr = formatBigNumber(liquidity)
          if ([500, 3000, 10000].includes(poolItem.fee)) {
            formatPool.push(poolItem)
          }
        }
      }
      return formatPool
    },
    [chainId],
  )

  const poolOptions: Pool[] = useMemo(() => {
    let formatPool: Pool[] = handleFormatPool(rawPool, tokenMap)
    if (selectedToken0 && selectedToken1) {
      formatPool = formatPool.filter(
        (item) =>
          item.token0 === selectedToken0 && item.token1 === selectedToken1,
      )
    } else {
      formatPool = []
    }
    return formatPool
  }, [selectedToken0, selectedToken1, rawPool, tokenMap, handleFormatPool])

  const isLoading = useMemo(() => {
    if (isBaseLoading) return true
    if (tokens.length > 0 && isMetaLoading) return true
    if (!isSuccess) return true
    if (tokens.length > 0 && !metaSuccess) return true
    return false
  }, [
    isBaseLoading,
    isMetaLoading,
    isSuccess,
    metaSuccess,
    tokens.length,
  ])

  return {
    isLoading,
    tokenMap,
    tokenList: [...tokenMap.values()],
    pairOptions: pairOptions.map((p) => {
      return {
        ...p,
        uuid: crypto.randomUUID(),
      }
    }),
    poolOptions: poolOptions.map((p) => {
      return {
        ...p,
        uuid: crypto.randomUUID(),
      }
    }),
    poolList: handleFormatPool(rawPool, tokenMap).map((p) => {
      return {
        ...p,
        uuid: crypto.randomUUID(),
      }
    }),
    availablePools:
      handleFormatPool(rawPool, tokenMap).filter((pool) => {
        return pool.sqrtPriceX96 !== BigInt(0) && pool.liquidity > BigInt(0)
      }) ?? [],
  }
}
