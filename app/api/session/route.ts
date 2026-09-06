import { requireContext } from '@/db/session';
import { errorResponse, json } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    const context = await requireContext(request);
    return json({
      user: context.user,
      workspace: context.workspace,
      role: context.role,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
