'use client'

import { useFormatPools } from '@/hooks/useFormatPools'
import { contractConfig } from '@/lib/contracts'
import { useAccount, useReadContract } from 'wagmi'
import { useEffect, useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'
import { FormattedPool } from '@/lib/getErc20Meta'
import { CreatePoolDialog } from './createPoolDialog'

export default function Poools() {
  const { isConnected } = useAccount()

  const {
    data: pools,
    refetch,
  } = useReadContract({
    abi: contractConfig.poolManager.abi,
    address: contractConfig.poolManager.address,
    functionName: 'getAllPools',
    query: {
      enabled: isConnected,
    },
  })
  const { poolList } = useFormatPools(pools ? [...pools] : [])

  const tableColumns: ColumnDef<FormattedPool>[] = useMemo(
    () => [
      {
        accessorKey: 'index',
        header: '#',
        cell: ({ row }) => {
          return <span className="text-center">{row.index + 1}</span>
        },
      },
      {
        header: 'Pool',
        id: 'pool',
        cell: ({ row }) => {
          const pool = row.original
          const token0 = pool.token0
          const token1 = pool.token1
          return (
            <div className="flex items-center">
              <span className="mr-1">{token0?.symbol}</span>/
              <span className="ml-1">{token1?.symbol}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'liquidity',
        header: 'Liquidity',
      },
      {
        accessorKey: 'fee',
        header: 'Fee Tier',
      },
      {
        accessorKey: 'priceRange',
        header: 'Price Range',
      },
      {
        accessorKey: 'currentPrice',
        header: 'Current Price',
      },
      {
        accessorKey: 'tick',
        header: 'Tick',
      },
    ],
    [poolList],
  )

  const closeCallback = () => {
    refetch()
  }

  useEffect(() => {
    const interval = setInterval(() => {
      refetch()
    }, 180000)
    return () => clearInterval(interval)
  }, [refetch])
  return (
    <div className="min-h-screen p-8 flex flex-col items-center space-y-5">
      <div className="w-[75vw] flex items-center justify-between">
        <h1 className="text-4xl font-bold text-center">Pools</h1>
        <CreatePoolDialog closeCallback={closeCallback} />
      </div>
      <DataTable
        columns={tableColumns}
        data={poolList ? [...poolList] : []}
        showPagination={false}
        className="w-[75vw]"
      />
    </div>
  )
}
