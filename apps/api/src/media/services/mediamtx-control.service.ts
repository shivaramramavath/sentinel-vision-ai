import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaMtxControlService {
  private readonly logger = new Logger(MediaMtxControlService.name);
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>(
      'app.mediamtxApiUrl',
      'http://localhost:9997',
    );
  }

  /**
   * Dynamically configures a camera path in MediaMTX to pull from an RTSP source.
   */
  async addCameraPath(
    pathName: string,
    rtspSource: string,
    sourceOnDemand = false,
  ): Promise<boolean> {
    const cleanPath = pathName.replace(/^\/+/, '');
    const url = `${this.apiUrl}/v3/config/paths/add/${cleanPath}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: rtspSource,
          sourceOnDemand,
          rtspTransport: 'tcp',
        }),
      });

      if (response.ok || response.status === 400) {
        // 400 often means path already exists; in which case we patch it
        if (response.status === 400) {
          await this.patchCameraPath(cleanPath, rtspSource, sourceOnDemand);
        }
        this.logger.log(`MediaMTX configured path '${cleanPath}' -> ${rtspSource.replace(/:[^:@]+@/, ':***@')}`);
        return true;
      }
      this.logger.warn(`MediaMTX add path returned status ${response.status}`);
      return false;
    } catch (err: any) {
      this.logger.debug(`MediaMTX API offline or unreachable (${err.message}) - path queued for next poller cycle`);
      return false;
    }
  }

  /**
   * Patches an existing path in MediaMTX.
   */
  async patchCameraPath(
    pathName: string,
    rtspSource: string,
    sourceOnDemand = false,
  ): Promise<boolean> {
    const cleanPath = pathName.replace(/^\/+/, '');
    const url = `${this.apiUrl}/v3/config/paths/patch/${cleanPath}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: rtspSource,
          sourceOnDemand,
          rtspTransport: 'tcp',
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Deletes a camera path from MediaMTX.
   */
  async removeCameraPath(pathName: string): Promise<boolean> {
    const cleanPath = pathName.replace(/^\/+/, '');
    const url = `${this.apiUrl}/v3/config/paths/delete/${cleanPath}`;

    try {
      const response = await fetch(url, { method: 'DELETE' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Queries active paths and their current telemetry from MediaMTX.
   */
  async listActivePaths(): Promise<any[]> {
    const url = `${this.apiUrl}/v3/paths/list`;
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      const data: any = await response.json();
      return data.items || [];
    } catch {
      return [];
    }
  }
}
