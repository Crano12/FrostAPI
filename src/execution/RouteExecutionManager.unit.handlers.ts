import { rest } from 'msw'
import {
  mockStepTransactionWithTxRequest,
  mockChainsResponse,
  mockStatus,
} from './RouteExecutionManager.unit.mock'
import ConfigService from '../services/ConfigService'
import { buildStepObject } from '../../test/fixtures'

const config = ConfigService.getInstance().getConfig()

export const lifiHandlers = [
  rest.post(
    `${config.apiUrl}/advanced/stepTransaction`,
    async (_, response, context) =>
      response(
        context.status(200),
        context.json(
          mockStepTransactionWithTxRequest(
            buildStepObject({
              includingExecution: true,
            })
          )
        )
      )
  ),
  rest.get(`${config.apiUrl}/chains`, async (_, response, context) =>
    response(
      context.status(200),
      context.json({
        chains: mockChainsResponse,
      })
    )
  ),
  rest.get(`${config.apiUrl}/status`, async (_, response, context) =>
    response(context.status(200), context.json(mockStatus))
  ),
]
