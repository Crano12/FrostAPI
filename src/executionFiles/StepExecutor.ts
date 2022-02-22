import { Signer } from 'ethers'
import StatusManager from '../StatusManager'

import {
  BridgeTool,
  CrossStep,
  ExchangeTool,
  Hooks,
  LifiStep,
  Step,
  SwapStep,
} from '../types'
import { oneinch } from './exchanges/oneinch'
import { openocean } from './exchanges/openocean'
import { paraswap } from './exchanges/paraswap'
import { SwapExecutionManager } from './exchanges/swap.execute'
import { uniswap } from './exchanges/uniswaps'
import { switchChain } from './switchChain'
import { BridgeExecutionManager } from './bridges/bridge.execute'

export class StepExecutor {
  settings: Hooks
  statusManager: StatusManager
  private swapExecutionManager = new SwapExecutionManager()
  private bridgeExecutionManager = new BridgeExecutionManager()

  executionStopped = false

  constructor(statusManager: StatusManager, settings: Hooks) {
    this.statusManager = statusManager
    this.settings = settings
  }

  stopStepExecution = (): void => {
    this.swapExecutionManager.setShouldContinue(false)
    this.bridgeExecutionManager.setShouldContinue(false)

    this.executionStopped = true
  }

  executeStep = async (signer: Signer, step: Step): Promise<Step> => {
    // check if signer is for correct chain
    const updatedSigner = await switchChain(
      signer,
      this.statusManager,
      step,
      this.settings.switchChainHook,
      !this.executionStopped
    )

    if (!updatedSigner) {
      // chain switch was not successful, stop execution here
      return step
    }

    signer = updatedSigner

    switch (step.type) {
      case 'lifi':
      case 'cross':
        await this.executeCross(signer, step, this.settings)
        break
      case 'swap':
        await this.executeSwap(signer, step, this.settings)
        break
      default:
        throw new Error('Unsupported step type')
    }

    return step
  }

  private executeSwap = async (
    signer: Signer,
    step: SwapStep,
    hooks: Hooks
  ) => {
    const swapParams = {
      signer,
      step,
      settings: this.settings,
      statusManager: this.statusManager,
      hooks,
    }

    switch (step.tool) {
      case ExchangeTool.paraswap:
        return await this.swapExecutionManager.execute({
          ...swapParams,
          parseReceipt: paraswap.parseReceipt,
        })
      case ExchangeTool.oneinch:
        return await this.swapExecutionManager.execute({
          ...swapParams,
          parseReceipt: oneinch.parseReceipt,
        })
      case ExchangeTool.openocean:
        return await this.swapExecutionManager.execute({
          ...swapParams,
          parseReceipt: openocean.parseReceipt,
        })
      case ExchangeTool.zerox:
      case ExchangeTool.dodo:
      default:
        return await this.swapExecutionManager.execute({
          ...swapParams,
          parseReceipt: uniswap.parseReceipt,
        })
    }
  }

  private executeCross = async (
    signer: Signer,
    step: CrossStep | LifiStep,
    hooks: Hooks
  ) => {
    const crossParams = {
      signer,
      step,
      hooks,
      statusManager: this.statusManager,
    }

    switch (step.tool) {
      case BridgeTool.connext:
      case 'nxtp': // keep for some time while user still may have unfinished routes locally
      case BridgeTool.cbridge:
      case BridgeTool.multichain:
      case 'anyswap': // keep for some time while user still may have unfinished routes locally
      case BridgeTool.hop:
        return await this.bridgeExecutionManager.execute(crossParams)
      default:
        throw new Error('Should never reach here, bridge not defined')
    }
  }
}
