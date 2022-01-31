import { TransactionResponse } from '@ethersproject/abstract-provider'
import { constants } from 'ethers'

import Lifi from '../../Lifi'
import { parseWalletError } from '../../utils/parseError'
import { ExecuteCrossParams, getChainById } from '../../types'
import { personalizeStep } from '../../utils/utils'
import { checkAllowance } from '../allowance.execute'
import { balanceCheck } from '../balanceCheck.execute'
import hop from './hop'
import { Execution } from '@lifinance/types'
import { getProvider } from '../../utils/getProvider'
import { switchChain } from '../switchChain'

export class HopExecutionManager {
  shouldContinue = true

  setShouldContinue = (val: boolean): void => {
    this.shouldContinue = val
  }

  execute = async ({
    signer,
    step,
    statusManager,
    hooks,
  }: ExecuteCrossParams): Promise<Execution> => {
    const { action, estimate } = step
    step.execution = statusManager.initExecutionObject(step)
    const fromChain = getChainById(action.fromChainId)
    const toChain = getChainById(action.toChainId)

    // STEP 1: Check Allowance ////////////////////////////////////////////////
    // approval still needed?
    const oldCrossProcess = step.execution.process.find(
      (p) => p.id === 'crossProcess'
    )
    if (!oldCrossProcess || !oldCrossProcess.txHash) {
      if (action.fromToken.address !== constants.AddressZero) {
        // Check Token Approval only if fromToken is not the native token => no approval needed in that case
        await checkAllowance(
          signer,
          step,
          fromChain,
          action.fromToken,
          action.fromAmount,
          estimate.approvalAddress,
          statusManager,
          true,
          this.shouldContinue
        )
      }
    }

    // STEP 2: Get Transaction ////////////////////////////////////////////////
    const crossProcess = statusManager.findOrCreateProcess(
      'crossProcess',
      step,
      'Prepare Transaction'
    )

    try {
      let tx: TransactionResponse
      if (crossProcess.txHash) {
        // load exiting transaction
        tx = await getProvider(signer).getTransaction(crossProcess.txHash)
      } else {
        // check balance
        await balanceCheck(signer, step)

        // create new transaction
        const personalizedStep = await personalizeStep(signer, step)
        const { transactionRequest } = await Lifi.getStepTransaction(
          personalizedStep
        )
        if (!transactionRequest) {
          statusManager.updateProcess(step, crossProcess.id, 'FAILED', {
            errorMessage: 'Unable to prepare Transaction',
          })
          statusManager.updateExecution(step, 'FAILED')
          throw crossProcess.errorMessage
        }

        // STEP 3: Send Transaction ///////////////////////////////////////////////
        // make sure that chain is still correct
        const updatedSigner = await switchChain(
          signer,
          statusManager,
          step,
          hooks.switchChainHook,
          this.shouldContinue
        )

        if (!updatedSigner) {
          // chain switch was not successful, stop execution here
          return step.execution
        }

        signer = updatedSigner

        statusManager.updateProcess(step, crossProcess.id, 'ACTION_REQUIRED')
        if (!this.shouldContinue) return step.execution

        tx = await signer.sendTransaction(transactionRequest)

        // STEP 4: Wait for Transaction ///////////////////////////////////////////
        statusManager.updateProcess(step, crossProcess.id, 'PENDING', {
          txHash: tx.hash,
          txLink: fromChain.metamask.blockExplorerUrls[0] + 'tx/' + tx.hash,
        })
      }

      await tx.wait()
    } catch (e: any) {
      if (e.code === 'TRANSACTION_REPLACED' && e.replacement) {
        statusManager.updateProcess(step, crossProcess.id, 'PENDING', {
          txHash: e.replacement.hash,
          txLink:
            fromChain.metamask.blockExplorerUrls[0] +
            'tx/' +
            e.replacement.hash,
        })
      } else {
        const error = parseWalletError(e, step, crossProcess)
        statusManager.updateProcess(step, crossProcess.id, 'FAILED', {
          errorMessage: e.message,
          htmlErrorMessage: error.htmlMessage,
          errorCode: e.code,
        })
        statusManager.updateExecution(step, 'FAILED')
        throw error
      }
    }

    statusManager.updateProcess(step, crossProcess.id, 'DONE', {
      message: 'Transfer started: ',
    })

    // STEP 5: Wait for Receiver //////////////////////////////////////
    // coinKey should always be set since this data is coming from the Lifi Backend.
    if (!action.toToken.coinKey) {
      console.error("toToken doesn't contain coinKey, aborting")
      throw new Error("toToken doesn't contain coinKey")
    }

    const waitForTxProcess = statusManager.findOrCreateProcess(
      'waitForTxProcess',
      step,
      'Wait for Receiving Chain'
    )
    let destinationTxReceipt
    try {
      destinationTxReceipt = await hop.waitForDestinationChainReceipt(
        crossProcess.txHash,
        action.toToken.coinKey,
        action.fromChainId,
        action.toChainId
      )
    } catch (e: any) {
      let errorMessage = 'Failed waiting'
      if (e.message) errorMessage += ':\n' + e.message

      statusManager.updateProcess(step, waitForTxProcess.id, 'FAILED', {
        errorMessage,
        errorCode: e.code,
      })
      statusManager.updateExecution(step, 'FAILED')
      throw e
    }

    // -> parse receipt & set status
    const parsedReceipt = await hop.parseReceipt(
      await signer.getAddress(),
      step.action.toToken.address,
      crossProcess.txHash,
      destinationTxReceipt
    )

    // step.execution.gasUsed = parsedReceipt.gasUsed
    statusManager.updateProcess(step, waitForTxProcess.id, 'DONE', {
      txHash: destinationTxReceipt.transactionHash,
      txLink:
        toChain.metamask.blockExplorerUrls[0] +
        'tx/' +
        destinationTxReceipt.transactionHash,
      message: 'Funds Received:',
    })
    statusManager.updateExecution(step, 'DONE', {
      fromAmount: parsedReceipt.fromAmount,
      toAmount: parsedReceipt.toAmount,
    })

    // DONE
    return step.execution
  }
}
