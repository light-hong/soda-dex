'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'
import { CreatePoolDialog } from './createPoolDialog'
import { Pool, usePools } from '@/hooks/usePools'
export default function Poools() {

  const { poolList, isLoading } = usePools()

  const tableColumns: ColumnDef<Pool>[] = [
    {
      accessorKey: 'index',
      header: '#',
      cell: ({ row }) => {
        return <span className="text-center">{row.index + 1}</span>
      },
    },
    {
      header: 'Pool',
      accessorKey: 'tokenPair',
    },
    {
      accessorKey: 'liquidityStr',
      header: 'Liquidity',
    },
    {
      accessorKey: 'feeStr',
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
  ]

  return (
    <div className="min-h-screen p-8 flex flex-col items-center space-y-5">
      <div className="w-[75vw] flex items-center justify-between">
        <h1 className="text-4xl font-bold text-center">Pools</h1>
        <CreatePoolDialog />
      </div>
      <DataTable
        isLoading={isLoading}
        columns={tableColumns}
        data={poolList}
        showPagination={false}
        className="w-[75vw]"
      />
    </div>
  )
}
