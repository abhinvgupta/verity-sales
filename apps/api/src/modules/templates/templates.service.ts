import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PaginationMeta } from '@verity/shared';
import { EvaluationTemplateDocument } from '../../database/schemas';
import { TemplatesRepository } from './templates.repository';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly templatesRepo: TemplatesRepository) {}

  /** Creates a new template (inactive by default). */
  create(
    companyId: string,
    dto: CreateTemplateDto,
  ): Promise<EvaluationTemplateDocument> {
    this.logger.log(`Creating template for company ${companyId}`);
    return this.templatesRepo.create(companyId, dto);
  }

  /** Returns all templates for the company, newest first. */
  findAll(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ data: EvaluationTemplateDocument[]; meta: PaginationMeta }> {
    return this.templatesRepo.findAll(companyId, page, limit);
  }

  /** Returns the currently active template. Throws if none is active. */
  async findActive(companyId: string): Promise<EvaluationTemplateDocument> {
    const template = await this.templatesRepo.findActive(companyId);
    if (!template) {
      throw new NotFoundException('No active template found for this company');
    }
    return template;
  }

  /**
   * Activates the given template and deactivates all others for the company.
   * Used internally by analysis processor to fetch the active template.
   */
  async activate(
    id: string,
    companyId: string,
  ): Promise<EvaluationTemplateDocument> {
    const exists = await this.templatesRepo.findById(id, companyId);
    if (!exists) throw new NotFoundException(`Template ${id} not found`);

    await this.templatesRepo.deactivateAll(companyId);
    const template = await this.templatesRepo.activate(id, companyId);
    if (!template) throw new NotFoundException(`Template ${id} not found`);

    this.logger.log(`Activated template ${id} for company ${companyId}`);
    return template;
  }
}
