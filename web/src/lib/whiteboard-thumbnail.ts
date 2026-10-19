/** Link a replacement before deleting the previous thumbnail. Cleanup failure never rolls back the link. */
export async function replaceWhiteboardThumbnail({
  oldName,
  upload,
  link,
  remove,
  onCleanupError,
}: {
  oldName: string;
  upload: () => Promise<string>;
  link: (name: string) => Promise<unknown>;
  remove: (name: string) => Promise<unknown>;
  onCleanupError: (name: string, error: unknown) => void;
}): Promise<string> {
  const name = await upload();
  await link(name);
  if (oldName && oldName !== name) {
    try {
      await remove(oldName);
    } catch (error) {
      onCleanupError(oldName, error);
    }
  }
  return name;
}
