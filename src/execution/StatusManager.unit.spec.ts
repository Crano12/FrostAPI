import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { buildRouteObject, buildStepObject } from '../../test/fixtures'
import { Route, Status, Step } from '../types'
import { StatusManager } from './StatusManager'

// Note: using structuredClone when passing objects to the StatusManager shall make sure that we are not facing any unknown call-by-reference-issues anymore

describe('StatusManager', () => {
  let statusManager: StatusManager
  let internalUpdateRouteCallbackMock: Mock
  let updateCallbackMock: Mock
  let route: Route
  let step: Step

  const expectCallbacksToHaveBeenCalledWith = (route: Route) => {
    expect(updateCallbackMock).toHaveBeenCalledWith(route)
    expect(internalUpdateRouteCallbackMock).toHaveBeenCalledWith(route)
  }

  const initializeStatusManager = ({
    includingExecution,
  }: {
    includingExecution: boolean
  }): StatusManager => {
    step = buildStepObject({ includingExecution })
    route = buildRouteObject({ step })

    return new StatusManager(
      structuredClone(route),
      {
        updateCallback: updateCallbackMock,
        switchChainHook: () => Promise.resolve(undefined),
        acceptSlippageUpdateHook: () => Promise.resolve(undefined),
        acceptExchangeRateUpdateHook: () => Promise.resolve(undefined),
        infiniteApproval: false,
        executeInBackground: false,
      },
      internalUpdateRouteCallbackMock
    )
  }

  beforeEach(() => {
    internalUpdateRouteCallbackMock = vi.fn()
    updateCallbackMock = vi.fn()
  })

  describe('initExecutionObject', () => {
    describe('when no execution is defined yet', () => {
      beforeEach(() => {
        statusManager = initializeStatusManager({ includingExecution: false })
        statusManager.initExecutionObject(step)
      })

      it('should create an empty execution & call the callbacks with the updated route', () => {
        const updatedStep = Object.assign({}, step, {
          execution: {
            status: 'PENDING',
            process: [],
          },
        })

        const updatedRoute = Object.assign({}, route, {
          steps: [updatedStep],
        })

        expectCallbacksToHaveBeenCalledWith(updatedRoute)
      })
    })

    describe('when an execution is already defined', () => {
      beforeEach(() => {
        statusManager = initializeStatusManager({ includingExecution: true })
        statusManager.initExecutionObject(structuredClone(step))
      })

      it('should not call the callbacks', () => {
        expect(updateCallbackMock).not.toHaveBeenCalled()
        expect(internalUpdateRouteCallbackMock).not.toHaveBeenCalled()
      })
    })
  })

  describe('updateExecution', () => {
    describe('when no execution is defined yet', () => {
      beforeEach(() => {
        statusManager = initializeStatusManager({ includingExecution: false })
      })

      it('should throw an error', () => {
        // function has to be wrapped into a function https://jestjs.io/docs/expect#tothrowerror
        expect(() =>
          statusManager.updateExecution(structuredClone(step), 'DONE')
        ).toThrow("Can't update empty execution.")
      })
    })

    describe('when an execution is defined', () => {
      beforeEach(() => {
        statusManager = initializeStatusManager({ includingExecution: true })
        statusManager.updateExecution(structuredClone(step), 'DONE', {
          fromAmount: '123',
          toAmount: '312',
        })
      })

      it('should update the execution & call the callbacks with the updated route', () => {
        const updatedExecution = Object.assign({}, step.execution, {
          fromAmount: '123',
          toAmount: '312',
          status: 'DONE',
        })

        const updatedStep = Object.assign({}, step, {
          execution: updatedExecution,
        })

        const updatedRoute = Object.assign({}, route, {
          steps: [updatedStep],
        })

        expectCallbacksToHaveBeenCalledWith(updatedRoute)
      })
    })
  })

  describe('findOrCreateProcess', () => {
    describe('when no execution is defined yet', () => {
      beforeEach(() => {
        statusManager = initializeStatusManager({ includingExecution: false })
      })

      it('should throw an error', () => {
        expect(() =>
          statusManager.findOrCreateProcess(structuredClone(step), 'SWAP')
        ).toThrow("Execution hasn't been initialized.")
      })
    })

    describe('when an execution is defined', () => {
      beforeEach(() => {
        statusManager = initializeStatusManager({ includingExecution: true })
      })

      describe('and the process already exists', () => {
        it('should return the process and not call the callbacks', () => {
          const process = statusManager.findOrCreateProcess(
            structuredClone(step),
            'TOKEN_ALLOWANCE'
          )

          expect(process).toEqual(step.execution?.process[0])

          expect(updateCallbackMock).not.toHaveBeenCalled()
          expect(internalUpdateRouteCallbackMock).not.toHaveBeenCalled()
        })
      })

      describe("and the process doesn't exist", () => {
        it('should create a process and call the callbacks with the updated route', () => {
          const process = statusManager.findOrCreateProcess(
            structuredClone(step),
            'CROSS_CHAIN'
          )

          expect(process.type).toEqual('CROSS_CHAIN')
          expect(process.status).toEqual('STARTED')
          expect(process.message).toEqual('Preparing bridge transaction.')

          const updatedExecution = Object.assign({}, step.execution, {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            process: [...step.execution!.process, process],
          })

          const updatedStep = Object.assign({}, step, {
            execution: updatedExecution,
          })

          const updatedRoute = Object.assign({}, route, {
            steps: [updatedStep],
          })

          expectCallbacksToHaveBeenCalledWith(updatedRoute)
        })
      })
    })
  })

  describe('updateProcess', () => {
    beforeEach(() => {
      statusManager = initializeStatusManager({ includingExecution: true })
    })

    describe('when no process can be found', () => {
      it('should throw an error', () => {
        expect(() =>
          statusManager.updateProcess(
            structuredClone(step),
            'CROSS_CHAIN',
            'CANCELLED'
          )
        ).toThrow("Can't find a process for the given type.")
      })
    })

    describe('when a process is found', () => {
      ;[
        { status: 'ACTION_REQUIRED' },
        { status: 'PENDING' },
        { status: 'FAILED', doneAt: true },
        { status: 'DONE', doneAt: true },
        { status: 'CANCELLED', doneAt: true },
      ].forEach(({ status, doneAt }) => {
        describe(`and the status is ${status}`, () => {
          it('should update the process and call the callbacks', () => {
            const process = statusManager.updateProcess(
              structuredClone(step),
              'SWAP',
              status as Status
            )

            expect(process.type).toEqual('SWAP')
            expect(process.status).toEqual(status)
            // expect(process.message).toEqual(
            //   getProcessMessage('SWAP', status as Status)
            // )
            doneAt
              ? expect(process.doneAt).toBeDefined()
              : expect(process.doneAt).toBeUndefined()

            const notUpdateableStatus =
              status === 'DONE' || status === 'CANCELLED'
            const updatedExecution = Object.assign({}, step.execution, {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              process: [step.execution!.process[0], process],
              status: notUpdateableStatus
                ? step.execution!.status
                : (status as Status),
            })

            const updatedStep = { ...step, execution: updatedExecution }

            const updatedRoute = Object.assign({}, route, {
              steps: [updatedStep],
            })

            expectCallbacksToHaveBeenCalledWith(updatedRoute)
          })
        })
      })
    })
  })

  describe('removeProcess', () => {
    describe('when no execution is defined yet', () => {
      beforeEach(() => {
        statusManager = initializeStatusManager({ includingExecution: false })
      })

      it('should throw an error', () => {
        expect(() =>
          statusManager.removeProcess(structuredClone(step), 'TOKEN_ALLOWANCE')
        ).toThrow("Execution hasn't been initialized.")
      })
    })

    describe('when an execution is defined', () => {
      beforeEach(() => {
        statusManager = initializeStatusManager({ includingExecution: true })
        statusManager.removeProcess(structuredClone(step), 'TOKEN_ALLOWANCE')
      })

      it('should remove the process and call the callbacks', () => {
        const updatedExecution = Object.assign({}, step.execution, {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          process: [step.execution!.process[1]],
        })

        const updatedStep = Object.assign({}, step, {
          execution: updatedExecution,
        })

        const updatedRoute = Object.assign({}, route, {
          steps: [updatedStep],
        })

        expectCallbacksToHaveBeenCalledWith(updatedRoute)
      })
    })
  })
})
