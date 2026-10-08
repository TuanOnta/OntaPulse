import { toast } from "sonner";

/** Copies text and says so; if the browser refuses, the toast says that instead of pretending. */
export async function copyToClipboard(text: string, successMessage: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error("Could not copy. Select the text and copy it manually.");
    return false;
  }
}
