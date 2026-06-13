import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PaginationMeta } from '@verity/shared';
import { UserDocument } from '../../database/schemas';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly usersRepo: UsersRepository) {}

  /** Creates a manager or rep scoped to the caller's company. */
  async create(companyId: string, dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.usersRepo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    this.logger.log(`Creating user: ${dto.email} (${dto.role})`);
    return this.usersRepo.create({ companyId, ...dto, passwordHash });
  }

  /** Returns paginated users scoped to the caller's company. */
  findAll(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ data: UserDocument[]; meta: PaginationMeta }> {
    return this.usersRepo.findAll(companyId, page, limit);
  }

  /** Returns a single user scoped to the caller's company. */
  async findById(id: string, companyId: string): Promise<UserDocument> {
    const user = await this.usersRepo.findById(id, companyId);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /** Updates name or active status of a user. */
  async update(
    id: string,
    companyId: string,
    dto: UpdateUserDto,
  ): Promise<UserDocument> {
    const user = await this.usersRepo.update(id, companyId, dto);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /** Soft-deletes a user by setting isActive to false. */
  async deactivate(id: string, companyId: string): Promise<UserDocument> {
    const user = await this.usersRepo.deactivate(id, companyId);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    this.logger.log(`Deactivated user ${id}`);
    return user;
  }
}
