import { LifiErrorCodes } from './errors'
import {
  errorCodes as MetaMaskErrorCodes,
  getMessageFromCode,
} from 'eth-rpc-errors'
import { parseBackendError, parseWalletError } from './parseError'
import { buildStepObject } from '../../test/fixtures'

describe('parseError', () => {
  describe('parseWalletError', () => {
    describe('when the error does not contain a code', () => {
      it('should return an UnknownError with the default message if no message is set', async () => {
        const parsedError = await parseWalletError('Oops')

        expect(parsedError.message).toEqual('Unknown error occurred')
        expect(parsedError.code).toEqual(LifiErrorCodes.internalError)
      })

      it('should return an UnknownError with the given message', async () => {
        const parsedError = await await parseWalletError({
          message: 'Somethings fishy',
        })

        expect(parsedError.message).toEqual('Somethings fishy')
        expect(parsedError.code).toEqual(LifiErrorCodes.internalError)
      })
    })

    describe('when the error contains an unknown error code', () => {
      it('should return an UnknownError', async () => {
        const parsedError = await parseWalletError({
          code: 1337,
          message: 'Somethings fishy',
        })

        expect(parsedError.message).toEqual('Somethings fishy')
        expect(parsedError.code).toEqual(LifiErrorCodes.internalError)
      })
    })

    describe('when the error contains a rpc error code', () => {
      it('should return a RPCError with the metamask error message', async () => {
        const parsedError = await parseWalletError({
          code: MetaMaskErrorCodes.rpc.methodNotFound,
          message: 'Somethings fishy',
        })

        expect(parsedError.message).toEqual(
          getMessageFromCode(MetaMaskErrorCodes.rpc.methodNotFound)
        )
        expect(parsedError.code).toEqual(MetaMaskErrorCodes.rpc.methodNotFound)
      })

      it('should return a RPCError with a custom message if underpriced', async () => {
        const parsedError = await parseWalletError({
          code: MetaMaskErrorCodes.rpc.internal,
          message: 'RPC called failed: transaction underpriced',
        })

        expect(parsedError.message).toEqual('Transaction is underpriced.')
        expect(parsedError.code).toEqual(LifiErrorCodes.transactionUnderpriced)
      })
    })

    describe('when the error contains a provider error code', () => {
      it('should return a ProviderError with the metamask error message', async () => {
        const parsedError = await parseWalletError({
          code: MetaMaskErrorCodes.provider.unsupportedMethod,
          message: 'Somethings fishy',
        })

        expect(parsedError.message).toEqual(
          getMessageFromCode(MetaMaskErrorCodes.provider.unsupportedMethod)
        )
        expect(parsedError.code).toEqual(
          MetaMaskErrorCodes.provider.unsupportedMethod
        )
      })
    })

    describe('when no step is passed to the parser', () => {
      it('should return a default htmlMessage', async () => {
        const parsedError = await parseWalletError({
          code: MetaMaskErrorCodes.rpc.methodNotFound,
          message: 'Somethings fishy',
        })

        expect(parsedError.htmlMessage).toEqual(
          // eslint-disable-next-line max-len
          "Transaction was not sent, your funds are still in your wallet, please retry.<br/>If it still doesn't work, it is safe to delete this transfer and start a new one."
        )
      })
    })

    describe('when a step is passed to the parser', () => {
      it('should include the token information in the htmlMessage', async () => {
        const parsedError = await parseWalletError(
          {
            code: MetaMaskErrorCodes.rpc.methodNotFound,
            message: 'Somethings fishy',
          },
          buildStepObject({})
        )

        expect(parsedError.htmlMessage).toEqual(
          // eslint-disable-next-line max-len
          "Transaction was not sent, your funds are still in your wallet (1.0000 USDC on Polygon), please retry.<br/>If it still doesn't work, it is safe to delete this transfer and start a new one."
        )
      })
    })

    describe('when a process is passed to the parser', () => {
      it('should include the explorer link in the htmlMessage', async () => {
        const step = buildStepObject({ includingExecution: true })
        const parsedError = await parseWalletError(
          {
            code: MetaMaskErrorCodes.rpc.methodNotFound,
            message: 'Somethings fishy',
          },
          step,
          step.execution?.process[0]
        )

        expect(parsedError.htmlMessage).toEqual(
          // eslint-disable-next-line max-len
          'Transaction was not sent, your funds are still in your wallet (1.0000 USDC on Polygon), please retry.<br/>If it still doesn\'t work, it is safe to delete this transfer and start a new one.<br>You can check the failed transaction&nbsp;<a href="https://example.com" target="_blank" rel="nofollow noreferrer">here</a>.'
        )
      })
    })
  })

  describe('parseBackendError', () => {
    describe("when the error doesn't contain a status", () => {
      it('should return a ServerError with a default messsage', async () => {
        const parsedError = parseBackendError('Oops')

        expect(parsedError.message).toEqual('Something went wrong')
        expect(parsedError.code).toEqual(LifiErrorCodes.internalError)
      })
    })

    describe('when the error contains a status', () => {
      describe('when the status is 400', () => {
        it('should return the error message if set', async () => {
          const parsedError = parseBackendError({
            response: { status: 400, data: { message: 'Oops' } },
          })

          expect(parsedError.message).toEqual('Oops')
          expect(parsedError.code).toEqual(LifiErrorCodes.validationError)
        })

        it('should return the axios statusText if message not set', async () => {
          const parsedError = parseBackendError({
            response: {
              status: 400,
              statusText: 'Request failed with statusCode 400',
            },
          })

          expect(parsedError.message).toEqual(
            'Request failed with statusCode 400'
          )
          expect(parsedError.code).toEqual(LifiErrorCodes.validationError)
        })
      })

      describe('when the status is 500', () => {
        it('should return the error message if set', async () => {
          const parsedError = parseBackendError({
            response: { status: 500, data: { message: 'Oops' } },
          })

          expect(parsedError.message).toEqual('Oops')
          expect(parsedError.code).toEqual(LifiErrorCodes.internalError)
        })

        it('should return the axios statusText if message not set', async () => {
          const parsedError = parseBackendError({
            response: {
              status: 500,
              statusText: 'Request failed with statusCode 500',
            },
          })

          expect(parsedError.message).toEqual(
            'Request failed with statusCode 500'
          )
          expect(parsedError.code).toEqual(LifiErrorCodes.internalError)
        })
      })
    })
  })
})
