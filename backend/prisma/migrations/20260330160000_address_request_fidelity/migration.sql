-- Add structured address components to address_requests for unit/apt fidelity
ALTER TABLE "address_requests"
ADD COLUMN "address_line2" TEXT,
ADD COLUMN "unit" TEXT;
