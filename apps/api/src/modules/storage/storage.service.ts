import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_EXPIRY_SECONDS = 15 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 60 * 60;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3Client({
      region: configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: configService.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucket = configService.getOrThrow<string>('S3_BUCKET_NAME');
  }

  /** Builds the canonical S3 key for a transcript file. */
  getTranscriptKey(companyId: string, callId: string, filename: string): string {
    return `transcripts/${companyId}/${callId}/${filename}`;
  }

  /** Builds the canonical S3 key for a rep form image. */
  getFormKey(companyId: string, callId: string, filename: string): string {
    return `forms/${companyId}/${callId}/${filename}`;
  }

  /** Returns a presigned URL the client uses to upload a transcript directly to S3. */
  getUploadPresignedUrl(key: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: UPLOAD_EXPIRY_SECONDS });
  }

  /** Uploads a transcript (file buffer or raw text) to S3 server-side. */
  async uploadTranscript(
    key: string,
    body: Buffer | string,
    contentType = 'text/plain',
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.log(`Uploaded transcript to S3: ${key}`);
  }

  /** Uploads a rep form image buffer to S3 server-side. */
  async uploadForm(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.log(`Uploaded form image to S3: ${key}`);
  }

  /** Returns a presigned URL for downloading a transcript or form. */
  getDownloadPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: DOWNLOAD_EXPIRY_SECONDS });
  }

  /** Downloads and returns the full text content of a transcript from S3.
   *  Called by the analysis processor to build the LLM prompt. */
  async getTranscriptText(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.s3.send(command);
    if (!response.Body) {
      throw new Error(`Empty S3 response for key: ${key}`);
    }
    const text = await response.Body.transformToString();
    this.logger.log(`Fetched transcript from S3: ${key}`);
    return text;
  }
}
