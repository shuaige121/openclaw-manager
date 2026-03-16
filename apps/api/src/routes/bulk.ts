import { Router, type NextFunction, type Request, type Response } from "express";
import { ActionHistoryService } from "../services/action-history";
import { describeBulkActionRequest, executeBulkAction } from "../services/project-bulk-actions";
import { type ProjectRegistryService } from "../services/project-registry";

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

export function createBulkRouter(options: {
  registryService: ProjectRegistryService;
  actionHistoryService?: ActionHistoryService;
}) {
  const bulkRouter = Router();
  const registryService = options.registryService;
  const actionHistoryService = options.actionHistoryService ?? new ActionHistoryService();

  bulkRouter.post(
    "/execute",
    handleAsync(async (request, response) => {
      const registry = await registryService.readRegistry();
      const description = describeBulkActionRequest(request.body);
      const execution = await executeBulkAction(registry.projects, request.body);
      const projects = registry.projects
        .filter((project) => execution.projectIds.includes(project.id))
        .map((project) => ({
          id: project.id,
          name: project.name,
        }));
      const okCount = execution.results.filter((result) => result.ok).length;

      await actionHistoryService.appendEntry({
        kind: "bulk_action",
        ok: execution.results.every((result) => result.ok),
        projects,
        summary: `${description.detail} (${okCount}/${execution.results.length} 成功)`,
        detail: execution.results.map((result) => `${result.projectName}: ${result.message}`).join("\n"),
        command: null,
        stdout: null,
        stderr: execution.results
          .filter((result) => !result.ok)
          .map((result) => `${result.projectName}: ${result.message}`)
          .join("\n"),
        durationMs: null,
        actionName: description.actionName,
      });

      response.json({
        ok: execution.results.every((result) => result.ok),
        action: execution.action,
        projectIds: execution.projectIds,
        results: execution.results,
      });
    }),
  );

  return bulkRouter;
}
