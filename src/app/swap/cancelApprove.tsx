'use client'

import { Button } from '@/components/ui/button'
import { erc20Abi } from 'viem'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { contractConfig } from '@/lib/contracts'
import { Spinner } from '@/components/ui/spinner'

type TokenMeta = {
  address?: `0x${string}`
  symbol: string
  decimals: number
}
type CancelApproveProps = {
  token: TokenMeta
}
export default function CancelApprove({ token }: CancelApproveProps) {
  const {
    writeContract,
    data: approveHash,
    isSuccess: approveSuccess,
    isPending: approvePending,
  } = useWriteContract()
  const {
    isLoading: approveConfirming,
    isSuccess: approveConfirmed,
    data: approveData,
  } = useWaitForTransactionReceipt({
    hash: approveHash,
    query: {
      enabled: approveSuccess && !!approveHash,
    },
  })
  const handleCancelApprove = () => {
    writeContract({
      address: token.address!,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contractConfig.swapRouter.address, BigInt(0n)],
    })
  }

  return (
    <div className="mt-3">
      <Button
        className="w-full h-13 mt-2.5 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        onClick={handleCancelApprove}
        disabled={approvePending || approveConfirming}
      >
        {(approvePending || approveConfirming) && <Spinner />}
        {approvePending
          ? '正在提交...'
          : approveConfirming
          ? '确认中...'
          : '取消授权'}
      </Button>
      {approveConfirmed && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            取消授权成功！交易哈希:
          </div>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 break-all font-mono">
            {approveData?.transactionHash}
          </div>
        </div>
      )}
    </div>
  )
}
