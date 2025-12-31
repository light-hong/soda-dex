import { z } from 'zod'

const amountSchema = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (!v) return true
      const n = Number(v)
      return !Number.isNaN(n) && n >= 0
    },
    { message: '请输入合法数量' },
  )

export const createPositionFormSchema = () =>
  z
    .object({
      pairId: z.string().min(1, '请选择交易对'),
      token0: z.string(),
      token1: z.string(),
      index: z.string().min(1, '请选择池子'),
      amount0Desired: amountSchema,
      amount1Desired: amountSchema,
    })
    .superRefine((data, ctx) => {
      const a0 = Number(data.amount0Desired || 0)
      const a1 = Number(data.amount1Desired || 0)

      if (a0 <= 0 && a1 <= 0) {
        ctx.addIssue({
          path: ['amount0Desired'],
          code: 'custom',
          message: '至少需要输入一个 Token 数量',
        })
        ctx.addIssue({
          path: ['amount1Desired'],
          code: 'custom',
          message: '至少需要输入一个 Token 数量',
        })
      }
    })
