-- CreateTable
CREATE TABLE "DnsBaseline" (
    "id" UUID NOT NULL,
    "monitorId" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "host" TEXT NOT NULL,
    "organizationDomain" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnsBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnsChange" (
    "id" UUID NOT NULL,
    "monitorId" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnsChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DnsBaseline_monitorId_key" ON "DnsBaseline"("monitorId");

-- CreateIndex
CREATE UNIQUE INDEX "DnsBaseline_scanId_key" ON "DnsBaseline"("scanId");

-- CreateIndex
CREATE UNIQUE INDEX "DnsChange_scanId_key" ON "DnsChange"("scanId");

-- CreateIndex
CREATE INDEX "DnsChange_monitorId_observedAt_idx" ON "DnsChange"("monitorId", "observedAt");

-- AddForeignKey
ALTER TABLE "DnsBaseline" ADD CONSTRAINT "DnsBaseline_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsBaseline" ADD CONSTRAINT "DnsBaseline_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsChange" ADD CONSTRAINT "DnsChange_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsChange" ADD CONSTRAINT "DnsChange_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
