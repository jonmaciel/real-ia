import { adminWrite } from "@/lib/admin-write";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) { return adminWrite(req, (await params).id, "approve"); }
