import { readFile, writeFile } from 'node:fs/promises';
import { exists } from 'node:fs';
import { promisify } from 'node:util';

const fsExists = promisify(exists);

const BEGIN_MARKER = '<!-- BEGIN ACO GENERATED CONTEXT -->';
const END_MARKER = '<!-- END ACO GENERATED CONTEXT -->';

export async function getManagedBlockUpdate(filePath: string, content: string): Promise<string> {
  let fileContent = '';
  try {
    if (await fsExists(filePath)) {
      fileContent = await readFile(filePath, 'utf-8');
    }
  } catch {
    // If reading fails, start with empty string
  }

  const beginIndex = fileContent.indexOf(BEGIN_MARKER);
  const endIndex = fileContent.indexOf(END_MARKER);

  if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
    // Replace existing block
    const before = fileContent.slice(0, beginIndex);
    const after = fileContent.slice(endIndex + END_MARKER.length);
    return `${before}${BEGIN_MARKER}\n${content}\n${END_MARKER}${after}`;
  } else {
    // Append block if markers don't exist or are broken
    return `${fileContent.trimEnd()}\n\n${BEGIN_MARKER}\n${content}\n${END_MARKER}\n`;
  }
}

export async function updateManagedBlock(filePath: string, content: string): Promise<void> {
  const updatedContent = await getManagedBlockUpdate(filePath, content);
  await writeFile(filePath, updatedContent);
}
