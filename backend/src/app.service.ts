import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      ok: true,
      service: 'proactive-backend',
      timestamp: new Date().toISOString()
    };
  }
}
