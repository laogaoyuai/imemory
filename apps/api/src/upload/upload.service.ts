import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { UploadPresignRequest, UploadPresignResponse } from '@atlas/contracts';

import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UploadService {
  private readonly client: S3Client | null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {
    const storage = config.storage;
    this.client = storage.mode === 's3' ? new S3Client({
      region: storage.region,
      ...(storage.endpoint ? { endpoint: storage.endpoint } : {}),
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId ?? '',
        secretAccessKey: storage.secretAccessKey ?? '',
      },
    }) : null;
  }

  async presign(userId: string, input: UploadPresignRequest): Promise<UploadPresignResponse> {
    if (!this.client || !this.config.storage.bucket) {
      throw new ServiceUnavailableException({ code: 'storage_not_configured', message: '对象存储尚未配置' });
    }
    const safeName = input.fileName.normalize('NFKC').replace(/[^a-zA-Z0-9._\u4e00-\u9fff-]+/g, '-').slice(-100);
    const month = new Date().toISOString().slice(0, 7);
    const objectKey = `users/${userId}/${month}/${randomUUID()}-${safeName || 'upload'}`;
    const upload = await this.prisma.uploadObject.create({
      data: {
        ownerId: userId,
        objectKey,
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
      },
    });
    const expiresIn = 600;
    const command = new PutObjectCommand({
      Bucket: this.config.storage.bucket,
      Key: objectKey,
      ContentType: input.mimeType,
      ContentLength: input.size,
      Metadata: { 'atlas-upload-id': upload.id, 'atlas-user-id': userId },
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return {
      uploadId: upload.id,
      objectKey,
      uploadUrl,
      publicUrl: this.config.storage.publicBaseUrl
        ? `${this.config.storage.publicBaseUrl.replace(/\/$/, '')}/${objectKey.split('/').map(encodeURIComponent).join('/')}`
        : null,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      headers: { 'Content-Type': input.mimeType },
    };
  }
}
