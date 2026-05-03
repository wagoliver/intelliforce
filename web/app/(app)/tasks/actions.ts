"use server";

import { ApiError } from "@/lib/api/client";
import { tasks } from "@/lib/api/tasks";

export async function createTaskAction(formData: FormData) {
  try {
    await tasks.create({
      agent_id: String(formData.get("agent_id") ?? ""),
      prompt: String(formData.get("prompt") ?? ""),
      input: {},
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.detail };
    return { error: "Erro inesperado ao criar tarefa." };
  }
}
