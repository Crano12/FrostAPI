import { Route, RouteOptions, Step, Token } from '@lifi/types'
import BigNumber from 'bignumber.js'
import { Signer } from 'ethers'
import { ChainId } from '.'
import { StatusManager } from '../execution/StatusManager'
import { StepExecutor } from '../execution/StepExecutor'

export interface TokenWithAmounts extends Token {
  amount?: BigNumber
  amountRendered?: string
}

export type ParsedReceipt = {
  fromAmount?: string
  toAmount: string
  gasUsed: string
  gasPrice: string
  gasFee: string
  toTokenAddress?: string
}

interface ExecutionParams {
  signer: Signer
  step: Step
  statusManager: StatusManager
  settings: InternalExecutionSettings
}

export interface ExecuteSwapParams extends ExecutionParams {
  step: Step
}

export interface ExecuteCrossParams extends ExecutionParams {
  // step: CrossStep | LifiStep
  step: Step
}

export type CallbackFunction = (updatedRoute: Route) => void

export type Config = {
  apiUrl: string
  rpcs: Record<ChainId, string[]>
  multicallAddresses: Record<ChainId, string | undefined>
  defaultExecutionSettings: InternalExecutionSettings
  defaultRouteOptions: RouteOptions
  disableVersionCheck?: boolean
}

export type ConfigUpdate = {
  apiUrl?: string
  rpcs?: Record<number, string[]>
  multicallAddresses?: Record<number, string | undefined>
  defaultExecutionSettings?: ExecutionSettings
  defaultRouteOptions?: RouteOptions
  disableVersionCheck?: boolean
}

export type SwitchChainHook = (
  requiredChainId: number
) => Promise<Signer | undefined>

export interface AcceptSlippageUpdateHookParams {
  toToken: Token
  oldToAmount: string
  newToAmount: string
  oldSlippage: number
  newSlippage: number
}

export type AcceptSlippageUpdateHook = (
  params: AcceptSlippageUpdateHookParams
) => Promise<boolean | undefined>

export interface ExecutionData {
  route: Route
  executors: StepExecutor[]
  settings: InternalExecutionSettings
}

export interface ExecutionSettings {
  updateCallback?: CallbackFunction
  switchChainHook?: SwitchChainHook
  acceptSlippageUpdateHook?: AcceptSlippageUpdateHook
  infiniteApproval?: boolean
  executeInBackground?: boolean
}

export interface InternalExecutionSettings extends ExecutionSettings {
  updateCallback: CallbackFunction
  switchChainHook: SwitchChainHook
  acceptSlippageUpdateHook: AcceptSlippageUpdateHook
  infiniteApproval: boolean
  executeInBackground: boolean
}

// Hard to read but this creates a new type that enforces all optional properties in a given interface
export type EnforcedObjectProperties<T> = T & {
  [P in keyof T]-?: T[P]
}

export interface ActiveRouteDictionary {
  [k: string]: ExecutionData
}

export type RevokeTokenData = {
  token: Token
  approvalAddress: string
}

export interface InteractionSettings {
  allowInteraction?: boolean
  allowUpdates?: boolean
  stopExecution?: boolean
}
