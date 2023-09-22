import type { LiFiStep } from '@lifi/types'
import type { WalletClient } from 'viem'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildStepObject } from '../../../tests/fixtures.js'
import type { StatusManager } from '../StatusManager.js'
import type { ExecutionOptions } from '../types.js'
import { switchChain } from './switchChain.js'

let walletClient: WalletClient,
  step: LiFiStep,
  statusManager: StatusManager,
  hooks: ExecutionOptions,
  getChainIdMock: Mock,
  switchChainHookMock: Mock,
  findOrCreateProcessMock: Mock,
  updateExecutionMock: Mock,
  updateProcessMock: Mock

describe('switchChain', () => {
  beforeEach(() => {
    getChainIdMock = vi.fn()
    walletClient = {
      getChainId: getChainIdMock,
    } as unknown as WalletClient

    switchChainHookMock = vi.fn()
    hooks = {
      switchChainHook: switchChainHookMock,
    } as unknown as ExecutionOptions

    step = buildStepObject({ includingExecution: false })

    findOrCreateProcessMock = vi.fn()
    updateExecutionMock = vi.fn()
    updateProcessMock = vi.fn()
    statusManager = {
      initExecutionObject: vi.fn(),
      findOrCreateProcess: findOrCreateProcessMock,
      removeProcess: vi.fn(),
      updateExecution: updateExecutionMock,
      updateProcess: updateProcessMock,
    } as unknown as StatusManager
  })

  describe('when the chain is already correct', () => {
    beforeEach(() => {
      getChainIdMock.mockResolvedValue(step.action.fromChainId)
    })

    it('should return the WalletClient and do nothing else', async () => {
      const updatedWalletClient = await switchChain(
        walletClient,
        statusManager,
        step,
        true,
        hooks.switchChainHook
      )

      expect(updatedWalletClient).toEqual(walletClient)
      expect(statusManager.initExecutionObject).not.toHaveBeenCalled()
      expect(hooks.switchChainHook).not.toHaveBeenCalled()
    })
  })

  describe('when the chain is not correct', () => {
    beforeEach(() => {
      getChainIdMock.mockResolvedValueOnce(1)
      findOrCreateProcessMock.mockReturnValue({ type: 'SWITCH_CHAIN' })
    })

    describe('when allowUserInteraction is false', () => {
      it('should initialize the status manager and abort', async () => {
        const updatedWalletClient = await switchChain(
          walletClient,
          statusManager,
          step,
          false,
          hooks.switchChainHook
        )

        expect(updatedWalletClient).toBeUndefined()

        expect(statusManager.initExecutionObject).toHaveBeenCalled()
        expect(statusManager.findOrCreateProcess).toHaveBeenCalled()
        expect(hooks.switchChainHook).not.toHaveBeenCalled()
      })
    })

    describe('when allowUserInteraction is true', () => {
      describe('when the switchChainHook fails', () => {
        beforeEach(() => {
          switchChainHookMock.mockRejectedValue(
            new Error('something went wrong')
          )
        })

        it('should throw the error', async () => {
          await expect(
            switchChain(
              walletClient,
              statusManager,
              step,
              true,
              hooks.switchChainHook
            )
          ).rejects.toThrowError(new Error('something went wrong'))

          expect(switchChainHookMock).toHaveBeenCalledWith(
            step.action.fromChainId
          )
          expect(updateExecutionMock).toHaveBeenCalledWith(step, 'FAILED')
        })
      })

      describe("when the switchChainHook doesn't change the chain", () => {
        beforeEach(() => {
          switchChainHookMock.mockResolvedValue(walletClient)
        })

        it('should throw the error', async () => {
          await expect(
            switchChain(
              walletClient,
              statusManager,
              step,
              true,
              hooks.switchChainHook
            )
          ).rejects.toThrowError(new Error('Chain switch required.'))

          expect(switchChainHookMock).toHaveBeenCalledWith(
            step.action.fromChainId
          )
          expect(updateExecutionMock).toHaveBeenCalledWith(step, 'FAILED')
        })
      })

      describe('when the switchChainHook changes the chain', () => {
        let newWalletClient: WalletClient

        beforeEach(() => {
          newWalletClient = {
            getChainId: () => Promise.resolve(step.action.fromChainId),
          } as unknown as WalletClient

          switchChainHookMock.mockResolvedValue(newWalletClient)
        })

        it('should return the updated WalletClient', async () => {
          const updatedWalletClient = await switchChain(
            walletClient,
            statusManager,
            step,
            true,
            hooks.switchChainHook
          )

          expect(switchChainHookMock).toHaveBeenCalledWith(
            step.action.fromChainId
          )
          expect(updatedWalletClient).toEqual(newWalletClient)
          expect(statusManager.updateProcess).toHaveBeenCalledWith(
            step,
            'SWITCH_CHAIN',
            'DONE'
          )
          expect(statusManager.updateExecution).toHaveBeenCalledWith(
            step,
            'PENDING'
          )
        })
      })
    })
  })
})
