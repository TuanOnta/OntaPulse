import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import {
  addWorkspaceMemberBodySchema,
  createWorkspaceBodySchema,
  updateWorkspaceMemberBodySchema,
  workspaceIdParamsSchema,
  workspaceMemberParamsSchema,
} from "./workspace.schema.js";
import { WorkspaceService } from "./workspace.service.js";

export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const parsedBody = createWorkspaceBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedBody.error.flatten().fieldErrors,
      );
    }

    const workspace = await this.workspaceService.create(userId, parsedBody.data);

    request.log.info({ workspaceId: workspace.id, userId }, "Workspace created");

    return reply.status(201).send(workspace);
  };

  findAll = async (request: FastifyRequest) => {
    const userId = getAuthenticatedUserId(request);

    return this.workspaceService.findAll(userId);
  };

  findMembers = async (request: FastifyRequest) => {
    const userId = getAuthenticatedUserId(request);
    const { workspaceId } = parseOrThrow(workspaceIdParamsSchema, request.params);
    return this.workspaceService.findMembers(workspaceId, userId);
  };

  addMember = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const { workspaceId } = parseOrThrow(workspaceIdParamsSchema, request.params);
    const body = parseOrThrow(addWorkspaceMemberBodySchema, request.body);
    const member = await this.workspaceService.addMember(workspaceId, userId, body);
    return reply.status(201).send(member);
  };

  updateMemberRole = async (request: FastifyRequest) => {
    const userId = getAuthenticatedUserId(request);
    const { workspaceId, userId: memberUserId } = parseOrThrow(
      workspaceMemberParamsSchema,
      request.params,
    );
    const body = parseOrThrow(updateWorkspaceMemberBodySchema, request.body);
    return this.workspaceService.updateMemberRole(workspaceId, userId, memberUserId, body);
  };

  removeMember = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const { workspaceId, userId: memberUserId } = parseOrThrow(
      workspaceMemberParamsSchema,
      request.params,
    );
    await this.workspaceService.removeMember(workspaceId, userId, memberUserId);
    return reply.status(204).send();
  };
}

function parseOrThrow<
  T extends {
    safeParse: (value: unknown) => {
      success: boolean;
      data?: unknown;
      error?: { flatten: () => unknown };
    };
  },
>(schema: T, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      "Request validation failed",
      400,
      "VALIDATION_ERROR",
      parsed.error!.flatten() as Record<string, unknown>,
    );
  }
  return parsed.data as ReturnType<T["safeParse"]> extends { data: infer Data } ? Data : never;
}

function getAuthenticatedUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  return request.userId;
}
