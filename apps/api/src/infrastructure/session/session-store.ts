export interface SessionStore {
  create(userId: string): Promise<string>;
  findUserId(token: string): Promise<string | null>;
  delete(token: string): Promise<void>;
  close(): Promise<void>;
}
