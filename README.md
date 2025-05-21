<div align="center">

[![license](https://img.shields.io/badge/license-Apache%202-blue)](/LICENSE.md)  
[![Follow on Twitter](https://img.shields.io/twitter/follow/frostprotocol.svg?label=follow+FROST)](https://twitter.com/FrostDeFAI)

</div>

<h1 align="center">Frost Solana SDK</h1>

[**Frost Solana SDK**](https://www.frostdefai.com/) is a powerful TypeScript/JavaScript toolkit for building seamless cross-program and cross-chain token swaps, bridging, and smart contract interactions on the Solana blockchain. Whether you're building DeFi dApps, wallets, or NFT platforms, Frost makes it easy to integrate complex Solana-native and wormhole-style bridging in both front-end and server-side environments.

[**Frost SDK**](https://www.frostdefai.com/) includes:

- Support for Solana-native programs, SPL tokens, and wrapped assets  
- Cross-chain bridging between Solana and EVM-compatible chains via Wormhole  
- Simple interfaces to quote, route, and execute token swaps on major Solana DEXs (Jupiter, Raydium, Orca)  
- Built-in utilities for signing, simulating, and sending Solana transactions using [@solana/web3.js](https://github.com/solana-labs/solana-web3.js)  
- Full compatibility with Phantom, Backpack, Solflare, and other Wallet Standard wallets  
- Hooks and event-driven utilities for swap tracking and transaction status  
- Lightweight, tree-shakable build for blazing-fast frontend performance  
- Supports common standards: SPL Token Program, Metaplex Metadata, Anchor-compatible IDLs  

## Installation

```bash
pnpm add @frost/solana-sdk
```
or
```
npm install --save @frost/solana-sdk
```

## Quick Start

### Set up the SDK

First, configure your app with an RPC endpoint and your dApp identifier:

```ts
import { initFrost } from '@frost/solana-sdk'

initFrost({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  appId: 'Your dApp name or company',
})
```
### Request a Quote

Fetch a quote from Solana DEX routing (e.g., via Jupiter aggregator):

```ts
import { getSwapQuote, Token } from '@frost/solana-sdk'

const quote = await getSwapQuote({
  fromToken: Token.SOL,
  toToken: Token.USDC,
  amount: 1 * 10 ** 9, // 1 SOL in lamports
  slippage: 0.5,
})
```

## Examples

Check the [`examples`](/examples) directory for working demos of:

- Swapping tokens  
- Bridging across chains  
- Wallet integration  
- Transaction simulation  

## Documentation

Explore the [Frost SDK documentation](https://www.frostdefai.com/) and [API reference](https://www.frostdefai.com/) for a full developer guide and programmatic reference.

## Changelog

See [CHANGELOG.md](/CHANGELOG.md) for a list of new features, bug fixes, and updates.

## License

This SDK is released under the [Apache 2.0 License](/LICENSE.md).

