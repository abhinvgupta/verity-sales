import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  PaginationSchema,
  PaginationDto,
} from "../../common/dto/pagination.dto";
import { JwtPayload } from "@verity/shared";
import { TemplatesService } from "./templates.service";
import {
  CreateTemplateSchema,
  CreateTemplateDto,
} from "./dto/create-template.dto";

@Controller("templates")
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Roles("company_admin")
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateTemplateSchema)) dto: CreateTemplateDto,
  ) {
    return this.templatesService.create(user.companyId, dto);
  }

  @Roles("company_admin", "manager")
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationDto,
  ) {
    return this.templatesService.findAll(
      user.companyId,
      query.page,
      query.limit,
    );
  }

  @Roles("company_admin", "manager")
  @Get("active")
  findActive(@CurrentUser() user: JwtPayload) {
    return this.templatesService.findActive(user.companyId);
  }

  @Roles("company_admin")
  @Patch(":id/activate")
  activate(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.templatesService.activate(id, user.companyId);
  }
}
