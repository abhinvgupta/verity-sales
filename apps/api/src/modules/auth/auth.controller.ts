import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginSchema, LoginDto } from './dto/login.dto';
import { SignupSchema, SignupDto } from './dto/signup.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body(new ZodValidationPipe(SignupSchema)) dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }
}
