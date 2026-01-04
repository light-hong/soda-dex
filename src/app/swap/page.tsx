'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePools } from '@/hooks/usePools'
import { ArrowDownUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  maxUint256,
  parseUnits,
} from 'viem'
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { contractConfig } from '@/lib/contracts'
import { getOutQuote } from '@/lib/getQuote'
import { Spinner } from '@/components/ui/spinner'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import CancelApprove from './cancelApprove'
import { TickMath } from '@uniswap/v3-sdk'
import { toast } from 'sonner'

type TokenMeta = {
  address?: `0x${string}`
  symbol: string
  decimals: number
}
export default function Swap() {
  const { isConnected, address } = useAccount()
  const publicClient = usePublicClient()
  const { tokenList, availablePools } = usePools()
  const [sellToken, setSellToken] = useState<TokenMeta>({
    address: undefined,
    symbol: '',
    decimals: 0,
  })
  const [sellAmount, setSellAmount] = useState<string>('')
  const [buyAmount, setBuyAmount] = useState<string>('')
  const [buyToken, setBuyToken] = useState<TokenMeta>({
    address: undefined,
    symbol: '',
    decimals: 0,
  })
  const [slippage, setSlippage] = useState<string>('0.5')
  const [isCalcing, setIsCalcing] = useState<boolean>(false)
  const {
    data: sellData,
    isLoading: sellLoading,
    isSuccess: sellSuccess,
    refetch: refetchSellData,
  } = useReadContracts({
    contracts: [
      {
        address: sellToken.address,
        abi: erc20Abi,
        functionName: 'decimals',
      },
      {
        address: sellToken.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      },
    ],
    query: {
      enabled: isConnected && sellToken !== undefined,
    },
  })

  const { data: allowance } = useReadContract({
    address: sellToken.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address as `0x${string}`, contractConfig.swapRouter.address],
    query: {
      enabled: isConnected && !!sellToken.address,
    },
  })

  const swapRoute = useMemo(() => {
    const findMatchingPools = (tokenIn: string, tokenOut: string) => {
      const normalizedTokenIn = tokenIn.toLowerCase()
      const normalizedTokenOut = tokenOut.toLowerCase()

      return availablePools
        .filter((pool) => {
          const poolToken0 = pool.token0.toLowerCase()
          const poolToken1 = pool.token1.toLowerCase()
          // 正向：tokenIn -> tokenOut 或反向：tokenOut -> tokenIn
          return (
            (poolToken0 === normalizedTokenIn &&
              poolToken1 === normalizedTokenOut) ||
            (poolToken0 === normalizedTokenOut &&
              poolToken1 === normalizedTokenIn)
          )
        })
        .sort((a, b) => Number(b.liquidity - a.liquidity))
    }

    if (sellToken.address && buyToken.address && availablePools.length) {
      const swapRoute = findMatchingPools(sellToken.address, buyToken.address)
      return swapRoute.length > 0 ? swapRoute : null
    }
    return null
  }, [availablePools, sellToken, buyToken])

  const {
    writeContract,
    data: approveHash,
    isSuccess: approveSuccess,
    isPending: approvePending,
  } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveConfirmed } =
    useWaitForTransactionReceipt({
      hash: approveHash,
      query: {
        enabled: approveSuccess && !!approveHash,
      },
    })
  const approve = () => {
    writeContract({
      address: sellToken.address!,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contractConfig.swapRouter.address, maxUint256],
    })
  }
  useEffect(() => {
    if (approveSuccess && approveHash && approveConfirmed) {
      directSwap()
    }
  }, [approveConfirmed, approveHash, approveSuccess])

  const {
    writeContract: writeSwapContract,
    data: swapHash,
    isSuccess: swapSuccess,
    isPending: swapPending,
  } = useWriteContract()
  const {
    isLoading: swapConfirming,
    isSuccess: swapConfirmed,
    data: swapConfirmHash,
  } = useWaitForTransactionReceipt({
    hash: swapHash,
    query: {
      enabled: swapSuccess && !!swapHash,
    },
  })
  useEffect(() => {
    if (swapConfirmed) {
      refetchSellData()
      setSellAmount('')
      setBuyAmount('')
    }
  }, [swapConfirmed])
  const directSwap = async () => {
    const amountInBigInt = parseUnits(sellAmount, sellToken.decimals)
    const amountOutBigInt = parseUnits(buyAmount, buyToken.decimals)
    const zeroForOne =
      sellToken.address!.toLowerCase() < buyToken.address!.toLowerCase()

    const sqrtPriceLimitX96 = zeroForOne
      ? BigInt(TickMath.MIN_SQRT_RATIO.toString()) + 1n
      : BigInt(TickMath.MAX_SQRT_RATIO.toString()) - 1n

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20)

    const slippageBps = BigInt(Math.floor(parseFloat(slippage) * 100))
    console.log('🚀 ~ directSwap ~ slippageBps:', slippageBps)

    const amountOutMinimum =
      (amountOutBigInt * (10_000n - slippageBps)) / 10_000n

    console.log('🚀 ~ directSwap ~ amountOutMinimum:', amountOutMinimum)

    const indexPath = swapRoute!.map((e) => e.index)

    const isNativeTokenIn =
      sellToken.address === '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'

    const value = isNativeTokenIn ? amountInBigInt : BigInt(0)
    const params = {
      tokenIn: sellToken.address!,
      tokenOut: buyToken.address!,
      indexPath: [indexPath[0]],
      recipient: address as `0x${string}`,
      deadline,
      amountIn: amountInBigInt,
      amountOutMinimum,
      sqrtPriceLimitX96,
    }
    console.log('🚀 ~ directSwap ~ params:', params)
    const gasEstimate = await publicClient!.estimateGas({
      account: address as `0x${string}`,
      to: contractConfig.swapRouter.address,
      data: encodeFunctionData({
        abi: contractConfig.swapRouter.abi,
        functionName: 'exactInput',
        args: [params],
      }),
    })
    writeSwapContract(
      {
        ...contractConfig.swapRouter,
        functionName: 'exactInput',
        args: [params],
        value,
      }
    )
  }
  const handleSwap = () => {
    if (isCalcing) return
    if (!sellAmount || !buyAmount || !swapRoute) return
    const sell = parseUnits(sellAmount.toString(), sellToken.decimals)

    const decimals = sellData![0].result as number
    const balance = sellData![1].result as bigint
    const balanceReadable = Number(formatUnits(balance, decimals))

    if (Number(sellAmount) > balanceReadable) return
    if (!allowance || allowance < sell) {
      approve()
    } else {
      directSwap()
    }
  }
  useEffect(() => {
    if (swapConfirming) {
      toast.loading('Swaping...', { position: 'top-right', id: 'swap-toast' })
      return
    }
    if (swapConfirmed) {
      toast.success(
        <div>
          交易哈希:
          <a
            href={`https://sepolia.etherscan.io/tx/${swapConfirmHash.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {`${swapConfirmHash.transactionHash.slice(
              0,
              10,
            )}...${swapConfirmHash.transactionHash.slice(-10)}`}
          </a>
        </div>,
        {
          position: 'top-right',
          id: 'swap-toast',
          duration: 7000,
        },
      )
      return
    }
  }, [swapConfirmed, swapConfirming, swapConfirmHash])

  const swapTip = useMemo(() => {
    if (swapPending || swapConfirming) return 'Swaping...'
    if (approvePending || approveConfirming) return 'Approving...'
    if (!swapRoute) return '无可用交易对'
    if (sellSuccess && sellData) {
      const decimals = sellData![0].result as number
      const balance = sellData![1].result as bigint
      const value = formatUnits(balance, decimals)
      if (Number(sellAmount) > Number(value)) return '可用余额不足'
      return 'Swap'
    }
    return 'Swap'
  }, [
    swapPending,
    swapConfirming,
    approvePending,
    approveConfirming,
    swapRoute,
    sellSuccess,
    sellData,
    sellAmount,
  ])
  const swapDisabled = useMemo(() => {
    if (swapPending || swapConfirming) return true
    if (approvePending || approveConfirming) return true
    if (isCalcing) return true
    if (!sellAmount || !buyAmount) return true
    if (!swapRoute) return true
    if (sellSuccess && sellData) {
      const decimals = sellData![0].result as number
      const balance = sellData![1].result as bigint
      const value = formatUnits(balance, decimals)
      if (Number(sellAmount) > Number(value)) return true
      return false
    }
    return false
  }, [
    swapPending,
    swapConfirming,
    approvePending,
    approveConfirming,
    isCalcing,
    sellAmount,
    buyAmount,
    swapRoute,
    sellSuccess,
    sellData,
  ])
  const handleExchange = () => {
    if (sellToken.address && buyToken.address && sellAmount && buyAmount) {
      const currentSellToken = sellToken
      const currentBuyToken = buyToken
      setSellToken(currentBuyToken)
      setBuyToken(currentSellToken)
      const currentSellAmount = sellAmount
      const currentBuyAmount = buyAmount
      setSellAmount(currentBuyAmount)
      setBuyAmount(currentSellAmount)
    }
  }
  const handleSellChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSellAmount(e.target.value)
  }

  const handleSellTokenChange = (address: `0x${string}`) => {
    const token = tokenList.find((t) => t.address === address)
    if (!token) return

    setSellToken({
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
    })
  }
  const handleBuyTokenChange = (address: `0x${string}`) => {
    const token = tokenList.find((t) => t.address === address)
    if (!token) return

    setBuyToken({
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
    })
  }

  const sellBalance = useMemo(() => {
    if (sellSuccess && sellData) {
      const decimals = sellData[0].result as number
      const balance = sellData[1].result as bigint
      const value = formatUnits(balance, decimals)
      return value === '0' ? 0 : Number(value).toFixed(4)
    }
    return '0'
  }, [sellData, sellSuccess])
  const sellList = useMemo(() => {
    return tokenList.filter((token) => token.address !== buyToken.address)
  }, [tokenList, buyToken])
  const buyList = useMemo(() => {
    return tokenList.filter((token) => token.address !== sellToken.address)
  }, [tokenList, sellToken])

  useEffect(() => {
    const getOut = async () => {
      setIsCalcing(true)
      const out = await getOutQuote({
        tokenIn: sellToken,
        tokenOut: buyToken,
        indexPath: swapRoute!.map((e) => e.index),
        amountIn: sellAmount,
      })
      setBuyAmount(out || '')
    }
    if (sellToken.address && buyToken.address && swapRoute && sellAmount) {
      getOut().finally(() => {
        setIsCalcing(false)
      })
    }
  }, [
    sellAmount,
    sellToken.address,
    buyToken.address,
    swapRoute?.map((e) => e.index).join(','),
  ])

  return (
    <div className="max-w-md mx-auto mt-30">
      <div className="relative w-full">
        <Card>
          <CardContent className="px-6 h-30 flex flex-col justify-center space-y-5">
            <div className="text-sm text-muted-foreground flex justify-between">
              <div>Sell</div>
              <div className="flex items-center">
                balance: {sellLoading ? <Spinner /> : sellBalance}
              </div>
            </div>
            <div className="text-4xl font-semibold flex items-center gap-2">
              <Input
                type="number"
                className="h-11"
                value={sellAmount}
                max={sellBalance}
                onChange={handleSellChange}
                disabled={!sellToken.address}
              />
              <Select
                value={sellToken.address}
                onValueChange={handleSellTokenChange}
              >
                <SelectTrigger className="w-50 h-11!">
                  <SelectValue placeholder="sell token" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectLabel>sell token</SelectLabel>
                    {sellList.map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <Button
            onClick={handleExchange}
            size="icon"
            className="h-12 w-12 rounded-xl bg-card text-card-foreground shadow-sm ring-1 ring-white/10"
          >
            <ArrowDownUp className="h-5 w-5" />
          </Button>
        </div>
        <Card className="mt-4">
          <CardContent className="px-6 h-30 flex flex-col justify-center space-y-5">
            <div className="text-sm text-muted-foreground flex items-center">
              Buy
              {isCalcing && (
                <div className="flex items-center gap-1 ml-2">
                  <Spinner className="size-3 text-primary" />
                  <span className="text-xs text-primary">计算价格中...</span>
                </div>
              )}
            </div>
            <div className="text-4xl font-semibold flex items-center gap-2">
              <Input
                type="number"
                className="h-11"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                disabled={!buyToken.address}
              />
              <Select
                value={buyToken.address}
                onValueChange={handleBuyTokenChange}
              >
                <SelectTrigger className="w-50 h-11!">
                  <SelectValue placeholder="buy token" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectLabel>buy token</SelectLabel>
                    {buyList.map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
      {swapRoute && (
        <Card className="mt-4">
          <CardContent className="px-3 flex flex-col justify-center space-y-1">
            <div className="text-sm text-muted-foreground flex justify-between items-center">
              <div>手续费</div>
              <div>{swapRoute[0].fee / 10000}%</div>
            </div>
            <div className="text-sm text-muted-foreground flex justify-between items-center">
              <div>滑点容忍度</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div>
                    {slippage}%{' '}
                    <span className="cursor-pointer text-primary">设置</span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuRadioGroup
                    value={slippage}
                    onValueChange={setSlippage}
                  >
                    <DropdownMenuRadioItem value="0.1">
                      0.1%
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="0.5">
                      0.5%
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="1">1%</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected ? (
        <Button
          className="w-full mt-2.5 h-13"
          disabled={swapDisabled}
          onClick={handleSwap}
        >
          {swapTip}
        </Button>
      ) : (
        <ConnectButton.Custom>
          {({ openConnectModal }) => {
            return (
              <Button className="w-full h-13 mt-2.5" onClick={openConnectModal}>
                连接钱包
              </Button>
            )
          }}
        </ConnectButton.Custom>
      )}
      {/* <CancelApprove token={sellToken} /> */}
    </div>
  )
}
