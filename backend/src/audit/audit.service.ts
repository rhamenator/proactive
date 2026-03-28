import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditWriter = PrismaService | Prisma.TransactionClient | PrismaClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    input: {
      actorUserId?: string | null;
      actionType: string;
      entityType: string;
      entityId: string;
      reasonCode?: string;
      reasonText?: string;
      oldValuesJson?: Prisma.InputJsonValue;
      newValuesJson?: Prisma.InputJsonValue;
      ipAddress?: string;
      deviceId?: string;
      userAgent?: string;
    },
    db: AuditWriter = this.prisma
  ) {
    return db.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
        oldValuesJson: input.oldValuesJson,
        newValuesJson: input.newValuesJson,
        ipAddress: input.ipAddress,
        deviceId: input.deviceId,
        userAgent: input.userAgent
      }
    });
  }
}
