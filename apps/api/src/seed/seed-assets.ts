import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export interface SeedAssetMeta {
  filename: string;
  contentType: string;
  sha256: string;
  localPath: string;
}

const SEED_ASSETS_DIR = path.resolve(process.cwd(), 'apps/api/seed-assets');

function generateSvgAvatar(name: string, bg1: string, bg2: string, text: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="32" fill="url(#grad)" />
  <circle cx="200" cy="150" r="70" fill="#ffffff" fill-opacity="0.85" />
  <path d="M 80 340 C 80 250, 320 250, 320 340 Z" fill="#ffffff" fill-opacity="0.85" />
  <text x="200" y="380" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">${name}</text>
  <text x="200" y="160" font-family="system-ui, sans-serif" font-size="36" font-weight="900" fill="${bg1}" text-anchor="middle">${text}</text>
</svg>`;
}

export function ensureSeedAssets(): Record<string, SeedAssetMeta> {
  if (!fs.existsSync(SEED_ASSETS_DIR)) {
    fs.mkdirSync(SEED_ASSETS_DIR, { recursive: true });
  }

  const assets: Record<string, { bg1: string; bg2: string; label: string; text: string }> = {
    'usr_001.svg': { bg1: '#1e293b', bg2: '#0f172a', label: 'Robert Vance', text: 'RV' },
    'usr_002.svg': { bg1: '#0284c7', bg2: '#0369a1', label: 'Sarah Vance', text: 'SV' },
    'usr_003.svg': { bg1: '#059669', bg2: '#047857', label: 'Marcus Chen', text: 'MC' },
    'usr_004.svg': { bg1: '#d97706', bg2: '#b45309', label: 'James Kelly', text: 'JK' },
    'usr_005.svg': { bg1: '#7c3aed', bg2: '#6d28d9', label: 'Marcus Brody', text: 'MB' },
    'usr_006.svg': { bg1: '#db2777', bg2: '#be185d', label: 'Elena Rostova', text: 'ER' },
    'usr_007.svg': { bg1: '#4b5563', bg2: '#374151', label: 'David Kim', text: 'DK' },
    'usr_mob_01.svg': { bg1: '#0d9488', bg2: '#0f766e', label: 'Operator Live', text: 'OP' },
    'usr_mob_02.svg': { bg1: '#ea580c', bg2: '#c2410c', label: 'Operator Pending', text: 'PND' },
    'ref_maya_lin_front.svg': { bg1: '#3b82f6', bg2: '#1d4ed8', label: 'Maya Lin - Front', text: 'ML' },
    'ref_maya_lin_body.svg': { bg1: '#6366f1', bg2: '#4338ca', label: 'Maya Lin - Body', text: 'ML' },
    'ref_maya_chen_front.svg': { bg1: '#ec4899', bg2: '#be185d', label: 'Maya Chen - Front', text: 'MC' },
    'ref_maya_chen_profile.svg': { bg1: '#f43f5e', bg2: '#e11d48', label: 'Maya Chen - Profile', text: 'MC' },
    'ref_david_kim_front.svg': { bg1: '#64748b', bg2: '#475569', label: 'David Kim - Front', text: 'DK' },
    'ref_elena_rostova_front.svg': { bg1: '#8b5cf6', bg2: '#7c3aed', label: 'Elena Rostova - Front', text: 'ER' },
    'crop_cam001.svg': { bg1: '#334155', bg2: '#1e293b', label: 'CAM-001 Turnstiles', text: 'C01' },
    'crop_cam002.svg': { bg1: '#334155', bg2: '#1e293b', label: 'CAM-002 Gate 12', text: 'C02' },
    'crop_cam003.svg': { bg1: '#334155', bg2: '#1e293b', label: 'CAM-003 Corridor B', text: 'C03' },
    'crop_cam005.svg': { bg1: '#334155', bg2: '#1e293b', label: 'CAM-005 Platform 3', text: 'C05' },
    'crop_cam007.svg': { bg1: '#334155', bg2: '#1e293b', label: 'CAM-007 Gate 4', text: 'C07' },
  };

  const manifest: Record<string, SeedAssetMeta> = {};

  for (const [filename, info] of Object.entries(assets)) {
    const fullPath = path.join(SEED_ASSETS_DIR, filename);
    const content = generateSvgAvatar(info.label, info.bg1, info.bg2, info.text);
    fs.writeFileSync(fullPath, content, 'utf8');

    const hash = createHash('sha256').update(content).digest('hex');
    manifest[filename] = {
      filename,
      contentType: 'image/svg+xml',
      sha256: hash,
      localPath: fullPath,
    };
  }

  return manifest;
}
