/**
 * Админ-API базы знаний AI-ассистентов (таблица assistantKnowledge).
 * Все процедуры — только для администраторов.
 */

import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  ASSISTANT_KNOWLEDGE_CATEGORIES,
  createAssistantKnowledge,
  deleteAssistantKnowledge,
  listAssistantKnowledge,
  searchAssistantKnowledge,
  updateAssistantKnowledge,
} from "../assistantKnowledgeDb";

const assistantSchema = z.enum(["masha", "zoya", "shared"]);
const categorySchema = z.enum(ASSISTANT_KNOWLEDGE_CATEGORIES);
const tagsSchema = z.array(z.string().min(1).max(64)).max(20);

export const assistantKnowledgeRouter = router({
  categories: adminProcedure.query(() => [...ASSISTANT_KNOWLEDGE_CATEGORIES]),

  list: adminProcedure
    .input(
      z
        .object({
          assistant: assistantSchema.optional(),
          category: categorySchema.optional(),
          search: z.string().max(200).optional(),
          includeInactive: z.boolean().optional(),
          limit: z.number().int().min(1).max(200).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) =>
      listAssistantKnowledge({
        assistant: input?.assistant,
        category: input?.category,
        search: input?.search?.trim() || undefined,
        includeInactive: input?.includeInactive ?? true,
        limit: input?.limit,
        offset: input?.offset,
      }),
    ),

  /** Проверка поиска глазами ассистента: что вернёт search_knowledge. */
  preview: adminProcedure
    .input(z.object({ assistant: assistantSchema.default("masha"), query: z.string().min(2).max(200), category: categorySchema.optional() }))
    .query(async ({ input }) => searchAssistantKnowledge(input.assistant, input.query, { category: input.category, limit: 5 })),

  create: adminProcedure
    .input(
      z.object({
        assistant: assistantSchema.default("masha"),
        category: categorySchema,
        title: z.string().min(1).max(255),
        content: z.string().min(1).max(20_000),
        tags: tagsSchema.optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().min(0).max(100_000).optional(),
      }),
    )
    .mutation(async ({ input }) =>
      createAssistantKnowledge({
        assistant: input.assistant,
        category: input.category,
        title: input.title.trim(),
        content: input.content.trim(),
        tags: input.tags ?? [],
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      }),
    ),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        assistant: assistantSchema.optional(),
        category: categorySchema.optional(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).max(20_000).optional(),
        tags: tagsSchema.optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().min(0).max(100_000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const data = Object.fromEntries(
        Object.entries({
          ...rest,
          title: rest.title?.trim(),
          content: rest.content?.trim(),
        }).filter(([, value]) => value !== undefined),
      );
      return updateAssistantKnowledge(id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => ({ success: await deleteAssistantKnowledge(input.id) })),
});
