import { z } from 'zod'
import { isAddress, getAddress, erc20Abi, PublicClient } from 'viem'

/* ---------------- constants ---------------- */

const MIN_TICK = -887220
const MAX_TICK = 887220

const FEE_TICK_SPACING: Record<string, number> = {
  '500': 10,
  '3000': 60,
  '10000': 200,
}

export const FEE_OPTIONS = [
  { label: '0.05%-稳定', value: '500' },
  { label: '0.3%-标准', value: '3000' },
  { label: '1%-高风险', value: '10000' },
] as const

/* ---------------- ERC20 validator ---------------- */

const erc20AddressSchema = (client: PublicClient) =>
  z.string().superRefine(async (value, ctx) => {
    // 1️⃣ address format
    if (!isAddress(value)) {
      ctx.addIssue({
        code: 'custom',
        message: '不是合法的 EVM 地址',
      })
      return
    }

    const address = getAddress(value)

    // 2️⃣ must be contract
    const code = await client.getBytecode({ address })
    if (!code || code === '0x') {
      ctx.addIssue({
        code: 'custom',
        message: '该地址不是合约（EOA）',
      })
      return
    }

    // 3️⃣ ERC20 core methods
    try {
      const results = await client.multicall({
        contracts: [
          {
            address,
            abi: erc20Abi,
            functionName: 'decimals',
          },
          {
            address,
            abi: erc20Abi,
            functionName: 'totalSupply',
          },
        ],
      })

      const [decimals, totalSupply] = results

      if (decimals.status !== 'success' || totalSupply.status !== 'success') {
        throw new Error('not erc20')
      }

      if (
        typeof decimals.result !== 'number' ||
        decimals.result < 0 ||
        decimals.result > 255
      ) {
        throw new Error('invalid decimals')
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: '该合约不是标准 ERC20',
      })
    }
  })

/* ---------------- main form schema ---------------- */

export const createPoolFormSchema = (client: PublicClient) =>
  z
    .object({
      token0: erc20AddressSchema(client),
      token1: erc20AddressSchema(client),

      fee: z.string().min(1, '请选择手续费'),

      tickLower: z.string().min(1, '请填写tickLower'),

      tickUpper: z.string().min(1, '请填写tickUpper'),

      initTick: z.number(), // 不校验
    })
    .superRefine((data, ctx) => {
      const { token0, token1, fee, tickLower, tickUpper } = data
      const spacing = FEE_TICK_SPACING[fee]
      const lower = Number(tickLower)
      const upper = Number(tickUpper)

      if (token0.toLowerCase() === token1.toLowerCase()) {
        ctx.addIssue({
          path: ['token1'],
          code: 'custom',
          message: `不能填写同一个token地址`,
        })
      }
      if (token1.toLowerCase() < token0.toLowerCase()) {
        ctx.addIssue({
          path: ['token1'],
          code: 'custom',
          message: `token0需小于token1`,
        })
      }

      /* ---- tickLower range ---- */
      if (lower < MIN_TICK || upper >= MAX_TICK) {
        ctx.addIssue({
          path: ['tickLower'],
          code: 'custom',
          message: `tickLower 必须 ≥ ${MIN_TICK} 且 < ${MAX_TICK}`,
        })
      }

      /* ---- tickUpper range ---- */
      if (upper <= MIN_TICK || upper > MAX_TICK) {
        ctx.addIssue({
          path: ['tickUpper'],
          code: 'custom',
          message: `tickUpper 必须 > ${MIN_TICK} 且 ≤ ${MAX_TICK}`,
        })
      }

      /* ---- upper > lower ---- */
      if (upper <= lower) {
        ctx.addIssue({
          path: ['tickUpper'],
          code: 'custom',
          message: 'tickUpper 必须大于 tickLower',
        })
      }

      /* ---- tick spacing ---- */
      if (lower % spacing !== 0) {
        ctx.addIssue({
          path: ['tickLower'],
          code: 'custom',
          message: `tickLower 必须是 ${spacing} 的整数倍`,
        })
      }

      if (upper % spacing !== 0) {
        ctx.addIssue({
          path: ['tickUpper'],
          code: 'custom',
          message: `tickUpper 必须是 ${spacing} 的整数倍`,
        })
      }
    })
