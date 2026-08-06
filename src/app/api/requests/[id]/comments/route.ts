export const dynamic = "force-dynamic";

import { created, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { requestCommentSchema } from "@/lib/validation";
import { addComment } from "@/lib/request-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requireAuth();
  const input = requestCommentSchema.parse(await req.json());
  const comment = await addComment(params.id, input, session);
  return created(comment);
});
