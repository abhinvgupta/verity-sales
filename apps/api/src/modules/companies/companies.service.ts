import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PaginationMeta } from '@verity/shared';
import { CompanyDocument } from '../../database/schemas';
import { CompaniesRepository } from './companies.repository';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly companiesRepo: CompaniesRepository) {}

  /** Creates a new tenant company. Slug must be globally unique. */
  async create(dto: CreateCompanyDto): Promise<CompanyDocument> {
    const existing = await this.companiesRepo.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }
    this.logger.log(`Creating company: ${dto.name}`);
    return this.companiesRepo.create(dto);
  }

  /** Returns a company by its globally-unique slug, or null if none exists. */
  findBySlug(slug: string): Promise<CompanyDocument | null> {
    return this.companiesRepo.findBySlug(slug);
  }

  /** Returns a paginated list of all companies. */
  findAll(
    page: number,
    limit: number,
  ): Promise<{ data: CompanyDocument[]; meta: PaginationMeta }> {
    return this.companiesRepo.findAll(page, limit);
  }

  /** Returns a single company by ID. Throws if not found. */
  async findById(id: string): Promise<CompanyDocument> {
    const company = await this.companiesRepo.findById(id);
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    return company;
  }

  /** Updates a company. Throws if not found. */
  async update(id: string, dto: UpdateCompanyDto): Promise<CompanyDocument> {
    const company = await this.companiesRepo.update(id, dto);
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    return company;
  }
}
