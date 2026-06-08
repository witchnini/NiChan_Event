import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const log = (msg: string) => console.log(msg);

/**
 * Backfill: tạo bản ghi Document cho các hợp đồng đã được gửi cho khách hàng
 * trước khi tính năng tự tạo tài liệu được thêm vào.
 *
 * Tiêu chí: contract.sentAt != null (đã từng gửi) và chưa có Document nào
 * gắn với contractId đó. Mỗi hợp đồng tạo tối đa một tài liệu.
 *
 * Chạy: npm run db:backfill-contract-documents
 */
async function main() {
  const contracts = await prisma.contract.findMany({
    where: { sentAt: { not: null } },
    include: {
      versions: { take: 1, orderBy: { createdAt: "desc" }, select: { documentUrl: true } },
    },
  });

  log(`Tìm thấy ${contracts.length} hợp đồng đã gửi (sentAt != null).`);

  let created = 0;
  let skipped = 0;

  for (const contract of contracts) {
    const existingDoc = await prisma.document.findFirst({
      where: { contractId: contract.id },
    });
    if (existingDoc) {
      skipped++;
      continue;
    }

    await prisma.document.create({
      data: {
        eventId: contract.eventId,
        contractId: contract.id,
        name: `Hợp đồng ${contract.contractCode}`,
        fileType: "Hợp đồng",
        fileUrl: contract.versions[0]?.documentUrl ?? "",
        uploadedById: contract.createdById,
        status: "sent",
      },
    });
    created++;
    log(`  ✅ Đã tạo tài liệu cho hợp đồng ${contract.contractCode}`);
  }

  log(`Hoàn tất. Tạo mới: ${created}, bỏ qua (đã có tài liệu): ${skipped}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
