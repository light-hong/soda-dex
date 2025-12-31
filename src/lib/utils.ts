import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import BigNumber from 'bignumber.js'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化数字
export function formatNumber(num: number): string {
  if (num === 0) return '0'
  if (num < 0.001) return '<0.001'
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
  return num.toFixed(3).replace(/\.?0+$/, '')
}

// 格式化代币数量
export function formatTokenAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (num === 0) return '0'
  if (num < 0.001) return '<0.001'
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
  return num.toFixed(6).replace(/\.?0+$/, '')
}

// 格式化价格
export function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (num === 0) return '0'
  if (num < 0.0001) return '<0.0001'
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
  return num.toFixed(6).replace(/\.?0+$/, '')
}

// 缩短地址显示
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

// 计算滑点后的最小接收量
export function calculateMinReceived(amount: string, slippage: number): string {
  const num = parseFloat(amount)
  const minReceived = num * (1 - slippage / 100)
  return minReceived.toString()
}

// 解析输入数量
export function parseInputAmount(input: string): string {
  // 移除非数字字符（除了小数点）
  const cleaned = input.replace(/[^0-9.]/g, '')

  // 确保只有一个小数点
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('')
  }

  return cleaned
}

export const getDeadline = (minutes = 20) =>
  BigInt(Math.floor(Date.now() / 1000) + minutes * 60)


export interface FormatBigNumberOptions {
  decimals?: number // 保留小数位
  thousandSeparator?: boolean // 是否加逗号
  compact?: boolean // 是否缩写（K/M/B/...）
  scientific?: boolean // 是否使用科学计数法
  scientificThreshold?: string // 超过该值自动 e+
}

export function formatBigNumber(
  value: BigNumber.Value,
  options: FormatBigNumberOptions = {},
): string {
  const {
    decimals = 4,
    thousandSeparator = false,
    compact = true,
    scientific = false,
    scientificThreshold = '1e15',
  } = options

  const num = new BigNumber(value)
  if (!num.isFinite()) return '0'

  const abs = num.absoluteValue()

  // ===== 科学计数法（优先级最高）=====
  if (scientific || abs.gte(scientificThreshold)) {
    return num.toExponential(decimals)
  }

  // ===== 缩写规则 =====
  if (compact) {
    if (abs.gte('1e18')) return num.div('1e18').toFixed(decimals) + 'E'
    if (abs.gte('1e15')) return num.div('1e15').toFixed(decimals) + 'P'
    if (abs.gte('1e12')) return num.div('1e12').toFixed(decimals) + 'T'
    if (abs.gte('1e9')) return num.div('1e9').toFixed(decimals) + 'B'
    if (abs.gte('1e6')) return num.div('1e6').toFixed(decimals) + 'M'
    if (abs.gte('1e3')) return num.div('1e3').toFixed(decimals) + 'K'
  }

  // ===== 普通格式 =====
  return thousandSeparator ? num.toFormat(decimals) : num.toFixed(decimals)
}

