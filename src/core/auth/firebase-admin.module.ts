import { Global, Module } from '@nestjs/common';

import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseAuthService } from './firebase-auth.service';

@Global()
@Module({
  providers: [FirebaseAuthService, FirebaseAuthGuard],
  exports: [FirebaseAuthService, FirebaseAuthGuard],
})
export class FirebaseAdminModule {}
