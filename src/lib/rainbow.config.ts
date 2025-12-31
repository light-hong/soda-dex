'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia } from 'wagmi/chains'

const config = getDefaultConfig({
  appName: 'soda-dex',
  projectId: process.env.NEXT_PUBLIC_DEX_PROJECT_ID!,
  chains: [mainnet, sepolia],
  ssr: true, // If your dApp uses server side rendering (SSR)
})

export default config
