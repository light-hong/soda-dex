import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { createPoolFormSchema, FEE_OPTIONS } from './poolSchema'
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { TickMath, tickToPrice } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'
import { useTokenInfo } from '@/hooks/useTokenInfo'
import { Spinner } from '@/components/ui/spinner'
import { contractConfig } from '@/lib/contracts'

type CreatePoolFormProps = {
  onClose?: () => void
}

type CreatePoolDialogProps = {
  closeCallback?: () => void
}

function CreatePoolForm({ onClose }: CreatePoolFormProps) {
  const client = usePublicClient()
  const chainId = useChainId()
  const poolSchema = createPoolFormSchema(client!)
  const {
    writeContract,
    isPending,
    data: hash,
    error: writeError,
  } = useWriteContract()

  const {
    data,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash,
  })
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof poolSchema>>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      token0: '',
      token1: '',
      fee: '3000',
      tickLower: '',
      tickUpper: '',
      initTick: 0, // 计算sqrtPriceX96
    },
    mode: 'onBlur',
  })
  useEffect(() => {
    if (isConfirming) {
      toast.loading('Processing...', {
        position: 'bottom-right',
        id: 'create-pool-toast',
      })
      return
    }
    if (isConfirmed) {
      toast.success(
        <div>
          交易哈希:
          <a
            href={`https://sepolia.etherscan.io/tx/${data.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {`${data.transactionHash.slice(
              0,
              10,
            )}...${data.transactionHash.slice(-10)}`}
          </a>
        </div>,
        {
          position: 'bottom-right',
          id: 'create-pool-toast',
          duration: 7000,
        },
      )
      onClose?.()
      return
    }
  }, [isConfirmed, data, isConfirming])

  const token0Value = useWatch({ control, name: 'token0' })
  const token1Value = useWatch({ control, name: 'token1' })
  const lowerValue = useWatch({ control, name: 'tickLower' })
  const upperValue = useWatch({ control, name: 'tickUpper' })
  const initValue = useWatch({ control, name: 'initTick' })
  const token0HasError = !!errors.token0
  const token1HasError = !!errors.token1
  const lowerHasError = !!errors.tickLower
  const upperHasError = !!errors.tickUpper
  const isTickSetDisabled =
    !token0Value &&
    !token1Value &&
    token0HasError &&
    token1HasError &&
    !lowerValue &&
    !upperValue &&
    lowerHasError &&
    upperHasError

  const { tokenMap, isSuccess: tokenInfoSuccess } = useTokenInfo({
    tokens: [token0Value as `0x${string}`, token1Value as `0x${string}`],
    query: {
      enabled: !!(
        token0Value &&
        token1Value &&
        !token0HasError &&
        !token1HasError
      ),
    },
  })

  const calcPrice = useCallback(
    (tick: number) => {
      if (isTickSetDisabled || !tokenInfoSuccess) {
        return '0'
      }
      const token0 = new Token(
        chainId,
        token0Value,
        tokenMap.get(token0Value)?.decimals ?? 18,
        tokenMap.get(token0Value)?.symbol,
      )
      const token1 = new Token(
        chainId,
        token1Value,
        tokenMap.get(token1Value)?.decimals ?? 18,
        tokenMap.get(token1Value)?.symbol,
      )
      const res = tickToPrice(token0, token1, tick).toFixed(6)
      return res
    },
    [
      chainId,
      isTickSetDisabled,
      token0Value,
      token1Value,
      tokenInfoSuccess,
      tokenMap,
    ],
  )

  const priceInfo = useMemo(() => {
    if (!isTickSetDisabled) {
      return {
        min: calcPrice(Number(lowerValue)),
        max: calcPrice(Number(upperValue)),
        init: calcPrice(Number(initValue)),
      }
    }
  }, [calcPrice, initValue, isTickSetDisabled, lowerValue, upperValue])

  const calcSqrtPriceX96 = (tick: number): bigint => {
    const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick)
    return BigInt(sqrtPriceX96.toString())
  }

  const onSubmit = async (data: z.infer<typeof poolSchema>) => {
    console.log('🚀 ~ onSubmit ~ data:', data)
    const sqrtPriceX96 = calcSqrtPriceX96(data.initTick)
    try {
      writeContract({
        ...contractConfig.poolManager,
        functionName: 'createAndInitializePoolIfNecessary',
        args: [
          {
            token0: data.token0 as `0x${string}`,
            token1: data.token1 as `0x${string}`,
            fee: Number(data.fee),
            tickLower: Number(data.tickLower),
            tickUpper: Number(data.tickUpper),
            sqrtPriceX96: sqrtPriceX96,
          },
        ],
      })
    } catch (error) {
      console.log('🚀 ~ onSubmit ~ error:', error)
      toast.error('Create Pool Failed')
    }
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Create New Pool</DialogTitle>
        <DialogDescription></DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[70vh]">
        <form
          id="form-rhf-pool"
          className="pr-5"
          onSubmit={handleSubmit(onSubmit)}
        >
          <FieldGroup>
            <Controller
              name="token0"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <Field
                    data-invalid={fieldState.invalid}
                    orientation="horizontal"
                  >
                    <FieldLabel htmlFor="form-rhf-pool-token0" className="w-25">
                      Token0
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-rhf-pool-token0"
                      aria-invalid={fieldState.invalid}
                      placeholder="0x..."
                      autoComplete="off"
                    />
                  </Field>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </>
              )}
            />
            <Controller
              name="token1"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <Field
                    data-invalid={fieldState.invalid}
                    orientation="horizontal"
                  >
                    <FieldLabel htmlFor="form-rhf-pool-token1" className="w-25">
                      Token1
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-rhf-pool-token1"
                      aria-invalid={fieldState.invalid}
                      placeholder="0x..."
                      autoComplete="off"
                    />
                  </Field>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </>
              )}
            />
            <Controller
              name="fee"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <Field
                    orientation="horizontal"
                    data-invalid={fieldState.invalid}
                  >
                    <FieldLabel htmlFor="form-rhf-pool-fee" className="w-25">
                      Fee Tier
                    </FieldLabel>
                    <Select
                      name={field.name}
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        className="w-full"
                        id="form-rhf-pool-fee"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {FEE_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </>
              )}
            />
            <Controller
              name="tickLower"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <Field
                    data-invalid={fieldState.invalid}
                    orientation="horizontal"
                  >
                    <FieldLabel
                      htmlFor="form-rhf-pool-tickLower"
                      className="w-25"
                    >
                      Tick Lower
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-rhf-pool-tickLower"
                      aria-invalid={fieldState.invalid}
                      type="number"
                      autoComplete="off"
                    />
                  </Field>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </>
              )}
            />
            <Controller
              name="tickUpper"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <Field
                    data-invalid={fieldState.invalid}
                    orientation="horizontal"
                  >
                    <FieldLabel
                      htmlFor="form-rhf-pool-tickUpper"
                      className="w-25"
                    >
                      Tick Upper
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-rhf-pool-tickUpper"
                      aria-invalid={fieldState.invalid}
                      type="number"
                      autoComplete="off"
                    />
                  </Field>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </>
              )}
            />
            <Controller
              name="initTick"
              control={control}
              render={({ field, fieldState }) => {
                const min = Number(getValues('tickLower'))
                const max = Number(getValues('tickUpper'))
                return (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      htmlFor="form-rhf-pool-initTick"
                      className="w-25"
                    >
                      Init Tick
                    </FieldLabel>
                    <FieldContent className="p-2.5">
                      <Slider
                        id="form-rhf-pool-initTick"
                        onValueChange={(value) => {
                          field.onChange(value[0])
                        }}
                        value={[Number(field.value)]}
                        aria-invalid={fieldState.invalid}
                        defaultValue={[min]}
                        max={max}
                        min={min}
                        step={1}
                        disabled={isTickSetDisabled}
                        className="cursor-pointer data-disabled:cursor-not-allowed"
                      />
                      <div className="mt-1.5 flex justify-between text-gray-400 text-xs">
                        <div className="space-y-0.5">
                          <div>Min {min}</div>
                          <div>Price {priceInfo?.min}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div>Select {field.value || '0'}</div>
                          <div>Price {priceInfo?.init}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div>Max {max}</div>
                          <div>Price {priceInfo?.max}</div>
                        </div>
                      </div>
                    </FieldContent>
                  </Field>
                )
              }}
            />
          </FieldGroup>
        </form>
      </ScrollArea>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          form="form-rhf-pool"
          disabled={isPending || isConfirming}
        >
          {isPending && isConfirming && <Spinner />}
          Submit
        </Button>
      </DialogFooter>
    </>
  )
}

export function CreatePoolDialog({ closeCallback }: CreatePoolDialogProps) {
  const { isConnected } = useAccount()
  const [open, setOpen] = useState(false)
  const onClose = () => {
    closeCallback?.()
    setOpen(false)
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!isConnected}>Create Pool</Button>
      </DialogTrigger>
      {open && (
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="sm:max-w-120"
        >
          <CreatePoolForm onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  )
}
