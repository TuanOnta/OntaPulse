-- CreateTable
CREATE TABLE "MonitorEdgeProfile" (
    "id" UUID NOT NULL,
    "monitorId" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "challengeObserved" BOOLEAN NOT NULL DEFAULT false,
    "detections" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorEdgeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitorEdgeProfile_monitorId_key" ON "MonitorEdgeProfile"("monitorId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorEdgeProfile_scanId_key" ON "MonitorEdgeProfile"("scanId");

-- AddForeignKey
ALTER TABLE "MonitorEdgeProfile" ADD CONSTRAINT "MonitorEdgeProfile_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorEdgeProfile" ADD CONSTRAINT "MonitorEdgeProfile_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
