import { contractConfig } from '@/lib/contracts'
import { Token } from '@uniswap/sdk-core'
import { tickToPrice } from '@uniswap/v3-sdk'
import { useEffect, useState } from 'react'
import { erc20Abi, erc721Abi, formatUnits } from 'viem'
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
} from 'wagmi'

export interface RawPosition {
  id: bigint
  owner: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  index: number
  fee: number
  liquidity: bigint
  tickLower: number
  tickUpper: number
  tokensOwed0: bigint
  tokensOwed1: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
}
export interface Position extends RawPosition {
  token0Symbol: string
  token0Decimals: number | null
  token1Symbol: string
  token1Decimals: number | null
  tokenPair: string
  feeStr: string
  liquidityStr: string
  tokensOwed0Str: string
  tokensOwed1Str: string
  totalRewardsStr: string
  priceRange: string
  status?: 'in-range' | 'out-of-range'
}
export const useUserPositions = () => {
  const { address: walletAddress } = useAccount()
  const client = usePublicClient()
  const chainId = useChainId()
  const [positions, setPositions] = useState<Position[]>([])

  const {
    data: allPositions,
    isSuccess,
    isLoading,
    refetch,
  } = useReadContract({
    ...contractConfig.positionManager,
    functionName: 'getAllPositions',
    query: {
      enabled: !!walletAddress,
    },
  })

  useEffect(() => {
    const processItem = async (rawItem: RawPosition) => {
      const item: Position = {
        ...rawItem,
        token0Symbol: '',
        token0Decimals: null,
        token1Symbol: '',
        token1Decimals: null,
        tokenPair: '',
        feeStr: '',
        liquidityStr: '',
        tokensOwed0Str: '',
        tokensOwed1Str: '',
        totalRewardsStr: '',
        priceRange: '',
        status: undefined,
      }
      try {
        // { result: 'USDC', status: 'success' }
        const [res1, res2, res3, res4] = await client!.multicall({
          contracts: [
            {
              address: item.token0,
              abi: erc20Abi,
              functionName: 'symbol',
            },
            {
              address: item.token0,
              abi: erc20Abi,
              functionName: 'decimals',
            },
            {
              address: item.token1,
              abi: erc20Abi,
              functionName: 'symbol',
            },
            {
              address: item.token1,
              abi: erc20Abi,
              functionName: 'decimals',
            },
          ],
        })

        item.token0Symbol =
          res1.status === 'success' ? (res1.result as string) : 'Unknown'
        item.token0Decimals =
          res2.status === 'success' ? (res2.result as number) : 18
        item.token1Symbol =
          res3.status === 'success' ? (res3.result as string) : 'Unknown'
        item.token1Decimals =
          res4.status === 'success' ? (res4.result as number) : 18
        item.tokenPair = `${item.token0Symbol}/${item.token1Symbol}`
        item.feeStr = (item.fee / 10000).toString() + '%'
        item.liquidityStr = formatUnits(item.liquidity, 18)
        item.tokensOwed0Str = formatUnits(item.tokensOwed0, item.token0Decimals)
        item.tokensOwed1Str = formatUnits(item.tokensOwed1, item.token1Decimals)
        // 计算价格范围
        const token0 = new Token(
          chainId,
          item.token0,
          item.token0Decimals,
          item.token0Symbol,
        )

        const token1 = new Token(
          chainId,
          item.token1,
          item.token1Decimals,
          item.token1Symbol,
        )
        const priceLower = tickToPrice(token0, token1, item.tickLower)
        const priceUpper = tickToPrice(token0, token1, item.tickUpper)
        item.priceRange = `${priceLower.toFixed(4)} - ${priceUpper.toFixed(4)}`

        // 模拟流动性价值（实际项目中需要从价格预言机获取）
        const liquidityValueNum = parseFloat(item.liquidityStr) * 1000 // 简化计算
        const liquidityValue =
          liquidityValueNum >= 1000
            ? `$${(liquidityValueNum / 1000).toFixed(2)}K`
            : `$${liquidityValueNum.toFixed(2)}`
        item.liquidityStr = liquidityValue

        // 计算总费用价值
        const totalFeesNum =
          parseFloat(item.tokensOwed0Str) + parseFloat(item.tokensOwed1Str)
        item.totalRewardsStr = `$${totalFeesNum.toFixed(2)}`

        // 判断是否在范围内（简化版本，实际需要获取当前池子价格）
        const status: 'in-range' | 'out-of-range' =
          parseFloat(item.liquidityStr) > 0 ? 'in-range' : 'out-of-range'
        item.status = status
      } catch (error) {
        console.log(error)
      }
      return item
    }
    const processArray = async (array: RawPosition[]) => {
      const results: Position[] = []
      for (const item of array) {
        // 等待当前项完成后再处理下一项
        const result = await processItem(item)
        results.push(result)
      }
      setPositions(results)
      return results
    }
    if (isSuccess && allPositions.length) {
      const _myPositions = allPositions.filter(
        (pos) => pos.owner === walletAddress,
      )
      processArray(_myPositions)
    }
  }, [isSuccess, allPositions, walletAddress])

  const totalInfo = {
    activePositions: positions.filter((p) => p.status === 'in-range').length,
    totalValue: positions.reduce((sum, position) => {
      const value = parseFloat(position.liquidityStr.replace(/[$,K]/g, ''))
      return sum + (position.liquidityStr.includes('K') ? value * 1000 : value)
    }, 0),
    totalRewardsStr: positions.reduce((sum, position) => {
      const fees = parseFloat(position.totalRewardsStr.replace(/[$,]/g, ''))
      return sum + fees
    }, 0),
  }

  return {
    positions,
    totalInfo,
    isPositionsLoading: isLoading,
    refetchPositions: refetch,
  }
}
