import { adminWrite } from "@/lib/admin-write";
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) { const { id, action } = await params; return adminWrite(req, id, action === "update" ? "invalid" : action); }
