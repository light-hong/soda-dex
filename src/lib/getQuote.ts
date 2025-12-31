import { simulateContract } from '@wagmi/core'
import config from './rainbow.config'
import { contractConfig } from './contracts'
import { TickMath } from '@uniswap/v3-sdk'
import { formatUnits, parseUnits } from 'viem'

type TokenMeta = {
  address?: `0x${string}`
  symbol: string
  decimals: number
}
type OutQuoteParams = {
  tokenIn: TokenMeta
  tokenOut: TokenMeta
  indexPath: number[]
  amountIn: string
  sqrtPriceLimitX96?: bigint
}
export const getOutQuote = async ({
  tokenIn,
  tokenOut,
  indexPath,
  amountIn,
}: OutQuoteParams) => {
  const amountInBigInt = parseUnits(amountIn, tokenIn.decimals)
  const zeroForOne =
    tokenIn.address!.toLowerCase() < tokenOut.address!.toLowerCase()

  const sqrtPriceLimitX96 = zeroForOne
    ? BigInt(TickMath.MIN_SQRT_RATIO.toString()) + 1n
    : BigInt(TickMath.MAX_SQRT_RATIO.toString()) - 1n
  try {
    const result = await simulateContract(config, {
      ...contractConfig.swapRouter,
      functionName: 'quoteExactInput',
      args: [
        {
          tokenIn: tokenIn.address!,
          tokenOut: tokenOut.address!,
          indexPath,
          amountIn: amountInBigInt,
          sqrtPriceLimitX96,
        },
      ],
    })
    const res = formatUnits(result.result, tokenOut.decimals)
    console.log('🚀 ~ getOutQuote ~ result:', res)
    return res
  } catch (error) {
    console.log('🚀 ~ getOutQuote ~ error:', error)
  }
}
