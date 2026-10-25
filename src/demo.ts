import { parsePackJson } from "./import";
import type { Attachment, PackInput } from "./model";

export interface DemoDataset {
  pack: PackInput;
  attachments: Record<string, Attachment>;
  files: Record<string, File>;
}

/** Load real, explicitly synthetic files and hash their bytes, just like uploads. */
export async function loadDemoDataset(): Promise<DemoDataset> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}demo/demo-pack.json`,
  );
  if (!response.ok) throw new Error("The demo dataset could not be loaded.");
  const parsed = parsePackJson(await response.text());
  if (!parsed.data || !parsed.data.demo)
    throw new Error(
      "The demo dataset is invalid or lacks its synthetic marker.",
    );
  const pack = parsed.data;
  const files: Record<string, File> = Object.create(null);
  const attachments: Record<string, Attachment> = Object.create(null);
  await Promise.all(
    pack.evidence.map(async (record) => {
      if (!/^[A-Z0-9-]+\.json$/.test(record.originalFilename))
        throw new Error(`Invalid demo source filename for ${record.id}.`);
      const result = await fetch(
        `${import.meta.env.BASE_URL}demo/sources/${record.originalFilename}`,
      );
      if (!result.ok)
        throw new Error(`Missing demo source ${record.originalFilename}.`);
      const bytes = await result.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (sha256 !== record.declaredSha256)
        throw new Error(
          `Demo source hash mismatch for ${record.id}. Reload after deployment completes.`,
        );
      const file = new File([bytes], record.originalFilename, {
        type: "application/json",
      });
      files[record.id] = file;
      attachments[record.id] = {
        name: file.name,
        sha256,
        capturedAt: new Date().toISOString(),
        size: file.size,
      };
    }),
  );
  return { pack, attachments, files };
}
