import sharp from "sharp";
import { writeFileSync } from "fs";
import { join } from "path";

const src =
  "C:/Users/User/.cursor/projects/c-Users-User-Desktop-denisov/assets/favicon-denisov.jpg";
const appDir = "C:/Users/User/Desktop/denisov/src/app";
const pubDir = "C:/Users/User/Desktop/denisov/public";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Денисов">
  <rect width="64" height="64" rx="14" fill="#FBF8F1"/>
  <text x="32" y="44" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="36" font-weight="600" fill="#211E19">D</text>
  <rect x="18" y="50" width="28" height="2" rx="1" fill="#9C6B4A"/>
</svg>`;

writeFileSync(join(pubDir, "favicon.svg"), svg);

const svgBuf = Buffer.from(svg);

await sharp(svgBuf).png().resize(16, 16).toFile(join(pubDir, "favicon-16.png"));
await sharp(svgBuf).png().resize(32, 32).toFile(join(pubDir, "favicon-32.png"));
await sharp(svgBuf).png().resize(32, 32).toFile(join(pubDir, "favicon.png"));
await sharp(svgBuf).png().resize(180, 180).toFile(join(appDir, "apple-icon.png"));
await sharp(svgBuf).png().resize(512, 512).toFile(join(appDir, "icon.png"));
await sharp(src).resize(512, 512, { fit: "cover" }).png().toFile(
  join(pubDir, "images/favicon-brand.png"),
);

console.log("favicon files written");
