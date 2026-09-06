import * as argon2 from "argon2";

import { AppError } from "../../infrastructure/errors/app-error.js";
import type { SessionStore } from "../../infrastructure/session/session-store.js";
import { AuthRepository } from "./auth.repository.js";
import type { RegisterInput } from "./auth.schema.js";

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly sessionStore: SessionStore,
  ) {}

  async register(input: RegisterInput) {
    const existingUser = await this.authRepository.findUserByEmail(input.email);

    if (existingUser) {
      throw new AppError(
        "An account with this email already exists",
        409,
        "EMAIL_ALREADY_REGISTERED",
      );
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    let registration;

    try {
      registration = await this.authRepository.createUserWithWorkspace({
        name: input.name,
        email: input.email,
        passwordHash,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          "An account with this email already exists",
          409,
          "EMAIL_ALREADY_REGISTERED",
        );
      }

      throw error;
    }

    const sessionToken = await this.sessionStore.create(registration.user.id);

    return {
      ...registration,
      sessionToken,
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
