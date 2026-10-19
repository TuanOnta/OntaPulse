import { AppError } from "../../infrastructure/errors/app-error.js";
import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import {
  EDGE_CONFIDENCES,
  EDGE_LAYERS,
  EDGE_SIGNAL_TYPES,
  EDGE_VENDORS,
  MAX_EDGE_DETECTIONS,
  MAX_EDGE_PROFILE_BYTES,
  MAX_EDGE_SIGNALS_PER_DETECTION,
  MAX_EDGE_SIGNAL_NAME_LENGTH,
  type EdgeDetection,
  type EdgeSignal,
} from "./edge-profile.constants.js";
import { EdgeProfileRepository } from "./edge-profile.repository.js";

export class EdgeProfileService {
  constructor(
    private readonly repository: EdgeProfileRepository,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async findByMonitorId(monitorId: string, userId: string) {
    const monitor = await this.repository.findMonitorById(monitorId);

    if (!monitor) {
      throw monitorNotFound();
    }

    await this.workspaceAccessService.requireMember(
      monitor.project.workspaceId,
      userId,
      monitorNotFound(),
    );

    const profile = await this.repository.findByMonitorId(monitorId);

    if (!profile) {
      throw new AppError("No edge profile found", 404, "NO_EDGE_PROFILE");
    }

    return { ...profile, detections: sanitizeDetections(profile.detections) };
  }
}

function monitorNotFound(): AppError {
  return new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
}

/**
 * Re-applies the stored-shape rules. The worker is the only writer, but the API never passes
 * through unknown fields, unknown vendors, or an oversized list.
 */
export function sanitizeDetections(value: unknown): EdgeDetection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const detections: EdgeDetection[] = [];

  for (const item of value) {
    const detection = toDetection(item);

    if (detection === null) {
      continue;
    }

    if (
      detections.length >= MAX_EDGE_DETECTIONS ||
      Buffer.byteLength(JSON.stringify([...detections, detection])) > MAX_EDGE_PROFILE_BYTES
    ) {
      break;
    }

    detections.push(detection);
  }

  return detections;
}

function toDetection(item: unknown): EdgeDetection | null {
  if (typeof item !== "object" || item === null) {
    return null;
  }

  const { vendor, layer, confidence, signals } = item as Record<string, unknown>;

  if (
    !isOneOf(EDGE_VENDORS, vendor) ||
    !isOneOf(EDGE_LAYERS, layer) ||
    !isOneOf(EDGE_CONFIDENCES, confidence) ||
    !Array.isArray(signals)
  ) {
    return null;
  }

  return {
    vendor,
    layer,
    confidence,
    signals: signals
      .map(toSignal)
      .filter((signal): signal is EdgeSignal => signal !== null)
      .slice(0, MAX_EDGE_SIGNALS_PER_DETECTION),
  };
}

function toSignal(item: unknown): EdgeSignal | null {
  if (typeof item !== "object" || item === null) {
    return null;
  }

  const { type, name } = item as Record<string, unknown>;

  if (!isOneOf(EDGE_SIGNAL_TYPES, type) || typeof name !== "string") {
    return null;
  }

  return { type, name: name.slice(0, MAX_EDGE_SIGNAL_NAME_LENGTH) };
}

function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
