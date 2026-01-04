import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { createPositionFormSchema } from './positionSchema'
import {
  useAccount,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEffect, useMemo, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { contractConfig } from '@/lib/contracts'
import { usePools } from '@/hooks/usePools'
import { erc20Abi, formatUnits, parseUnits } from 'viem'
import { getDeadline } from '@/lib/utils'

type CreatePositionFormProps = {
  onClose?: () => void
}

type MintParams = {
  token0: `0x${string}`
  token1: `0x${string}`
  index: number
  recipient: `0x${string}`
  deadline: bigint
  amount0Desired: bigint
  amount1Desired: bigint
}
const defaultParams: MintParams = {
  token0: '' as `0x${string}`,
  token1: '' as `0x${string}`,
  index: 0,
  recipient: '' as `0x${string}`,
  deadline: BigInt(0),
  amount0Desired: BigInt(0),
  amount1Desired: BigInt(0),
}
function CreatePositionForm({ onClose }: CreatePositionFormProps) {
  const { address } = useAccount()
  const positionSchema = createPositionFormSchema()
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof positionSchema>>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      pairId: '',
      token0: '',
      token1: '',
      index: '',
      amount0Desired: '',
      amount1Desired: '',
    },
    mode: 'onChange',
  })
  const token0Value = useWatch({ control, name: 'token0' })
  const token1Value = useWatch({ control, name: 'token1' })
  const { pairOptions, poolOptions, tokenMap } = usePools(
    token0Value as `0x${string}`,
    token1Value as `0x${string}`,
  )
  const [mintParams, setMintParams] = useState<MintParams>(defaultParams)
  const {
    data: t0Data,
    isLoading: t0Loading,
    isSuccess: t0Success,
    refetch: refetchT0Data,
  } = useReadContracts({
    contracts: [
      {
        address: token0Value as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      },
      {
        address: token0Value as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      },
    ],
    query: {
      enabled: !!token0Value,
    },
  })
  const t0Balance = useMemo(() => {
    if (t0Success && t0Data) {
      const decimals = t0Data[0].result as number
      const balance = t0Data[1].result as bigint
      const value = formatUnits(balance, decimals)
      return value === '0' ? 0 : Number(value).toFixed(4)
    }
    return '0'
  }, [t0Data, t0Success])
  const {
    data: t1Data,
    isLoading: t1Loading,
    isSuccess: t1Success,
    refetch: refetchT1Data,
  } = useReadContracts({
    contracts: [
      {
        address: token1Value as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      },
      {
        address: token1Value as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      },
    ],
    query: {
      enabled: !!token1Value,
    },
  })
  const t1Balance = useMemo(() => {
    if (t1Success && t1Data) {
      const decimals = t1Data[0].result as number
      const balance = t1Data[1].result as bigint
      const value = formatUnits(balance, decimals)
      return value === '0' ? 0 : Number(value).toFixed(4)
    }
    return '0'
  }, [t1Data, t1Success])
  const {
    writeContract: writeApproveToken0,
    data: t0Hash,
    isSuccess: approveT0Success,
    isPending: approveT0Pending,
  } = useWriteContract()
  const { isLoading: approveT0Confirming, isSuccess: approveT0Confirmed } =
    useWaitForTransactionReceipt({
      hash: t0Hash,
      query: {
        enabled: approveT0Success && !!t0Hash,
      },
    })
  const {
    writeContract: writeApproveToken1,
    data: t1Hash,
    isSuccess: approveT1Success,
    isPending: approveT1Pending,
  } = useWriteContract()
  const { isLoading: approveT1Confirming, isSuccess: approveT1Confirmed } =
    useWaitForTransactionReceipt({
      hash: t1Hash,
      query: {
        enabled: approveT1Success && !!t1Hash,
      },
    })

  const {
    writeContract: writePositionContract,
    data: positionHash,
    isSuccess: positionSuccess,
    isPending: positionPending,
  } = useWriteContract()
  const {
    isLoading: positionConfirming,
    isError,
    isSuccess: positionConfirmed,
    data: positionData,
  } = useWaitForTransactionReceipt({
    hash: positionHash,
    query: {
      enabled: positionSuccess && !!positionHash,
    },
  })

  useEffect(() => {
    if (positionConfirming) {
      toast.loading('Processing...', {
        position: 'bottom-right',
        id: 'create-position-toast',
      })
      return
    }
    if (positionConfirmed) {
      toast.success(
        <div>
          交易哈希:
          <a
            href={`https://sepolia.etherscan.io/tx/${positionData.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {`${positionData.transactionHash.slice(
              0,
              10,
            )}...${positionData.transactionHash.slice(-10)}`}
          </a>
        </div>,
        {
          position: 'bottom-right',
          id: 'create-position-toast',
          duration: 7000,
        },
      )
      onClose?.()
      return
    }
  }, [positionConfirmed, positionConfirming, positionData])
  useEffect(() => {
    const handleMint = () => {
      writePositionContract({
        ...contractConfig.positionManager,
        functionName: 'mint',
        args: [mintParams],
      })
    }
    const { amount0Desired, amount1Desired } = mintParams
    if (
      amount0Desired &&
      amount1Desired &&
      amount0Desired !== 0n &&
      amount1Desired !== 0n
    ) {
      if (approveT0Confirmed && approveT1Confirmed) {
        handleMint()
      }
    }
    if (
      amount0Desired &&
      amount0Desired !== 0n &&
      (!amount1Desired || amount1Desired === 0n)
    ) {
      if (approveT0Confirmed) {
        handleMint()
      }
    }
    if (
      amount1Desired &&
      amount1Desired !== 0n &&
      (!amount0Desired || amount0Desired === 0n)
    ) {
      if (approveT1Confirmed) {
        handleMint()
      }
    }
  }, [approveT0Confirmed, mintParams, approveT1Confirmed])

  const processing = useMemo(() => {
    const { amount0Desired, amount1Desired } = mintParams
    if (
      amount0Desired &&
      amount1Desired &&
      amount0Desired !== 0n &&
      amount1Desired !== 0n
    ) {
      return (
        approveT0Pending ||
        approveT1Pending ||
        approveT0Confirming ||
        approveT1Confirming ||
        positionPending ||
        positionConfirming
      )
    }
    if (
      amount0Desired &&
      amount0Desired !== 0n &&
      (!amount1Desired || amount1Desired === 0n)
    ) {
      return (
        approveT0Pending ||
        approveT0Confirming ||
        positionPending ||
        positionConfirming
      )
    }
    if (
      amount1Desired &&
      amount1Desired !== 0n &&
      (!amount0Desired || amount0Desired === 0n)
    ) {
      return (
        approveT1Pending ||
        approveT1Confirming ||
        positionPending ||
        positionConfirming
      )
    }
    return false
  }, [
    approveT0Confirming,
    approveT0Pending,
    approveT1Confirming,
    approveT1Pending,
    mintParams,
    positionConfirming,
    positionPending,
  ])

  const onSubmit = async (data: z.infer<typeof positionSchema>) => {
    const t0 = tokenMap.get(data.token0 as `0x${string}`)
    const t1 = tokenMap.get(data.token1 as `0x${string}`)
    const amount0Desired = parseUnits(data.amount0Desired!, t0!.decimals)
    const maxT0 = parseUnits(data.amount0Desired! + 20, t0!.decimals)
    const amount1Desired = parseUnits(data.amount1Desired!, t1!.decimals)
    const maxT1 = parseUnits(data.amount1Desired! + 20, t1!.decimals)

    const params = {
      token0: data.token0 as `0x${string}`,
      token1: data.token1 as `0x${string}`,
      index: Number(data.index),
      recipient: address as `0x${string}`,
      deadline: getDeadline(),
      amount0Desired,
      amount1Desired,
    }
    setMintParams(params)
    if (params.amount0Desired && params.amount0Desired !== 0n) {
      await writeApproveToken0({
        address: params.token0! as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractConfig.positionManager.address, BigInt(maxT0)],
      })
    }
    if (params.amount1Desired && params.amount1Desired !== 0n) {
      await writeApproveToken1({
        address: params.token1! as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractConfig.positionManager.address, BigInt(maxT1)],
      })
    }
    console.log('🚀 ~ onSubmit ~ params:', params)
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Create New Position</DialogTitle>
      </DialogHeader>
      <form id="form-rhf-position" onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Controller
            name="pairId"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="form-rhf-position-pairId">
                  交易对
                </FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={(pairId) => {
                    field.onChange(pairId)

                    const pair = pairOptions.find((p) => p.uuid === pairId)
                    if (!pair) return

                    setValue('token0', pair.token0, { shouldValidate: true })
                    setValue('token1', pair.token1, { shouldValidate: true })
                    setValue('index', '', { shouldValidate: false })
                  }}
                >
                  <SelectTrigger
                    id="form-rhf-position-pairId"
                    aria-invalid={fieldState.invalid}
                    className="h-12!"
                  >
                    <SelectValue placeholder="选择交易对" />
                  </SelectTrigger>

                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectLabel>select pair</SelectLabel>
                      {pairOptions.map((pair) => (
                        <SelectItem key={pair.uuid} value={pair.uuid}>
                          {pair.pair}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="index"
            control={control}
            render={({ field, fieldState }) => {
              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-position-index">
                    交易池
                  </FieldLabel>
                  <Select
                    name={field.name}
                    onValueChange={(poolId) => {
                      // field.onChange(pairId)

                      const pool = poolOptions.find((p) => p.uuid === poolId)
                      if (!pool) return
                      setValue('index', `${pool.index}`)
                    }}
                  >
                    <SelectTrigger
                      id="form-rhf-position-index"
                      aria-invalid={fieldState.invalid}
                      className="h-12!"
                    >
                      <SelectValue
                        placeholder={
                          poolOptions.length ? '选择交易池' : '该交易对暂无数据'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {poolOptions.map((pool) => (
                        <SelectItem key={pool.uuid} value={`${pool.uuid}`}>
                          <span>
                            Fee: {pool.feeStr} | Price Range: {pool.priceRange}{' '}
                            | Current Price: {pool.currentPrice}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )
            }}
          />
          <Controller
            name="amount0Desired"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="form-rhf-position-amount0Desired">
                  <div className="flex items-center">
                    Token0数量( {t0Loading ? <Spinner /> : t0Balance} )
                  </div>
                </FieldLabel>
                <Input
                  {...field}
                  id="form-rhf-position-amount0Desired"
                  aria-invalid={fieldState.invalid}
                  type="number"
                  autoComplete="off"
                  className="h-12"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="amount1Desired"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="form-rhf-position-amount1Desired">
                  <div className="flex items-center">
                    Token1数量( {t1Loading ? <Spinner /> : t1Balance} )
                  </div>
                </FieldLabel>
                <Input
                  {...field}
                  id="form-rhf-position-amount1Desired"
                  aria-invalid={fieldState.invalid}
                  type="number"
                  autoComplete="off"
                  className="h-12"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
      {isError && (
        <div className="w-full flex items-center justify-center">
          <div className="w-full flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <span className="text-base">❌</span>
            <span>创建失败了，请稍候再试</span>
          </div>
        </div>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={processing} type="submit" form="form-rhf-position">
          {processing ? (
            <div className="inline-flex gap-1 items-center">
              <Spinner />
              Processing...
            </div>
          ) : (
            'Submit'
          )}
        </Button>
      </DialogFooter>
    </>
  )
}

type CreatePositionDialogProps = {
  callBack?: () => void
}
export function CreatePositionDialog({ callBack }: CreatePositionDialogProps) {
  const { isConnected } = useAccount()
  const [open, setOpen] = useState(false)
  const onClose = () => {
    callBack?.()
    setOpen(false)
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!isConnected}>Create Position</Button>
      </DialogTrigger>
      {open && (
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="sm:max-w-120"
        >
          <CreatePositionForm onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  )
}
