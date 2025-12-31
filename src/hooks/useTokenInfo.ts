import { useEffect, useState } from 'react'
import { erc20Abi } from 'viem'
import { useReadContracts } from 'wagmi'

type Params = {
  tokens: `0x${string}`[]
  query?: {
    enabled?: boolean
  }
}

type TokenMeta = {
  symbol: string
  decimals: number
}
export function useTokenInfo(params: Params) {
  const { tokens, query } = params
  const [tokenMap, setTokenMap] = useState<Map<string, TokenMeta>>(new Map())
  const { data, isSuccess } = useReadContracts({
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
    query,
    allowFailure: true,
  })

  useEffect(() => {
    if (isSuccess) {
      const resultMap = new Map<string, TokenMeta>()
      for (let i = 0; i < tokens.length; i++) {
        let symbol: string = 'Unknown'
        let decimal: number = 18
        const symbolResult = data[i * 2]
        const decimalsResult = data[i * 2 + 1]
        if (symbolResult.status === 'success') {
          symbol = symbolResult.result as string
        }
        if (decimalsResult.status === 'success') {
          decimal = decimalsResult.result as number
        }
        resultMap.set(tokens[i], { symbol, decimals: decimal })
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokenMap(resultMap)
    }
  }, [data, isSuccess, tokens])
  return { tokenMap, isSuccess }
}
