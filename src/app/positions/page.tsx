'use client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useUserPositions } from '@/hooks/useUserPositions'
import { formatNumber } from '@/lib/utils'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, Bitcoin } from 'lucide-react'
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { CreatePositionDialog } from './createPositionDialog'
import { contractConfig } from '@/lib/contracts'
import { useEffect } from 'react'

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`
  }
  return `$${value.toFixed(2)}`
}

export default function Positions() {
  const { address, isConnected } = useAccount()
  const { positions, isPositionsLoading, totalInfo, refetchPositions } =
    useUserPositions()
  console.log('🚀 ~ Positions ~ positions:', positions)
  const {
    writeContract: writeBurnContract,
    data: burnHash,
    isSuccess: burnSuccess,
    isPending: burnPending,
  } = useWriteContract()
  const { isLoading: burnConfirming } = useWaitForTransactionReceipt({
    hash: burnHash,
    query: {
      enabled: burnSuccess && !!burnHash,
    },
  })
  const {
    writeContract: writeCollectContract,
    data: collectHash,
    isSuccess: collectSuccess,
    isPending: collectPending,
  } = useWriteContract()
  const { isLoading: collectConfirming } = useWaitForTransactionReceipt({
    hash: collectHash,
    query: {
      enabled: collectSuccess && !!collectHash,
    },
  })
  const handleBurn = (positionId: bigint) => {
    writeBurnContract(
      {
        ...contractConfig.positionManager,
        functionName: 'burn',
        args: [positionId],
      },
      {
        onSuccess: () => {
          refetchPositions()
        },
      },
    )
  }
  const handleCollect = (positionId: bigint) => {
    writeCollectContract(
      {
        ...contractConfig.positionManager,
        functionName: 'collect',
        args: [positionId, address as `0x${string}`],
      },
      {
        onSuccess: () => {
          refetchPositions()
        },
      },
    )
  }
  useEffect(() => {
    const interval = setInterval(() => {
      refetchPositions()
    }, 20000)
    return () => clearInterval(interval)
  }, [refetchPositions])

  if (!isConnected) {
    return <ConnectCard />
  }
  return (
    <div className="p-8 flex flex-col items-center space-y-5">
      <div className="w-[75vw] p-8">
        <div className="flex justify-between">
          <h2 className="mb-6 text-xl font-semibold">Your positions</h2>
          <CreatePositionDialog />
        </div>
        {isPositionsLoading ? (
          <PositionsLoading />
        ) : positions.length ? (
          <div className="grid grid-rows-[100px_auto] grid-cols-3 gap-4">
            <Card>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {totalInfo.activePositions}
                </div>
                <div className="text-xs text-gray-500">活跃头寸</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {formatCurrency(totalInfo.totalValue)}
                </div>
                <div className="text-xs text-gray-500">总流动性</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {formatCurrency(totalInfo.totalRewardsStr)}
                </div>
                <div className="text-xs text-gray-500">未领取费用</div>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              {positions.map((position, index) => (
                <div key={position.id}>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      {/* Token 图标 */}
                      <div className="flex -space-x-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-blue-500 text-white font-semibold">
                          {position.token0Symbol.charAt(0).toUpperCase()}
                          {/* M */}
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-green-500 to-teal-500 text-white font-semibold">
                          {position.token1Symbol.charAt(0).toUpperCase()}
                          {/* M */}
                        </div>
                      </div>

                      <div>
                        <div className="text-lg font-semibold">
                          {position.tokenPair}
                          {/* MNTB/MNTC */}
                        </div>
                        <div className="text-sm text-gray-500">
                          费率: {position.feeStr} | ID: #{position.id}
                          {/* 费率: 0.30% | ID: #73 */}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-10 mb-5">
                      <InfoItem label="价格范围">
                        <div className="text-base font-medium">
                          {/* 0.9940 - 1.0060 */}
                          {position.priceRange}
                        </div>
                      </InfoItem>

                      <InfoItem label="流动性">
                        <div className="text-base font-medium">
                          {/* $333.85K */}
                          {position.liquidityStr}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatNumber(
                            parseFloat(
                              position.liquidityStr.replace(/[$,K]/g, ''),
                            ),
                          )}{' '}
                          LP
                        </div>
                      </InfoItem>

                      <InfoItem label="未领取费用">
                        <div className="text-base font-medium text-green-600">
                          {/* $0.00 */}
                          {position.totalRewardsStr}
                        </div>
                        <div className="text-sm text-gray-500">
                          {/* 0.0000 MNB + 0.0000 MNC */}
                          {position.tokensOwed0Str} {position.token0Symbol}+{' '}
                          {position.tokensOwed1Str} {position.token1Symbol}
                        </div>
                      </InfoItem>

                      <InfoItem label="Tick 范围">
                        <div className="text-base font-medium">
                          {/* -60 - 60 */}
                          {position.tickLower} - {position.tickUpper}
                        </div>
                      </InfoItem>
                      {/* 操作按钮 */}
                      <div className="flex flex-col gap-3">
                        <Button
                          disabled={
                            (position.tokensOwed0 === 0n &&
                              position.tokensOwed1 === 0n) ||
                            collectPending ||
                            collectConfirming
                          }
                          onClick={() => handleCollect(position.id)}
                        >
                          {collectPending
                            ? '正在领取中'
                            : collectConfirming
                            ? '领取确认中'
                            : '领取费用'}
                        </Button>
                        <Button
                          disabled={
                            position.liquidity === 0n ||
                            burnPending ||
                            burnConfirming
                          }
                          onClick={() => handleBurn(position.id)}
                          variant="destructive"
                        >
                          {burnPending
                            ? '正在处理中'
                            : burnConfirming
                            ? '正在确认中'
                            : '移除流动性'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  {positions.length !== index + 1 && (
                    <div className="flex justify-center">
                      <Separator className="w-[95%]!" />
                    </div>
                  )}
                </div>
              ))}
              {/* <TestData /> */}
            </Card>
          </div>
        ) : (
          <NoPositionsCard />
        )}
      </div>
    </div>
  )
}

const ConnectCard = () => {
  return (
    <div className="p-8 flex flex-col items-center space-y-5">
      <div className="w-[75vw] p-8">
        <h2 className="mb-6 text-xl font-semibold">Your positions</h2>
        <Card className="flex min-h-70 flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <Wallet className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-lg font-medium">Connect your wallet</h3>
          <p className="mb-6 max-w-sm text-sm">
            To view your positions and rewards you must connect your wallet.
          </p>
          <ConnectButton.Custom>
            {({ openConnectModal }) => {
              return <Button onClick={openConnectModal}>连接钱包</Button>
            }}
          </ConnectButton.Custom>
        </Card>
      </div>
    </div>
  )
}
const NoPositionsCard = () => {
  return (
    <Card className="flex min-h-70 flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
        <Bitcoin className="h-6 w-6" />
      </div>
      <h3 className="mb-2 text-lg font-medium">Create your positions</h3>
      <p className="mb-6 max-w-sm text-sm">
        To create your positions and get rewards.
      </p>
      <Button>Create Position</Button>
    </Card>
  )
}

const PositionsLoading = () => {
  return (
    <Card className="flex min-h-70 flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
        <Bitcoin className="h-6 w-6 animate-spin" />
      </div>
      <Spinner />
      <h3 className="mb-1 text-lg font-medium">Loading...</h3>
    </Card>
  )
}

function InfoItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 text-sm text-gray-500">{label}</div>
      {children}
    </div>
  )
}

function TestData() {
  return (
    <div>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          {/* Token 图标 */}
          <div className="flex -space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-blue-500 text-white font-semibold">
              M
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-green-500 to-teal-500 text-white font-semibold">
              M
            </div>
          </div>

          <div>
            <div className="text-lg font-semibold">MNTC/MNTD</div>
            <div className="text-sm text-gray-500">费率: 0.30% | ID: #73</div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-10">
          <InfoItem label="价格范围">
            <div className="text-base font-medium">0.9940 - 1.0060</div>
          </InfoItem>

          <InfoItem label="流动性">
            <div className="text-base font-medium">$333.85K</div>
            <div className="text-sm text-gray-500">3399.09 LP</div>
          </InfoItem>

          <InfoItem label="未领取费用">
            <div className="text-base font-medium text-green-600">$0.00</div>
            <div className="text-sm text-gray-500">0.0000 MNB + 0.0000 MNC</div>
          </InfoItem>

          <InfoItem label="Tick 范围">
            <div className="text-base font-medium">-60 - 60</div>
          </InfoItem>
          {/* 操作按钮 */}
          <div className="flex flex-col gap-3">
            <Button>领取费用</Button>
            <Button variant="destructive">移除流动性</Button>
          </div>
        </div>
      </CardContent>
    </div>
  )
}
