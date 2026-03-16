import { Router, type NextFunction, type Request, type Response } from "express";
import { ActionHistoryService } from "../services/action-history";

type AsyncRouteHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

function handleAsync(handler: AsyncRouteHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

function parseLimit(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

export function createActionsRouter(options?: {
  actionHistoryService?: ActionHistoryService;
}) {
  const actionsRouter = Router();
  const actionHistoryService = options?.actionHistoryService ?? new ActionHistoryService();

  actionsRouter.get(
    "/",
    handleAsync(async (request, response) => {
      const history = await actionHistoryService.listEntries({
        limit: parseLimit(request.query.limit),
        projectId: typeof request.query.projectId === "string" ? request.query.projectId : undefined,
      });

      response.json(history);
    }),
  );

  return actionsRouter;
}
