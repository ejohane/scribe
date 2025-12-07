#!/usr/bin/env node
/**
 * Generates all app icon formats from scribe-v1.png source
 * - icon.png (1024x1024) - for Linux and dev mode
 * - icon.icns - for macOS
 * - icon.ico - for Windows
 */

import sharp from 'sharp';
import { execSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const buildDir = join(rootDir, 'apps/desktop/build');

const SOURCE_ICON = join(rootDir, 'scribe-v1.png');

async function generateIcons() {
  console.log('Generating app icons from scribe-v1.png...\n');

  // 1. Copy source as icon.png (1024x1024)
  console.log('📄 Creating icon.png...');
  await sharp(SOURCE_ICON).resize(1024, 1024).png().toFile(join(buildDir, 'icon.png'));
  console.log('   ✅ icon.png (1024x1024)');

  // 2. Generate .icns for macOS using iconutil
  console.log('\n🍎 Creating icon.icns for macOS...');
  const iconsetDir = join(buildDir, 'icon.iconset');

  // Clean up any existing iconset
  rmSync(iconsetDir, { recursive: true, force: true });
  mkdirSync(iconsetDir, { recursive: true });

  // macOS iconset requires specific sizes
  const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];

  for (const size of icnsSizes) {
    // Standard resolution
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(join(iconsetDir, `icon_${size}x${size}.png`));

    // @2x (Retina) resolution - except for 1024 which is already max
    if (size <= 512) {
      await sharp(SOURCE_ICON)
        .resize(size * 2, size * 2)
        .png()
        .toFile(join(iconsetDir, `icon_${size}x${size}@2x.png`));
    }
  }

  // Use iconutil to create .icns
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${join(buildDir, 'icon.icns')}"`, {
      stdio: 'pipe',
    });
    console.log('   ✅ icon.icns');
  } catch (err) {
    console.error('   ❌ Failed to create .icns:', err.message);
  }

  // Clean up iconset directory
  rmSync(iconsetDir, { recursive: true, force: true });

  // 3. Generate .ico for Windows
  console.log('\n🪟 Creating icon.ico for Windows...');

  // ICO format needs multiple sizes embedded
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoPngs = [];

  for (const size of icoSizes) {
    const pngPath = join(buildDir, `icon-${size}.png`);
    await sharp(SOURCE_ICON).resize(size, size).png().toFile(pngPath);
    icoPngs.push(pngPath);
  }

  // Use png-to-ico to create proper .ico file
  try {
    const pngToIco = (await import('png-to-ico')).default;
    const icoBuffer = await pngToIco(icoPngs);
    const { writeFileSync } = await import('fs');
    writeFileSync(join(buildDir, 'icon.ico'), icoBuffer);
    console.log('   ✅ icon.ico');
  } catch (err) {
    console.error('   ❌ Failed to create .ico:', err.message);
  }

  // Clean up temporary PNG files
  for (const pngPath of icoPngs) {
    rmSync(pngPath, { force: true });
  }
  rmSync(join(buildDir, 'icon.ico.png'), { force: true });

  console.log('\n✨ Icon generation complete!');
  console.log(`   Source: ${SOURCE_ICON}`);
  console.log(`   Output: ${buildDir}/`);
}

generateIcons().catch(console.error);
