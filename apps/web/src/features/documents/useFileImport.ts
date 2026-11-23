import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { DEFAULT_MAX_UPLOAD_MB, IMPORT_EXTENSIONS, IMPORT_SUPPORTED_LABEL } from '@ajaia/shared';
import { isApiError } from '../../lib/api';
import { useImportDocument } from './api';

const MAX_BYTES = DEFAULT_MAX_UPLOAD_MB * 1024 * 1024;

/** Client-side pre-checks give instant feedback; the server re-validates everything. */
export function validateImportFile(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  if (!(IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
    return `“${file.name}” can't be imported. Supported files: ${IMPORT_SUPPORTED_LABEL}.`;
  }
  if (file.size > MAX_BYTES) return `“${file.name}” is larger than ${DEFAULT_MAX_UPLOAD_MB} MB.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

export function useFileImport() {
  const navigate = useNavigate();
  const mutation = useImportDocument();

  const importFile = (file: File) => {
    const problem = validateImportFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const id = toast.loading(`Importing “${file.name}”…`);
    mutation.mutate(file, {
      onSuccess: (doc) => {
        toast.success(`Imported “${doc.title}”`, { id });
        navigate(`/d/${doc.id}`);
      },
      onError: (err) => {
        toast.error(isApiError(err) ? err.message : 'Import failed. Try again.', { id });
      },
    });
  };

  return { importFile, isImporting: mutation.isPending };
}
