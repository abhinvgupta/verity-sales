import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { JwtPayload } from "@verity/shared";
import { CompaniesService } from "../companies/companies.service";
import { AuthRepository } from "./auth.repository";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly companiesService: CompaniesService,
  ) {}

  /** Validates credentials and returns a signed JWT access token. */
  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.authRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload: JwtPayload = {
      sub: user._id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
    };

    this.logger.log(`User logged in: ${user.email}`);
    return { accessToken: this.jwtService.sign(payload) };
  }

  /** Creates a new company and company_admin user, returns a signed JWT. */
  async signup(dto: SignupDto): Promise<{ accessToken: string }> {
    const existing = await this.authRepo.findByEmail(dto.email);
    if (existing) throw new ConflictException("Email already registered");

    let company = await this.companiesService.findBySlug(dto.companySlug);
    if (!company) {
      company = await this.companiesService.create({
        name: dto.companyName,
        slug: dto.companySlug,
        plan: "starter",
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.authRepo.createUser({
      companyId: company._id,
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: "company_admin",
    });

    const payload: JwtPayload = {
      sub: user._id,
      companyId: company._id,
      role: user.role,
      email: user.email,
    };

    this.logger.log(
      `Signup complete: ${dto.email} (company: ${dto.companySlug})`,
    );
    return { accessToken: this.jwtService.sign(payload) };
  }
}
